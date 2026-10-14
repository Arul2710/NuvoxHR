const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadProfilePhoto, uploadDocument } = require('../middleware/upload');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  setEmployeeStatus,
  getEmployeeAttendance,
  uploadEmployeeDocument,
  replaceEmployeeDocument,
  deleteEmployeeDocument,
  updateEmployeeSection,
  sendEmployeeLoginDetails,
  uploadEmployeePhoto,
} = require('../controllers/employeeController');
const { getPayrollConfig, updatePayrollConfig } = require('../controllers/payrollConfigController');

router.use(protect, apiLimiter);

router.get('/', authorize('admin'), getEmployees);
router.get('/:id/attendance', authorize('admin', 'employee'), getEmployeeAttendance);
router.get('/:id/payroll', authorize('admin'), getPayrollConfig);
router.patch('/:id/payroll', authorize('admin'), updatePayrollConfig);
router.get('/:id', authorize('admin', 'employee'), getEmployee);
router.post('/', authorize('admin'), uploadProfilePhoto, createEmployee);
router.put('/:id', authorize('admin'), uploadProfilePhoto, updateEmployee);
router.patch('/:id/status', authorize('admin'), setEmployeeStatus);
router.delete('/:id', authorize('admin'), deleteEmployee);
router.post('/:id/send-login', authorize('admin'), sendEmployeeLoginDetails);
router.post('/:id/photo', authorize('admin'), uploadProfilePhoto, uploadEmployeePhoto);
router.patch('/:id/sections/:section', authorize('admin'), updateEmployeeSection);
router.post('/:id/documents', authorize('admin'), uploadDocument, uploadEmployeeDocument);
router.put('/:id/documents/:docId', authorize('admin'), uploadDocument, replaceEmployeeDocument);
router.delete('/:id/documents/:docId', authorize('admin'), deleteEmployeeDocument);

module.exports = router;