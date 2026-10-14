const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
  listDocuments,
  getEmployeeDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
} = require('../controllers/documentController');

router.use(protect, apiLimiter);

router.get('/', authorize('admin'), listDocuments);
router.get('/employee/:employeeId', authorize('admin', 'employee'), getEmployeeDocuments);
router.get('/:id', authorize('admin', 'employee'), getDocument);
router.post('/', authorize('admin'), createDocument);
router.put('/:id', authorize('admin'), updateDocument);
router.delete('/:id', authorize('admin'), deleteDocument);

module.exports = router;
