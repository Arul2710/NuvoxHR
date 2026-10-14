const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const FaceProfile = require('../models/FaceProfile');
const asyncHandler = require('../utils/asyncHandler');
const { saveBuffer } = require('../middleware/upload');
const { haversineDistanceMeters } = require('../utils/geo');
const { getAttendanceSettings } = require('../services/attendanceSettingsService');
const {
  verifyAgainstProfile,
  parseDescriptor,
} = require('../services/faceVerification');
const {
  evaluateCheckInStatus,
  computeFinalStatus,
} = require('../services/attendanceService');
const {
  startOfDay,
  endOfDay,
  getDayName,
  formatDuration,
  monthRange,
  toDateKey,
  isWeekend,
  diffDays,
} = require('../utils/date');

const sanitizeString = (v, max = 200) => String(v || '').slice(0, max);

// Parse an optional location payload (object or JSON string) sent by the client.
function parseLocation(raw) {
  if (!raw) return null;
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

  const loc = {};
  if (typeof obj.address === 'string' && obj.address.trim()) {
    loc.address = obj.address.trim().slice(0, 300);
  }
  const lat = Number(obj.latitude);
  const lng = Number(obj.longitude);
  if (lat !== null && lat !== undefined && lat !== '' && !Number.isNaN(lat)) loc.latitude = Math.round(lat * 1e6) / 1e6;
  if (lng !== null && lng !== undefined && lng !== '' && !Number.isNaN(lng)) loc.longitude = Math.round(lng * 1e6) / 1e6;

  if (!('address' in loc) && !('latitude' in loc) && !('longitude' in loc)) return null;
  return loc;
}

function summarizeDevice(req) {
  return {
    userAgent: sanitizeString(req.body.device?.userAgent || req.headers['user-agent'] || '', 500),
    platform: sanitizeString(req.body.device?.platform || '', 100),
    screen: sanitizeString(req.body.device?.screen || '', 50),
  };
}

function computeDistanceFromCompany(location, locCfg) {
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return null;
  const d = haversineDistanceMeters(location.latitude, location.longitude, locCfg.latitude, locCfg.longitude);
  return d === null ? null : Math.round(d);
}

function evaluateGeofence(settings, location) {
  if (!settings.geoEnabled) return { ok: true, distance: null, allowed: null };
  if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
    return {
      ok: false,
      code: 'LOCATION_REQUIRED',
      message: 'Location access is required to mark attendance. Please enable location and try again.',
    };
  }
  const allowed = settings.location.allowedRadius;
  const distance = computeDistanceFromCompany(location, settings.location);
  if (distance === null) {
    return { ok: false, code: 'LOCATION_INVALID', message: 'Could not compute your distance from the company location.' };
  }
  if (distance > allowed) {
    return {
      ok: false,
      code: 'OUTSIDE_ALLOWED_AREA',
      message: `You are outside the authorized attendance area. Current distance: ${distance} m · Allowed distance: ${allowed} m`,
      distance,
      allowed,
    };
  }
  return { ok: true, distance, allowed };
}

// helper: build per-employee day status for all active employees on a date
async function computeDayStatus(employees, date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const [records, leaves] = await Promise.all([
    Attendance.find({ date: { $gte: dayStart, $lt: dayEnd } })
      .populate('employee', 'firstName lastName employeeId profilePhoto department office')
      .lean(),
    Leave.find({ status: 'Approved', startDate: { $lt: dayEnd }, endDate: { $gte: dayStart } })
      .select('employee')
      .lean(),
  ]);

  const recMap = new Map();
  records.forEach((r) => recMap.set(String(r.employee._id), r));
  const leaveSet = new Set();
  leaves.forEach((l) => leaveSet.add(String(l.employee._id)));

  return employees.map((emp) => {
    const rec = recMap.get(String(emp._id));
    if (rec) return { employee: emp, record: rec, status: rec.status };
    if (leaveSet.has(String(emp._id))) return { employee: emp, record: null, status: 'On Leave' };
    return { employee: emp, record: null, status: 'Absent' };
  });
}

// @route  POST /api/attendance/check-in
const checkIn = asyncHandler(async (req, res) => {
  const employee = req.user.employee;
  if (!employee) return res.status(403).json({ success: false, message: 'Only employees can check in' });

  const empDoc = await Employee.findById(employee);
  if (!empDoc) return res.status(404).json({ success: false, message: 'Employee profile not found' });
  if (empDoc.status !== 'Active') {
    return res.status(403).json({ success: false, message: 'Your account is inactive. Please contact HR.' });
  }

  const settings = await getAttendanceSettings();
  const faceRequired = settings.faceEnabled !== false;
  const geoRequired = settings.geoEnabled !== false;

  if (faceRequired && (!req.file || !req.file.buffer)) {
    return res.status(400).json({ success: false, message: 'A face photo is required to check in' });
  }

  const today = startOfDay(new Date());
  const existing = await Attendance.findOne({ employee: req.user.employee, date: today });

  if (existing) {
    if (existing.checkInTime && existing.checkOutTime) {
      return res.status(409).json({
        success: false,
        message: 'You have already completed today\'s attendance.',
        code: 'COMPLETED',
        data: existing,
      });
    }
    if (existing.checkInTime) {
      return res.status(409).json({
        success: false,
        message: `Already checked in today at ${new Date(existing.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Would you like to check out?`,
        code: 'ALREADY_CHECKED_IN',
        data: existing,
      });
    }
  }

  const checkInLocation = parseLocation(req.body.location);
  const geofence = evaluateGeofence(settings, checkInLocation);
  if (!geofence.ok) {
    return res.status(403).json({
      success: false,
      message: geofence.message,
      code: geofence.code,
      data: { distance: geofence.distance, allowed: geofence.allowed },
    });
  }

  let verification = { ok: true, distance: null, message: '' };
  if (faceRequired) {
    verification = await verifyAgainstProfile({
      employeeId: req.user.employee,
      buffer: req.file.buffer,
      clientDescriptor: parseDescriptor(req.body.descriptor),
    });

    if (!verification.ok) {
      return res.status(400).json({ success: false, message: verification.message, code: verification.code, data: verification });
    }
  }

  const now = new Date();
  let checkInPhoto = null;
  if (req.file && req.file.buffer) {
    const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    checkInPhoto = saveBuffer(req.file.buffer, ext);
  }
  const checkInDistanceFromCompany = geofence.distance;
  const faceVerified = faceRequired && verification.ok;
  const geoVerified = geoRequired;
  const method = faceRequired ? 'Face' : 'Self Service';

  const { status, lateMinutes } = await evaluateCheckInStatus(today, now);

  try {
    const record = await Attendance.create({
      employee: req.user.employee,
      employeeId: empDoc.employeeId,
      date: today,
      dayName: getDayName(today),
      checkInTime: now,
      status,
      lateMinutes,
      checkInPhoto,
      checkInLocation,
      checkInDistanceFromCompany,
      checkInMatchDistance: faceRequired ? verification.distance : undefined,
      faceVerified,
      geoVerified,
      source: method,
      verification: {
        faceVerified,
        faceDistance: faceRequired ? (verification.distance ?? null) : null,
        faceAt: faceVerified ? now : null,
        geoRequired,
        geoVerified,
        geoDistance: geofence.distance ?? null,
        geoAllowedRadius: geofence.allowed ?? null,
        method,
        verifiedAt: now,
      },
      deviceInfo: summarizeDevice(req),
    });

    return res.status(201).json({
      success: true,
      message: status === 'Late' ? `Check-in successful. You are late by ${lateMinutes} minutes.` : 'Check-in successful',
      data: record,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already checked in today.',
        code: 'ALREADY_CHECKED_IN',
      });
    }
    throw err;
  }
});

// @route  POST /api/attendance/check-out
const checkOut = asyncHandler(async (req, res) => {
  const employee = req.user.employee;
  if (!employee) return res.status(403).json({ success: false, message: 'Only employees can check out' });

  const settings = await getAttendanceSettings();
  const faceRequired = settings.faceEnabled !== false;
  const geoRequired = settings.geoEnabled !== false;

  if (faceRequired && (!req.file || !req.file.buffer)) {
    return res.status(400).json({ success: false, message: 'A face photo is required to check out' });
  }

  const today = startOfDay(new Date());
  const record = await Attendance.findOne({ employee: req.user.employee, date: today });
  if (!record || !record.checkInTime) {
    return res.status(400).json({
      success: false,
      message: 'You have not checked in today.',
      code: 'NOT_CHECKED_IN',
    });
  }
  if (record.checkOutTime) {
    return res.status(409).json({
      success: false,
      message: 'You have already checked out today.',
      code: 'ALREADY_CHECKED_OUT',
    });
  }

  const checkOutLocation = parseLocation(req.body.location);
  const geofence = evaluateGeofence(settings, checkOutLocation);
  if (!geofence.ok) {
    return res.status(403).json({
      success: false,
      message: geofence.message,
      code: geofence.code,
      data: { distance: geofence.distance, allowed: geofence.allowed },
    });
  }

  let verification = { ok: true, distance: null, message: '' };
  if (faceRequired) {
    verification = await verifyAgainstProfile({
      employeeId: req.user.employee,
      buffer: req.file.buffer,
      clientDescriptor: parseDescriptor(req.body.descriptor),
    });

    if (!verification.ok) {
      return res.status(400).json({ success: false, message: verification.message, code: verification.code, data: verification });
    }
  }

  const now = new Date();
  let checkOutPhoto = null;
  if (req.file && req.file.buffer) {
    const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
    checkOutPhoto = saveBuffer(req.file.buffer, ext);
  }

  const workingHoursMinutes = Math.max(0, Math.round((now - record.checkInTime) / 60000));
  const status = await computeFinalStatus(record.checkInTime, now, record.status);

  record.checkOutTime = now;
  record.checkOutPhoto = checkOutPhoto;
  record.checkOutLocation = checkOutLocation;
  record.checkOutDistanceFromCompany = geofence.distance;
  record.checkOutMatchDistance = faceRequired ? verification.distance : undefined;
  record.workingHoursMinutes = workingHoursMinutes;
  record.status = status;
  record.geoVerified = geoRequired || record.geoVerified;
  if (faceRequired) record.faceVerified = record.faceVerified && verification.ok;
  record.verification = {
    ...(record.verification ? record.verification.toObject?.() || record.verification : {}),
    faceVerified: faceRequired ? verification.ok : Boolean(record.faceVerified),
    faceDistance: faceRequired ? (verification.distance ?? null) : (record.verification?.faceDistance ?? null),
    geoRequired,
    geoVerified: geoRequired,
    geoDistance: geofence.distance ?? null,
    geoAllowedRadius: geofence.allowed ?? null,
    method: faceRequired ? (record.verification?.method || 'Face') : 'Self Service',
    verifiedAt: now,
  };
  if (!faceRequired && !record.source) record.source = 'Self Service';
  await record.save();

  res.json({
    success: true,
    message: 'Check-out successful',
    data: record,
    summary: { workingHours: formatDuration(workingHoursMinutes) },
  });
});

// @route  GET /api/attendance  (admin records list, with filters + pagination)
const getRecords = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 200);
  const { date, from, to, status, department, search, employee } = req.query;

  const filter = {};
  if (date) {
    filter.date = { $gte: startOfDay(new Date(date)), $lt: endOfDay(new Date(date)) };
  } else if (from || to) {
    const range = {};
    if (from) range.$gte = startOfDay(new Date(from));
    if (to) range.$lt = endOfDay(new Date(to));
    filter.date = range;
  }
  if (status && !['Absent', 'On Leave'].includes(status)) filter.status = status;

  const employeeFilter = {};
  if (department) employeeFilter.department = department;
  if (employee && /^[0-9a-fA-F]{24}$/.test(String(employee))) {
    filter.employee = employee;
  }
  if (search) {
    const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    employeeFilter.$or = [{ firstName: re }, { lastName: re }, { employeeId: re }, { email: re }];
  }
  if (Object.keys(employeeFilter).length) {
    const emps = await Employee.find(employeeFilter).select('_id').lean();
    filter.employee = { $in: emps.map((e) => e._id) };
  }

  const sort = {};
  sort[req.query.sortBy === 'checkInTime' ? 'checkInTime' : 'date'] = req.query.order === 'asc' ? 1 : -1;

  const [total, records] = await Promise.all([
    Attendance.countDocuments(filter),
    Attendance.find(filter)
      .sort({ ...sort, createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate({ path: 'employee', select: 'firstName lastName employeeId email profilePhoto department designation', populate: 'department designation' })
      .lean(),
  ]);

  res.json({
    success: true,
    data: records,
    meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  });
});

// @route  GET /api/attendance/today  (admin + optionally employee view)
const getToday = asyncHandler(async (req, res) => {
  const today = new Date();

  if (req.user.role === 'employee' && req.user.employee) {
    const employees = await Employee.find({ _id: req.user.employee }).select('firstName lastName employeeId profilePhoto').lean();
    const rows = await computeDayStatus(employees, today);
    return res.json({ success: true, data: { date: toDateKey(today), rows } });
  }

  const reqDate = req.query.date ? new Date(req.query.date) : today;
  const department = req.query.department;

  const empFilter = { status: 'Active' };
  if (department) empFilter.department = department;
  const employees = await Employee.find(empFilter)
    .populate('department', 'name')
    .sort({ firstName: 1 })
    .lean();

  const rows = await computeDayStatus(employees, reqDate);

  const summarize = (list) => list.reduce(
    (acc, r) => {
      if (r.status in acc) acc[r.status] += 1;
      return acc;
    },
    { Present: 0, Late: 0, Absent: 0, 'On Leave': 0, 'Half Day': 0 }
  );

  const counts = summarize(rows);

  res.json({
    success: true,
    data: {
      date: toDateKey(reqDate),
      totals: {
        totalEmployees: employees.length,
        present: counts.Present,
        late: counts.Late,
        absent: counts.Absent,
        onLeave: counts['On Leave'],
        halfDay: counts['Half Day'],
      },
      rows,
    },
  });
});

// @route  GET /api/attendance/:employeeId?month=&year=  (owner or admin)
const getMonthly = asyncHandler(async (req, res) => {
  const employeeId = req.params.employeeId || req.user.employee;
  if (!employeeId) return res.status(400).json({ success: false, message: 'Employee is required' });

  const emp = await Employee.findById(employeeId);
  if (!emp) return res.status(404).json({ success: false, message: 'Employee not found' });
  if (req.user.role === 'employee' && String(req.user.employee) !== String(employeeId)) {
    return res.status(403).json({ success: false, message: 'You can only view your own attendance' });
  }

  const y = parseInt(req.query.year, 10) || new Date().getFullYear();
  const m = parseInt(req.query.month, 10) || new Date().getMonth();
  const { start, end } = monthRange(y, m);

  const [records, leaves] = await Promise.all([
    Attendance.find({ employee: employeeId, date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean(),
    Leave.find({
      employee: employeeId,
      status: 'Approved',
      startDate: { $lt: end },
      endDate: { $gte: start },
    }).lean(),
  ]);

  const recMap = new Map(records.map((r) => [toDateKey(r.date), r]));
  const leaveDays = new Set();
  leaves.forEach((l) => {
    const d = diffDays(l.startDate, l.endDate);
    for (let i = 0; i < d; i++) {
      const day = new Date(l.startDate);
      day.setDate(l.startDate.getDate() + i);
      leaveDays.add(toDateKey(day));
    }
  });

  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(y, m, d);
    const key = toDateKey(dayDate);
    const record = recMap.get(key) || null;
    let status = 'Absent';
    if (isWeekend(dayDate)) status = 'Weekend';
    else if (record) status = record.status;
    else if (leaveDays.has(key)) status = 'On Leave';

    days.push({
      date: key,
      day: d,
      dayName: getDayName(dayDate),
      isWeekend: isWeekend(dayDate),
      status,
      record,
    });
  }

  const presentDays = days.filter((d) => d.record).length;
  const totalHours = records.reduce((s, r) => s + (r.workingHoursMinutes || 0), 0);

  res.json({
    success: true,
    data: {
      employee: { _id: emp._id, employeeId: emp.employeeId, fullName: emp.fullName },
      year: y,
      month: m,
      days,
      summary: {
        presentDays,
        absentDays: days.filter((d) => d.status === 'Absent').length,
        lateDays: days.filter((d) => d.status === 'Late').length,
        leaveDays: leaveDays.size,
        weekendDays: days.filter((d) => d.status === 'Weekend').length,
        totalHours,
      },
    },
  });
});

/**
 * Shared attendance marking used by both the employee self-service flow and
 * the admin-mediated flow. `mode` is 'check-in' or 'check-out'. The employee's
 * registered face profile is always verified before a record is created.
 */
async function performMarkAttendance(employeeId, mode, req) {
  if (!employeeId) return { status: 400, message: 'Employee is required' };

  const empDoc = await Employee.findById(employeeId);
  if (!empDoc) return { status: 404, message: 'Employee profile not found' };
  if (empDoc.status !== 'Active') {
    return { status: 403, message: 'This employee account is inactive. Please contact HR.' };
  }

  const settings = await getAttendanceSettings();
  if (settings.faceEnabled === false) {
    return {
      status: 403,
      code: 'FACE_DISABLED',
      message: 'Face attendance is currently disabled by your administrator.',
    };
  }

  const location = parseLocation(req.body.location);

  const geofence = evaluateGeofence(settings, location);
  if (!geofence.ok) {
    return { status: 403, code: geofence.code, message: geofence.message, data: { distance: geofence.distance, allowed: geofence.allowed } };
  }
  const distanceFromCompany = geofence.distance;

  if (!req.file || !req.file.buffer) {
    return { status: 400, message: 'A face photo is required to mark attendance' };
  }

  const today = startOfDay(new Date());
  const existing = await Attendance.findOne({ employee: employeeId, date: today });

  if (mode === 'check-in') {
    if (existing && existing.checkInTime && existing.checkOutTime) {
      return { status: 409, message: 'Today\'s attendance is already completed.', code: 'COMPLETED', data: existing };
    }
    if (existing && existing.checkInTime) {
      return {
        status: 409,
        message: `Already checked in today at ${new Date(existing.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Would you like to check out?`,
        code: 'ALREADY_CHECKED_IN',
        data: existing,
      };
    }
  } else {
    if (!existing || !existing.checkInTime) {
      return { status: 400, message: 'This employee has not checked in today.', code: 'NOT_CHECKED_IN' };
    }
    if (existing.checkOutTime) {
      return { status: 409, message: 'This employee has already checked out today.', code: 'ALREADY_CHECKED_OUT' };
    }
  }

  const verification = await verifyAgainstProfile({
    employeeId,
    buffer: req.file.buffer,
    clientDescriptor: parseDescriptor(req.body.descriptor),
  });

  if (!verification.ok) {
    return { status: 400, message: verification.message, code: verification.code, data: verification };
  }

  const faceVerified = true;
  const matchDistance = verification.distance;
  const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const photo = saveBuffer(req.file.buffer, ext);

  const now = new Date();
  const deviceInfo = summarizeDevice(req);

  if (mode === 'check-in') {
    const { status, lateMinutes } = await evaluateCheckInStatus(today, now);
    try {
      const record = await Attendance.create({
        employee: employeeId,
        employeeId: empDoc.employeeId,
        date: today,
        dayName: getDayName(today),
        checkInTime: now,
        status,
        lateMinutes,
        checkInPhoto: photo,
        checkInLocation: location,
        checkInDistanceFromCompany: distanceFromCompany,
        checkInMatchDistance: matchDistance,
        faceVerified,
        deviceInfo,
      });
      return {
        status: 201,
        message: status === 'Late' ? `Check-in successful. You are late by ${lateMinutes} minutes.` : 'Check-in successful',
        data: record,
      };
    } catch (err) {
      if (err.code === 11000) {
        return { status: 409, message: 'This employee has already checked in today.', code: 'ALREADY_CHECKED_IN' };
      }
      throw err;
    }
  }

  const workingHoursMinutes = Math.max(0, Math.round((now - existing.checkInTime) / 60000));
  const status = await computeFinalStatus(existing.checkInTime, now, existing.status);

  existing.checkOutTime = now;
  existing.checkOutPhoto = photo;
  existing.checkOutLocation = location;
  existing.checkOutDistanceFromCompany = distanceFromCompany;
  existing.checkOutMatchDistance = matchDistance;
  existing.faceVerified = existing.faceVerified || faceVerified;
  existing.workingHoursMinutes = workingHoursMinutes;
  existing.status = status;
  await existing.save();

  return {
    status: 200,
    message: 'Check-out successful',
    data: existing,
    summary: { workingHours: formatDuration(workingHoursMinutes) },
  };
}

function respondAttendance(res, result) {
  const body = { success: result.status < 400, message: result.message };
  if (result.code) body.code = result.code;
  if (result.data) body.data = result.data;
  if (result.summary) body.summary = result.summary;
  return res.status(result.status).json(body);
}

// @route  POST /api/attendance/admin/:employeeId/check-in  (admin only)
const adminCheckIn = asyncHandler(async (req, res) => {
  const result = await performMarkAttendance(String(req.params.employeeId), 'check-in', req);
  return respondAttendance(res, result);
});

// @route  GET /api/attendance/admin/:employeeId/check-out  (admin only)
const adminCheckOut = asyncHandler(async (req, res) => {
  const result = await performMarkAttendance(String(req.params.employeeId), 'check-out', req);
  return respondAttendance(res, result);
});

/* ------------------------------------------------------------------
 * Admin manual attendance marking & correction.
 * These never claim face or GPS verification — source is always Manual.
 * ------------------------------------------------------------------ */

const MANUAL_STATUSES = ['Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Holiday', 'Weekly Off', 'Pending Review'];

function parseManualTime(value, fallbackDate) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d;
  const [h, m] = String(value).split(':').map((p) => parseInt(p, 10));
  if (Number.isNaN(h)) return null;
  const base = fallbackDate instanceof Date ? new Date(fallbackDate) : new Date();
  base.setHours(h || 0, m || 0, 0, 0);
  return base;
}

// Human-readable time (e.g. "06:30 PM") for messages shown to admins.
function formatTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function manualAudit(field, oldValue, newValue, reason, req) {
  return {
    field,
    oldValue: oldValue === undefined ? null : oldValue,
    newValue: newValue === undefined ? null : newValue,
    reason: String(reason || '').trim(),
    by: req.user.id,
    byName: req.user.name || '',
    at: new Date(),
  };
}

// @route  GET /api/attendance/record/:id  (admin + owner)
const getAttendanceDetail = asyncHandler(async (req, res) => {
  const record = await Attendance.findById(req.params.id)
    .populate({ path: 'employee', select: 'firstName lastName employeeId email department designation', populate: 'department designation' })
    .populate('markedBy', 'name')
    .lean();
  if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });
  if (req.user.role === 'employee' && String(req.user.employee) !== String(record.employee?._id)) {
    return res.status(403).json({ success: false, message: 'You can only view your own attendance' });
  }
  res.json({ success: true, data: record });
});

// @route  POST /api/attendance/mark  (admin only — manual entry)
const manualMarkAttendance = asyncHandler(async (req, res) => {
  const { employeeId, date, action, status, reason, remarks } = req.body;
  if (!employeeId) return res.status(400).json({ success: false, message: 'Employee is required' });
  if (!date) return res.status(400).json({ success: false, message: 'Attendance date is required' });
  if (!['check-in', 'check-out'].includes(action)) {
    return res.status(400).json({ success: false, message: 'Attendance action must be Check-In or Check-Out' });
  }
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ success: false, message: 'A reason is required for manual attendance' });
  }

  const empDoc = await Employee.findById(employeeId);
  if (!empDoc) return res.status(404).json({ success: false, message: 'Employee not found' });
  if (empDoc.status !== 'Active') {
    return res.status(403).json({ success: false, message: 'This employee account is inactive' });
  }

  const attendanceDate = startOfDay(new Date(date));
  if (Number.isNaN(attendanceDate.getTime())) {
    return res.status(400).json({ success: false, message: 'Invalid attendance date' });
  }

  let time = parseManualTime(req.body.time, attendanceDate);
  if (!time) return res.status(400).json({ success: false, message: 'A valid time is required' });

  const chosenStatus = MANUAL_STATUSES.includes(status) ? status : undefined;
  const existing = await Attendance.findOne({ employee: empDoc._id, date: attendanceDate });
  const now = new Date();

  if (action === 'check-in') {
    if (existing && existing.checkInTime) {
      return res.status(409).json({
        success: false,
        message: `This employee already has a check-in at ${formatTime(existing.checkInTime)} on ${toDateKey(attendanceDate)}. Use correction to modify it.`,
        code: 'ALREADY_CHECKED_IN',
        data: existing,
      });
    }
    const record = existing || await Attendance.create({
      employee: empDoc._id,
      employeeId: empDoc.employeeId,
      date: attendanceDate,
      dayName: getDayName(attendanceDate),
    });
    const previous = record.checkInTime;
    const evaluated = await evaluateCheckInStatus(attendanceDate, time);
    record.checkInTime = time;
    record.checkOutTime = null;
    record.status = chosenStatus || evaluated.status;
    record.lateMinutes = chosenStatus === 'Late' ? evaluated.lateMinutes : 0;
    record.source = 'Manual';
    record.faceVerified = false;
    record.geoVerified = false;
    record.manualReason = String(reason).trim();
    record.manualRemarks = String(remarks || '').trim();
    record.markedBy = req.user.id;
    record.markedByName = req.user.name || '';
    record.deviceInfo = summarizeDevice(req);
    record.audit.push(manualAudit('check-in', previous, time, reason, req));
    await record.save();
    return res.status(201).json({ success: true, message: 'Manual check-in recorded', data: record });
  }

  // check-out
  if (!existing || !existing.checkInTime) {
    return res.status(400).json({ success: false, message: 'This employee has not checked in on this date', code: 'NOT_CHECKED_IN' });
  }
  if (existing.checkOutTime) {
    return res.status(409).json({
      success: false,
      message: `This employee already checked out at ${formatTime(existing.checkOutTime)} on ${toDateKey(attendanceDate)}. Use correction to modify it.`,
      code: 'ALREADY_CHECKED_OUT',
      data: existing,
    });
  }
  if (time <= existing.checkInTime) {
    return res.status(400).json({ success: false, message: 'Check-out time cannot be before the check-in time', code: 'INVALID_SEQUENCE' });
  }
  const previous = existing.checkOutTime;
  existing.checkOutTime = time;
  existing.workingHoursMinutes = Math.max(0, Math.round((time - existing.checkInTime) / 60000));
  if (chosenStatus) {
    existing.status = chosenStatus;
  } else {
    existing.status = await computeFinalStatus(existing.checkInTime, time, existing.status);
  }
  existing.source = 'Manual';
  existing.faceVerified = false;
  existing.geoVerified = false;
  existing.manualReason = String(reason).trim();
  existing.manualRemarks = String(remarks || '').trim();
  existing.markedBy = req.user.id;
  existing.markedByName = req.user.name || '';
  existing.audit.push(manualAudit('check-out', previous, time, reason, req));
  await existing.save();
  return res.json({ success: true, message: 'Manual check-out recorded', data: existing });
});

// @route  PUT /api/attendance/:id/correct  (admin only — correction with audit)
const correctAttendance = asyncHandler(async (req, res) => {
  const { checkInTime, checkOutTime, status, reason, remarks } = req.body;
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ success: false, message: 'A reason is required to correct an attendance record' });
  }
  const record = await Attendance.findById(req.params.id);
  if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });

  const audits = [];
  if (checkInTime !== undefined && checkInTime !== null && checkInTime !== '') {
    const t = parseManualTime(checkInTime, record.date);
    if (!t) return res.status(400).json({ success: false, message: 'Invalid check-in time' });
    audits.push(manualAudit('check-in', record.checkInTime, t, reason, req));
    record.checkInTime = t;
  }
  if (checkOutTime !== undefined && checkOutTime !== null && checkOutTime !== '') {
    const t = parseManualTime(checkOutTime, record.date);
    if (!t) return res.status(400).json({ success: false, message: 'Invalid check-out time' });
    if (record.checkInTime && t <= record.checkInTime) {
      return res.status(400).json({ success: false, message: 'Check-out time cannot be before the check-in time', code: 'INVALID_SEQUENCE' });
    }
    audits.push(manualAudit('check-out', record.checkOutTime, t, reason, req));
    record.checkOutTime = t;
  }

  if (status && MANUAL_STATUSES.includes(status)) {
    audits.push(manualAudit('status', record.status, status, reason, req));
    record.status = status;
  }
  if (remarks !== undefined) {
    record.manualRemarks = String(remarks).trim();
  }

  if (record.checkInTime && record.checkOutTime) {
    record.workingHoursMinutes = Math.max(0, Math.round((record.checkOutTime - record.checkInTime) / 60000));
  }
  record.source = 'Manual';
  record.faceVerified = false;
  record.geoVerified = false;
  record.manualReason = String(reason).trim();
  record.markedBy = req.user.id;
  record.markedByName = req.user.name || '';
  record.audit.push(...audits);
  await record.save();

  const populated = await Attendance.findById(record._id)
    .populate({ path: 'employee', select: 'firstName lastName employeeId department designation', populate: 'department designation' })
    .lean();
  res.json({ success: true, message: 'Attendance record corrected. Change recorded in audit history.', data: populated });
});

module.exports = { checkIn, checkOut, getRecords, getToday, getMonthly, computeDayStatus, adminCheckIn, adminCheckOut, getAttendanceDetail, manualMarkAttendance, correctAttendance };