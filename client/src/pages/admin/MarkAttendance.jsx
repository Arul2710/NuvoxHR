import { useState, useEffect } from 'react';
import { Search, Clock, UserCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import api, { extractError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatTime, toInputDate } from '../../services/format';
import PageHeader from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import Button, { FullScreenLoader } from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { useToast } from '../../context/ToastContext';

const STATUSES = ['Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Holiday', 'Weekly Off', 'Pending Review'];

export default function MarkAttendance() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [date, setDate] = useState(toInputDate(new Date()));
  const [action, setAction] = useState('check-in');
  const [time, setTime] = useState('');
  const [status, setStatus] = useState('Present');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [existingRecord, setExistingRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const empApi = useApi(async () => {
    const { data } = await api.get('/employees?page=1&pageSize=500');
    setEmployees(data.data);
    return data.data;
  }, []);

  useEffect(() => {
    if (selectedEmployee && date) {
      api.get(`/attendance?employee=${selectedEmployee._id}&date=${date}&page=1&pageSize=1`)
        .then(({ data }) => setExistingRecord(data.data[0] || null))
        .catch(() => setExistingRecord(null));
    } else {
      setExistingRecord(null);
    }
  }, [selectedEmployee, date]);

  // Default the action to the next valid step based on the existing record.
  useEffect(() => {
    if (existingRecord?.checkInTime && !existingRecord.checkOutTime) setAction('check-out');
    else if (!existingRecord?.checkInTime) setAction('check-in');
  }, [existingRecord]);

  const alreadyCheckedIn = Boolean(existingRecord?.checkInTime);
  const alreadyCheckedOut = Boolean(existingRecord?.checkOutTime);
  const actionBlocked =
    (action === 'check-in' && alreadyCheckedIn) || (action === 'check-out' && alreadyCheckedOut);
  const requiresCheckInFirst = action === 'check-out' && !alreadyCheckedIn;

  const handleSubmit = async () => {
    if (!selectedEmployee) { toast.error('Please select an employee'); return; }
    if (!date) { toast.error('Please select a date'); return; }
    if (action === 'check-in' && alreadyCheckedIn) {
      toast.error(`This employee already checked in at ${formatTime(existingRecord.checkInTime)}. Use correction to modify it.`);
      return;
    }
    if (action === 'check-out' && alreadyCheckedOut) {
      toast.error(`This employee already checked out at ${formatTime(existingRecord.checkOutTime)}. Use correction to modify it.`);
      return;
    }
    if (action === 'check-out' && !alreadyCheckedIn) {
      toast.error('This employee has not checked in on this date. Check-in is required first.');
      return;
    }
    if (!time) { toast.error('Please enter a time'); return; }
    if (!reason.trim()) { toast.error('A reason is required for manual attendance'); return; }

    setSaving(true);
    try {
      const payload = {
        employeeId: selectedEmployee._id,
        date,
        action,
        time: `${date}T${time}`,
        status,
        reason: reason.trim(),
        remarks: remarks.trim(),
      };
      const { data } = await api.post('/attendance/mark', payload);
      toast.success(data.message || 'Attendance recorded');
      setReason('');
      setRemarks('');
      setExistingRecord(data.data);
    } catch (err) {
      toast.error(extractError(err, 'Failed to record attendance'));
    } finally {
      setSaving(false);
    }
  };

  if (empApi.loading) return <FullScreenLoader label="Loading employees…" />;

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return e.firstName?.toLowerCase().includes(q) || e.lastName?.toLowerCase().includes(q) || e.employeeId?.toLowerCase().includes(q) || e.email?.toLowerCase().includes(q);
  });

  return (
    <div>
      <PageHeader title="Mark Attendance" description="Manually record employee check-in or check-out with audit trail." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card className="p-4">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee…" className="input pl-9" />
            </div>
            <div className="max-h-[500px] space-y-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <EmptyState title="No employees found" />
              ) : (
                filtered.map((emp) => (
                  <button
                    key={emp._id}
                    onClick={() => setSelectedEmployee(emp)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${selectedEmployee?._id === emp._id ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800 dark:text-slate-100">{emp.firstName} {emp.lastName}</p>
                      <p className="text-xs text-slate-400">{emp.employeeId}</p>
                    </div>
                    {selectedEmployee?._id === emp._id && <CheckCircle2 className="h-4 w-4 text-brand-600" />}
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="p-5">
            {selectedEmployee ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedEmployee.firstName} {selectedEmployee.lastName}</p>
                    <p className="text-sm text-slate-400">{selectedEmployee.employeeId} · {selectedEmployee.department?.name || 'No dept'}</p>
                  </div>
                  <Badge tone="indigo">{selectedEmployee.status}</Badge>
                </div>

                {existingRecord ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <p className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                      <AlertCircle className="h-4 w-4" /> Existing record for {formatDate(existingRecord.date)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amber-700 dark:text-amber-400">
                      <span>Check-in: {existingRecord.checkInTime ? formatTime(existingRecord.checkInTime) : '—'}</span>
                      <span>Check-out: {existingRecord.checkOutTime ? formatTime(existingRecord.checkOutTime) : '—'}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                      {alreadyCheckedIn ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Already checked in</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Not checked in</span>
                      )}
                      {alreadyCheckedOut ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Already checked out</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Not checked out</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/60">
                    No attendance record exists for this employee on {formatDate(date)}.
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Attendance Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  <Input label={action === 'check-out' ? 'Check-Out Time' : 'Check-In Time'} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select label="Attendance Action" value={action} onChange={(e) => setAction(e.target.value)}>
                    <option value="check-in" disabled={alreadyCheckedIn}>Check-In{alreadyCheckedIn ? ' (already recorded)' : ''}</option>
                    <option value="check-out" disabled={alreadyCheckedOut || !alreadyCheckedIn}>Check-Out{alreadyCheckedOut ? ' (already recorded)' : (!alreadyCheckedIn ? ' (needs check-in)' : '')}</option>
                  </Select>
                  <Select label="Attendance Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </div>

                {(actionBlocked || requiresCheckInFirst) && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {requiresCheckInFirst
                      ? 'Check-out is not allowed before this employee checks in.'
                      : 'This action is already recorded for the selected date. Use the Attendance Records page to correct it.'}
                  </p>
                )}

                <Textarea label="Reason for manual attendance (required)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for manual attendance…" />
                <Textarea label="Supporting remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Additional notes…" />

                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => { setReason(''); setRemarks(''); }}>Clear</Button>
                  <Button onClick={handleSubmit} loading={saving} disabled={actionBlocked || requiresCheckInFirst}>
                    <Clock className="h-4 w-4" /> Record Attendance
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState icon={UserCheck} title="Select an employee" message="Choose an employee from the list to mark their attendance." />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
