const mongoose = require('mongoose');

const lineItemSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true },
    amount: { type: Number, default: 0 },
    category: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const adjustmentSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true },
    amount: { type: Number, default: 0 },
    type: { type: String, enum: ['earning', 'deduction'], default: 'earning' },
    reason: { type: String, trim: true, default: '' },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    byName: { type: String, trim: true, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const attendanceSummarySchema = new mongoose.Schema(
  {
    daysInMonth: { type: Number, default: 0 },
    workingDays: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    halfDays: { type: Number, default: 0 },
    paidLeaveDays: { type: Number, default: 0 },
    unpaidLeaveDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    weeklyOffDays: { type: Number, default: 0 },
    publicHolidays: { type: Number, default: 0 },
    paidHolidays: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    payableDays: { type: Number, default: 0 },
    workedMinutes: { type: Number, default: 0 },
    overtimeMinutes: { type: Number, default: 0 },
  },
  { _id: false }
);

const statutorySchema = new mongoose.Schema(
  {
    applicable: { type: Boolean, default: false },
    base: { type: Number, default: 0 },
    percent: { type: Number, default: 0 },
    employeeContribution: { type: Number, default: 0 },
    employerContribution: { type: Number, default: 0 },
    number: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const payrollSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    employeeId: { type: String, required: true, trim: true, uppercase: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 0, max: 11 },
    periodKey: { type: String, required: true, index: true }, // YYYY-MM
    status: { type: String, enum: ['Draft', 'Reviewed', 'Approved', 'Paid'], default: 'Draft' },
    currency: { type: String, default: 'INR' },
    salaryBasis: { type: String, default: 'Fixed (Monthly)' },
    baseSalary: { type: Number, default: 0 },
    attendance: { type: attendanceSummarySchema, default: () => ({}) },
    earnings: { type: [lineItemSchema], default: [] },
    deductions: { type: [lineItemSchema], default: [] },
    grossEarnings: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netSalary: { type: Number, default: 0 },
    pf: { type: statutorySchema, default: () => ({}) },
    esi: { type: statutorySchema, default: () => ({}) },
    paymentMode: { type: String, default: 'Bank Transfer' },
    slipNumber: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    adjustments: { type: [adjustmentSchema], default: [] },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    generatedByName: { type: String, trim: true, default: '' },
    generatedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

payrollSchema.index({ employee: 1, periodKey: 1 }, { unique: true });
payrollSchema.index({ periodKey: 1, status: 1 });

module.exports = mongoose.model('Payroll', payrollSchema);
