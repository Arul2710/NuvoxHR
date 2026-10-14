const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const { faceLimiter, apiLimiter } = require('../middleware/rateLimiter');
const {
  checkIn,
  checkOut,
  getRecords,
  getToday,
  getMonthly,
  adminCheckIn,
  adminCheckOut,
  getAttendanceDetail,
  manualMarkAttendance,
  correctAttendance,
} = require('../controllers/attendanceController');
const { getReport } = require('../controllers/reportController');

router.use(protect);

router.post('/check-in', authorize('employee'), faceLimiter, uploadImage, checkIn);
router.post('/check-out', authorize('employee'), faceLimiter, uploadImage, checkOut);
router.post('/admin/:employeeId/check-in', authorize('admin'), faceLimiter, uploadImage, adminCheckIn);
router.post('/admin/:employeeId/check-out', authorize('admin'), faceLimiter, uploadImage, adminCheckOut);

// Manual admin marking / correction and record detail (no multipart).
router.post('/mark', authorize('admin'), apiLimiter, manualMarkAttendance);
router.put('/:id/correct', authorize('admin'), apiLimiter, correctAttendance);

router.get('/report', authorize('admin'), apiLimiter, getReport);
router.get('/today', authorize('admin', 'employee'), apiLimiter, getToday);
// Declare before the parametric '/:employeeId' so "record" is not consumed as an id.
router.get('/record/:id', authorize('admin', 'employee'), apiLimiter, getAttendanceDetail);
router.get('/:employeeId', authorize('admin', 'employee'), apiLimiter, getMonthly);
router.get('/', authorize('admin'), apiLimiter, getRecords);

module.exports = router;
