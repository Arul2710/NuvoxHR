import { useState, useEffect } from 'react';
import { Search, Download, Eye, FileText } from 'lucide-react';
import api, { extractError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { MONTH_NAMES } from '../../services/format';
import { exportPDF } from '../../services/export';
import PageHeader from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import Button, { FullScreenLoader } from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Form';
import { useToast } from '../../context/ToastContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SalarySlips() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState(null);
  const [company, setCompany] = useState(null);

  const { data, loading, refetch } = useApi(async () => {
    const sp = new URLSearchParams({ year: String(year), month: String(month), page: '1', pageSize: '200' });
    if (search) sp.set('search', search);
    const { data } = await api.get(`/payroll?${sp.toString()}`);
    return data;
  }, [year, month, search]);

  useEffect(() => {
    api.get('/company/details').then(({ data }) => setCompany(data.data)).catch(() => {});
  }, []);

  const rows = data?.data || [];

  const generateSlip = (record) => {
    const doc = new jsPDF();
    const emp = record.employee || {};
    const companyName = company?.name || 'Nuvox Technologies';
    const companyAddr = [company?.addressLine1, company?.addressLine2, company?.city, company?.state, company?.pincode].filter(Boolean).join(', ');

    doc.setFontSize(18);
    doc.setTextColor(37, 67, 235);
    doc.text(companyName, 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(companyAddr || '', 105, 27, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('SALARY SLIP', 105, 40, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Pay Period: ${MONTH_NAMES[record.month]} ${record.year}`, 14, 52);
    doc.text(`Slip No: ${record.slipNumber || '-'}`, 14, 58);

    autoTable(doc, {
      startY: 65,
      body: [
        ['Employee ID', record.employeeId || ''],
        ['Employee Name', emp ? `${emp.firstName} ${emp.lastName}` : ''],
        ['Department', emp?.department?.name || ''],
        ['Designation', emp?.designation?.name || ''],
        ['Salary Basis', record.salaryBasis || ''],
        ['Payment Mode', record.paymentMode || ''],
      ],
      theme: 'plain',
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
    });

    const earnings = record.earnings || [];
    const deductions = record.deductions || [];

    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY || 100) + 10,
      head: [['Earnings', 'Amount (₹)']],
      body: earnings.map((e) => [e.label, e.amount.toFixed(2)]),
      foot: [['Gross Earnings', record.grossEarnings.toFixed(2)]],
      theme: 'striped',
      headStyles: { fillColor: [37, 67, 235] },
      footStyles: { fillColor: [230, 240, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
    });

    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY || 150) + 10,
      head: [['Deductions', 'Amount (₹)']],
      body: deductions.map((d) => [d.label, d.amount.toFixed(2)]),
      foot: [['Total Deductions', record.totalDeductions.toFixed(2)]],
      theme: 'striped',
      headStyles: { fillColor: [220, 53, 69] },
      footStyles: { fillColor: [255, 235, 238], textColor: [0, 0, 0], fontStyle: 'bold' },
    });

    const finalY = (doc.lastAutoTable?.finalY || 200) + 10;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Net Salary: ₹${record.netSalary.toFixed(2)}`, 14, finalY + 5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Attendance: ${record.attendance?.presentDays || 0} present, ${record.attendance?.halfDays || 0} half, ${record.attendance?.paidLeaveDays || 0} leave, ${record.attendance?.absentDays || 0} absent`, 14, finalY + 15);
    doc.text(`Overtime: ${record.attendance?.overtimeHours || 0} hrs`, 14, finalY + 21);

    doc.text(`___________________`, 140, finalY + 35);
    doc.text(company?.signatoryName || 'Authorised Signatory', 140, finalY + 41);
    doc.text(company?.signatoryDesignation || '', 140, finalY + 46);

    return doc;
  };

  const handleDownload = (record) => {
    const doc = generateSlip(record);
    doc.save(`${record.slipNumber || 'salary-slip'}.pdf`);
  };

  const handlePreview = (record) => {
    setPreview(record);
  };

  if (loading) return <FullScreenLoader label="Loading salary slips…" />;

  return (
    <div>
      <PageHeader title="Salary Slips" description="View and download generated salary slips.">
        <Button variant="secondary" onClick={() => refetch()}>Refresh</Button>
      </PageHeader>

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee…" className="input pl-9" />
          </div>
          <Select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
            {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </Select>
          <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || year)} />
          <button onClick={() => setSearch('')} className="btn-ghost text-sm">Clear</button>
        </div>
      </Card>

      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="th">Employee</th>
                <th className="th">Period</th>
                <th className="th">Gross</th>
                <th className="th">Deductions</th>
                <th className="th">Net Salary</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={7}><EmptyState title="No salary slips" message="Generate payroll first to create salary slips." /></td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} className="border-b transition last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
                    <td className="td">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : r.employeeId}</p>
                      <p className="text-xs text-slate-400">{r.slipNumber}</p>
                    </td>
                    <td className="td text-xs">{MONTH_NAMES[r.month]} {r.year}</td>
                    <td className="td">₹{r.grossEarnings?.toLocaleString()}</td>
                    <td className="td text-rose-600">₹{r.totalDeductions?.toLocaleString()}</td>
                    <td className="td font-semibold text-emerald-600">₹{r.netSalary?.toLocaleString()}</td>
                    <td className="td"><Badge>{r.status}</Badge></td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" onClick={() => handlePreview(r)}><Eye className="h-3 w-3" /></Button>
                        <Button size="sm" variant="secondary" onClick={() => handleDownload(r)}><Download className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <Card><EmptyState title="No salary slips" /></Card>
        ) : (
          rows.map((r) => (
            <Card key={r._id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : r.employeeId}</p>
                  <p className="text-xs text-slate-400">{MONTH_NAMES[r.month]} {r.year}</p>
                </div>
                <Badge>{r.status}</Badge>
              </div>
              <p className="mt-2 text-sm font-semibold text-emerald-600">₹{r.netSalary?.toLocaleString()}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => handlePreview(r)}><Eye className="h-3 w-3" /> Preview</Button>
                <Button size="sm" variant="secondary" onClick={() => handleDownload(r)}><Download className="h-3 w-3" /> PDF</Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Salary Slip Preview" size="lg">
        {preview && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 dark:border-slate-700">
              <h3 className="text-center text-lg font-bold text-brand-600">{company?.name || 'Nuvox Technologies'}</h3>
              <p className="text-center text-xs text-slate-400">Salary Slip - {MONTH_NAMES[preview.month]} {preview.year}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-400">Employee:</span> <span className="font-medium">{preview.employee ? `${preview.employee.firstName} ${preview.employee.lastName}` : preview.employeeId}</span></div>
              <div><span className="text-slate-400">ID:</span> {preview.employeeId}</div>
              <div><span className="text-slate-400">Department:</span> {preview.employee?.department?.name || '-'}</div>
              <div><span className="text-slate-400">Designation:</span> {preview.employee?.designation?.name || '-'}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-400">Earnings</p>
                {(preview.earnings || []).map((e, i) => (
                  <div key={i} className="flex justify-between text-sm"><span>{e.label}</span><span>₹{e.amount?.toLocaleString()}</span></div>
                ))}
                <div className="mt-1 flex justify-between border-t pt-1 text-sm font-bold"><span>Gross</span><span>₹{preview.grossEarnings?.toLocaleString()}</span></div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-400">Deductions</p>
                {(preview.deductions || []).map((d, i) => (
                  <div key={i} className="flex justify-between text-sm"><span>{d.label}</span><span>₹{d.amount?.toLocaleString()}</span></div>
                ))}
                <div className="mt-1 flex justify-between border-t pt-1 text-sm font-bold"><span>Total</span><span>₹{preview.totalDeductions?.toLocaleString()}</span></div>
              </div>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-500/10">
              <p className="text-sm text-slate-500">Net Salary</p>
              <p className="text-2xl font-bold text-emerald-600">₹{preview.netSalary?.toLocaleString()}</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleDownload(preview)}><Download className="h-4 w-4" /> Download PDF</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
