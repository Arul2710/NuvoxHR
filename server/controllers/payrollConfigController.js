const Employee = require('../models/Employee');
const asyncHandler = require('../utils/asyncHandler');

const SALARY_BASIS = [
  'Per Hour',
  'Per Day',
  'Working Hours (Monthly)',
  'Working Days (Monthly)',
  'Fixed (Monthly)',
  'Per Day (Include Public Holidays)',
  'Working Days (Include Public Holidays)',
];
const OVERTIME_OPTIONS = ['Not Applicable', 'Per Day', 'Per Week', 'Per Month', 'Fixed Hours (Monthly)'];
const ATTENDANCE_POLICIES = ['Standard (Mon–Fri)', '5.5-Day Week', '6-Day Week', 'Shift Based', 'Flexi Hours'];
const PAYMENT_MODES = ['Bank Transfer', 'Cheque', 'Cash', 'Other'];
const WEEK_OFF_PATTERNS = ['Saturday & Sunday', 'Sunday Only', 'Alternate Saturdays', 'Custom'];

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const sanitizeId = (v) => (v && /^[0-9a-fA-F]{24}$/.test(String(v)) ? v : null);

const DEFAULT_PAYROLL = {
  salaryBasis: 'Fixed (Monthly)',
  salaryAmount: 0,
  workingHoursPerMonth: 208,
  workingDaysPerMonth: 26,
  overtimeApplicable: 'Not Applicable',
  overtimeRate: 0,
  overtimeThresholdHours: 0,
  fixedOvertimeHours: 0,
  attendancePolicy: 'Standard (Mon–Fri)',
  workShift: { name: 'Day Shift', startTime: '09:00', endTime: '18:00', breakMinutes: 60, graceMinutes: 10, overnight: false },
  paymentMode: 'Bank Transfer',
  pf: { applicable: false, employeePercent: 12, employerPercent: 12, vpfPercent: 0, applyOn: 'Basic', number: '', effectiveDate: null },
  esi: { applicable: false, esiNumber: '', employeePercent: 0.75, employerPercent: 3.25, effectiveDate: null },
  weeklyOff: { pattern: 'Sunday Only', days: ['Sunday'] },
  leavePolicy: null,
  effectiveDate: null,
  notes: '',
};

function toPlain(raw) {
  const doc = raw && raw.toObject ? raw.toObject() : raw || {};
  return { ...DEFAULT_PAYROLL, ...doc, pf: { ...DEFAULT_PAYROLL.pf, ...(doc.pf || {}) }, esi: { ...DEFAULT_PAYROLL.esi, ...(doc.esi || {}) }, workShift: { ...DEFAULT_PAYROLL.workShift, ...(doc.workShift || {}) }, weeklyOff: { ...DEFAULT_PAYROLL.weeklyOff, ...(doc.weeklyOff || {}) } };
}

function sanitizePayload(body = {}) {
  const basis = SALARY_BASIS.includes(body.salaryBasis) ? body.salaryBasis : DEFAULT_PAYROLL.salaryBasis;
  const errors = [];

  const salaryAmount = num(body.salaryAmount, 0);
  if (salaryAmount < 0) errors.push('Salary amount cannot be negative');

  const workingHoursPerMonth = num(body.workingHoursPerMonth, DEFAULT_PAYROLL.workingHoursPerMonth);
  const workingDaysPerMonth = num(body.workingDaysPerMonth, DEFAULT_PAYROLL.workingDaysPerMonth);
  if (['Working Hours (Monthly)', 'Per Hour'].includes(basis) && workingHoursPerMonth <= 0) {
    errors.push('Working hours per month must be greater than 0 for this salary basis');
  }
  if (['Working Days (Monthly)', 'Working Days (Include Public Holidays)', 'Per Day', 'Per Day (Include Public Holidays)'].includes(basis) && workingDaysPerMonth <= 0) {
    errors.push('Working days per month must be greater than 0 for this salary basis');
  }

  const overtimeApplicable = OVERTIME_OPTIONS.includes(body.overtimeApplicable) ? body.overtimeApplicable : DEFAULT_PAYROLL.overtimeApplicable;
  const overtimeRate = num(body.overtimeRate, 0);
  const fixedOvertimeHours = num(body.fixedOvertimeHours, 0);
  const overtimeThresholdHours = num(body.overtimeThresholdHours, 0);
  if (overtimeApplicable !== 'Not Applicable' && overtimeRate < 0) errors.push('Overtime rate cannot be negative');
  if (overtimeApplicable === 'Fixed Hours (Monthly)' && fixedOvertimeHours < 0) errors.push('Fixed overtime hours cannot be negative');

  const paymentMode = PAYMENT_MODES.includes(body.paymentMode) ? body.paymentMode : DEFAULT_PAYROLL.paymentMode;
  const attendancePolicy = ATTENDANCE_POLICIES.includes(body.attendancePolicy) ? body.attendancePolicy : DEFAULT_PAYROLL.attendancePolicy;

  const shift = body.workShift && typeof body.workShift === 'object' ? body.workShift : {};
  const pfRaw = body.pf && typeof body.pf === 'object' ? body.pf : {};
  const esiRaw = body.esi && typeof body.esi === 'object' ? body.esi : {};
  const weekOffRaw = body.weeklyOff && typeof body.weeklyOff === 'object' ? body.weeklyOff : {};

  const pf = {
    applicable: !!pfRaw.applicable,
    employeePercent: clamp(num(pfRaw.employeePercent, 12), 0, 100),
    employerPercent: clamp(num(pfRaw.employerPercent, 12), 0, 100),
    vpfPercent: clamp(num(pfRaw.vpfPercent, 0), 0, 100),
    applyOn: pfRaw.applyOn === 'Gross' ? 'Gross' : 'Basic',
    number: String(pfRaw.number || '').trim().slice(0, 60),
    effectiveDate: pfRaw.effectiveDate ? new Date(pfRaw.effectiveDate) : null,
  };
  const esi = {
    applicable: !!esiRaw.applicable,
    esiNumber: String(esiRaw.esiNumber || '').trim().slice(0, 60),
    employeePercent: clamp(num(esiRaw.employeePercent, 0.75), 0, 100),
    employerPercent: clamp(num(esiRaw.employerPercent, 3.25), 0, 100),
    effectiveDate: esiRaw.effectiveDate ? new Date(esiRaw.effectiveDate) : null,
  };
  const weekDays = Array.isArray(weekOffRaw.days) ? weekOffRaw.days.map((d) => String(d).trim()).filter(Boolean) : DEFAULT_PAYROLL.weeklyOff.days;

  const payload = {
    salaryBasis: basis,
    salaryAmount: Math.max(0, salaryAmount),
    workingHoursPerMonth: Math.max(0, workingHoursPerMonth),
    workingDaysPerMonth: Math.max(0, workingDaysPerMonth),
    overtimeApplicable,
    overtimeRate: Math.max(0, overtimeRate),
    overtimeThresholdHours: Math.max(0, overtimeThresholdHours),
    fixedOvertimeHours: Math.max(0, fixedOvertimeHours),
    attendancePolicy,
    workShift: {
      name: String(shift.name || DEFAULT_PAYROLL.workShift.name).trim(),
      startTime: String(shift.startTime || DEFAULT_PAYROLL.workShift.startTime).trim(),
      endTime: String(shift.endTime || DEFAULT_PAYROLL.workShift.endTime).trim(),
      breakMinutes: Math.max(0, num(shift.breakMinutes, DEFAULT_PAYROLL.workShift.breakMinutes)),
      graceMinutes: Math.max(0, num(shift.graceMinutes, DEFAULT_PAYROLL.workShift.graceMinutes)),
      overnight: !!shift.overnight,
    },
    paymentMode,
    pf,
    esi,
    weeklyOff: {
      pattern: WEEK_OFF_PATTERNS.includes(weekOffRaw.pattern) ? weekOffRaw.pattern : DEFAULT_PAYROLL.weeklyOff.pattern,
      days: weekDays.length ? weekDays : DEFAULT_PAYROLL.weeklyOff.days,
    },
    leavePolicy: sanitizeId(body.leavePolicy),
    effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
    notes: String(body.notes || '').trim().slice(0, 500),
  };

  return { payload, errors };
}

// @route GET /api/employees/:id/payroll
const getPayrollConfig = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id).select('employeeId firstName lastName payroll salaryHistory bankDetails').lean();
  if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
  res.json({ success: true, data: { payroll: toPlain(employee.payroll), salaryHistory: employee.salaryHistory || [] } });
});

// @route PATCH /api/employees/:id/payroll
const updatePayrollConfig = asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Only admins can change salary configuration' });
  }
  const employee = await Employee.findById(req.params.id);
  if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

  const reason = String(req.body.reason || '').trim();
  const { payload, errors } = sanitizePayload(req.body);
  if (errors.length) return res.status(400).json({ success: false, message: errors[0] });
  if (!reason) return res.status(400).json({ success: false, message: 'A reason is required when changing salary configuration' });

  const previous = toPlain(employee.payroll);
  employee.payroll = { ...previous, ...payload };
  employee.salaryHistory = employee.salaryHistory || [];
  employee.salaryHistory.push({
    changedBy: req.user.id,
    changedByName: req.user.name || '',
    reason,
    previous,
    next: toPlain(employee.payroll),
    at: new Date(),
  });
  await employee.save();

  res.json({ success: true, message: 'Salary configuration saved', data: { payroll: toPlain(employee.payroll), salaryHistory: employee.salaryHistory } });
});

module.exports = { getPayrollConfig, updatePayrollConfig, DEFAULT_PAYROLL, SALARY_BASIS, OVERTIME_OPTIONS, ATTENDANCE_POLICIES, PAYMENT_MODES };
