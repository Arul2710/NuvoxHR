const Holiday = require('../models/Holiday');
const asyncHandler = require('../utils/asyncHandler');
const { startOfDay, toDateKey } = require('../utils/date');

const sanitizeId = (v) => (v && /^[0-9a-fA-F]{24}$/.test(String(v)) ? v : null);

function parseYearRange(year) {
  const y = parseInt(year, 10) || new Date().getFullYear();
  return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), year: y };
}

// @route GET /api/holidays?year=&department=
const listHolidays = asyncHandler(async (req, res) => {
  const { start, end, year } = parseYearRange(req.query.year);
  const filter = { date: { $gte: start, $lt: end } };
  if (req.query.active === 'true') filter.active = true;
  if (req.query.department) filter.department = sanitizeId(req.query.department);
  const holidays = await Holiday.find(filter).populate('department', 'name').sort({ date: 1 }).lean();
  res.json({ success: true, data: holidays, meta: { year } });
});

// @route POST /api/holidays
const createHoliday = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ success: false, message: 'Holiday name is required' });
  if (!req.body.date) return res.status(400).json({ success: false, message: 'Holiday date is required' });

  const date = startOfDay(new Date(req.body.date));
  const department = sanitizeId(req.body.department);
  const group = String(req.body.group || '').trim();

  const dup = await Holiday.findOne({ date, department: department || null, group });
  if (dup) return res.status(409).json({ success: false, message: 'A holiday already exists for this date and group' });

  const holiday = await Holiday.create({
    name,
    date,
    type: req.body.type === 'Partial Day' ? 'Partial Day' : 'Full Day',
    partialHours: Math.max(0, Number(req.body.partialHours) || 0),
    paid: req.body.paid !== false,
    department: department || null,
    group,
    notes: String(req.body.notes || '').trim().slice(0, 300),
    active: req.body.active !== false,
  });
  res.status(201).json({ success: true, message: 'Holiday added', data: holiday });
});

// @route PUT /api/holidays/:id
const updateHoliday = asyncHandler(async (req, res) => {
  const holiday = await Holiday.findById(req.params.id);
  if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });

  if (req.body.name !== undefined) holiday.name = String(req.body.name).trim() || holiday.name;
  if (req.body.date) holiday.date = startOfDay(new Date(req.body.date));
  if (req.body.type) holiday.type = req.body.type === 'Partial Day' ? 'Partial Day' : 'Full Day';
  if (req.body.partialHours !== undefined) holiday.partialHours = Math.max(0, Number(req.body.partialHours) || 0);
  if (req.body.paid !== undefined) holiday.paid = !!req.body.paid;
  if (req.body.department !== undefined) holiday.department = sanitizeId(req.body.department) || null;
  if (req.body.group !== undefined) holiday.group = String(req.body.group).trim();
  if (req.body.notes !== undefined) holiday.notes = String(req.body.notes).trim().slice(0, 300);
  if (req.body.active !== undefined) holiday.active = !!req.body.active;

  const dup = await Holiday.findOne({ _id: { $ne: holiday._id }, date: holiday.date, department: holiday.department || null, group: holiday.group });
  if (dup) return res.status(409).json({ success: false, message: 'Another holiday already exists for this date and group' });

  await holiday.save();
  res.json({ success: true, message: 'Holiday updated', data: holiday });
});

// @route DELETE /api/holidays/:id
const deleteHoliday = asyncHandler(async (req, res) => {
  const holiday = await Holiday.findById(req.params.id);
  if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });
  await holiday.deleteOne();
  res.json({ success: true, message: 'Holiday deleted' });
});

module.exports = { listHolidays, createHoliday, updateHoliday, deleteHoliday };
