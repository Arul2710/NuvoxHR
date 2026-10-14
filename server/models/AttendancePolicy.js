const mongoose = require('mongoose');

const attendancePolicySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    weeklyOffDays: { type: [String], default: ['Sunday'] },
    alternateSaturdayOff: { type: Boolean, default: true },
    fullDayHours: { type: Number, default: 8, min: 0 },
    halfDayThresholdHours: { type: Number, default: 4, min: 0 },
    lateGraceMinutes: { type: Number, default: 10, min: 0 },
    overtimeAfterHours: { type: Number, default: 9, min: 0 },
    description: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AttendancePolicy', attendancePolicySchema);
