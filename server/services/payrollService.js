const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const LeavePolicy = require('../models/LeavePolicy');
const { getApplicableHolidays } = require('./holidayService');
const { getPayrollPolicy, getStatutoryConfig } = require('./companySettingsService');
const { monthRange, toDateKey, getDayName, startOfDay } = require('../utils/date');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function weeklyOffDaysFor(employee) {
  const payrollDays = employee?.payroll?.weeklyOff?.days;
  if (Array.isArray(payrollDays) && payrollDays.length) return payrollDays;
  const single = employee?.weekOff?.weeklyOffDay;
  const second = employee?.weekOff?.secondWeeklyOffDay;
  const days = [single, second].filter(Boolean);
  return days.length ? days : ['Sunday'];
}

function weeklyOffPattern(employee) {
  return employee?.payroll?.weeklyOff?.pattern || (employee?.weekOff?.secondWeeklyOffDay ? 'Saturday & Sunday' : 'Sunday Only');
}

function isWeeklyOff(date, employee) {
  const dayName = getDayName(date);
  const days = weeklyOffDaysFor(employee);
  const pattern = weeklyOffPattern(employee);
  if (pattern === 'Alternate Saturdays' && dayName === 'Saturday') {
    // 2nd and 4th Saturdays off.
    const week = Math.ceil(date.getDate() / 7);
    return week === 2 || week === 4;
  }
  return days.includes(dayName);
}

async function policyPaidMap(leaveTypes) {
  const policies = await LeavePolicy.find({ leaveType: { $in: leaveTypes }, active: true }).lean();
  const map = {};
  policies.forEach((p) => {
    if (map[p.leaveType] === undefined) map[p.leaveType] = p.paid;
  });
  return map;
}

/**
 * Compute the payroll for one employee and one month from persisted attendance,
 * approved leave, holidays and the employee's saved salary configuration.
 * Pure read-only: returns a plain object that the controller persists.
 */
async function computePayroll(employee, year, month, options = {}) {
  const emp = employee.toObject ? employee.toObject() : employee;
  const payroll = emp.payroll || {};
  const salaryBasis = payroll.salaryBasis || 'Fixed (Monthly)';
  const salaryAmount = Number(payroll.salaryAmount) || 0;

  const [policy, statutory] = await Promise.all([getPayrollPolicy(), getStatutoryConfig()]);
  const { start, end } = monthRange(year, month);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const [records, leaves, holidays] = await Promise.all([
    Attendance.find({ employee: emp._id, date: { $gte: start, $lt: end } }).lean(),
    Leave.find({
      employee: emp._id,
      status: 'Approved',
      startDate: { $lt: end },
      endDate: { $gte: start },
    }).lean(),
    getApplicableHolidays(start, end, emp),
  ]);

  const recordByDay = {};
  records.forEach((r) => {
    recordByDay[toDateKey(r.date)] = r;
  });

  const holidayMap = {};
  holidays.forEach((h) => {
    holidayMap[toDateKey(h.date)] = h;
  });

  // Expand approved leave into per-day entries (excluding weekly offs / holidays).
  const leaveByDay = {};
  leaves.forEach((l) => {
    const s = startOfDay(l.startDate) < start ? start : startOfDay(l.startDate);
    const e = startOfDay(l.endDate) >= end ? new Date(end.getTime() - 86400000) : startOfDay(l.endDate);
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const key = toDateKey(d);
      if (!leaveByDay[key]) leaveByDay[key] = l;
    }
  });

  const leaveTypes = [...new Set(leaves.map((l) => l.leaveType))];
  const paidMap = await policyPaidMap(leaveTypes);

  let presentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let absentDays = 0;
  let weeklyOffDays = 0;
  let publicHolidays = 0;
  let paidHolidays = 0;
  let workedMinutes = 0;
  let overtimeMinutes = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = toDateKey(date);
    const record = recordByDay[key];
    const holiday = holidayMap[key];
    const leave = leaveByDay[key];

    if (record && record.checkInTime) {
      workedMinutes += record.workingHoursMinutes || 0;
      overtimeMinutes += record.overtimeMinutes || 0;
      if (record.status === 'Half Day') halfDays += 1;
      else presentDays += 1;
      continue;
    }

    if (holiday && holiday.type === 'Full Day') {
      publicHolidays += 1;
      if (holiday.paid) paidHolidays += 1;
      continue;
    }

    if (isWeeklyOff(date, emp)) {
      weeklyOffDays += 1;
      continue;
    }

    if (leave) {
      const isPaid = paidMap[leave.leaveType] !== undefined ? paidMap[leave.leaveType] : leave.leaveType !== 'Unpaid Leave';
      if (isPaid) paidLeaveDays += 1;
      else unpaidLeaveDays += 1;
      continue;
    }

    absentDays += 1;
  }

  const workingDays = daysInMonth - weeklyOffDays - publicHolidays;
  const includeHolidays = salaryBasis.includes('Include Public Holidays');
  const isFixed = salaryBasis === 'Fixed (Monthly)';
  const baseWorkingDays = Number(payroll.workingDaysPerMonth) || policy.workingDaysPerMonth;
  const baseWorkingHours = Number(payroll.workingHoursPerMonth) || baseWorkingDays * policy.standardHoursPerDay;

  const attendancePaidDays = presentDays + halfDays * 0.5;
  const holidayPaidDays = includeHolidays ? paidHolidays : 0;
  const payableDays = attendancePaidDays + paidLeaveDays + holidayPaidDays;

  const earnings = [];
  let grossEarnings = 0;
  const addEarning = (label, amount, category) => {
    const amt = round2(amount);
    if (amt !== 0) earnings.push({ label, amount: amt, category });
    grossEarnings = round2(grossEarnings + amt);
  };

  const existingEarnings = options.manualEarnings || [];

  if (isFixed) {
    addEarning('Basic Salary (Monthly)', salaryAmount, 'base');
  } else if (salaryBasis === 'Per Hour' || salaryBasis === 'Working Hours (Monthly)') {
    const hourlyRate = baseWorkingHours > 0 ? salaryAmount / baseWorkingHours : 0;
    const paidHours = workedMinutes / 60 + paidLeaveDays * policy.standardHoursPerDay + holidayPaidDays * policy.standardHoursPerDay;
    addEarning('Basic Pay (Hours)', hourlyRate * paidHours, 'base');
  } else if (salaryBasis === 'Per Day' || salaryBasis === 'Per Day (Include Public Holidays)') {
    addEarning('Basic Pay (Days)', salaryAmount * payableDays, 'base');
  } else {
    // Working Days (Monthly) / Working Days (Include Public Holidays)
    const perDayRate = baseWorkingDays > 0 ? salaryAmount / baseWorkingDays : 0;
    addEarning('Basic Pay (Working Days)', perDayRate * payableDays, 'base');
  }

  // Overtime (only when configured and applicable).
  let overtimeHours = 0;
  let overtimePay = 0;
  const otApplicable = payroll.overtimeApplicable && payroll.overtimeApplicable !== 'Not Applicable';
  const otRate = Number(payroll.overtimeRate) || 0;
  if (otApplicable && otRate > 0) {
    if (payroll.overtimeApplicable === 'Fixed Hours (Monthly)') {
      overtimeHours = Number(payroll.fixedOvertimeHours) || 0;
    } else {
      overtimeHours = round2(overtimeMinutes / 60);
    }
    overtimePay = round2(overtimeHours * otRate);
    addEarning('Overtime', overtimePay, 'overtime');
  }

  const deductions = [];
  let totalDeductions = 0;
  const addDeduction = (label, amount, category) => {
    const amt = round2(amount);
    if (amt !== 0) deductions.push({ label, amount: amt, category });
    totalDeductions = round2(totalDeductions + amt);
  };

  // Unpaid leave / unauthorised absence deduction for fixed monthly salary.
  // Use the actual working days in the month so the per-day rate always divides
  // the monthly salary evenly across the days that were expected to be worked.
  if (isFixed && (unpaidLeaveDays > 0 || absentDays > 0)) {
    const divisor = workingDays > 0 ? workingDays : baseWorkingDays;
    const perDayRate = divisor > 0 ? salaryAmount / divisor : 0;
    addDeduction('Unpaid Leave / Absence', perDayRate * (unpaidLeaveDays + absentDays), 'attendance');
  }

  // Provident Fund.
  const pfCfg = payroll.pf || {};
  const pfApplicable = !!pfCfg.applicable;
  const pfEmployeePercent = Number(pfCfg.employeePercent) || statutory.pfEmployeePercent;
  const pfEmployerPercent = Number(pfCfg.employerPercent) || statutory.pfEmployerPercent;
  const applyOn = pfCfg.applyOn || statutory.pfApplyOn;
  let pfBase = 0;
  let pfEmployee = 0;
  let pfEmployer = 0;
  if (pfApplicable) {
    pfBase = applyOn === 'Basic' ? round2(grossEarnings * (statutory.basicPercentOfGross / 100)) : grossEarnings;
    if (statutory.pfWageCeiling > 0) pfBase = Math.min(pfBase, statutory.pfWageCeiling);
    pfEmployee = round2(pfBase * (pfEmployeePercent / 100));
    pfEmployer = round2(pfBase * (pfEmployerPercent / 100));
    const vpfPercent = Number(pfCfg.vpfPercent) || 0;
    const vpfAmount = vpfPercent > 0 ? round2(pfBase * (vpfPercent / 100)) : 0;
    addDeduction('Provident Fund (PF)', pfEmployee, 'pf');
    if (vpfAmount > 0) addDeduction('Voluntary PF (VPF)', vpfAmount, 'pf');
  }

  // Employee State Insurance.
  const esiCfg = payroll.esi || {};
  const esiApplicable = !!esiCfg.applicable;
  const esiEmployeePercent = Number(esiCfg.employeePercent) || statutory.esiEmployeePercent;
  const esiEmployerPercent = Number(esiCfg.employerPercent) || statutory.esiEmployerPercent;
  let esiEmployee = 0;
  let esiEmployer = 0;
  if (esiApplicable) {
    const eligible = statutory.esiWageCeiling <= 0 || grossEarnings <= statutory.esiWageCeiling;
    if (eligible) {
      esiEmployee = round2(grossEarnings * (esiEmployeePercent / 100));
      esiEmployer = round2(grossEarnings * (esiEmployerPercent / 100));
      addDeduction('Employee State Insurance (ESI)', esiEmployee, 'esi');
    }
  }

  // Caller-supplied manual deductions (applied through the adjustment workflow).
  (options.manualDeductions || []).forEach((d) => addDeduction(d.label || 'Adjustment', d.amount || 0, d.category || 'manual'));

  // Deductions must never exceed gross earnings. Reduce the attendance-based
  // deduction (unpaid leave / absence) first, since a fully-absent month should
  // simply pay nothing rather than produce a negative net salary.
  if (totalDeductions > grossEarnings) {
    let excess = round2(totalDeductions - grossEarnings);
    const attendanceIdx = deductions.findIndex((d) => d.category === 'attendance');
    if (attendanceIdx >= 0 && excess > 0) {
      const cut = Math.min(deductions[attendanceIdx].amount, excess);
      deductions[attendanceIdx].amount = round2(deductions[attendanceIdx].amount - cut);
      totalDeductions = round2(totalDeductions - cut);
      excess = round2(excess - cut);
      if (deductions[attendanceIdx].amount === 0) deductions.splice(attendanceIdx, 1);
    }
  }

  const netSalary = round2(Math.max(0, grossEarnings - totalDeductions));

  const snapshot = {
    records: records.map((r) => ({
      date: toDateKey(r.date),
      status: r.status,
      checkInTime: r.checkInTime,
      checkOutTime: r.checkOutTime,
      workingHoursMinutes: r.workingHoursMinutes || 0,
      overtimeMinutes: r.overtimeMinutes || 0,
      source: r.source,
    })),
    leaves: leaves.map((l) => ({
      leaveType: l.leaveType,
      startDate: toDateKey(l.startDate),
      endDate: toDateKey(l.endDate),
      days: l.days,
      status: l.status,
    })),
    holidays: holidays.map((h) => ({ date: toDateKey(h.date), name: h.name, paid: h.paid, type: h.type })),
    computedAt: new Date().toISOString(),
  };

  return {
    employee: emp._id,
    employeeId: emp.employeeId,
    year,
    month,
    periodKey: `${year}-${String(month + 1).padStart(2, '0')}`,
    periodLabel: `${MONTHS[month]} ${year}`,
    currency: emp.salary?.currency || 'INR',
    salaryBasis,
    baseSalary: salaryAmount,
    attendance: {
      daysInMonth,
      workingDays,
      presentDays,
      halfDays,
      paidLeaveDays,
      unpaidLeaveDays,
      absentDays,
      weeklyOffDays,
      publicHolidays,
      paidHolidays,
      overtimeHours,
      payableDays: round2(payableDays),
      workedMinutes,
      overtimeMinutes,
    },
    earnings,
    deductions,
    grossEarnings,
    totalDeductions,
    netSalary,
    overtimePay,
    pf: { applicable: pfApplicable, base: pfBase, percent: pfEmployeePercent, employeeContribution: pfEmployee, employerContribution: pfEmployer, number: pfCfg.number || '' },
    esi: { applicable: esiApplicable && esiEmployee > 0, base: grossEarnings, percent: esiEmployeePercent, employeeContribution: esiEmployee, employerContribution: esiEmployer, number: esiCfg.esiNumber || '' },
    paymentMode: payroll.paymentMode || 'Bank Transfer',
    snapshot,
  };
}

function buildSlipNumber(employeeId, year, month) {
  return `NUVOX-${year}${String(month + 1).padStart(2, '0')}-${String(employeeId || '').toUpperCase()}`;
}

module.exports = { computePayroll, buildSlipNumber, MONTHS, isWeeklyOff, weeklyOffDaysFor };
