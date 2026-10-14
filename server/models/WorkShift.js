const mongoose = require('mongoose');

const workShiftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '18:00' },
    breakMinutes: { type: Number, default: 60, min: 0 },
    graceMinutes: { type: Number, default: 10, min: 0 },
    overnight: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('WorkShift', workShiftSchema);
