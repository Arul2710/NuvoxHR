const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: [true, 'Employee ID is required'], unique: true, trim: true, uppercase: true },
    firstName: { type: String, required: [true, 'First name is required'], trim: true },
    middleName: { type: String, trim: true, default: '' },
    lastName: { type: String, required: [true, 'Last name is required'], trim: true },
    email: { type: String, required: [true, 'Email is required'], unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
    address: { type: String, trim: true },
    state: { type: String, trim: true, default: '' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    office: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', default: null },
    designation: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation', default: null },
    joiningDate: { type: Date, required: [true, 'Joining date is required'] },
    employmentType: {
      type: String,
      enum: ['Full-time', 'Part-time', 'Contract', 'Intern'],
      default: 'Full-time',
    },
    subDepartment: { type: String, trim: true, default: '' },
    subDepartment1: { type: String, trim: true, default: '' },
    subDepartment2: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: '' },
    subCategory: { type: String, trim: true, default: '' },
    grade: { type: String, trim: true, default: '' },
    reportingManager: { type: String, trim: true, default: '' },
    reportingManager2: { type: String, trim: true, default: '' },
    probation: { type: String, trim: true, default: '' },
    probationManage: { type: Boolean, default: false },
    totalExperience: { type: String, trim: true, default: '' },
    exEmployee: { type: Boolean, default: false },
    profilePhoto: { type: String, default: null },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

const contactAddressSchema = new mongoose.Schema(
  { line1: String, line2: String, city: String, state: String, country: String, pincode: String },
  { _id: false }
);

const contactSchema = new mongoose.Schema(
  {
    personalEmail: { type: String, lowercase: true, trim: true },
    alternateEmail: { type: String, lowercase: true, trim: true },
    mobileNumber: { type: String, trim: true },
    alternatePhone: { type: String, trim: true },
    sameAsCurrent: { type: Boolean, default: true },
    permanentAddress: { type: String, trim: true },
    address: contactAddressSchema,
  },
  { _id: false }
);

const bankDetailsSchema = new mongoose.Schema(
  {
    accountHolderName: String,
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    branchName: String,
    accountType: String,
  },
  { _id: false }
);

const personalInfoSchema = new mongoose.Schema(
  {
    maritalStatus: String,
    bloodGroup: String,
    nationality: String,
  },
  { _id: false }
);

const familyMemberSchema = new mongoose.Schema(
  {
    fullName: String,
    relationship: String,
    dateOfBirth: Date,
    phoneNumber: String,
    occupation: String,
    address: String,
  },
  { _id: false }
);

const experienceEntrySchema = new mongoose.Schema(
  {
    company: String,
    jobTitle: String,
    employmentType: { type: String, enum: ['Full-time', 'Part-time', 'Contract', 'Intern'] },
    startDate: Date,
    endDate: Date,
    currentlyWorking: { type: Boolean, default: false },
    location: String,
    description: String,
  },
  { _id: false }
);

const qualificationEntrySchema = new mongoose.Schema(
  {
    degree: String,
    institution: String,
    fieldOfStudy: String,
    startYear: String,
    endYear: String,
    grade: String,
    description: String,
  },
  { _id: false }
);

const fileRefSchema = new mongoose.Schema(
  { name: String, path: String, mimeType: String, size: Number, docId: String },
  { _id: false }
);

const certificationEntrySchema = new mongoose.Schema(
  {
    name: String,
    organization: String,
    issueDate: Date,
    expiryDate: Date,
    credentialId: String,
    credentialUrl: String,
    file: fileRefSchema,
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    fullName: String,
    relationship: String,
    primaryPhone: String,
    alternatePhone: String,
    email: String,
    address: String,
  },
  { _id: false }
);

const weekOffSchema = new mongoose.Schema(
  {
    weeklyOffDay: { type: String, default: '' },
    secondWeeklyOffDay: { type: String, default: '' },
    workingDays: { type: [String], default: [] },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    kind: { type: String, default: 'other' },
    originalName: String,
    fileName: String,
    path: String,
    mimeType: String,
    size: Number,
  },
  { _id: true, timestamps: true }
);

const salaryDetailsSchema = new mongoose.Schema(
  {
    ctc: Number,
    basicSalary: Number,
    hra: Number,
    specialAllowance: Number,
    otherAllowance: Number,
    monthlyGross: Number,
    monthlyDeductions: Number,
    netPay: Number,
    currency: { type: String, default: 'INR' },
    effectiveDate: Date,
    revisionDate: Date,
    notes: String,
  },
  { _id: false }
);

const pfDetailsSchema = new mongoose.Schema(
  {
    uan: String,
    pfNumber: String,
    pfStatus: { type: String, enum: ['Active', 'Inactive', 'Exempt'], default: 'Inactive' },
    vpf: { type: Boolean, default: false },
    contribution: Number,
    employerContribution: Number,
    pfStartDate: Date,
    pfExitDate: Date,
    remarks: String,
  },
  { _id: false }
);

const adminDetailsSchema = new mongoose.Schema(
  {
    salaryOn: String,
    otApplicable: String,
    attendancePolicy: String,
    workshift: String,
    paymentMode: String,
    ptApplicable: { type: Boolean, default: false },
    esicApplicable: { type: Boolean, default: false },
    esiNo: String,
    pfAsPerGovernment: { type: Boolean, default: false },
    pfOnTotalBasic: { type: Boolean, default: false },
    employerPfAsPerGovernment: { type: Boolean, default: false },
    employerPfOnTotalBasic: { type: Boolean, default: false },
    pensionNotApplicable: { type: Boolean, default: false },
    tdsApplicable: { type: Boolean, default: false },
    compensatoryOffApplicable: { type: Boolean, default: false },
    employerEsicApplicable: { type: Boolean, default: false },
    vpfPercentage: Number,
    pfNo: String,
    uan: String,
    gratuityApplicable: { type: Boolean, default: false },
    gratuityNo: String,
    aadhaarCardNo: String,
    rfidCardNo: String,
    fingerprintId: String,
  },
  { _id: false }
);

const immigrationEntrySchema = new mongoose.Schema(
  {
    documentType: String,
    documentNumber: String,
    issuingCountry: String,
    issueDate: Date,
    expiryDate: Date,
    remarks: String,
  },
  { _id: false }
);

const shiftConfigSchema = new mongoose.Schema(
  {
    name: { type: String, default: 'Day Shift' },
    startTime: { type: String, default: '09:00' },
    endTime: { type: String, default: '18:00' },
    breakMinutes: { type: Number, default: 60, min: 0 },
    graceMinutes: { type: Number, default: 10, min: 0 },
    overnight: { type: Boolean, default: false },
  },
  { _id: false }
);

const payrollPfSchema = new mongoose.Schema(
  {
    applicable: { type: Boolean, default: false },
    employeePercent: { type: Number, default: 12, min: 0, max: 100 },
    employerPercent: { type: Number, default: 12, min: 0, max: 100 },
    vpfPercent: { type: Number, default: 0, min: 0, max: 100 },
    applyOn: { type: String, enum: ['Basic', 'Gross'], default: 'Basic' },
    number: { type: String, trim: true, default: '' },
    effectiveDate: { type: Date, default: null },
  },
  { _id: false }
);

const payrollEsiSchema = new mongoose.Schema(
  {
    applicable: { type: Boolean, default: false },
    esiNumber: { type: String, trim: true, default: '' },
    employeePercent: { type: Number, default: 0.75, min: 0, max: 100 },
    employerPercent: { type: Number, default: 3.25, min: 0, max: 100 },
    effectiveDate: { type: Date, default: null },
  },
  { _id: false }
);

const payrollWeekOffSchema = new mongoose.Schema(
  {
    pattern: {
      type: String,
      enum: ['Saturday & Sunday', 'Sunday Only', 'Alternate Saturdays', 'Custom'],
      default: 'Sunday Only',
    },
    days: { type: [String], default: ['Sunday'] },
  },
  { _id: false }
);

const payrollConfigSchema = new mongoose.Schema(
  {
    salaryBasis: {
      type: String,
      enum: [
        'Per Hour',
        'Per Day',
        'Working Hours (Monthly)',
        'Working Days (Monthly)',
        'Fixed (Monthly)',
        'Per Day (Include Public Holidays)',
        'Working Days (Include Public Holidays)',
      ],
      default: 'Fixed (Monthly)',
    },
    salaryAmount: { type: Number, default: 0, min: 0 },
    workingHoursPerMonth: { type: Number, default: 208, min: 0 },
    workingDaysPerMonth: { type: Number, default: 26, min: 0 },
    overtimeApplicable: {
      type: String,
      enum: ['Not Applicable', 'Per Day', 'Per Week', 'Per Month', 'Fixed Hours (Monthly)'],
      default: 'Not Applicable',
    },
    overtimeRate: { type: Number, default: 0, min: 0 },
    overtimeThresholdHours: { type: Number, default: 0, min: 0 },
    fixedOvertimeHours: { type: Number, default: 0, min: 0 },
    attendancePolicy: {
      type: String,
      enum: ['Standard (Mon–Fri)', '5.5-Day Week', '6-Day Week', 'Shift Based', 'Flexi Hours'],
      default: 'Standard (Mon–Fri)',
    },
    workShift: { type: shiftConfigSchema, default: () => ({}) },
    paymentMode: {
      type: String,
      enum: ['Bank Transfer', 'Cheque', 'Cash', 'Other'],
      default: 'Bank Transfer',
    },
    pf: { type: payrollPfSchema, default: () => ({}) },
    esi: { type: payrollEsiSchema, default: () => ({}) },
    weeklyOff: { type: payrollWeekOffSchema, default: () => ({}) },
    leavePolicy: { type: mongoose.Schema.Types.ObjectId, ref: 'LeavePolicy', default: null },
    effectiveDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const salaryRevisionSchema = new mongoose.Schema(
  {
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedByName: { type: String, trim: true, default: '' },
    reason: { type: String, trim: true, default: '' },
    previous: { type: mongoose.Schema.Types.Mixed, default: null },
    next: { type: mongoose.Schema.Types.Mixed, default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

employeeSchema.add({
  contact: contactSchema,
  bankDetails: bankDetailsSchema,
  personal: personalInfoSchema,
  family: [familyMemberSchema],
  experience: [experienceEntrySchema],
  qualifications: [qualificationEntrySchema],
  certifications: [certificationEntrySchema],
  emergencyContact: emergencyContactSchema,
  emergencyContacts: [emergencyContactSchema],
  weekOff: weekOffSchema,
  documents: [documentSchema],
  salary: salaryDetailsSchema,
  payroll: payrollConfigSchema,
  salaryHistory: [salaryRevisionSchema],
  pf: pfDetailsSchema,
  admin: adminDetailsSchema,
  immigration: [immigrationEntrySchema],
});

employeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`.trim();
});

employeeSchema.virtual('face', {
  ref: 'FaceProfile',
  localField: '_id',
  foreignField: 'employee',
  justOne: true,
});

module.exports = mongoose.model('Employee', employeeSchema);