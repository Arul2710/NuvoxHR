import { useState, useEffect } from 'react';
import { Search, Save, History, AlertCircle } from 'lucide-react';
import api, { extractError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import PageHeader from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import Button, { FullScreenLoader } from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { useToast } from '../../context/ToastContext';

const SALARY_BASIS = [
  'Per Hour',
  'Per Day',
  'Working Hours (Monthly)',
  'Working Days (Monthly)',
  'Fixed (Monthly)',
  'Per Day (Include Public Holidays)',
  'Working Days (Include Public Holidays)',
];
const OVERTIME_OPTIONS = ['Not Applicable', 'Per Day', 'Per Week', 'Per Month', 'Fixed Hours (Monthly)'];
const ATTENDANCE_POLICIES = ['Standard (Mon–Fri)', '5.5-Day Week', '6-Day Week', 'Shift Based', 'Flexi Hours'];
const PAYMENT_MODES = ['Bank Transfer', 'Cheque', 'Cash', 'Other'];
const WEEK_OFF_PATTERNS = ['Saturday & Sunday', 'Sunday Only', 'Alternate Saturdays', 'Custom'];

export default function SalaryConfig() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [config, setConfig] = useState(null);
  const [history, setHistory] = useState([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);

  const empApi = useApi(async () => {
    const { data } = await api.get('/employees?page=1&pageSize=500');
    setEmployees(data.data);
    return data.data;
  }, []);

  useEffect(() => {
    if (selectedEmployee) {
      setLoadingConfig(true);
      api.get(`/employees/${selectedEmployee._id}/payroll`)
        .then(({ data }) => {
          setConfig(data.data.payroll);
          setHistory(data.data.salaryHistory || []);
        })
        .catch((err) => toast.error(extractError(err, 'Failed to load salary config')))
        .finally(() => setLoadingConfig(false));
    }
  }, [selectedEmployee]);

  const update = (key, value) => setConfig((c) => ({ ...c, [key]: value }));
  const updateNested = (parent, key, value) => setConfig((c) => ({ ...c, [parent]: { ...c[parent], [key]: value } }));

  const handleSave = async () => {
    if (!selectedEmployee) return;
    if (!reason.trim()) { toast.error('A reason is required to save salary changes'); return; }
    setSaving(true);
    try {
      const { data } = await api.patch(`/employees/${selectedEmployee._id}/payroll`, { ...config, reason: reason.trim() });
      setConfig(data.data.payroll);
      setHistory(data.data.salaryHistory);
      setReason('');
      toast.success('Salary configuration saved');
    } catch (err) {
      toast.error(extractError(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  if (empApi.loading) return <FullScreenLoader label="Loading employees…" />;

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    return e.firstName?.toLowerCase().includes(q) || e.lastName?.toLowerCase().includes(q) || e.employeeId?.toLowerCase().includes(q);
  });

  const showOvertimeFields = config?.overtimeApplicable && config.overtimeApplicable !== 'Not Applicable';
  const showPfFields = config?.pf?.applicable;
  const showEsiFields = config?.esi?.applicable;

  return (
    <div>
      <PageHeader title="Salary Configuration" description="Configure employee salary structure, overtime, PF/ESI, and payment settings." />

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
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {selectedEmployee ? (
            <div className="space-y-4">
              <Card className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedEmployee.firstName} {selectedEmployee.lastName}</p>
                    <p className="text-sm text-slate-400">{selectedEmployee.employeeId} · {selectedEmployee.department?.name || 'No dept'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowHistory(true)}>
                      <History className="h-4 w-4" /> History
                    </Button>
                  </div>
                </div>

                {loadingConfig ? (
                  <FullScreenLoader label="Loading…" />
                ) : config ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select label="Salary Basis" value={config.salaryBasis} onChange={(e) => update('salaryBasis', e.target.value)}>
                        {SALARY_BASIS.map((b) => <option key={b} value={b}>{b}</option>)}
                      </Select>
                      <Input label="Salary Amount (₹)" type="number" value={config.salaryAmount} onChange={(e) => update('salaryAmount', parseFloat(e.target.value) || 0)} />
                    </div>

                    {(config.salaryBasis === 'Working Hours (Monthly)' || config.salaryBasis === 'Per Hour') && (
                      <Input label="Working Hours per Month" type="number" value={config.workingHoursPerMonth} onChange={(e) => update('workingHoursPerMonth', parseFloat(e.target.value) || 0)} />
                    )}
                    {(config.salaryBasis.includes('Working Days') || config.salaryBasis.includes('Per Day')) && (
                      <Input label="Working Days per Month" type="number" value={config.workingDaysPerMonth} onChange={(e) => update('workingDaysPerMonth', parseFloat(e.target.value) || 0)} />
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select label="Attendance Policy" value={config.attendancePolicy} onChange={(e) => update('attendancePolicy', e.target.value)}>
                        {ATTENDANCE_POLICIES.map((p) => <option key={p} value={p}>{p}</option>)}
                      </Select>
                      <Select label="Payment Mode" value={config.paymentMode} onChange={(e) => update('paymentMode', e.target.value)}>
                        {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </Select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select label="Overtime Applicable" value={config.overtimeApplicable} onChange={(e) => update('overtimeApplicable', e.target.value)}>
                        {OVERTIME_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </Select>
                      {showOvertimeFields && (
                        <>
                          <Input label="Overtime Rate (₹/hr)" type="number" value={config.overtimeRate} onChange={(e) => update('overtimeRate', parseFloat(e.target.value) || 0)} />
                          {config.overtimeApplicable === 'Fixed Hours (Monthly)' && (
                            <Input label="Fixed Overtime Hours" type="number" value={config.fixedOvertimeHours} onChange={(e) => update('fixedOvertimeHours', parseFloat(e.target.value) || 0)} />
                          )}
                        </>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select label="Weekly Off Pattern" value={config.weeklyOff?.pattern || 'Sunday Only'} onChange={(e) => updateNested('weeklyOff', 'pattern', e.target.value)}>
                        {WEEK_OFF_PATTERNS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </Select>
                      <Input label="Effective Date" type="date" value={config.effectiveDate ? config.effectiveDate.split('T')[0] : ''} onChange={(e) => update('effectiveDate', e.target.value)} />
                    </div>

                    <div className="border-t pt-4 dark:border-slate-700">
                      <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Work Shift</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Shift Name" value={config.workShift?.name || ''} onChange={(e) => updateNested('workShift', 'name', e.target.value)} />
                        <div className="grid grid-cols-2 gap-2">
                          <Input label="Start Time" type="time" value={config.workShift?.startTime || ''} onChange={(e) => updateNested('workShift', 'startTime', e.target.value)} />
                          <Input label="End Time" type="time" value={config.workShift?.endTime || ''} onChange={(e) => updateNested('workShift', 'endTime', e.target.value)} />
                        </div>
                        <Input label="Break (minutes)" type="number" value={config.workShift?.breakMinutes || 0} onChange={(e) => updateNested('workShift', 'breakMinutes', parseInt(e.target.value) || 0)} />
                        <Input label="Grace Period (min)" type="number" value={config.workShift?.graceMinutes || 0} onChange={(e) => updateNested('workShift', 'graceMinutes', parseInt(e.target.value) || 0)} />
                      </div>
                    </div>

                    <div className="border-t pt-4 dark:border-slate-700">
                      <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">PF Configuration</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={config.pf?.applicable || false} onChange={(e) => updateNested('pf', 'applicable', e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                          <label className="text-sm text-slate-600 dark:text-slate-300">PF Applicable</label>
                        </div>
                        {showPfFields && (
                          <>
                            <Input label="Employee %" type="number" value={config.pf?.employeePercent || 0} onChange={(e) => updateNested('pf', 'employeePercent', parseFloat(e.target.value) || 0)} />
                            <Input label="Employer %" type="number" value={config.pf?.employerPercent || 0} onChange={(e) => updateNested('pf', 'employerPercent', parseFloat(e.target.value) || 0)} />
                            <Input label="VPF %" type="number" value={config.pf?.vpfPercent || 0} onChange={(e) => updateNested('pf', 'vpfPercent', parseFloat(e.target.value) || 0)} />
                            <Select label="Apply On" value={config.pf?.applyOn || 'Basic'} onChange={(e) => updateNested('pf', 'applyOn', e.target.value)}>
                              <option value="Basic">Basic</option>
                              <option value="Gross">Gross</option>
                            </Select>
                            <Input label="PF Number" value={config.pf?.number || ''} onChange={(e) => updateNested('pf', 'number', e.target.value)} />
                          </>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-4 dark:border-slate-700">
                      <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">ESI Configuration</p>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={config.esi?.applicable || false} onChange={(e) => updateNested('esi', 'applicable', e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                          <label className="text-sm text-slate-600 dark:text-slate-300">ESI Applicable</label>
                        </div>
                        {showEsiFields && (
                          <>
                            <Input label="ESI Number" value={config.esi?.esiNumber || ''} onChange={(e) => updateNested('esi', 'esiNumber', e.target.value)} />
                            <Input label="Employee %" type="number" value={config.esi?.employeePercent || 0} onChange={(e) => updateNested('esi', 'employeePercent', parseFloat(e.target.value) || 0)} />
                            <Input label="Employer %" type="number" value={config.esi?.employerPercent || 0} onChange={(e) => updateNested('esi', 'employerPercent', parseFloat(e.target.value) || 0)} />
                          </>
                        )}
                      </div>
                    </div>

                    <Textarea label="Reason for Change (required)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for this salary change…" />

                    <div className="flex justify-end">
                      <Button onClick={handleSave} loading={saving}>
                        <Save className="h-4 w-4" /> Save Configuration
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            </div>
          ) : (
            <Card><EmptyState title="Select an employee" message="Choose an employee to configure their salary." /></Card>
          )}
        </div>
      </div>

      <Modal open={showHistory} onClose={() => setShowHistory(false)} title="Salary Change History" size="lg">
        {history.length === 0 ? (
          <EmptyState title="No history" message="No salary changes recorded yet." />
        ) : (
          <div className="space-y-3">
            {history.slice().reverse().map((h, i) => (
              <div key={i} className="rounded-lg border p-3 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{h.changedByName || 'System'}</p>
                  <p className="text-xs text-slate-400">{new Date(h.at).toLocaleString()}</p>
                </div>
                {h.reason && <p className="mt-1 text-xs text-slate-500">{h.reason}</p>}
                {h.previous && h.next && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded bg-slate-50 p-2 dark:bg-slate-800">
                      <p className="font-medium text-slate-500">Previous</p>
                      <p>₹{h.previous.salaryAmount} ({h.previous.salaryBasis})</p>
                    </div>
                    <div className="rounded bg-brand-50 p-2 dark:bg-brand-500/10">
                      <p className="font-medium text-brand-600">New</p>
                      <p>₹{h.next.salaryAmount} ({h.next.salaryBasis})</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
