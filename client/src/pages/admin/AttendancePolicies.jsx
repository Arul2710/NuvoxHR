import { useState } from 'react';
import { Plus, Edit2, Trash2, Clock } from 'lucide-react';
import api, { extractError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import PageHeader from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import Button, { FullScreenLoader } from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { Input, Select, Textarea } from '../../components/ui/Form';
import { useToast } from '../../context/ToastContext';

const emptyForm = { name: '', code: '', weeklyOffDays: ['Sunday'], alternateSaturdayOff: false, fullDayHours: 8, halfDayThresholdHours: 4, lateGraceMinutes: 10, overtimeAfterHours: 9, description: '' };
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function AttendancePolicies() {
  const toast = useToast();
  const { data, loading, refetch } = useApi(async () => {
    const { data } = await api.get('/company/attendance-policies');
    return data.data;
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...p }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Policy name is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/company/attendance-policies/${editing._id}`, form);
        toast.success('Policy updated');
      } else {
        await api.post('/company/attendance-policies', form);
        toast.success('Policy created');
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
      await api.delete(`/company/attendance-policies/${deleting._id}`);
      toast.success('Policy deactivated');
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to delete'));
    }
  };

  if (loading) return <FullScreenLoader label="Loading attendance policies…" />;

  return (
    <div>
      <PageHeader title="Attendance Policies" description="Configure attendance rules, weekly offs, and overtime thresholds.">
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Policy</Button>
      </PageHeader>

      {data?.length === 0 ? (
        <Card><EmptyState icon={Clock} title="No attendance policies" message="Create policies to define attendance rules." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <Card key={p._id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.code}</p>
                </div>
                {p.alternateSaturdayOff && <Badge tone="violet">Alt Sat</Badge>}
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                <p>Weekly offs: {p.weeklyOffDays?.join(', ') || 'None'}</p>
                <p>Full day: {p.fullDayHours}h · Half day: {p.halfDayThresholdHours}h</p>
                <p>Late grace: {p.lateGraceMinutes} min · OT after: {p.overtimeAfterHours}h</p>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(p)}><Edit2 className="h-3 w-3" /> Edit</Button>
                <Button size="sm" variant="danger" onClick={() => setDeleting(p)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Policy' : 'Create Policy'} size="lg">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Policy Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div>
            <label className="label">Weekly Off Days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d) => (
                <label key={d} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={form.weeklyOffDays?.includes(d)} onChange={(e) => {
                    const days = e.target.checked ? [...(form.weeklyOffDays || []), d] : (form.weeklyOffDays || []).filter((x) => x !== d);
                    setForm({ ...form, weeklyOffDays: days });
                  }} className="h-4 w-4 rounded" />
                  {d.slice(0, 3)}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Full Day Hours" type="number" value={form.fullDayHours} onChange={(e) => setForm({ ...form, fullDayHours: parseFloat(e.target.value) || 0 })} />
            <Input label="Half Day Threshold (hrs)" type="number" value={form.halfDayThresholdHours} onChange={(e) => setForm({ ...form, halfDayThresholdHours: parseFloat(e.target.value) || 0 })} />
            <Input label="Late Grace (min)" type="number" value={form.lateGraceMinutes} onChange={(e) => setForm({ ...form, lateGraceMinutes: parseInt(e.target.value) || 0 })} />
            <Input label="Overtime After (hrs)" type="number" value={form.overtimeAfterHours} onChange={(e) => setForm({ ...form, overtimeAfterHours: parseFloat(e.target.value) || 0 })} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.alternateSaturdayOff} onChange={(e) => setForm({ ...form, alternateSaturdayOff: e.target.checked })} className="h-4 w-4 rounded" /> Alternate Saturdays Off</label>
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Policy</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete Policy" message={`Deactivate "${deleting?.name}"?`} confirmLabel="Deactivate" />
    </div>
  );
}
