const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require('../controllers/holidayController');

router.use(protect, apiLimiter);

router.get('/', authorize('admin'), listHolidays);
router.post('/', authorize('admin'), createHoliday);
router.put('/:id', authorize('admin'), updateHoliday);
router.delete('/:id', authorize('admin'), deleteHoliday);

module.exports = router;
