const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
  listPayroll,
  payrollSummary,
  generatePayroll,
  getPayroll,
  updatePayrollStatus,
  adjustPayroll,
  deletePayroll,
} = require('../controllers/payrollController');

router.use(protect, apiLimiter);

router.get('/', authorize('admin'), listPayroll);
router.get('/summary', authorize('admin'), payrollSummary);
router.post('/generate', authorize('admin'), generatePayroll);
router.get('/:id', authorize('admin'), getPayroll);
router.put('/:id/status', authorize('admin'), updatePayrollStatus);
router.post('/:id/adjust', authorize('admin'), adjustPayroll);
router.delete('/:id', authorize('admin'), deletePayroll);

module.exports = router;
