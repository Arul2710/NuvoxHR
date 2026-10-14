const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    address: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const auditEntrySchema = new mongoose.Schema(
  {
    field: { type: String, trim: true, default: '' },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, trim: true, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byName: { type: String, trim: true, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const verificationSchema = new mongoose.Schema(
  {
    faceVerified: { type: Boolean, default: false },
    faceDistance: { type: Number, default: null },
    faceAt: { type: Date, default: null },
    geoRequired: { type: Boolean, default: false },
    geoVerified: { type: Boolean, default: false },
    geoDistance: { type: Number, default: null },
    geoAllowedRadius: { type: Number, default: null },
    method: { type: String, default: '' }, // Face / Manual / Self Service
    verifiedAt: { type: Date, default: null },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    employeeId: { type: String, required: true, index: true, trim: true, uppercase: true },
    date: {
      type: Date,
      required: true,
      set: (v) => (v instanceof Date ? new Date(v.getFullYear(), v.getMonth(), v.getDate()) : v),
    },
    dayName: { type: String },
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Holiday', 'Weekly Off', 'Pending Review'],
      default: 'Present',
    },
    workingHoursMinutes: { type: Number, default: 0 },
    breakMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    checkInPhoto: { type: String, default: null },
    checkOutPhoto: { type: String, default: null },
    checkInLocation: { type: locationSchema, default: null },
    checkOutLocation: { type: locationSchema, default: null },
    checkInMatchDistance: { type: Number },
    checkOutMatchDistance: { type: Number },
    checkInDistanceFromCompany: { type: Number, default: null },
    checkOutDistanceFromCompany: { type: Number, default: null },
    faceVerified: { type: Boolean, default: false },
    geoVerified: { type: Boolean, default: false },
    // How this record was created. 'Manual' is never claimed as a face/GPS verification.
    source: { type: String, enum: ['Face', 'Self Service', 'Manual', 'System'], default: 'Face' },
    verification: { type: verificationSchema, default: () => ({}) },
    manualReason: { type: String, trim: true, default: '' },
    manualRemarks: { type: String, trim: true, default: '' },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    markedByName: { type: String, trim: true, default: '' },
    exceptionReason: { type: String, trim: true, default: '' },
    audit: { type: [auditEntrySchema], default: [] },
    deviceInfo: {
      userAgent: { type: String, default: '' },
      platform: { type: String, default: '' },
      screen: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

// Enforce a single attendance row per employee per calendar day.
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: -1 });
attendanceSchema.index({ employeeId: 1, date: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);