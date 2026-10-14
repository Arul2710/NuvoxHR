import { useState } from 'react';
import { Plus, Edit2, Trash2, ShieldCheck } from 'lucide-react';
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

const LEAVE_TYPES = ['Sick Leave', 'Casual Leave', 'Earned Leave', 'Maternity Leave', 'Paternity Leave', 'Unpaid Leave', 'Compensatory Off', 'Other'];

const emptyForm = {
  name: '', code: '', leaveType: 'Sick Leave', allowanceType: 'Annual', allowance: 12,
  paid: true, maxConsecutiveDays: 0, carryForward: { enabled: false, maxDays: 0 },
  approvalRequired: true, documentRequired: false, applicableGroups: [], description: '',
};

export default function LeavePolicies() {
  const toast = useToast();
  const { data, loading, refetch } = useApi(async () => {
    const { data } = await api.get('/leave-policies/policies');
    return data.data;
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (policy) => {
    setEditing(policy);
    setForm({ ...policy, carryForward: policy.carryForward || { enabled: false, maxDays: 0 } });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { toast.error('Name and code are required'); return; }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/leave-policies/policies/${editing._id}`, form);
        toast.success('Leave policy updated');
      } else {
        await api.post('/leave-policies/policies', form);
        toast.success('Leave policy created');
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
      await api.delete(`/leave-policies/policies/${deleting._id}`);
      toast.success('Leave policy deactivated');
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to delete'));
    }
  };

  if (loading) return <FullScreenLoader label="Loading leave policies…" />;

  return (
    <div>
      <PageHeader title="Leave Policies" description="Configure leave types, allowances, carry-forward, and approval rules.">
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Policy</Button>
      </PageHeader>

      {data?.length === 0 ? (
        <Card><EmptyState icon={ShieldCheck} title="No leave policies" message="Create leave policies to manage employee leave allowances." /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <Card key={p._id} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.code} · {p.leaveType}</p>
                </div>
                <Badge tone={p.paid ? 'emerald' : 'rose'}>{p.paid ? 'Paid' : 'Unpaid'}</Badge>
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                <p>Allowance: <span className="font-medium text-slate-700 dark:text-slate-200">{p.allowance} days/{p.allowanceType.toLowerCase()}</span></p>
                <p>Max consecutive: {p.maxConsecutiveDays || 'Unlimited'}</p>
                <p>Carry forward: {p.carryForward?.enabled ? `Yes (max ${p.carryForward.maxDays})` : 'No'}</p>
                <p>Approval: {p.approvalRequired ? 'Required' : 'Not required'}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEdit(p)}><Edit2 className="h-3 w-3" /> Edit</Button>
                <Button size="sm" variant="danger" onClick={() => setDeleting(p)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Leave Policy' : 'Create Leave Policy'} size="lg">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Policy Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Leave Type" value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select label="Allowance Type" value={form.allowanceType} onChange={(e) => setForm({ ...form, allowanceType: e.target.value })}>
              <option value="Annual">Annual</option>
              <option value="Monthly">Monthly</option>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Allowance (days)" type="number" value={form.allowance} onChange={(e) => setForm({ ...form, allowance: parseFloat(e.target.value) || 0 })} />
            <Input label="Max Consecutive Days" type="number" value={form.maxConsecutiveDays} onChange={(e) => setForm({ ...form, maxConsecutiveDays: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.paid} onChange={(e) => setForm({ ...form, paid: e.target.checked })} className="h-4 w-4 rounded" /> Paid Leave</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.approvalRequired} onChange={(e) => setForm({ ...form, approvalRequired: e.target.checked })} className="h-4 w-4 rounded" /> Approval Required</label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.documentRequired} onChange={(e) => setForm({ ...form, documentRequired: e.target.checked })} className="h-4 w-4 rounded" /> Document Required</label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.carryForward?.enabled} onChange={(e) => setForm({ ...form, carryForward: { ...form.carryForward, enabled: e.target.checked } })} className="h-4 w-4 rounded" /> Carry Forward</label>
            {form.carryForward?.enabled && (
              <Input label="Max Carry Forward Days" type="number" value={form.carryForward.maxDays} onChange={(e) => setForm({ ...form, carryForward: { ...form.carryForward, maxDays: parseInt(e.target.value) || 0 } })} />
            )}
          </div>
          <Textarea label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>Save Policy</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete Leave Policy" message={`Deactivate "${deleting?.name}"? This will not affect existing leave records.`} confirmLabel="Deactivate" />
    </div>
  );
}
