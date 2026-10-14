import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Edit2, Trash2, CalendarRange, CalendarDays, List, ChevronLeft, ChevronRight, Settings2 } from 'lucide-react';
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

const emptyForm = { name: '', date: '', type: 'Full Day', partialHours: 0, paid: true, department: '', group: '', notes: '' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Holidays() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [view, setView] = useState('list');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [policies, setPolicies] = useState([]);

  const { data, loading, refetch } = useApi(async () => {
    const { data } = await api.get(`/holidays?year=${year}`);
    return data.data;
  }, [year]);

  useApi(async () => {
    const { data } = await api.get('/departments');
    setDepartments(data.data);
    return data.data;
  }, []);

  useApi(async () => {
    const { data } = await api.get('/company/attendance-policies');
    setPolicies(data.data || []);
    return data.data;
  }, []);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (h) => { setEditing(h); setForm({ ...h, date: h.date?.split('T')[0] }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.date) { toast.error('Name and date are required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/holidays/${editing._id}`, form);
        toast.success('Holiday updated');
      } else {
        await api.post('/holidays', form);
        toast.success('Holiday added');
      }
      setShowModal(false);
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/holidays/${deleting._id}`);
      toast.success('Holiday deleted');
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to delete'));
    }
  };

  // Build the month grid for the calendar view.
  const holidaysByDay = {};
  (data || []).forEach((h) => {
    const d = new Date(h.date);
    if (d.getFullYear() === year && d.getMonth() === month) holidaysByDay[d.getDate()] = h;
  });
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1);
  };

  if (loading) return <FullScreenLoader label="Loading holidays…" />;

  return (
    <div>
      <PageHeader title="Holidays & Weekly Offs" description="Manage company holidays, weekly offs, and paid holiday rules.">
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm ${view === 'list' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              <List className="h-4 w-4" /> List
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm ${view === 'calendar' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'}`}
            >
              <CalendarDays className="h-4 w-4" /> Calendar
            </button>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Holiday</Button>
        </div>
      </PageHeader>

      <Card className="mb-5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-600 dark:text-slate-300">Year:</label>
          <Input type="number" value={year} onChange={(e) => setYear(parseInt(e.target.value) || year)} className="w-28" />
          {view === 'calendar' && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
              <Select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))} className="w-40">
                {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </Select>
              <Button variant="secondary" size="sm" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          )}
        </div>
      </Card>

      {policies.length > 0 && (
        <Card className="mb-5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Weekly Off Rules</p>
              <p className="mt-0.5 text-xs text-slate-400">Applied per the employee's assigned attendance policy. Employee-specific overrides can be set in Salary Configuration.</p>
            </div>
            <Link to="/admin/attendance-policies" className="btn-secondary text-sm"><Settings2 className="h-4 w-4" /> Manage Policies</Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {policies.map((p) => (
              <span key={p._id} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <span className="font-semibold">{p.name}</span>: {(p.weeklyOffDays || []).join(', ') || 'No weekly off'}
                {p.alternateSaturdayOff ? ' · Alternate Saturdays off' : ''}
              </span>
            ))}
          </div>
        </Card>
      )}

      {view === 'calendar' ? (
        <Card className="overflow-hidden p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            {WEEKDAYS.map((w) => <div key={w} className="py-2">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, idx) => {
              const h = day ? holidaysByDay[day] : null;
              const isToday = day && year === now.getFullYear() && month === now.getMonth() && day === now.getDate();
              return (
                <div
                  key={idx}
                  className={`min-h-[76px] rounded-lg border p-1.5 text-left ${
                    h
                      ? h.paid
                        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                        : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
                      : 'border-slate-100 dark:border-slate-800'
                  }`}
                >
                  {day && (
                    <>
                      <div className={`text-xs font-semibold ${isToday ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                        {day}
                      </div>
                      {h && (
                        <button
                          onClick={() => openEdit(h)}
                          className="mt-1 block w-full truncate text-left text-[11px] font-medium text-slate-700 dark:text-slate-200"
                          title={`${h.name}${h.paid ? ' (Paid)' : ' (Unpaid)'}`}
                        >
                          {h.name}
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-400">Public holidays are highlighted. Click a holiday to edit it.</p>
        </Card>
      ) : data?.length === 0 ? (
        <Card><EmptyState icon={CalendarRange} title="No holidays" message="No holidays configured for this year." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((h) => (
            <Card key={h._id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{h.name}</p>
                  <p className="text-sm text-slate-400">{formatDate(h.date)}</p>
                </div>
                <Badge tone={h.paid ? 'emerald' : 'slate'}>{h.paid ? 'Paid' : 'Unpaid'}</Badge>
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                <p>Type: {h.type}</p>
                {h.department && <p>Department: {h.department.name}</p>}
                {h.group && <p>Group: {h.group}</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(h)}><Edit2 className="h-3 w-3" /> Edit</Button>
                <Button size="sm" variant="danger" onClick={() => setDeleting(h)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Holiday' : 'Add Holiday'} size="md">
        <div className="space-y-4">
          <Input label="Holiday Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="Full Day">Full Day</option>
              <option value="Partial Day">Partial Day</option>
            </Select>
          </div>
          {form.type === 'Partial Day' && (
            <Input label="Partial Hours" type="number" value={form.partialHours} onChange={(e) => setForm({ ...form, partialHours: parseFloat(e.target.value) || 0 })} />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Department (optional)" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </Select>
            <Input label="Group (optional)" value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} className="h-4 w-4 rounded" /> Paid Holiday</label>
          <Textarea label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Holiday</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete Holiday" message={`Delete "${deleting?.name}"?`} confirmLabel="Delete" />
    </div>
  );
}
