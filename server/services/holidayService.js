const Holiday = require('../models/Holiday');
const { startOfDay, toDateKey } = require('../utils/date');

/**
 * Fetch holidays that overlap [start, end) and apply to the given employee
 * (a holiday with no department applies company-wide).
 */
async function getApplicableHolidays(start, end, employee = null) {
  const filter = {
    active: true,
    date: { $gte: startOfDay(start), $lt: startOfDay(end) },
  };
  const holidays = await Holiday.find(filter).lean();
  const deptId = employee?.department ? String(employee.department._id || employee.department) : null;
  return holidays.filter((h) => {
    if (!h.department) return true;
    if (!deptId) return false;
    return String(h.department) === deptId;
  });
}

/** Returns a map of { 'YYYY-MM-DD': holidayDoc } applicable to the employee. */
async function getHolidayMap(start, end, employee = null) {
  const list = await getApplicableHolidays(start, end, employee);
  const map = {};
  list.forEach((h) => {
    map[toDateKey(h.date)] = h;
  });
  return map;
}

module.exports = { getApplicableHolidays, getHolidayMap };
