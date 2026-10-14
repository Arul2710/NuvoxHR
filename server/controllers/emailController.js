const fs = require('fs');
const path = require('path');
const EmployeeDocument = require('../models/EmployeeDocument');
const Employee = require('../models/Employee');
const EmailLog = require('../models/EmailLog');
const asyncHandler = require('../utils/asyncHandler');
const { sendMail } = require('../services/mailService');
const { getEmailConfig } = require('../services/companySettingsService');
const { saveBuffer, uploadsDir } = require('../middleware/upload');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const decodeBase64 = (dataUrl) => {
  if (typeof dataUrl !== 'string' || !dataUrl) return null;
  const base64 = dataUrl.includes(',') ? dataUrl.slice(dataUrl.indexOf(',') + 1) : dataUrl;
  try {
    return Buffer.from(base64, 'base64');
  } catch {
    return null;
  }
};

// @route GET /api/emails/config
const getConfig = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await getEmailConfig() });
});

// @route POST /api/emails/send-document
const sendDocumentEmail = asyncHandler(async (req, res) => {
  const { documentId } = req.body;
  const to = String(req.body.to || '').trim().toLowerCase();
  const subject = String(req.body.subject || '').trim();
  const body = String(req.body.body || '').trim();

  if (!documentId) return res.status(400).json({ success: false, message: 'A generated document is required before sending' });
  if (!EMAIL_RE.test(to)) return res.status(400).json({ success: false, message: 'Enter a valid recipient email address' });
  if (!subject) return res.status(400).json({ success: false, message: 'An email subject is required' });

  const doc = await EmployeeDocument.findById(documentId);
  if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
  const employee = await Employee.findById(doc.employee);

  // Guard against accidental double submissions (same doc + recipient within 60s).
  const recent = await EmailLog.findOne({ document: doc._id, recipient: to, status: { $in: ['Sent', 'Delivered'] }, sentAt: { $gte: new Date(Date.now() - 60000) } });
  if (recent) {
    return res.status(409).json({ success: false, message: 'This document was just sent to this recipient. Please wait before sending again.' });
  }

  const cfg = await getEmailConfig();
  const log = await EmailLog.create({
    document: doc._id,
    employee: employee?._id || null,
    employeeId: doc.employeeId,
    type: doc.type,
    recipient: to,
    cc: String(req.body.cc || '').trim().toLowerCase(),
    sender: cfg.fromEmail || '',
    senderUser: req.user.id,
    subject,
    body,
    status: 'Pending',
    provider: 'smtp',
    attempts: 1,
    lastAttemptAt: new Date(),
  });

  const attachments = [];
  const pdfBuffer = decodeBase64(req.body.pdfBase64);
  if (pdfBuffer && pdfBuffer.length) {
    const saved = saveBuffer(pdfBuffer, 'pdf');
    log.attachmentPath = saved;
    log.attachmentName = String(req.body.pdfName || `${doc.type.replace(/\s+/g, '-')}-${doc.employeeId}.pdf`);
    attachments.push({ filename: log.attachmentName, content: pdfBuffer, contentType: 'application/pdf' });
  }

  const result = await sendMail({ to, cc: log.cc, subject, html: `<p style="font-family:Arial;white-space:pre-wrap">${escapeHtml(body)}</p>`, text: body, attachments });

  if (result.sent) {
    log.status = 'Sent';
    log.providerMessageId = result.messageId || '';
    log.sentAt = new Date();
    await log.save();
    return res.json({ success: true, message: `Email sent to ${to}`, data: log });
  }

  log.status = 'Failed';
  log.error = result.reason === 'smtp-not-configured' ? 'Email service is not configured on the server.' : result.reason || 'Send failed';
  await log.save();

  if (result.reason === 'smtp-not-configured') {
    return res.status(503).json({
      success: false,
      message: 'Email service is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS on the server before sending.',
      data: log,
    });
  }
  return res.status(502).json({ success: false, message: `Email could not be sent: ${log.error}`, data: log });
});

// @route GET /api/emails
const listEmails = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 25, 1), 100);
  const filter = {};
  if (req.query.status && ['Pending', 'Sent', 'Failed', 'Delivered'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.employeeId) filter.employee = req.query.employeeId;
  if (req.query.documentId) filter.document = req.query.documentId;

  const [total, logs] = await Promise.all([
    EmailLog.countDocuments(filter),
    EmailLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate({ path: 'employee', select: 'firstName lastName employeeId' })
      .lean(),
  ]);
  res.json({ success: true, data: logs, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
});

// @route POST /api/emails/:id/retry
const retryEmail = asyncHandler(async (req, res) => {
  const log = await EmailLog.findById(req.params.id);
  if (!log) return res.status(404).json({ success: false, message: 'Email log not found' });
  if (log.status === 'Sent' || log.status === 'Delivered') {
    return res.status(400).json({ success: false, message: 'This email was already sent' });
  }

  const attachments = [];
  if (log.attachmentPath) {
    const full = path.join(uploadsDir, path.basename(log.attachmentPath));
    if (fs.existsSync(full)) {
      attachments.push({ filename: log.attachmentName || 'document.pdf', content: fs.readFileSync(full), contentType: 'application/pdf' });
    }
  }

  log.attempts += 1;
  log.lastAttemptAt = new Date();
  const result = await sendMail({ to: log.recipient, cc: log.cc, subject: log.subject, html: `<p style="font-family:Arial;white-space:pre-wrap">${escapeHtml(log.body)}</p>`, text: log.body, attachments });

  if (result.sent) {
    log.status = 'Sent';
    log.providerMessageId = result.messageId || '';
    log.error = '';
    log.sentAt = new Date();
    await log.save();
    return res.json({ success: true, message: 'Email re-sent', data: log });
  }
  log.status = 'Failed';
  log.error = result.reason === 'smtp-not-configured' ? 'Email service is not configured on the server.' : result.reason || 'Send failed';
  await log.save();
  return res.status(result.reason === 'smtp-not-configured' ? 503 : 502).json({ success: false, message: `Retry failed: ${log.error}`, data: log });
});

function escapeHtml(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { getConfig, sendDocumentEmail, listEmails, retryEmail };
