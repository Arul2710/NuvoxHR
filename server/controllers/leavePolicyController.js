const LeavePolicy = require('../models/LeavePolicy');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const Employee = require('../models/Employee');
const asyncHandler = require('../utils/asyncHandler');

const LEAVE_TYPES = ['Sick Leave', 'Casual Leave', 'Earned Leave', 'Maternity Leave', 'Paternity Leave', 'Unpaid Leave', 'Compensatory Off', 'Other'];

function sanitizePolicy(body = {}) {
  const errors = [];
  const name = String(body.name || '').trim();
  const code = String(body.code || '').trim().toUpperCase();
  const leaveType = LEAVE_TYPES.includes(body.leaveType) ? body.leaveType : null;
  if (!name) errors.push('Policy name is required');
  if (!code) errors.push('Policy code is required');
  if (!leaveType) errors.push('A valid leave type is required');
  const allowance = Number(body.allowance);
  if (!Number.isFinite(allowance) || allowance < 0) errors.push('Allowance must be zero or greater');

  return {
    errors,
    payload: {
      name,
      code: code.replace(/\s+/g, '_'),
      leaveType,
      allowanceType: body.allowanceType === 'Monthly' ? 'Monthly' : 'Annual',
      allowance: Math.max(0, Number(allowance) || 0),
      paid: body.paid !== false,
      maxConsecutiveDays: Math.max(0, Number(body.maxConsecutiveDays) || 0),
      carryForward: {
        enabled: !!(body.carryForward && body.carryForward.enabled),
        maxDays: Math.max(0, Number(body.carryForward?.maxDays) || 0),
      },
      approvalRequired: body.approvalRequired !== false,
      documentRequired: !!body.documentRequired,
      applicableGroups: Array.isArray(body.applicableGroups) ? body.applicableGroups.map((g) => String(g).trim()).filter(Boolean) : [],
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date(),
      description: String(body.description || '').trim().slice(0, 300),
      active: body.active !== false,
    },
  };
}

// @route GET /api/leave-policies
const listPolicies = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.active === 'true') filter.active = true;
  if (req.query.includeInactive !== 'true') filter.active = { $ne: false };
  const policies = await LeavePolicy.find(filter).sort({ leaveType: 1, name: 1 }).lean();
  res.json({ success: true, data: policies });
});

// @route POST /api/leave-policies
const createPolicy = asyncHandler(async (req, res) => {
  const { errors, payload } = sanitizePolicy(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: errors[0] });
  const dup = await LeavePolicy.findOne({ code: payload.code });
  if (dup) return res.status(409).json({ success: false, message: `A leave policy with code ${payload.code} already exists` });
  const policy = await LeavePolicy.create(payload);
  res.status(201).json({ success: true, message: 'Leave policy created', data: policy });
});

// @route PUT /api/leave-policies/:id
const updatePolicy = asyncHandler(async (req, res) => {
  const policy = await LeavePolicy.findById(req.params.id);
  if (!policy) return res.status(404).json({ success: false, message: 'Leave policy not found' });
  const { errors, payload } = sanitizePolicy({ ...policy.toObject(), ...req.body });
  if (errors.length) return res.status(400).json({ success: false, message: errors[0] });
  Object.assign(policy, payload);
  await policy.save();
  res.json({ success: true, message: 'Leave policy updated', data: policy });
});

// @route DELETE /api/leave-policies/:id
const deletePolicy = asyncHandler(async (req, res) => {
  const policy = await LeavePolicy.findById(req.params.id);
  if (!policy) return res.status(404).json({ success: false, message: 'Leave policy not found' });
  policy.active = false;
  await policy.save();
  res.json({ success: true, message: 'Leave policy deactivated' });
});

// Compute balances for a set of employees for a given year.
async function computeBalances(employees, year) {
  const employeeIds = employees.map((e) => e._id);
  const [policies, approved, overrides] = await Promise.all([
    LeavePolicy.find({ active: { $ne: false } }).lean(),
    Leave.aggregate([
      { $match: { employee: { $in: employeeIds }, status: 'Approved', startDate: { $lt: new Date(year + 1, 0, 1) }, endDate: { $gte: new Date(year, 0, 1) } } },
      { $group: { _id: { employee: '$employee', leaveType: '$leaveType' }, used: { $sum: '$days' } } },
    ]),
    LeaveBalance.find({ year, employee: { $in: employeeIds } }).lean(),
  ]);

  const usedMap = {};
  approved.forEach((a) => {
    usedMap[`${a._id.employee}-${a._id.leaveType}`] = a.used;
  });
  const overrideMap = {};
  overrides.forEach((o) => {
    overrideMap[`${o.employee}-${o.leaveType}`] = o;
  });

  const rows = [];
  employees.forEach((emp) => {
    policies.forEach((p) => {
      const key = `${emp._id}-${p.leaveType}`;
      const ov = overrideMap[key];
      const annualAllocated = p.allowanceType === 'Monthly' ? p.allowance * 12 : p.allowance;
      const allocated = ov && ov.allocated !== undefined && ov.allocated !== null ? ov.allocated : annualAllocated;
      const carriedForward = ov?.carriedForward || 0;
      const adjusted = ov?.adjusted || 0;
      const used = usedMap[key] || 0;
      rows.push({
        employee: { _id: emp._id, employeeId: emp.employeeId, fullName: emp.fullName, department: emp.department },
        leaveType: p.leaveType,
        policyId: p._id,
        policyName: p.name,
        paid: p.paid,
        year,
        allocated,
        used,
        carriedForward,
        adjusted,
        remaining: Math.round((allocated + carriedForward + adjusted - used) * 100) / 100,
        overrideId: ov?._id || null,
        notes: ov?.notes || '',
      });
    });
  });
  return rows;
}

// @route GET /api/leave-balances  (admin)
const listBalances = asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const filter = { status: 'Active' };
  if (req.query.department) filter.department = req.query.department;
  if (req.query.search) {
    const re = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ firstName: re }, { lastName: re }, { employeeId: re }];
  }
  const employees = await Employee.find(filter).populate('department', 'name').sort({ firstName: 1 }).lean();
  const rows = await computeBalances(employees, year);

  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 200);
  const start = (page - 1) * pageSize;
  const paged = rows.slice(start, start + pageSize);

  res.json({ success: true, data: paged, meta: { total: rows.length, page, pageSize, totalPages: Math.ceil(rows.length / pageSize) } });
});

// @route GET /api/leave-balances/mine  (employee)
const getMyBalances = asyncHandler(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  if (!req.user.employee) return res.status(403).json({ success: false, message: 'Only employees have leave balances' });
  const employees = await Employee.find({ _id: req.user.employee }).populate('department', 'name').lean();
  const rows = await computeBalances(employees, year);
  res.json({ success: true, data: rows });
});

// @route PUT /api/leave-balances/:employeeId  (admin upsert override)
const upsertBalance = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const employee = await Employee.findById(employeeId);
  if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

  const year = parseInt(req.body.year, 10) || new Date().getFullYear();
  const leaveType = String(req.body.leaveType || '').trim();
  if (!leaveType) return res.status(400).json({ success: false, message: 'Leave type is required' });

  const num = (v) => (v === undefined || v === null || v === '' ? 0 : Number(v));
  const update = {
    employee: employee._id,
    employeeId: employee.employeeId,
    leaveType,
    year,
    allocated: num(req.body.allocated),
    carriedForward: num(req.body.carriedForward),
    adjusted: num(req.body.adjusted),
    notes: String(req.body.notes || '').trim().slice(0, 300),
  };
  const doc = await LeaveBalance.findOneAndUpdate(
    { employee: employee._id, leaveType, year },
    { $set: update, $setOnInsert: { used: 0 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json({ success: true, message: 'Leave balance updated', data: doc });
});

module.exports = { listPolicies, createPolicy, updatePolicy, deletePolicy, listBalances, getMyBalances, upsertBalance, LEAVE_TYPES };
