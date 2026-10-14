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
import { Input, Select } from '../../components/ui/Form';
import { useToast } from '../../context/ToastContext';

const emptyForm = { name: '', code: '', startTime: '09:00', endTime: '18:00', breakMinutes: 60, graceMinutes: 10, overnight: false };

export default function WorkShifts() {
  const toast = useToast();
  const { data, loading, refetch } = useApi(async () => {
    const { data } = await api.get('/company/shifts');
    return data.data;
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...s }); setShowModal(true); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Shift name is required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/company/shifts/${editing._id}`, form);
        toast.success('Shift updated');
      } else {
        await api.post('/company/shifts', form);
        toast.success('Shift created');
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
      await api.delete(`/company/shifts/${deleting._id}`);
      toast.success('Shift deactivated');
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to delete'));
    }
  };

  if (loading) return <FullScreenLoader label="Loading work shifts…" />;

  return (
    <div>
      <PageHeader title="Work Shifts" description="Configure work shifts with start/end times, breaks, and grace periods.">
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Shift</Button>
      </PageHeader>

      {data?.length === 0 ? (
        <Card><EmptyState icon={Clock} title="No work shifts" message="Create work shifts to assign to employees." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => (
            <Card key={s._id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.code}</p>
                </div>
                {s.overnight && <Badge tone="violet">Overnight</Badge>}
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                <p>Start: {s.startTime} · End: {s.endTime}</p>
                <p>Break: {s.breakMinutes} min · Grace: {s.graceMinutes} min</p>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(s)}><Edit2 className="h-3 w-3" /> Edit</Button>
                <Button size="sm" variant="danger" onClick={() => setDeleting(s)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Shift' : 'Create Shift'} size="md">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Shift Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Start Time" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <Input label="End Time" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Break (minutes)" type="number" value={form.breakMinutes} onChange={(e) => setForm({ ...form, breakMinutes: parseInt(e.target.value) || 0 })} />
            <Input label="Grace Period (min)" type="number" value={form.graceMinutes} onChange={(e) => setForm({ ...form, graceMinutes: parseInt(e.target.value) || 0 })} />
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.overnight} onChange={(e) => setForm({ ...form, overnight: e.target.checked })} className="h-4 w-4 rounded" /> Overnight Shift</label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Shift</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete Shift" message={`Deactivate "${deleting?.name}"?`} confirmLabel="Deactivate" />
    </div>
  );
}
