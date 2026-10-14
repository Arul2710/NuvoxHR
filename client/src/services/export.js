import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function triggerDownload(content, filename, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/**
 * Export rows to CSV. `columns` = [{ key, label }].
 */
export function exportCSV(filename, columns, rows) {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const body = rows
    .map((row) => columns.map((c) => escapeCsv(c.render ? c.render(row) : row[c.key])).join(','))
    .join('\n');
  triggerDownload(`${header}\n${body}`, filename);
}

/**
 * Export rows to PDF with autoTable. `columns` = [{ key, label, render? }].
 */
export function exportPDF(filename, title, columns, rows) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.setTextColor(37, 67, 235);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const now = new Date().toLocaleString();
  doc.text(`FaceHR · Generated ${now}`, 14, 22);

  autoTable(doc, {
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => (c.render ? c.render(row) : row[c.key]))),
    startY: 27,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [37, 67, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [243, 244, 248] },
  });

  doc.save(filename);
}

// --- Attendance export helpers -------------------------------------------
// These accept rows from two sources:
//  * Attendance.jsx  -> already-formatted display strings (checkIn, hours, location, face …)
//  * Reports.jsx     -> raw values (Date objects / minute counts) from the report API
// Each renderer therefore accepts either shape.

const timeCell = (value) => {
  if (!value) return '—';
  if (typeof value === 'string') return value; // already formatted by the caller
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const dateCell = (value) => {
  if (!value) return '—';
  if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}/.test(value)) return value; // already formatted
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

const durationCell = (flatValue, minutes) => {
  if (typeof flatValue === 'string' && flatValue) return flatValue;
  const m = Number(minutes);
  if (!m) return '—';
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

const locationCell = (r) => {
  if (typeof r.location === 'string') return r.location;
  if (typeof r.geoVerified === 'boolean') return r.geoVerified ? 'Verified' : 'Not Verified';
  return '—';
};

const faceCell = (r) => {
  if (typeof r.face === 'string') return r.face;
  if (typeof r.faceVerified === 'boolean') {
    return r.faceVerified ? 'Verified' : (r.source === 'Manual' ? 'Manual' : 'Not Verified');
  }
  return r.source === 'Manual' ? 'Manual' : '—';
};

const ATTENDANCE_COLUMNS = [
  { key: 'employeeId', label: 'Employee ID', render: (r) => r.employeeId || r.employee?.employeeId || '—' },
  { key: 'employeeName', label: 'Employee Name', render: (r) => r.employeeName || (r.employee ? `${r.employee.firstName} ${r.employee.lastName || ''}`.trim() : '—') },
  { key: 'department', label: 'Department', render: (r) => r.department || r.employee?.department?.name || '—' },
  { key: 'date', label: 'Attendance Date', render: (r) => dateCell(r.date) },
  { key: 'checkIn', label: 'Check-In Time', render: (r) => timeCell(r.checkIn || r.checkInTime) },
  { key: 'checkOut', label: 'Check-Out Time', render: (r) => timeCell(r.checkOut || r.checkOutTime) },
  { key: 'hours', label: 'Total Working Hours', render: (r) => durationCell(r.hours, r.workingHoursMinutes) },
  { key: 'breakDuration', label: 'Break Duration', render: (r) => durationCell(r.breakDuration, r.breakMinutes) },
  { key: 'overtime', label: 'Overtime Hours', render: (r) => durationCell(r.overtime, r.overtimeMinutes) },
  { key: 'status', label: 'Attendance Status', render: (r) => r.status || '—' },
  { key: 'location', label: 'Location Verification', render: (r) => locationCell(r) },
  { key: 'face', label: 'Face Verification', render: (r) => faceCell(r) },
];

/** Build the shared attendance export payload (columns + title + file base). */
export function buildAttendanceExportPayload(summary = {}, rows = []) {
  const from = summary?.range?.from ?? 'All';
  const to = summary?.range?.to ?? 'All';
  return {
    columns: ATTENDANCE_COLUMNS,
    title: `Attendance Report · ${from} to ${to}`,
    fileBase: `facehr-attendance-${from}-${to}`,
    rows,
  };
}

/** Export attendance rows to CSV using the shared report columns. */
export function exportAttendanceToCsv(rows, fileBase) {
  exportCSV(`${fileBase}.csv`, ATTENDANCE_COLUMNS, rows);
}

/** Export attendance rows to a captioned PDF table. */
export function exportAttendanceToPdf(rows, summary = {}) {
  const { columns, title, fileBase } = buildAttendanceExportPayload(summary, rows);
  exportPDF(`${fileBase}.pdf`, title, columns, rows);
}