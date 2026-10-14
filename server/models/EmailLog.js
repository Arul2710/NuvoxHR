const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema(
  {
    document: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeDocument', default: null },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    employeeId: { type: String, trim: true, uppercase: true, default: '' },
    type: { type: String, trim: true, default: '' },
    recipient: { type: String, required: true, lowercase: true, trim: true },
    cc: { type: String, trim: true, default: '' },
    sender: { type: String, lowercase: true, trim: true, default: '' },
    senderUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    subject: { type: String, trim: true, default: '' },
    body: { type: String, default: '' },
    // Only provider events may move this to 'Delivered'.
    status: { type: String, enum: ['Pending', 'Sent', 'Failed', 'Delivered'], default: 'Pending' },
    provider: { type: String, trim: true, default: 'smtp' },
    providerMessageId: { type: String, trim: true, default: '' },
    attachmentName: { type: String, trim: true, default: '' },
    attachmentPath: { type: String, trim: true, default: '' },
    error: { type: String, trim: true, default: '' },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

emailLogSchema.index({ employee: 1, createdAt: -1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
