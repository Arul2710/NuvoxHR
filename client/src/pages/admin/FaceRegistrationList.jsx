import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanFace, CheckCircle2, XCircle, Clock, Search, Users, Trash2, RefreshCw } from 'lucide-react';
import api, { extractError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { resolveAsset } from '../../services/format';
import PageHeader from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import Button, { FullScreenLoader } from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import Avatar from '../../components/Avatar';
import { useToast } from '../../context/ToastContext';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

export default function FaceRegistrationList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [deleting, setDeleting] = useState(null);

  const { data, loading, refetch } = useApi(async () => {
    const sp = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) sp.set('search', search);
    const { data } = await api.get(`/employees?${sp.toString()}`);
    return data;
  }, [search, page, pageSize]);

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize, totalPages: 1, total: 0 };

  const getStatus = (emp) => {
    if (!emp.face) return { label: 'Not Registered', tone: 'slate' };
    if (!emp.face.active) return { label: 'Disabled', tone: 'rose' };
    return { label: 'Registered', tone: 'emerald' };
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/face/${deleting._id}`);
      toast.success('Face registration removed');
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to remove face registration'));
    }
  };

  if (loading) return <FullScreenLoader label="Loading employees…" />;

  const filtered = statusFilter
    ? rows.filter((e) => {
        const s = getStatus(e).label;
        return s === statusFilter;
      })
    : rows;

  return (
    <div>
      <PageHeader title="Face Registration" description="Manage employee facial profiles for attendance verification.">
        <Button variant="secondary" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </PageHeader>

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search employee…" className="input pl-9" />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="input">
            <option value="">All Statuses</option>
            <option value="Registered">Registered</option>
            <option value="Not Registered">Not Registered</option>
            <option value="Disabled">Disabled</option>
          </select>
          <div />
          <button onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }} className="btn-ghost text-sm">Clear filters</button>
        </div>
      </Card>

      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="th">Employee</th>
                <th className="th">Department</th>
                <th className="th">Email</th>
                <th className="th">Status</th>
                <th className="th">Registration Date</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><EmptyState icon={Users} title="No employees found" message="Adjust filters or add employees." /></td></tr>
              ) : (
                filtered.map((emp) => {
                  const status = getStatus(emp);
                  return (
                    <tr key={emp._id} className="border-b transition last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Avatar name={`${emp.firstName} ${emp.lastName}`} src={resolveAsset(emp.profilePhoto)} size="sm" />
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{emp.firstName} {emp.lastName}</p>
                            <p className="text-xs text-slate-400">{emp.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td text-xs">{emp.department?.name || '—'}</td>
                      <td className="td text-xs">{emp.email}</td>
                      <td className="td"><Badge tone={status.tone}>{status.label}</Badge></td>
                      <td className="td text-xs">{emp.face?.createdAt ? new Date(emp.face.createdAt).toLocaleDateString() : '—'}</td>
                      <td className="td">
                        <div className="flex justify-end gap-1">
                          {status.label === 'Not Registered' ? (
                            <Button size="sm" onClick={() => navigate(`/admin/employees/${emp._id}/face`)}>
                              <ScanFace className="h-3 w-3" /> Register
                            </Button>
                          ) : (
                            <>
                              <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/employees/${emp._id}/face`)}>
                                <ScanFace className="h-3 w-3" /> Re-register
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => setDeleting(emp)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && <Pagination page={meta.page} pageSize={pageSize} total={meta.total} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
      </Card>

      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <Card><EmptyState title="No employees found" /></Card>
        ) : (
          filtered.map((emp) => {
            const status = getStatus(emp);
            return (
              <Card key={emp._id} className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={`${emp.firstName} ${emp.lastName}`} src={resolveAsset(emp.profilePhoto)} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-slate-400">{emp.employeeId} · {emp.department?.name || 'No dept'}</p>
                    <div className="mt-1"><Badge tone={status.tone}>{status.label}</Badge></div>
                  </div>
                  {status.label === 'Not Registered' ? (
                    <Button size="sm" onClick={() => navigate(`/admin/employees/${emp._id}/face`)}>
                      <ScanFace className="h-4 w-4" /> Register
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/employees/${emp._id}/face`)}>
                      <ScanFace className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Remove Face Registration"
        message={`Remove face registration for ${deleting?.firstName} ${deleting?.lastName}? Their attendance history will be preserved.`}
        confirmLabel="Remove"
      />
    </div>
  );
}
