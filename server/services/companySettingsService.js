const Setting = require('../models/Setting');
const config = require('../config/config');

const COMPANY_KEY = 'companyDetails';
const STATUTORY_KEY = 'statutoryConfig';
const PAYROLL_KEY = 'payrollPolicy';
const EMAIL_KEY = 'emailConfig';

const DEFAULT_COMPANY = {
  name: config.companyName || 'Nuvox Technologies',
  legalName: 'Nuvox Technologies',
  addressLine1: '',
  addressLine2: '',
  city: 'Chennai',
  state: 'Tamil Nadu',
  pincode: '',
  country: 'India',
  phone: '',
  email: '',
  website: '',
  gstin: '',
  cin: '',
  logo: '',
  signatoryName: 'Authorised Signatory',
  signatoryDesignation: 'HR Manager',
};

const DEFAULT_STATUTORY = {
  pfWageCeiling: 15000,
  pfEmployeePercent: 12,
  pfEmployerPercent: 12,
  pfApplyOn: 'Basic',
  basicPercentOfGross: 50,
  esiWageCeiling: 21000,
  esiEmployeePercent: 0.75,
  esiEmployerPercent: 3.25,
};

const DEFAULT_PAYROLL_POLICY = {
  workingDaysPerMonth: 26,
  standardHoursPerDay: 8,
  overtimeMultiplier: 1.5,
  leaveDeductionPolicy: 'PerDay', // How unpaid leave reduces fixed salary
  holidayPayForIncludeVariants: true,
  roundCurrency: true,
};

function merge(defaults, raw) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return { ...defaults, ...src };
}

async function readKey(key, defaults) {
  const row = await Setting.findOne({ key }).lean();
  return merge(defaults, row?.value);
}

async function writeKey(key, value) {
  await Setting.updateOne({ key }, { $set: { key, value } }, { upsert: true });
  return value;
}

async function getCompanyDetails() {
  return readKey(COMPANY_KEY, DEFAULT_COMPANY);
}

async function updateCompanyDetails(payload = {}) {
  const current = await getCompanyDetails();
  const allowed = Object.keys(DEFAULT_COMPANY);
  const next = { ...current };
  allowed.forEach((k) => {
    if (payload[k] !== undefined && payload[k] !== null) next[k] = typeof payload[k] === 'string' ? payload[k].trim() : payload[k];
  });
  if (!next.name) next.name = current.name;
  await writeKey(COMPANY_KEY, next);
  return next;
}

async function getStatutoryConfig() {
  const s = await readKey(STATUTORY_KEY, DEFAULT_STATUTORY);
  return {
    pfWageCeiling: Number(s.pfWageCeiling) || DEFAULT_STATUTORY.pfWageCeiling,
    pfEmployeePercent: Number(s.pfEmployeePercent) || 0,
    pfEmployerPercent: Number(s.pfEmployerPercent) || 0,
    pfApplyOn: s.pfApplyOn === 'Gross' ? 'Gross' : 'Basic',
    basicPercentOfGross: Number(s.basicPercentOfGross) || DEFAULT_STATUTORY.basicPercentOfGross,
    esiWageCeiling: Number(s.esiWageCeiling) || DEFAULT_STATUTORY.esiWageCeiling,
    esiEmployeePercent: Number(s.esiEmployeePercent) || 0,
    esiEmployerPercent: Number(s.esiEmployerPercent) || 0,
  };
}

async function updateStatutoryConfig(payload = {}) {
  const current = await getStatutoryConfig();
  const clamp = (v, min, max, fallback) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  };
  const next = {
    pfWageCeiling: clamp(payload.pfWageCeiling, 0, 1000000, current.pfWageCeiling),
    pfEmployeePercent: clamp(payload.pfEmployeePercent, 0, 100, current.pfEmployeePercent),
    pfEmployerPercent: clamp(payload.pfEmployerPercent, 0, 100, current.pfEmployerPercent),
    pfApplyOn: payload.pfApplyOn === 'Gross' ? 'Gross' : payload.pfApplyOn === 'Basic' ? 'Basic' : current.pfApplyOn,
    basicPercentOfGross: clamp(payload.basicPercentOfGross, 0, 100, current.basicPercentOfGross),
    esiWageCeiling: clamp(payload.esiWageCeiling, 0, 1000000, current.esiWageCeiling),
    esiEmployeePercent: clamp(payload.esiEmployeePercent, 0, 100, current.esiEmployeePercent),
    esiEmployerPercent: clamp(payload.esiEmployerPercent, 0, 100, current.esiEmployerPercent),
  };
  await writeKey(STATUTORY_KEY, next);
  return next;
}

async function getPayrollPolicy() {
  const p = await readKey(PAYROLL_KEY, DEFAULT_PAYROLL_POLICY);
  return {
    workingDaysPerMonth: Number(p.workingDaysPerMonth) || DEFAULT_PAYROLL_POLICY.workingDaysPerMonth,
    standardHoursPerDay: Number(p.standardHoursPerDay) || DEFAULT_PAYROLL_POLICY.standardHoursPerDay,
    overtimeMultiplier: Number(p.overtimeMultiplier) || DEFAULT_PAYROLL_POLICY.overtimeMultiplier,
    leaveDeductionPolicy: ['PerDay', 'WorkingDays', 'None'].includes(p.leaveDeductionPolicy)
      ? p.leaveDeductionPolicy
      : DEFAULT_PAYROLL_POLICY.leaveDeductionPolicy,
    holidayPayForIncludeVariants: p.holidayPayForIncludeVariants !== false,
    roundCurrency: p.roundCurrency !== false,
  };
}

async function updatePayrollPolicy(payload = {}) {
  const current = await getPayrollPolicy();
  const next = {
    workingDaysPerMonth: Number(payload.workingDaysPerMonth) || current.workingDaysPerMonth,
    standardHoursPerDay: Number(payload.standardHoursPerDay) || current.standardHoursPerDay,
    overtimeMultiplier: Number(payload.overtimeMultiplier) || current.overtimeMultiplier,
    leaveDeductionPolicy: ['PerDay', 'WorkingDays', 'None'].includes(payload.leaveDeductionPolicy)
      ? payload.leaveDeductionPolicy
      : current.leaveDeductionPolicy,
    holidayPayForIncludeVariants:
      payload.holidayPayForIncludeVariants !== undefined ? !!payload.holidayPayForIncludeVariants : current.holidayPayForIncludeVariants,
    roundCurrency: payload.roundCurrency !== undefined ? !!payload.roundCurrency : current.roundCurrency,
  };
  await writeKey(PAYROLL_KEY, next);
  return next;
}

async function getEmailConfig() {
  const e = await readKey(EMAIL_KEY, { fromName: '', fromEmail: '', replyTo: '' });
  return {
    fromName: e.fromName || '',
    fromEmail: e.fromEmail || '',
    replyTo: e.replyTo || '',
    // Credentials intentionally stay in environment variables only.
    smtpConfigured: Boolean(config.smtp.host && config.smtp.user && config.smtp.pass),
  };
}

async function updateEmailConfig(payload = {}) {
  const current = await getEmailConfig();
  const next = {
    fromName: typeof payload.fromName === 'string' ? payload.fromName.trim() : current.fromName,
    fromEmail: typeof payload.fromEmail === 'string' ? payload.fromEmail.trim().toLowerCase() : current.fromEmail,
    replyTo: typeof payload.replyTo === 'string' ? payload.replyTo.trim().toLowerCase() : current.replyTo,
  };
  await writeKey(EMAIL_KEY, next);
  return getEmailConfig();
}

module.exports = {
  COMPANY_KEY,
  STATUTORY_KEY,
  DEFAULT_COMPANY,
  DEFAULT_STATUTORY,
  DEFAULT_PAYROLL_POLICY,
  getCompanyDetails,
  updateCompanyDetails,
  getStatutoryConfig,
  updateStatutoryConfig,
  getPayrollPolicy,
  updatePayrollPolicy,
  getEmailConfig,
  updateEmailConfig,
};
