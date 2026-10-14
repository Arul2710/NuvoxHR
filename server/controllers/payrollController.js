const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const asyncHandler = require('../utils/asyncHandler');
const { computePayroll, buildSlipNumber, MONTHS } = require('../services/payrollService');
const { createNotification } = require('../services/notificationService');

const STATUS_FLOW = ['Draft', 'Reviewed', 'Approved', 'Paid'];

function periodKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function sanitizeId(value) {
  return value && /^[0-9a-fA-F]{24}$/.test(String(value)) ? value : null;
}

// @route GET /api/payroll
const listPayroll = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 200);
  const filter = {};

  if (req.query.year && req.query.month !== undefined && req.query.month !== '') {
    filter.periodKey = periodKey(parseInt(req.query.year, 10), parseInt(req.query.month, 10));
  } else if (req.query.periodKey) {
    filter.periodKey = String(req.query.periodKey);
  }
  if (req.query.status && STATUS_FLOW.includes(req.query.status)) filter.status = req.query.status;

  const employeeFilter = {};
  if (req.query.department) employeeFilter.department = sanitizeId(req.query.department);
  if (req.query.search) {
    const re = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    employeeFilter.$or = [{ firstName: re }, { lastName: re }, { employeeId: re }, { email: re }];
  }
  if (Object.keys(employeeFilter).length) {
    const emps = await Employee.find(employeeFilter).select('_id').lean();
    filter.employee = { $in: emps.map((e) => e._id) };
  }

  const [total, items] = await Promise.all([
    Payroll.countDocuments(filter),
    Payroll.find(filter)
      .sort({ periodKey: -1, employeeId: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate({ path: 'employee', select: 'firstName lastName employeeId email profilePhoto department designation', populate: 'department designation' })
      .lean(),
  ]);

  res.json({ success: true, data: items, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
});

// @route GET /api/payroll/summary
const payrollSummary = asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const month = req.query.month !== undefined && req.query.month !== '' ? parseInt(req.query.month, 10) : new Date().getMonth();
  const key = periodKey(year, month);

  const [agg] = await Payroll.aggregate([
    { $match: { periodKey: key } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        gross: { $sum: '$grossEarnings' },
        net: { $sum: '$netSalary' },
        deductions: { $sum: '$totalDeductions' },
      },
    },
  ]);

  const byStatus = { Draft: 0, Reviewed: 0, Approved: 0, Paid: 0 };
  const rows = await Payroll.find({ periodKey: key }).select('status grossEarnings totalDeductions netSalary').lean();
  let gross = 0;
  let net = 0;
  let deductions = 0;
  rows.forEach((r) => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    gross += r.grossEarnings || 0;
    net += r.netSalary || 0;
    deductions += r.totalDeductions || 0;
  });

  res.json({
    success: true,
    data: {
      periodKey: key,
      periodLabel: `${MONTHS[month]} ${year}`,
      year,
      month,
      total: rows.length,
      byStatus,
      totals: { gross: Math.round(gross), deductions: Math.round(deductions), net: Math.round(net) },
    },
  });
});

// @route POST /api/payroll/generate
const generatePayroll = asyncHandler(async (req, res) => {
  const year = parseInt(req.body.year, 10);
  const month = parseInt(req.body.month, 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 0 || month > 11) {
    return res.status(400).json({ success: false, message: 'A valid payroll year and month are required' });
  }
  const key = periodKey(year, month);
  const overwrite = req.body.overwrite === true;
  const employeeIds = Array.isArray(req.body.employeeIds) ? req.body.employeeIds.map(sanitizeId).filter(Boolean) : [];

  const filter = { status: 'Active' };
  if (employeeIds.length) filter._id = { $in: employeeIds };
  if (req.body.department) filter.department = sanitizeId(req.body.department);

  const employees = await Employee.find(filter).select('+salary +payroll +weekOff').populate('department');
  if (!employees.length) {
    return res.status(400).json({ success: false, message: 'No active employees matched the selection' });
  }

  const existing = await Payroll.find({ periodKey: key }).select('employee status').lean();
  const existingMap = new Map(existing.map((p) => [String(p.employee), p]));

  const created = [];
  const updated = [];
  const skipped = [];
  const failed = [];

  for (const emp of employees) {
    const prev = existingMap.get(String(emp._id));
    if (prev) {
      if (!overwrite || prev.status !== 'Draft') {
        skipped.push({ employeeId: emp.employeeId, reason: prev.status === 'Draft' ? 'Already generated' : `Locked (${prev.status})` });
        continue;
      }
    }
    try {
      const computed = await computePayroll(emp, year, month);
      const payload = {
        ...computed,
        status: 'Draft',
        slipNumber: buildSlipNumber(emp.employeeId, year, month),
        generatedBy: req.user.id,
        generatedByName: req.user.name || '',
        generatedAt: new Date(),
        adjustments: prev ? undefined : [],
      };
      if (prev) {
        delete payload.adjustments;
        const doc = await Payroll.findOneAndUpdate(
          { employee: emp._id, periodKey: key, status: 'Draft' },
          { $set: payload },
          { new: true }
        );
        if (doc) updated.push(doc._id);
        else skipped.push({ employeeId: emp.employeeId, reason: 'Locked' });
      } else {
        const doc = await Payroll.create({ ...payload, adjustments: [] });
        created.push(doc._id);
      }
    } catch (err) {
      failed.push({ employeeId: emp.employeeId, reason: err.message });
    }
  }

  res.status(201).json({
    success: true,
    message: `Payroll generated for ${MONTHS[month]} ${year}. Created ${created.length}, updated ${updated.length}, skipped ${skipped.length}.`,
    data: { periodKey: key, created: created.length, updated: updated.length, skipped, failed },
  });
});

// @route GET /api/payroll/:id
const getPayroll = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id)
    .populate({ path: 'employee', select: 'firstName lastName employeeId email profilePhoto department designation bankDetails', populate: 'department designation' })
    .lean();
  if (!payroll) return res.status(404).json({ success: false, message: 'Payroll record not found' });
  res.json({ success: true, data: payroll });
});

// @route PUT /api/payroll/:id/status
const updatePayrollStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!STATUS_FLOW.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid payroll status' });
  }
  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) return res.status(404).json({ success: false, message: 'Payroll record not found' });

  const currentIdx = STATUS_FLOW.indexOf(payroll.status);
  const nextIdx = STATUS_FLOW.indexOf(status);
  if (nextIdx < currentIdx) {
    return res.status(400).json({ success: false, message: `Payroll cannot move back from ${payroll.status} to ${status}` });
  }
  if (nextIdx === currentIdx) {
    return res.json({ success: true, message: `Payroll is already ${status}`, data: payroll });
  }

  payroll.status = status;
  if (status === 'Reviewed') {
    payroll.reviewedBy = req.user.id;
    payroll.reviewedAt = new Date();
  }
  if (status === 'Approved') {
    payroll.approvedBy = req.user.id;
    payroll.approvedAt = new Date();
  }
  if (status === 'Paid') {
    payroll.paidBy = req.user.id;
    payroll.paidAt = new Date();
  }
  await payroll.save();

  if (status === 'Paid') {
    const emp = await Employee.findById(payroll.employee);
    const user = require('../models/User');
    const u = await user.findOne({ employee: payroll.employee });
    if (u) {
      await createNotification({
        user: u._id,
        title: 'Salary processed',
        message: `Your salary for ${MONTHS[payroll.month]} ${payroll.year} has been processed. Net pay: ${payroll.currency} ${payroll.netSalary}.`,
        type: 'success',
        link: '/employee',
      });
    }
    void emp;
  }

  res.json({ success: true, message: `Payroll marked as ${status}`, data: payroll });
});

// @route POST /api/payroll/:id/adjust
const adjustPayroll = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) return res.status(404).json({ success: false, message: 'Payroll record not found' });

  const label = String(req.body.label || '').trim();
  const reason = String(req.body.reason || '').trim();
  const amount = Number(req.body.amount);
  const type = req.body.type === 'deduction' ? 'deduction' : 'earning';
  if (!label) return res.status(400).json({ success: false, message: 'Adjustment label is required' });
  if (!Number.isFinite(amount) || amount === 0) return res.status(400).json({ success: false, message: 'Enter a non-zero adjustment amount' });
  if (!reason) return res.status(400).json({ success: false, message: 'A reason is required for every payroll adjustment' });

  payroll.adjustments.push({ label, amount: Math.abs(amount), type, reason, by: req.user.id, byName: req.user.name || '', at: new Date() });
  if (type === 'earning') payroll.earnings.push({ label, amount: Math.abs(amount), category: 'adjustment' });
  else payroll.deductions.push({ label, amount: Math.abs(amount), category: 'adjustment' });

  const gross = payroll.earnings.reduce((s, e) => s + (e.amount || 0), 0);
  const totalDeductions = payroll.deductions.reduce((s, d) => s + (d.amount || 0), 0);
  payroll.grossEarnings = Math.round(gross * 100) / 100;
  payroll.totalDeductions = Math.round(totalDeductions * 100) / 100;
  payroll.netSalary = Math.round((payroll.grossEarnings - payroll.totalDeductions) * 100) / 100;
  await payroll.save();

  res.json({ success: true, message: 'Payroll adjustment recorded', data: payroll });
});

// @route DELETE /api/payroll/:id   (draft only)
const deletePayroll = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id);
  if (!payroll) return res.status(404).json({ success: false, message: 'Payroll record not found' });
  if (payroll.status !== 'Draft') {
    return res.status(400).json({ success: false, message: 'Only draft payroll can be deleted. Use an adjustment for locked records.' });
  }
  await payroll.deleteOne();
  res.json({ success: true, message: 'Draft payroll deleted' });
});

module.exports = { listPayroll, payrollSummary, generatePayroll, getPayroll, updatePayrollStatus, adjustPayroll, deletePayroll };
