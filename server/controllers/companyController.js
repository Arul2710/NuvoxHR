const asyncHandler = require('../utils/asyncHandler');
const WorkShift = require('../models/WorkShift');
const AttendancePolicy = require('../models/AttendancePolicy');
const {
  getCompanyDetails,
  updateCompanyDetails,
  getStatutoryConfig,
  updateStatutoryConfig,
  getPayrollPolicy,
  updatePayrollPolicy,
  getEmailConfig,
  updateEmailConfig,
} = require('../services/companySettingsService');

// ---- Company details ----
const getDetails = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getCompanyDetails() });
});
const putDetails = asyncHandler(async (req, res) => {
  const data = await updateCompanyDetails(req.body);
  res.json({ success: true, message: 'Company details saved', data });
});

// ---- Statutory (PF/ESI) ----
const getStatutory = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getStatutoryConfig() });
});
const putStatutory = asyncHandler(async (req, res) => {
  const data = await updateStatutoryConfig(req.body);
  res.json({ success: true, message: 'Statutory rules saved', data });
});

// ---- Payroll policy ----
const getPayrollPolicyCfg = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getPayrollPolicy() });
});
const putPayrollPolicyCfg = asyncHandler(async (req, res) => {
  const data = await updatePayrollPolicy(req.body);
  res.json({ success: true, message: 'Payroll policy saved', data });
});

// ---- Email config ----
const getEmailCfg = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getEmailConfig() });
});
const putEmailCfg = asyncHandler(async (req, res) => {
  const data = await updateEmailConfig(req.body);
  res.json({ success: true, message: 'Email configuration saved', data });
});

// ---- Work shifts ----
const listShifts = asyncHandler(async (_req, res) => {
  const shifts = await WorkShift.find({}).sort({ name: 1 }).lean();
  res.json({ success: true, data: shifts });
});
const createShift = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: 'Shift name is required' });
  const shift = await WorkShift.create({
    name,
    code: String(req.body.code || name).trim().toUpperCase().replace(/\s+/g, '_'),
    startTime: req.body.startTime || '09:00',
    endTime: req.body.endTime || '18:00',
    breakMinutes: Math.max(0, Number(req.body.breakMinutes) || 0),
    graceMinutes: Math.max(0, Number(req.body.graceMinutes) || 0),
    overnight: !!req.body.overnight,
    active: req.body.active !== false,
  });
  res.status(201).json({ success: true, message: 'Work shift created', data: shift });
});
const updateShift = asyncHandler(async (req, res) => {
  const shift = await WorkShift.findById(req.params.id);
  if (!shift) return res.status(404).json({ success: false, message: 'Work shift not found' });
  ['name', 'startTime', 'endTime'].forEach((k) => {
    if (req.body[k] !== undefined) shift[k] = String(req.body[k]).trim();
  });
  if (req.body.breakMinutes !== undefined) shift.breakMinutes = Math.max(0, Number(req.body.breakMinutes) || 0);
  if (req.body.graceMinutes !== undefined) shift.graceMinutes = Math.max(0, Number(req.body.graceMinutes) || 0);
  if (req.body.overnight !== undefined) shift.overnight = !!req.body.overnight;
  if (req.body.active !== undefined) shift.active = !!req.body.active;
  await shift.save();
  res.json({ success: true, message: 'Work shift updated', data: shift });
});
const deleteShift = asyncHandler(async (req, res) => {
  const shift = await WorkShift.findById(req.params.id);
  if (!shift) return res.status(404).json({ success: false, message: 'Work shift not found' });
  shift.active = false;
  await shift.save();
  res.json({ success: true, message: 'Work shift deactivated' });
});

// ---- Attendance policies ----
const listPolicies = asyncHandler(async (_req, res) => {
  const policies = await AttendancePolicy.find({}).sort({ name: 1 }).lean();
  res.json({ success: true, data: policies });
});
const createPolicy = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: 'Policy name is required' });
  const policy = await AttendancePolicy.create({
    name,
    code: String(req.body.code || name).trim().toUpperCase().replace(/\s+/g, '_'),
    weeklyOffDays: Array.isArray(req.body.weeklyOffDays) && req.body.weeklyOffDays.length ? req.body.weeklyOffDays : ['Sunday'],
    alternateSaturdayOff: req.body.alternateSaturdayOff !== false,
    fullDayHours: Math.max(0, Number(req.body.fullDayHours) || 8),
    halfDayThresholdHours: Math.max(0, Number(req.body.halfDayThresholdHours) || 4),
    lateGraceMinutes: Math.max(0, Number(req.body.lateGraceMinutes) || 0),
    overtimeAfterHours: Math.max(0, Number(req.body.overtimeAfterHours) || 0),
    description: String(req.body.description || '').trim().slice(0, 300),
    active: req.body.active !== false,
  });
  res.status(201).json({ success: true, message: 'Attendance policy created', data: policy });
});
const updatePolicy = asyncHandler(async (req, res) => {
  const policy = await AttendancePolicy.findById(req.params.id);
  if (!policy) return res.status(404).json({ success: false, message: 'Attendance policy not found' });
  ['name', 'description'].forEach((k) => {
    if (req.body[k] !== undefined) policy[k] = String(req.body[k]).trim();
  });
  if (Array.isArray(req.body.weeklyOffDays) && req.body.weeklyOffDays.length) policy.weeklyOffDays = req.body.weeklyOffDays;
  ['fullDayHours', 'halfDayThresholdHours', 'lateGraceMinutes', 'overtimeAfterHours'].forEach((k) => {
    if (req.body[k] !== undefined) policy[k] = Math.max(0, Number(req.body[k]) || 0);
  });
  if (req.body.alternateSaturdayOff !== undefined) policy.alternateSaturdayOff = !!req.body.alternateSaturdayOff;
  if (req.body.active !== undefined) policy.active = !!req.body.active;
  await policy.save();
  res.json({ success: true, message: 'Attendance policy updated', data: policy });
});
const deletePolicy = asyncHandler(async (req, res) => {
  const policy = await AttendancePolicy.findById(req.params.id);
  if (!policy) return res.status(404).json({ success: false, message: 'Attendance policy not found' });
  policy.active = false;
  await policy.save();
  res.json({ success: true, message: 'Attendance policy deactivated' });
});

module.exports = {
  getDetails,
  putDetails,
  getStatutory,
  putStatutory,
  getPayrollPolicyCfg,
  putPayrollPolicyCfg,
  getEmailCfg,
  putEmailCfg,
  listShifts,
  createShift,
  updateShift,
  deleteShift,
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
};
