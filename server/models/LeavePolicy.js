const mongoose = require('mongoose');

const leavePolicySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    leaveType: {
      type: String,
      required: true,
      enum: ['Sick Leave', 'Casual Leave', 'Earned Leave', 'Maternity Leave', 'Paternity Leave', 'Unpaid Leave', 'Compensatory Off', 'Other'],
    },
    allowanceType: { type: String, enum: ['Annual', 'Monthly'], default: 'Annual' },
    allowance: { type: Number, default: 12, min: 0 },
    paid: { type: Boolean, default: true },
    maxConsecutiveDays: { type: Number, default: 0, min: 0 }, // 0 = no limit
    carryForward: {
      enabled: { type: Boolean, default: false },
      maxDays: { type: Number, default: 0, min: 0 },
    },
    approvalRequired: { type: Boolean, default: true },
    documentRequired: { type: Boolean, default: false },
    applicableGroups: { type: [String], default: [] },
    effectiveDate: { type: Date, default: Date.now },
    description: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeavePolicy', leavePolicySchema);
