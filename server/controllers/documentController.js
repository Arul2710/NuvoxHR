const Employee = require('../models/Employee');
const EmployeeDocument = require('../models/EmployeeDocument');
const asyncHandler = require('../utils/asyncHandler');

const DOC_TYPES = EmployeeDocument.DOC_TYPES;

const REQUIRED_FIELDS = {
  'Offer Letter': ['position', 'proposedJoiningDate'],
  'Appointment Letter': ['designationLabel', 'employmentStartDate'],
  'Experience Letter': ['designationLabel', 'startDate', 'endDate'],
  'Relieving Letter': ['resignationDate', 'lastWorkingDay'],
};

const str = (v) => (v === null || v === undefined ? '' : String(v).trim());
const sanitizeId = (v) => (v && /^[0-9a-fA-F]{24}$/.test(String(v)) ? v : null);

function normalizeFields(raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  Object.entries(src).forEach(([k, v]) => {
    if (v === null || v === undefined) return;
    out[k] = typeof v === 'string' ? v.trim() : v;
  });
  return out;
}

function buildSummary(employee, fields, doc) {
  return {
    employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
    employeeId: employee.employeeId,
    designation: fields.designationLabel || employee.designation?.name || '',
    department: employee.department?.name || '',
    issuedDate: doc.issuedDate,
    signatory: fields.signatoryName || '',
  };
}

// @route GET /api/documents
const listDocuments = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 100);
  const filter = {};
  if (req.query.type && DOC_TYPES.includes(req.query.type)) filter.type = req.query.type;
  if (req.query.employeeId) filter.employee = sanitizeId(req.query.employeeId);

  if (req.query.search) {
    const re = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const emps = await Employee.find({ $or: [{ firstName: re }, { lastName: re }, { employeeId: re }, { email: re }] }).select('_id').lean();
    filter.employee = { $in: emps.map((e) => e._id) };
  }

  const [total, docs] = await Promise.all([
    EmployeeDocument.countDocuments(filter),
    EmployeeDocument.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate({ path: 'employee', select: 'firstName lastName employeeId email department designation', populate: 'department designation' })
      .lean(),
  ]);

  res.json({ success: true, data: docs, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
});

// @route GET /api/documents/employee/:employeeId
const getEmployeeDocuments = asyncHandler(async (req, res) => {
  // Employees may only read their own documents.
  if (req.user.role === 'employee' && String(req.user.employee) !== String(req.params.employeeId)) {
    return res.status(403).json({ success: false, message: 'You can only view your own documents' });
  }
  const docs = await EmployeeDocument.find({ employee: req.params.employeeId }).sort({ type: 1, version: -1 }).lean();
  res.json({ success: true, data: docs });
});

// @route GET /api/documents/:id
const getDocument = asyncHandler(async (req, res) => {
  const doc = await EmployeeDocument.findById(req.params.id)
    .populate({ path: 'employee', select: 'firstName lastName employeeId email department designation joiningDate', populate: 'department designation' })
    .lean();
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
  if (req.user.role === 'employee' && String(req.user.employee) !== String(doc.employee?._id)) {
    return res.status(403).json({ success: false, message: 'You can only view your own documents' });
  }
  res.json({ success: true, data: doc });
});

async function createVersion(employee, type, fields, meta) {
  const latest = await EmployeeDocument.findOne({ employee: employee._id, type }).sort({ version: -1 }).select('version').lean();
  const version = (latest?.version || 0) + 1;
  const doc = await EmployeeDocument.create({
    employee: employee._id,
    employeeId: employee.employeeId,
    type,
    title: `${type}`,
    version,
    fields,
    summary: buildSummary(employee, fields, { issuedDate: meta.issuedDate }),
    status: 'Final',
    issuedDate: meta.issuedDate,
    generatedBy: meta.user?.id || null,
    generatedByName: meta.user?.name || '',
    generatedAt: new Date(),
  });
  return doc;
}

// @route POST /api/documents
const createDocument = asyncHandler(async (req, res) => {
  const { employeeId, type } = req.body;
  if (!DOC_TYPES.includes(type)) return res.status(400).json({ success: false, message: 'A valid document type is required' });
  const employee = await Employee.findById(sanitizeId(employeeId)).populate('department designation');
  if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

  const fields = normalizeFields(req.body.fields);
  const required = REQUIRED_FIELDS[type] || [];
  const missing = required.filter((k) => !str(fields[k]));
  if (missing.length) {
    return res.status(400).json({ success: false, message: `Please provide required details before generating: ${missing.join(', ')}` });
  }

  const issuedDate = req.body.issuedDate ? new Date(req.body.issuedDate) : new Date();
  const doc = await createVersion(employee, type, fields, { issuedDate, user: req.user });
  res.status(201).json({ success: true, message: `${type} generated`, data: doc });
});

// @route PUT /api/documents/:id  (creates a new version, keeps history)
const updateDocument = asyncHandler(async (req, res) => {
  const existing = await EmployeeDocument.findById(req.params.id);
  if (!existing) return res.status(404).json({ success: false, message: 'Document not found' });
  const employee = await Employee.findById(existing.employee).populate('department designation');
  if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

  const fields = { ...(existing.fields || {}), ...normalizeFields(req.body.fields) };
  const required = REQUIRED_FIELDS[existing.type] || [];
  const missing = required.filter((k) => !str(fields[k]));
  if (missing.length) return res.status(400).json({ success: false, message: `Missing required details: ${missing.join(', ')}` });

  const issuedDate = req.body.issuedDate ? new Date(req.body.issuedDate) : existing.issuedDate;
  const doc = await createVersion(employee, existing.type, fields, { issuedDate, user: req.user });
  res.json({ success: true, message: 'Document updated (new version created)', data: doc });
});

// @route DELETE /api/documents/:id
const deleteDocument = asyncHandler(async (req, res) => {
  const doc = await EmployeeDocument.findById(req.params.id);
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
  await doc.deleteOne();
  res.json({ success: true, message: 'Document deleted' });
});

module.exports = { listDocuments, getEmployeeDocuments, getDocument, createDocument, updateDocument, deleteDocument, DOC_TYPES, REQUIRED_FIELDS };
