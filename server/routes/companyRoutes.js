const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
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
} = require('../controllers/companyController');

router.use(protect, apiLimiter);

router.get('/details', authorize('admin'), getDetails);
router.put('/details', authorize('admin'), putDetails);
router.get('/statutory', authorize('admin'), getStatutory);
router.put('/statutory', authorize('admin'), putStatutory);
router.get('/payroll-policy', authorize('admin'), getPayrollPolicyCfg);
router.put('/payroll-policy', authorize('admin'), putPayrollPolicyCfg);
router.get('/email', authorize('admin'), getEmailCfg);
router.put('/email', authorize('admin'), putEmailCfg);

router.get('/shifts', authorize('admin'), listShifts);
router.post('/shifts', authorize('admin'), createShift);
router.put('/shifts/:id', authorize('admin'), updateShift);
router.delete('/shifts/:id', authorize('admin'), deleteShift);

router.get('/attendance-policies', authorize('admin'), listPolicies);
router.post('/attendance-policies', authorize('admin'), createPolicy);
router.put('/attendance-policies/:id', authorize('admin'), updatePolicy);
router.delete('/attendance-policies/:id', authorize('admin'), deletePolicy);

module.exports = router;
