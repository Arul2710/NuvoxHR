const mongoose = require('mongoose');

const DOC_TYPES = ['Offer Letter', 'Appointment Letter', 'Experience Letter', 'Relieving Letter'];

const employeeDocumentSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    employeeId: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, enum: DOC_TYPES, required: true },
    title: { type: String, trim: true, default: '' },
    version: { type: Number, default: 1 },
    fields: { type: mongoose.Schema.Types.Mixed, default: {} },
    summary: {
      employeeName: String,
      designation: String,
      department: String,
      issuedDate: Date,
      signatory: String,
    },
    status: { type: String, enum: ['Draft', 'Final'], default: 'Final' },
    issuedDate: { type: Date, default: Date.now },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    generatedByName: { type: String, trim: true, default: '' },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

employeeDocumentSchema.index({ employee: 1, type: 1, version: -1 });

module.exports = mongoose.model('EmployeeDocument', employeeDocumentSchema);
module.exports.DOC_TYPES = DOC_TYPES;
