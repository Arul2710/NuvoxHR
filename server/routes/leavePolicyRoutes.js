const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  listBalances,
  getMyBalances,
  upsertBalance,
} = require('../controllers/leavePolicyController');

router.use(protect, apiLimiter);

router.get('/policies', authorize('admin'), listPolicies);
router.post('/policies', authorize('admin'), createPolicy);
router.put('/policies/:id', authorize('admin'), updatePolicy);
router.delete('/policies/:id', authorize('admin'), deletePolicy);
router.get('/balances', authorize('admin'), listBalances);
router.get('/balances/mine', authorize('employee'), getMyBalances);
router.put('/balances/:employeeId', authorize('admin'), upsertBalance);

module.exports = router;
