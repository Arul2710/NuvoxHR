const config = require('../config/config');

let transporter = null;
let warned = false;

function getTransporter() {
  if (transporter) return transporter;
  const { host, port, secure, user, pass } = config.smtp;
  if (!host || !user || !pass) {
    if (!warned) {
      console.warn('[mail] SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS). Skipping outgoing mail.');
      warned = true;
    }
    return null;
  }
  // eslint-disable-next-line global-require
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  return transporter;
}

async function sendMail({ to, cc, replyTo, subject, html, text, attachments }) {
  const client = getTransporter();
  if (!client) return { sent: false, reason: 'smtp-not-configured' };
  const from = config.smtp.from || config.smtp.user;
  try {
    const info = await client.sendMail({ from, to, cc, replyTo, subject, html, text, attachments });
    return { sent: true, messageId: info?.messageId || '' };
  } catch (err) {
    console.error('[mail] Failed to send email:', err.message);
    return { sent: false, reason: err.message };
  }
}

/** Simple generic document email with optional PDF attachment. */
async function sendDocumentMail({ to, cc, replyTo, fromName, subject, body, attachments }) {
  const company = config.companyName || 'HR';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;color:#0f172a;">
      <p style="color:#334155;font-size:14px;line-height:1.7;white-space:pre-wrap;">${esc(body || '')}</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
      <p style="margin:0;color:#94a3b8;font-size:12px;">${esc(fromName || company)} · This is an automated message — please do not reply.</p>
    </div>
  `;
  return sendMail({ to, cc, replyTo, subject, html, text: body || '', attachments });
}

// Welcome / credentials email sent to a newly created employee's work email.
async function sendLoginDetailsMail({ to, companyName, employeeName, employeeId, loginEmail, temporaryPassword, loginUrl }) {
  const company = companyName || config.companyName;
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;color:#0f172a;">
      <h2 style="margin:0 0 4px;color:#1e293b;">Your Employee Account Login Details</h2>
      <p style="margin:0 0 20px;color:#475569;">Your employee account for <strong>${esc(company)}</strong> has been created. Use the details below to sign in for the first time.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#64748b;width:45%;">Company name</td><td style="padding:6px 0;font-weight:600;">${esc(company)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Employee name</td><td style="padding:6px 0;font-weight:600;">${esc(employeeName)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Employee ID</td><td style="padding:6px 0;font-weight:600;">${esc(employeeId)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Login email</td><td style="padding:6px 0;font-weight:600;">${esc(loginEmail)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;">Temporary password</td><td style="padding:6px 0;font-weight:600;">${esc(temporaryPassword)}</td></tr>
      </table>
      <p style="margin:20px 0 8px;color:#334155;">To log in, open your employee login page:</p>
      <p style="margin:0 0 20px;">
        <a href="${esc(loginUrl)}" style="display:inline-block;padding:10px 18px;background:#4f46e5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Employee Login &mdash; ${esc(company)}</a>
      </p>
      <ol style="margin:0 0 20px;padding-left:20px;color:#475569;font-size:13px;line-height:1.7;">
        <li>Open the employee login page using the button above.</li>
        <li>Enter your login email and the temporary password shown above.</li>
        <li>After your first successful sign in, go to the profile / settings menu and change your password.</li>
        <li>Never share your password with anyone. If you believe it has been compromised, contact HR immediately.</li>
      </ol>
      <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">This is an automated message — do not reply.</p>
    </div>
  `;
  return sendMail({
    to,
    subject: `Your Employee Account Login Details`,
    html,
    text: [
      `Your Employee Account Login Details`,
      '',
      `Company name: ${company}`,
      `Employee name: ${employeeName}`,
      `Employee ID: ${employeeId}`,
      `Login email: ${loginEmail}`,
      `Temporary password: ${temporaryPassword}`,
      '',
      `Employee login page: ${loginUrl}`,
      '',
      'To log in:',
      `1. Open the employee login page.`,
      `2. Enter your login email and the temporary password above.`,
      `3. Change your password from the profile / settings menu after your first sign in.`,
      '',
      'Never share your password with anyone.',
    ].join('\n'),
  });
}

// Backwards-compatible alias used by the original employee-creation flow.
async function sendWelcomeMail(opts) {
  return sendLoginDetailsMail(opts);
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { sendMail, sendDocumentMail, sendWelcomeMail, sendLoginDetailsMail };