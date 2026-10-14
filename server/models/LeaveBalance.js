const mongoose = require('mongoose');

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    employeeId: { type: String, required: true, trim: true, uppercase: true },
    leaveType: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    allocated: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    carriedForward: { type: Number, default: 0 },
    adjusted: { type: Number, default: 0 },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

leaveBalanceSchema.index({ employee: 1, leaveType: 1, year: 1 }, { unique: true });

leaveBalanceSchema.virtual('remaining').get(function () {
  return Number((this.allocated + this.carriedForward + this.adjusted - this.used).toFixed(2));
});

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
