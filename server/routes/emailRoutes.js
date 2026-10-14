const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const { getConfig, sendDocumentEmail, listEmails, retryEmail } = require('../controllers/emailController');

router.use(protect, apiLimiter);

router.get('/config', authorize('admin'), getConfig);
router.get('/', authorize('admin'), listEmails);
router.post('/send-document', authorize('admin'), sendDocumentEmail);
router.post('/:id/retry', authorize('admin'), retryEmail);

module.exports = router;
