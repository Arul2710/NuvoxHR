import { useState } from 'react';
import { Search, Plus, Download, Mail, Eye, FileText, Trash2 } from 'lucide-react';
import api, { extractError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { formatDate } from '../../services/format';
import PageHeader from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import Button, { FullScreenLoader } from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { useToast } from '../../context/ToastContext';
import { jsPDF } from 'jspdf';

const DOC_TYPES = ['Offer Letter', 'Appointment Letter', 'Experience Letter', 'Relieving Letter'];

const REQUIRED_FIELDS = {
  'Offer Letter': ['position', 'proposedJoiningDate'],
  'Appointment Letter': ['designationLabel', 'employmentStartDate'],
  'Experience Letter': ['designationLabel', 'startDate', 'endDate'],
  'Relieving Letter': ['resignationDate', 'lastWorkingDay'],
};

export default function Documents() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showCreate, setShowCreate] = useState(false);
  const [showEmail, setShowEmail] = useState(null);
  const [showPreview, setShowPreview] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [docType, setDocType] = useState('Offer Letter');
  const [fields, setFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [company, setCompany] = useState(null);
  const [emailForm, setEmailForm] = useState({ to: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);

  const { data, loading, refetch } = useApi(async () => {
    const sp = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) sp.set('search', search);
    if (typeFilter) sp.set('type', typeFilter);
    const { data } = await api.get(`/documents?${sp.toString()}`);
    return data;
  }, [search, typeFilter, page, pageSize]);

  useApi(async () => {
    const { data } = await api.get('/employees?page=1&pageSize=500');
    setEmployees(data.data);
    return data.data;
  }, []);

  useApi(async () => {
    const { data } = await api.get('/company/details');
    setCompany(data.data);
    return data.data;
  }, []);

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize, totalPages: 1, total: 0 };

  const filteredEmps = employees.filter((e) => {
    const q = search.toLowerCase();
    return e.firstName?.toLowerCase().includes(q) || e.lastName?.toLowerCase().includes(q) || e.employeeId?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    if (!selectedEmp) { toast.error('Please select an employee'); return; }
    const required = REQUIRED_FIELDS[docType] || [];
    const missing = required.filter((k) => !fields[k]?.trim());
    if (missing.length) { toast.error(`Missing required fields: ${missing.join(', ')}`); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/documents', { employeeId: selectedEmp._id, type: docType, fields });
      toast.success(`${docType} generated`);
      setShowCreate(false);
      setFields({});
      setSelectedEmp(null);
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to generate document'));
    } finally {
      setSaving(false);
    }
  };

  const generatePDF = (doc) => {
    const pdf = new jsPDF();
    const emp = doc.employee || {};
    const companyName = company?.name || 'Nuvox Technologies';
    const companyAddr = [company?.addressLine1, company?.addressLine2, company?.city, company?.state, company?.pincode].filter(Boolean).join(', ');

    pdf.setFontSize(18);
    pdf.setTextColor(37, 67, 235);
    pdf.text(companyName, 105, 20, { align: 'center' });
    pdf.setFontSize(10);
    pdf.setTextColor(100, 116, 139);
    pdf.text(companyAddr, 105, 27, { align: 'center' });
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    pdf.text(doc.type.toUpperCase(), 105, 40, { align: 'center' });

    pdf.setFontSize(11);
    pdf.text(`Date: ${formatDate(doc.issuedDate)}`, 14, 55);
    pdf.text(`To:`, 14, 65);
    pdf.text(`${emp.firstName} ${emp.lastName}`, 20, 71);
    pdf.text(`Employee ID: ${emp.employeeId}`, 20, 77);
    pdf.text(`Department: ${emp.department?.name || ''}`, 20, 83);

    pdf.setFontSize(11);
    let y = 95;
    const f = doc.fields || {};
    const lines = [
      `Dear ${emp.firstName} ${emp.lastName},`,
      '',
      ...Object.entries(f).map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}: ${v}`),
      '',
      `Issued on: ${formatDate(doc.issuedDate)}`,
    ];
    lines.forEach((line) => { pdf.text(line, 14, y); y += 7; });

    pdf.text(`___________________`, 140, y + 10);
    pdf.text(company?.signatoryName || 'Authorised Signatory', 140, y + 16);
    pdf.text(company?.signatoryDesignation || '', 140, y + 22);

    return pdf;
  };

  const handleDownload = (doc) => {
    const pdf = generatePDF(doc);
    pdf.save(`${doc.type.replace(/\s+/g, '-')}-${doc.employeeId}.pdf`);
  };

  const handleSendEmail = async () => {
    if (!showEmail) return;
    if (!emailForm.to.trim()) { toast.error('Recipient email is required'); return; }
    if (!emailForm.subject.trim()) { toast.error('Subject is required'); return; }
    setSending(true);
    try {
      const pdf = generatePDF(showEmail);
      const pdfBase64 = pdf.output('datauristring');
      const { data } = await api.post('/emails/send-document', {
        documentId: showEmail._id,
        to: emailForm.to,
        subject: emailForm.subject,
        body: emailForm.body,
        pdfBase64,
        pdfName: `${showEmail.type.replace(/\s+/g, '-')}-${showEmail.employeeId}.pdf`,
      });
      toast.success(data.message || 'Email sent');
      setShowEmail(null);
      setEmailForm({ to: '', subject: '', body: '' });
    } catch (err) {
      const msg = extractError(err, 'Failed to send email');
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/documents/${deleting._id}`);
      toast.success('Document deleted');
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to delete'));
    }
  };

  if (loading) return <FullScreenLoader label="Loading documents…" />;

  return (
    <div>
      <PageHeader title="Employee Documents" description="Generate and manage offer, appointment, experience, and relieving letters.">
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Generate Document</Button>
      </PageHeader>

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search employee…" className="input pl-9" />
          </div>
          <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <div />
          <button onClick={() => { setSearch(''); setTypeFilter(''); setPage(1); }} className="btn-ghost text-sm">Clear filters</button>
        </div>
      </Card>

      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="th">Employee</th>
                <th className="th">Type</th>
                <th className="th">Version</th>
                <th className="th">Issued Date</th>
                <th className="th">Generated By</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={FileText} title="No documents" message="Generate documents to see them here." /></td></tr>
              ) : (
                rows.map((d) => (
                  <tr key={d._id} className="border-b transition last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
                    <td className="td">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{d.employee ? `${d.employee.firstName} ${d.employee.lastName}` : d.employeeId}</p>
                      <p className="text-xs text-slate-400">{d.employeeId}</p>
                    </td>
                    <td className="td"><Badge tone="indigo">{d.type}</Badge></td>
                    <td className="td">v{d.version}</td>
                    <td className="td">{formatDate(d.issuedDate)}</td>
                    <td className="td text-xs">{d.generatedByName || 'System'}</td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="secondary" onClick={() => setShowPreview(d)}><Eye className="h-3 w-3" /></Button>
                        <Button size="sm" variant="secondary" onClick={() => handleDownload(d)}><Download className="h-3 w-3" /></Button>
                        <Button size="sm" variant="secondary" onClick={() => { setShowEmail(d); setEmailForm({ to: d.employee?.email || '', subject: `${d.type} - ${d.employeeId}`, body: `Please find attached your ${d.type}.\n\nRegards,\n${company?.name || 'HR Team'}` }); }}><Mail className="h-3 w-3" /></Button>
                        <Button size="sm" variant="danger" onClick={() => setDeleting(d)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && <Pagination page={meta.page} pageSize={pageSize} total={meta.total} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
      </Card>

      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <Card><EmptyState title="No documents" /></Card>
        ) : (
          rows.map((d) => (
            <Card key={d._id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{d.employee ? `${d.employee.firstName} ${d.employee.lastName}` : d.employeeId}</p>
                  <Badge tone="indigo">{d.type} v{d.version}</Badge>
                </div>
                <p className="text-xs text-slate-400">{formatDate(d.issuedDate)}</p>
              </div>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setShowPreview(d)}><Eye className="h-3 w-3" /></Button>
                <Button size="sm" variant="secondary" onClick={() => handleDownload(d)}><Download className="h-3 w-3" /></Button>
                <Button size="sm" variant="secondary" onClick={() => { setShowEmail(d); setEmailForm({ to: d.employee?.email || '', subject: `${d.type} - ${d.employeeId}`, body: `Please find attached your ${d.type}.` }); }}><Mail className="h-3 w-3" /></Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Generate Document" size="lg">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Employee</label>
              <select value={selectedEmp?._id || ''} onChange={(e) => { const emp = employees.find((x) => x._id === e.target.value); setSelectedEmp(emp || null); }} className="input">
                <option value="">Select employee…</option>
                {filteredEmps.map((e) => <option key={e._id} value={e._id}>{e.firstName} {e.lastName} ({e.employeeId})</option>)}
              </select>
            </div>
            <Select label="Document Type" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          {selectedEmp && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p><span className="text-slate-400">Name:</span> {selectedEmp.firstName} {selectedEmp.lastName}</p>
              <p><span className="text-slate-400">ID:</span> {selectedEmp.employeeId}</p>
              <p><span className="text-slate-400">Department:</span> {selectedEmp.department?.name || '-'}</p>
              <p><span className="text-slate-400">Designation:</span> {selectedEmp.designation?.name || '-'}</p>
              <p><span className="text-slate-400">Joining:</span> {formatDate(selectedEmp.joiningDate)}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {docType === 'Offer Letter' && (
              <>
                <Input label="Position Offered" value={fields.position || ''} onChange={(e) => setFields({ ...fields, position: e.target.value })} />
                <Input label="Proposed Joining Date" type="date" value={fields.proposedJoiningDate || ''} onChange={(e) => setFields({ ...fields, proposedJoiningDate: e.target.value })} />
              </>
            )}
            {docType === 'Appointment Letter' && (
              <>
                <Input label="Designation" value={fields.designationLabel || ''} onChange={(e) => setFields({ ...fields, designationLabel: e.target.value })} />
                <Input label="Employment Start Date" type="date" value={fields.employmentStartDate || ''} onChange={(e) => setFields({ ...fields, employmentStartDate: e.target.value })} />
              </>
            )}
            {docType === 'Experience Letter' && (
              <>
                <Input label="Designation" value={fields.designationLabel || ''} onChange={(e) => setFields({ ...fields, designationLabel: e.target.value })} />
                <div className="grid grid-cols-2 gap-2">
                  <Input label="Start Date" type="date" value={fields.startDate || ''} onChange={(e) => setFields({ ...fields, startDate: e.target.value })} />
                  <Input label="End Date" type="date" value={fields.endDate || ''} onChange={(e) => setFields({ ...fields, endDate: e.target.value })} />
                </div>
              </>
            )}
            {docType === 'Relieving Letter' && (
              <>
                <Input label="Resignation Date" type="date" value={fields.resignationDate || ''} onChange={(e) => setFields({ ...fields, resignationDate: e.target.value })} />
                <Input label="Last Working Day" type="date" value={fields.lastWorkingDay || ''} onChange={(e) => setFields({ ...fields, lastWorkingDay: e.target.value })} />
              </>
            )}
          </div>
          <Input label="Signatory Name" value={fields.signatoryName || ''} onChange={(e) => setFields({ ...fields, signatoryName: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}><FileText className="h-4 w-4" /> Generate</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!showPreview} onClose={() => setShowPreview(null)} title="Document Preview" size="lg">
        {showPreview && (
          <div className="space-y-4">
            <div className="rounded-lg border p-4 dark:border-slate-700">
              <h3 className="text-center text-lg font-bold text-brand-600">{company?.name || 'Nuvox Technologies'}</h3>
              <p className="text-center text-sm text-slate-400">{showPreview.type}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-slate-400">Employee:</span> {showPreview.employee ? `${showPreview.employee.firstName} ${showPreview.employee.lastName}` : showPreview.employeeId}</div>
              <div><span className="text-slate-400">ID:</span> {showPreview.employeeId}</div>
              <div><span className="text-slate-400">Department:</span> {showPreview.employee?.department?.name || '-'}</div>
              <div><span className="text-slate-400">Issued:</span> {formatDate(showPreview.issuedDate)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              {Object.entries(showPreview.fields || {}).map(([k, v]) => (
                <p key={k} className="text-sm"><span className="font-medium text-slate-500">{k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}:</span> {v}</p>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => handleDownload(showPreview)}><Download className="h-4 w-4" /> Download PDF</Button>
              <Button onClick={() => { setShowEmail(showPreview); setEmailForm({ to: showPreview.employee?.email || '', subject: `${showPreview.type} - ${showPreview.employeeId}`, body: `Please find attached your ${showPreview.type}.` }); }}><Mail className="h-4 w-4" /> Email</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!showEmail} onClose={() => setShowEmail(null)} title="Send Document via Email" size="md">
        {showEmail && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p><span className="text-slate-400">Document:</span> {showEmail.type} v{showEmail.version}</p>
              <p><span className="text-slate-400">Employee:</span> {showEmail.employee ? `${showEmail.employee.firstName} ${showEmail.employee.lastName}` : showEmail.employeeId}</p>
            </div>
            <Input label="Recipient Email" type="email" value={emailForm.to} onChange={(e) => setEmailForm({ ...emailForm, to: e.target.value })} />
            <Input label="Subject" value={emailForm.subject} onChange={(e) => setEmailForm({ ...emailForm, subject: e.target.value })} />
            <Textarea label="Message" value={emailForm.body} onChange={(e) => setEmailForm({ ...emailForm, body: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowEmail(null)}>Cancel</Button>
              <Button onClick={handleSendEmail} loading={sending}><Mail className="h-4 w-4" /> Send Email</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete Document" message={`Delete "${deleting?.type}" for ${deleting?.employeeId}?`} confirmLabel="Delete" />
    </div>
  );
}
