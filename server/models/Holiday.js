const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: {
      type: Date,
      required: true,
      set: (v) => (v instanceof Date ? new Date(v.getFullYear(), v.getMonth(), v.getDate()) : v),
    },
    type: { type: String, enum: ['Full Day', 'Partial Day'], default: 'Full Day' },
    partialHours: { type: Number, default: 0, min: 0 },
    paid: { type: Boolean, default: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    group: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// One holiday per date per applicable group/department.
holidaySchema.index({ date: 1, department: 1, group: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', holidaySchema);
