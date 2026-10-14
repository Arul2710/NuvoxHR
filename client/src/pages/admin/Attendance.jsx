import { useState, useRef, useEffect } from 'react';
import { Search, RefreshCw, Download, Eye, ChevronDown, MapPin, ScanFace, AlertCircle, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { extractError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import {
  resolveAsset,
  formatDate,
  formatTime,
  formatDuration,
  formatLocation,
} from '../../services/format';
import { exportAttendanceToCsv, exportAttendanceToPdf } from '../../services/export';
import PageHeader from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import { SkeletonRow } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { useToast } from '../../context/ToastContext';

const STATUS = ['Present', 'Late', 'Half Day', 'Absent', 'On Leave', 'Holiday', 'Weekly Off', 'Pending Review'];

export default function Attendance() {
  const navigate = useNavigate();
  const toast = useToast();
  const [date, setDate] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [view, setView] = useState(null);
  const [detail, setDetail] = useState(null);
  const [depts, setDepts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correcting, setCorrecting] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({ checkInTime: '', checkOutTime: '', status: '', reason: '', remarks: '' });
  const [savingCorrection, setSavingCorrection] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useApi(async () => {
    const { data } = await api.get('/departments');
    setDepts(data.data);
    return data.data;
  });

  useApi(async () => {
    const { data } = await api.get('/employees?page=1&pageSize=500');
    setEmployees(data.data);
    return data.data;
  }, []);

  const derivedStatus = (status === 'Absent' || status === 'On Leave') && !date;
  const effectiveStatus = derivedStatus ? undefined : status;

  const { data, loading, refetch } = useApi(async () => {
    if (derivedStatus) {
      const sp = new URLSearchParams({ date: date || new Date().toISOString().split('T')[0] });
      if (department) sp.set('department', department);
      const { data } = await api.get(`/attendance/today?${sp.toString()}`);
      const rows = data.data.rows || [];
      const filtered = rows.filter((r) => r.status === status);
      if (search) {
        const q = search.toLowerCase();
        const match = (v) => String(v || '').toLowerCase().includes(q);
        return {
          data: filtered.filter((r) =>
            match(r.employee.firstName) || match(r.employee.lastName) || match(r.employee.employeeId) || match(r.employee.email)
          ),
          meta: { total: filtered.length, page: 1, pageSize, totalPages: 1 },
        };
      }
      return { data: filtered, meta: { total: filtered.length, page: 1, pageSize, totalPages: 1 } };
    }
    const sp = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (date) sp.set('date', date);
    else if (dateRange.from || dateRange.to) {
      if (dateRange.from) sp.set('from', dateRange.from);
      if (dateRange.to) sp.set('to', dateRange.to);
    }
    if (department) sp.set('department', department);
    if (employeeFilter) sp.set('employee', employeeFilter);
    if (effectiveStatus) sp.set('status', effectiveStatus);
    if (search) sp.set('search', search);
    const { data } = await api.get(`/attendance?${sp.toString()}`);
    return data;
  }, [page, pageSize, date, dateRange.from, dateRange.to, department, employeeFilter, effectiveStatus, status, search, derivedStatus]);

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize, totalPages: 1, total: rows.length };

  const handleExportCSV = async () => {
    const payload = rows.map((r) => ({
      employeeId: r.employee.employeeId,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      department: r.employee.department?.name || '—',
      date: formatDate(r.date),
      checkIn: r.checkInTime ? formatTime(r.checkInTime) : '—',
      checkOut: r.checkOutTime ? formatTime(r.checkOutTime) : '—',
      hours: r.workingHoursMinutes ? formatDuration(r.workingHoursMinutes) : '—',
      breakDuration: r.breakMinutes ? formatDuration(r.breakMinutes) : '—',
      overtime: r.overtimeMinutes ? formatDuration(r.overtimeMinutes) : '—',
      status: r.status,
      location: r.geoVerified ? 'Verified' : 'Not Verified',
      face: r.faceVerified ? 'Verified' : (r.source === 'Manual' ? 'Manual' : 'Not Verified'),
    }));
    exportAttendanceToCsv(payload, `attendance-${date || 'export'}`);
  };

  const handleExportPDF = async () => {
    const payload = rows.map((r) => ({
      employeeId: r.employeeId || r.employee.employeeId,
      employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
      department: r.employee.department?.name || '—',
      date: formatDate(r.date),
      checkIn: r.checkInTime ? formatTime(r.checkInTime) : '—',
      checkOut: r.checkOutTime ? formatTime(r.checkOutTime) : '—',
      hours: r.workingHoursMinutes ? formatDuration(r.workingHoursMinutes) : '—',
      breakDuration: r.breakMinutes ? formatDuration(r.breakMinutes) : '—',
      overtime: r.overtimeMinutes ? formatDuration(r.overtimeMinutes) : '—',
      status: r.status,
      location: r.geoVerified ? 'Verified' : 'Not Verified',
      face: r.faceVerified ? 'Verified' : (r.source === 'Manual' ? 'Manual' : 'Not Verified'),
    }));
    exportAttendanceToPdf(payload, { range: { from: date || 'All', to: date || 'All' } });
  };

  const openDetail = async (r) => {
    try {
      const { data } = await api.get(`/attendance/record/${r._id}`);
      setDetail(data.data);
    } catch {
      setDetail(r);
    }
  };

  const openCorrection = (r) => {
    setCorrecting(r);
    setCorrectionForm({
      checkInTime: r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
      checkOutTime: r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
      status: r.status,
      reason: '',
      remarks: r.manualRemarks || '',
    });
    setShowCorrection(true);
  };

  const handleCorrection = async () => {
    if (!correcting) return;
    if (!correctionForm.reason.trim()) { toast.error('A reason is required to correct the record'); return; }
    setSavingCorrection(true);
    try {
      const payload = {
        reason: correctionForm.reason,
        remarks: correctionForm.remarks,
        status: correctionForm.status,
      };
      if (correctionForm.checkInTime) payload.checkInTime = `${correcting.date.split('T')[0]}T${correctionForm.checkInTime}`;
      if (correctionForm.checkOutTime) payload.checkOutTime = `${correcting.date.split('T')[0]}T${correctionForm.checkOutTime}`;
      const { data } = await api.put(`/attendance/${correcting._id}/correct`, payload);
      toast.success(data.message || 'Attendance corrected');
      setShowCorrection(false);
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to correct attendance'));
    } finally {
      setSavingCorrection(false);
    }
  };

  return (
    <div>
      <PageHeader title="Attendance Records" description="Review all check-ins, check-outs and daily status across your team.">
        <div className="relative" ref={dropdownRef}>
          <Button variant="secondary" onClick={() => setDropdownOpen((o) => !o)}>
            Actions <ChevronDown className="h-4 w-4" />
          </Button>
          {dropdownOpen && (
            <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border bg-white shadow-lift dark:bg-slate-900">
              <button onClick={() => { setDropdownOpen(false); navigate('/admin/attendance/mark'); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                <ScanFace className="h-4 w-4" /> Mark Attendance
              </button>
              <button onClick={() => { setDropdownOpen(false); refetch(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                <RefreshCw className="h-4 w-4" /> View Attendance Records
              </button>
              <button onClick={() => { setDropdownOpen(false); handleExportCSV(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                <Download className="h-4 w-4" /> Export Attendance Report (CSV)
              </button>
              <button onClick={() => { setDropdownOpen(false); handleExportPDF(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                <Download className="h-4 w-4" /> Export Attendance Report (PDF)
              </button>
            </div>
          )}
        </div>
        <Button variant="secondary" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
        <Button variant="secondary" onClick={handleExportPDF} disabled={!rows.length}><Download className="h-4 w-4" /> Export PDF</Button>
        <Button onClick={handleExportCSV} disabled={!rows.length}><Download className="h-4 w-4" /> Export CSV</Button>
      </PageHeader>

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, ID, or email…" className="input pl-9" />
          </div>
          <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} className="input" title="Attendance date" placeholder="Attendance date" />
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span className="whitespace-nowrap">From</span>
            <input type="date" value={dateRange.from} onChange={(e) => { setDateRange((r) => ({ ...r, from: e.target.value })); setPage(1); }} className="input" />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <span className="whitespace-nowrap">To</span>
            <input type="date" value={dateRange.to} onChange={(e) => { setDateRange((r) => ({ ...r, to: e.target.value })); setPage(1); }} className="input" />
          </label>
          <select value={department} onChange={(e) => { setDepartment(e.target.value); setPage(1); }} className="input">
            <option value="">All Departments</option>
            {depts.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
          </select>
          <select value={employeeFilter} onChange={(e) => { setEmployeeFilter(e.target.value); setPage(1); }} className="input">
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>{emp.employeeId} · {emp.firstName} {emp.lastName}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input">
            <option value="">All Statuses</option>
            {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => { setSearch(''); setDate(''); setDateRange({ from: '', to: '' }); setDepartment(''); setEmployeeFilter(''); setStatus(''); setPage(1); }}
            className="btn-ghost text-sm"
          >
            Clear filters
          </button>
        </div>
        {derivedStatus && !date && (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
            “{status}” is computed per day. Select a date to see who was {status.toLowerCase()} on that day.
          </p>
        )}
      </Card>

      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="th">Employee ID</th>
                <th className="th">Employee Name</th>
                <th className="th">Department</th>
                <th className="th">Attendance Date</th>
                <th className="th">Check-In Time</th>
                <th className="th">Check-Out Time</th>
                <th className="th">Total Working Hours</th>
                <th className="th">Break Duration</th>
                <th className="th">Overtime Hours</th>
                <th className="th">Attendance Status</th>
                <th className="th">Location Verification</th>
                <th className="th">Face Verification</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={13} />)
              ) : rows.length === 0 ? (
                <tr><td colSpan={13}><EmptyState title="No records found" message="Adjust the filters or pick another date." /></td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id || `${r.employee._id}-${r.date}`} className="cursor-pointer border-b transition last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50" onClick={() => openDetail(r)}>
                    <td className="td">{r.employeeId || r.employee.employeeId}</td>
                    <td className="td">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{r.employee.firstName} {r.employee.lastName}</p>
                      <p className="text-xs text-slate-400">{r.employee.email}</p>
                    </td>
                    <td className="td text-xs">{r.employee.department?.name || '—'}</td>
                    <td className="td">{formatDate(r.date)}</td>
                    <td className="td">{r.checkInTime ? formatTime(r.checkInTime) : '—'}</td>
                    <td className="td">{r.checkOutTime ? formatTime(r.checkOutTime) : '—'}</td>
                    <td className="td">{r.workingHoursMinutes ? formatDuration(r.workingHoursMinutes) : '—'}</td>
                    <td className="td">{r.breakMinutes ? formatDuration(r.breakMinutes) : '—'}</td>
                    <td className="td">{r.overtimeMinutes ? formatDuration(r.overtimeMinutes) : '—'}</td>
                    <td className="td"><Badge>{r.status}</Badge></td>
                    <td className="td">
                      {r.geoVerified ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <MapPin className="h-3.5 w-3.5" /> Verified
                        </span>
                      ) : <span className="text-xs text-slate-400">Not Verified</span>}
                    </td>
                    <td className="td">
                      {r.faceVerified ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          <ScanFace className="h-3.5 w-3.5" /> Verified
                        </span>
                      ) : <span className="text-xs text-slate-400">{r.source === 'Manual' ? 'Manual' : 'Not Verified'}</span>}
                    </td>
                    <td className="td">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openDetail(r); }}><Eye className="h-3 w-3" /></Button>
                        <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); openCorrection(r); }}><Edit className="h-3 w-3" /></Button>
                        {r.checkInPhoto && <PhotoThumb src={resolveAsset(r.checkInPhoto)} label={`Check-in · ${formatTime(r.checkInTime)}`} onView={(e) => { e.stopPropagation(); setView({ src: resolveAsset(r.checkInPhoto), label: `Check-in · ${formatTime(r.checkInTime)}` }); }} />}
                        {r.checkOutPhoto && <PhotoThumb src={resolveAsset(r.checkOutPhoto)} label={`Check-out · ${formatTime(r.checkOutTime)}`} onView={(e) => { e.stopPropagation(); setView({ src: resolveAsset(r.checkOutPhoto), label: `Check-out · ${formatTime(r.checkOutTime)}` }); }} />}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {rows.length > 0 && !derivedStatus && (
          <Pagination page={meta.page} pageSize={pageSize} total={meta.total} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        )}
      </Card>

      {/* Mobile */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-24 animate-pulse" />)
        ) : rows.length === 0 ? (
          <Card><EmptyState title="No records found" /></Card>
        ) : (
          rows.map((r) => (
            <Card key={r._id || `${r.employee._id}-${r.date}`} className="cursor-pointer p-4" onClick={() => openDetail(r)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{r.employee.firstName} {r.employee.lastName}</p>
                  <p className="text-xs text-slate-400">{formatDate(r.date)} · {r.employeeId}</p>
                </div>
                <Badge>{r.status}</Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div>In: <span className="font-semibold text-slate-700 dark:text-slate-200">{r.checkInTime ? formatTime(r.checkInTime) : '—'}</span></div>
                <div>Out: <span className="font-semibold text-slate-700 dark:text-slate-200">{r.checkOutTime ? formatTime(r.checkOutTime) : '—'}</span></div>
                <div className="col-span-2">Hours: <span className="font-semibold text-slate-700 dark:text-slate-200">{r.workingHoursMinutes ? formatDuration(r.workingHoursMinutes) : '—'}</span></div>
              </div>
            </Card>
          ))
        )}
        {rows.length > 0 && !derivedStatus && (
          <Pagination page={meta.page} pageSize={pageSize} total={meta.total} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
        )}
      </div>

      <Modal open={!!view} onClose={() => setView(null)} title={view?.label} size="sm">
        {view && <img src={view.src} alt={view.label} className="w-full rounded-xl object-contain" />}
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Attendance Record Details" size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div><p className="text-xs text-slate-400">Employee</p><p className="font-medium">{detail.employee ? `${detail.employee.firstName} ${detail.employee.lastName}` : detail.employeeId}</p></div>
              <div><p className="text-xs text-slate-400">Employee ID</p><p className="font-medium">{detail.employeeId || detail.employee?.employeeId}</p></div>
              <div><p className="text-xs text-slate-400">Department</p><p className="font-medium">{detail.employee?.department?.name || '—'}</p></div>
              <div><p className="text-xs text-slate-400">Date</p><p className="font-medium">{formatDate(detail.date)}</p></div>
              <div><p className="text-xs text-slate-400">Status</p><Badge>{detail.status}</Badge></div>
              <div><p className="text-xs text-slate-400">Source</p><p className="font-medium">{detail.source || 'Face'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div><p className="text-xs text-slate-400">Check-in</p><p className="font-medium">{detail.checkInTime ? formatTime(detail.checkInTime) : '—'}</p></div>
              <div><p className="text-xs text-slate-400">Check-out</p><p className="font-medium">{detail.checkOutTime ? formatTime(detail.checkOutTime) : '—'}</p></div>
              <div><p className="text-xs text-slate-400">Working Hours</p><p className="font-medium">{detail.workingHoursMinutes ? formatDuration(detail.workingHoursMinutes) : '—'}</p></div>
              <div><p className="text-xs text-slate-400">Overtime</p><p className="font-medium">{detail.overtimeMinutes ? formatDuration(detail.overtimeMinutes) : '—'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div><p className="text-xs text-slate-400">Break Duration</p><p className="font-medium">{detail.breakMinutes ? formatDuration(detail.breakMinutes) : '—'}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500"><ScanFace className="h-3.5 w-3.5" /> Face Verification</p>
                <p className="text-sm">{detail.faceVerified ? <span className="text-emerald-600">Verified</span> : <span className="text-slate-400">Not verified (Manual)</span>}</p>
                {detail.checkInMatchDistance && <p className="text-xs text-slate-400">Match distance: {detail.checkInMatchDistance.toFixed(4)}</p>}
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500"><MapPin className="h-3.5 w-3.5" /> GPS Verification</p>
                <p className="text-sm">{detail.geoVerified ? <span className="text-emerald-600">Verified</span> : <span className="text-slate-400">Not verified</span>}</p>
                {detail.checkInLocation && <p className="text-xs text-slate-400">{formatLocation(detail.checkInLocation) || 'No location data'}</p>}
                {detail.checkInDistanceFromCompany && <p className="text-xs text-slate-400">Distance from company: {detail.checkInDistanceFromCompany}m</p>}
              </div>
            </div>
            {detail.manualReason && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                <p className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400"><AlertCircle className="h-3.5 w-3.5" /> Manual Entry</p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">{detail.manualReason}</p>
                {detail.manualRemarks && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{detail.manualRemarks}</p>}
              </div>
            )}
            {detail.exceptionReason && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-500/20 dark:bg-rose-500/10">
                <p className="flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400"><AlertCircle className="h-3.5 w-3.5" /> Exception/Reason</p>
                <p className="mt-1 text-sm text-rose-800 dark:text-rose-300">{detail.exceptionReason}</p>
              </div>
            )}
            {detail.audit?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-500">Manual Correction History</p>
                <div className="max-h-40 space-y-2 overflow-y-auto">
                  {detail.audit.map((a, i) => (
                    <div key={i} className="rounded-lg border p-2 text-xs dark:border-slate-700">
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{a.field}</span>
                        <span className="text-slate-400">{a.byName || 'System'} · {new Date(a.at).toLocaleString()}</span>
                      </div>
                      <p className="mt-0.5 text-slate-500">{a.oldValue ? `From: ${a.oldValue}` : ''} {a.newValue ? `To: ${a.newValue}` : ''}</p>
                      {a.reason && <p className="mt-0.5 text-slate-500">Reason: {a.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!showCorrection} onClose={() => setShowCorrection(false)} title="Correct Attendance Record" size="md">
        {correcting && (
          <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
              <p><span className="text-slate-400">Employee:</span> {correcting.employee.firstName} {correcting.employee.lastName} ({correcting.employeeId})</p>
              <p><span className="text-slate-400">Date:</span> {formatDate(correcting.date)}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Check-In Time" type="time" value={correctionForm.checkInTime} onChange={(e) => setCorrectionForm({ ...correctionForm, checkInTime: e.target.value })} />
              <Input label="Check-Out Time" type="time" value={correctionForm.checkOutTime} onChange={(e) => setCorrectionForm({ ...correctionForm, checkOutTime: e.target.value })} />
            </div>
            <Select label="Status" value={correctionForm.status} onChange={(e) => setCorrectionForm({ ...correctionForm, status: e.target.value })}>
              {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Textarea label="Reason (mandatory)" value={correctionForm.reason} onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })} placeholder="Reason for correction..." required />
            <Textarea label="Remarks (optional)" value={correctionForm.remarks} onChange={(e) => setCorrectionForm({ ...correctionForm, remarks: e.target.value })} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowCorrection(false)}>Cancel</Button>
              <Button onClick={handleCorrection} loading={savingCorrection}>Save Correction</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function PhotoThumb({ src, label, onView }) {
  return (
    <button onClick={onView} title={label} className="group relative">
      <img src={src} alt={label} className="h-9 w-9 rounded-lg object-cover ring-1 ring-black/5" />
      <span className="absolute inset-0 hidden items-center justify-center rounded-lg bg-black/40 group-hover:flex">
        <Eye className="h-3.5 w-3.5 text-white" />
      </span>
    </button>
  );
}