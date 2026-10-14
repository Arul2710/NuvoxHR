const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const Location = require('../models/Location');
const LeavePolicy = require('../models/LeavePolicy');
const WorkShift = require('../models/WorkShift');
const AttendancePolicy = require('../models/AttendancePolicy');
const Setting = require('../models/Setting');
const config = require('../config/config');

const DEFAULT_DEPARTMENTS = ['Development', 'Human Resources', 'Marketing', 'Sales', 'Finance', 'Operations'];

const DEFAULT_LOCATIONS = [
  { name: 'Chennai Office', city: 'Chennai', address: '' },
  { name: 'Hosur Office', city: 'Hosur', address: '' },
  { name: 'Bangalore Office', city: 'Bangalore', address: '' },
];

const DEFAULT_DESIGNATIONS = [
  'Software Engineer',
  'Senior Software Engineer',
  'Team Lead',
  'Project Manager',
  'HR Executive',
  'Marketing Specialist',
  'Sales Executive',
  'Accountant',
  'Operations Analyst',
  'Intern',
];

async function seedDefaultDepartments() {
  const count = await Department.countDocuments();
  if (count === 0) {
    await Department.insertMany(DEFAULT_DEPARTMENTS.map((name) => ({ name, description: '', active: true })));
    console.log('[Seed] Default departments created');
  }
}

async function seedDefaultLocations() {
  const count = await Location.countDocuments();
  if (count === 0) {
    await Location.insertMany(DEFAULT_LOCATIONS.map((l) => ({ ...l, active: true })));
    console.log('[Seed] Default locations created');
  }
}

async function seedDefaultDesignations() {
  const count = await Designation.countDocuments();
  if (count === 0) {
    await Designation.insertMany(DEFAULT_DESIGNATIONS.map((name) => ({ name, description: '' })));
    console.log('[Seed] Default designations created');
  }
}

async function seedAdmin() {
  const exists = await User.findOne({ role: 'admin' });
  if (!exists) {
    const hashed = await bcrypt.hash(config.adminPassword, 10);
    await User.create({
      name: config.adminName,
      email: config.adminEmail,
      password: hashed,
      role: 'admin',
      active: true,
    });
    console.log(`[Seed] Default admin created: ${config.adminEmail}`);
  }
}

async function seedSettings() {
  await Setting.updateOne(
    { key: 'officeStartTime' },
    { $set: { value: config.officeStartTime } },
    { upsert: true }
  );
  await Setting.updateOne(
    { key: 'halfDayThresholdHours' },
    { $set: { value: config.halfDayThresholdHours } },
    { upsert: true }
  );
}

async function seedDefaultLeavePolicies() {
  const count = await LeavePolicy.countDocuments();
  if (count > 0) return;
  const policies = [
    { name: 'Sick Leave', code: 'SL', leaveType: 'Sick Leave', allowanceType: 'Annual', allowance: 12, paid: true, maxConsecutiveDays: 3, approvalRequired: true, documentRequired: true },
    { name: 'Casual Leave', code: 'CL', leaveType: 'Casual Leave', allowanceType: 'Annual', allowance: 12, paid: true, maxConsecutiveDays: 3, approvalRequired: true, documentRequired: false },
    { name: 'Earned Leave', code: 'EL', leaveType: 'Earned Leave', allowanceType: 'Annual', allowance: 15, paid: true, maxConsecutiveDays: 5, approvalRequired: true, documentRequired: false },
    { name: 'Unpaid Leave', code: 'UL', leaveType: 'Unpaid Leave', allowanceType: 'Annual', allowance: 0, paid: false, maxConsecutiveDays: 0, approvalRequired: true, documentRequired: false },
  ];
  await LeavePolicy.insertMany(policies);
  console.log('[Seed] Default leave policies created');
}

async function seedDefaultWorkShifts() {
  const count = await WorkShift.countDocuments();
  if (count > 0) return;
  const shifts = [
    { name: 'Day Shift', code: 'DAY', startTime: '09:00', endTime: '18:00', breakMinutes: 60, graceMinutes: 10, overnight: false },
    { name: 'Evening Shift', code: 'EVE', startTime: '14:00', endTime: '23:00', breakMinutes: 60, graceMinutes: 10, overnight: false },
    { name: 'Night Shift', code: 'NIGHT', startTime: '22:00', endTime: '07:00', breakMinutes: 60, graceMinutes: 10, overnight: true },
    { name: 'Rotational', code: 'ROT', startTime: '09:00', endTime: '18:00', breakMinutes: 60, graceMinutes: 10, overnight: false },
  ];
  await WorkShift.insertMany(shifts);
  console.log('[Seed] Default work shifts created');
}

async function seedDefaultAttendancePolicies() {
  const count = await AttendancePolicy.countDocuments();
  if (count > 0) return;
  const policies = [
    { name: 'Standard (Mon–Fri)', code: 'STD', weeklyOffDays: ['Sunday'], alternateSaturdayOff: false, fullDayHours: 8, halfDayThresholdHours: 4, lateGraceMinutes: 10, overtimeAfterHours: 9 },
    { name: '5.5-Day Week', code: '55', weeklyOffDays: ['Sunday'], alternateSaturdayOff: true, fullDayHours: 8, halfDayThresholdHours: 4, lateGraceMinutes: 10, overtimeAfterHours: 9 },
    { name: '6-Day Week', code: '6D', weeklyOffDays: ['Sunday'], alternateSaturdayOff: false, fullDayHours: 8, halfDayThresholdHours: 4, lateGraceMinutes: 10, overtimeAfterHours: 9 },
    { name: 'Shift Based', code: 'SHIFT', weeklyOffDays: ['Sunday'], alternateSaturdayOff: false, fullDayHours: 8, halfDayThresholdHours: 4, lateGraceMinutes: 10, overtimeAfterHours: 9 },
    { name: 'Flexi Hours', code: 'FLEXI', weeklyOffDays: ['Sunday'], alternateSaturdayOff: false, fullDayHours: 8, halfDayThresholdHours: 4, lateGraceMinutes: 15, overtimeAfterHours: 9 },
  ];
  await AttendancePolicy.insertMany(policies);
  console.log('[Seed] Default attendance policies created');
}

async function seedDefaultCompanySettings() {
  const { DEFAULT_COMPANY, DEFAULT_STATUTORY, DEFAULT_PAYROLL_POLICY } = require('../services/companySettingsService');
  await Setting.updateOne({ key: 'companyDetails' }, { $set: { value: DEFAULT_COMPANY } }, { upsert: true });
  await Setting.updateOne({ key: 'statutoryConfig' }, { $set: { value: DEFAULT_STATUTORY } }, { upsert: true });
  await Setting.updateOne({ key: 'payrollPolicy' }, { $set: { value: DEFAULT_PAYROLL_POLICY } }, { upsert: true });
  await Setting.updateOne({ key: 'emailConfig' }, { $set: { value: { fromName: '', fromEmail: '', replyTo: '' } } }, { upsert: true });
  console.log('[Seed] Default company settings created');
}

module.exports = { seedDefaultDepartments, seedDefaultLocations, seedDefaultDesignations, seedAdmin, seedSettings, seedDefaultLeavePolicies, seedDefaultWorkShifts, seedDefaultAttendancePolicies, seedDefaultCompanySettings };