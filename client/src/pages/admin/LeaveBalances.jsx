import { useState } from 'react';
import { Search, Edit2 } from 'lucide-react';
import api, { extractError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import PageHeader from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import Button, { FullScreenLoader } from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { Input, Select } from '../../components/ui/Form';
import { useToast } from '../../context/ToastContext';

export default function LeaveBalances() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const { data, loading, refetch } = useApi(async () => {
    const sp = new URLSearchParams({ year: String(year), page: String(page), pageSize: String(pageSize) });
    if (search) sp.set('search', search);
    const { data } = await api.get(`/leave-policies/balances?${sp.toString()}`);
    return data;
  }, [year, search, page, pageSize]);

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize, totalPages: 1, total: 0 };

  const openEdit = (row) => {
    setEditing(row);
    setEditForm({ allocated: row.allocated, carriedForward: row.carriedForward, adjusted: row.adjusted, notes: row.notes });
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/leave-policies/balances/${editing.employee._id}`, {
        year,
        leaveType: editing.leaveType,
        allocated: editForm.allocated,
        carriedForward: editForm.carriedForward,
        adjusted: editForm.adjusted,
        notes: editForm.notes,
      });
      toast.success('Leave balance updated');
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FullScreenLoader label="Loading leave balances…" />;

  return (
    <div>
      <PageHeader title="Leave Balances" description="View and adjust employee leave balances by type and year." />

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search employee…" className="input pl-9" />
          </div>
          <Input type="number" value={year} onChange={(e) => { setYear(parseInt(e.target.value) || year); setPage(1); }} />
          <div />
          <button onClick={() => { setSearch(''); setPage(1); }} className="btn-ghost text-sm">Clear filters</button>
        </div>
      </Card>

      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="th">Employee</th>
                <th className="th">Leave Type</th>
                <th className="th">Allocated</th>
                <th className="th">Used</th>
                <th className="th">Carried Fwd</th>
                <th className="th">Adjusted</th>
                <th className="th">Remaining</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8}><EmptyState title="No leave balances" message="No balances found for this period." /></td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={`${r.employee?._id}-${r.leaveType}`} className="border-b transition last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
                    <td className="td">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{r.employee?.fullName || r.employeeId}</p>
                      <p className="text-xs text-slate-400">{r.employee?.employeeId}</p>
                    </td>
                    <td className="td">
                      <Badge tone={r.paid ? 'emerald' : 'rose'}>{r.leaveType}</Badge>
                    </td>
                    <td className="td">{r.allocated}</td>
                    <td className="td">{r.used}</td>
                    <td className="td">{r.carriedForward}</td>
                    <td className="td">{r.adjusted}</td>
                    <td className="td">
                      <span className={`font-semibold ${r.remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{r.remaining}</span>
                    </td>
                    <td className="td">
                      <div className="flex justify-end">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(r)}><Edit2 className="h-3 w-3" /></Button>
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
          <Card><EmptyState title="No leave balances" /></Card>
        ) : (
          rows.map((r) => (
            <Card key={`${r.employee?._id}-${r.leaveType}`} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{r.employee?.fullName || r.employeeId}</p>
                  <Badge tone={r.paid ? 'emerald' : 'rose'}>{r.leaveType}</Badge>
                </div>
                <span className={`text-lg font-bold ${r.remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{r.remaining}</span>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs text-slate-500">
                <div><p className="font-semibold text-slate-700 dark:text-slate-200">{r.allocated}</p><p>Alloc</p></div>
                <div><p className="font-semibold text-slate-700 dark:text-slate-200">{r.used}</p><p>Used</p></div>
                <div><p className="font-semibold text-slate-700 dark:text-slate-200">{r.carriedForward}</p><p>Carry</p></div>
                <div><p className="font-semibold text-slate-700 dark:text-slate-200">{r.adjusted}</p><p>Adj</p></div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="secondary" onClick={() => openEdit(r)}><Edit2 className="h-3 w-3" /> Adjust</Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Adjust Leave Balance" size="sm">
        {editing && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">{editing.employee?.fullName} · {editing.leaveType} · {editing.year}</p>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Allocated" type="number" value={editForm.allocated} onChange={(e) => setEditForm({ ...editForm, allocated: parseFloat(e.target.value) || 0 })} />
              <Input label="Carried Forward" type="number" value={editForm.carriedForward} onChange={(e) => setEditForm({ ...editForm, carriedForward: parseFloat(e.target.value) || 0 })} />
              <Input label="Adjusted" type="number" value={editForm.adjusted} onChange={(e) => setEditForm({ ...editForm, adjusted: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSave} loading={saving}>Save</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
