import { useState, useEffect } from 'react';
import { Search, Download, Play, CheckCircle2, Lock, FileText, RefreshCw } from 'lucide-react';
import api, { extractError } from '../../services/api';
import { useApi } from '../../hooks/useApi';
import { formatDate, formatDuration, MONTH_NAMES } from '../../services/format';
import { exportCSV, exportPDF } from '../../services/export';
import PageHeader from '../../components/PageHeader';
import { Card, StatCard } from '../../components/ui/Card';
import Button, { FullScreenLoader } from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import { Input, Select } from '../../components/ui/Form';
import { useToast } from '../../context/ToastContext';
import { Wallet, Users, IndianRupee, TrendingUp } from 'lucide-react';

const STATUSES = ['Draft', 'Reviewed', 'Approved', 'Paid'];

export default function Payroll() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState(null);

  const { data, loading, refetch } = useApi(async () => {
    const sp = new URLSearchParams({ year: String(year), month: String(month), page: String(page), pageSize: String(pageSize) });
    if (search) sp.set('search', search);
    if (statusFilter) sp.set('status', statusFilter);
    const { data } = await api.get(`/payroll?${sp.toString()}`);
    return data;
  }, [year, month, search, statusFilter, page, pageSize]);

  const summaryApi = useApi(async () => {
    const { data } = await api.get(`/payroll/summary?year=${year}&month=${month}`);
    setSummary(data.data);
    return data.data;
  }, [year, month]);

  useEffect(() => { summaryApi.refetch(); }, [data]);

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, pageSize, totalPages: 1, total: 0 };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post('/payroll/generate', { year, month });
      toast.success(data.message || 'Payroll generated');
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to generate payroll'));
    } finally {
      setGenerating(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/payroll/${id}/status`, { status });
      toast.success(`Payroll marked as ${status}`);
      refetch();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update status'));
    }
  };

  const handleExportCSV = () => {
    const columns = [
      { key: 'employeeId', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'salaryBasis', label: 'Salary Basis' },
      { key: 'baseSalary', label: 'Base Salary' },
      { key: 'payableDays', label: 'Payable Days' },
      { key: 'grossEarnings', label: 'Gross' },
      { key: 'totalDeductions', label: 'Deductions' },
      { key: 'netSalary', label: 'Net Salary' },
      { key: 'status', label: 'Status' },
    ];
    const payload = rows.map((r) => ({
      employeeId: r.employeeId,
      employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '',
      department: r.employee?.department?.name || '',
      salaryBasis: r.salaryBasis,
      baseSalary: r.baseSalary,
      payableDays: r.attendance?.payableDays || 0,
      grossEarnings: r.grossEarnings,
      totalDeductions: r.totalDeductions,
      netSalary: r.netSalary,
      status: r.status,
    }));
    exportCSV(`payroll-${year}-${month + 1}.csv`, columns, payload);
  };

  const handleExportPDF = () => {
    const columns = [
      { key: 'employeeId', label: 'ID' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Dept' },
      { key: 'payableDays', label: 'Days' },
      { key: 'grossEarnings', label: 'Gross' },
      { key: 'totalDeductions', label: 'Deductions' },
      { key: 'netSalary', label: 'Net' },
      { key: 'status', label: 'Status' },
    ];
    const payload = rows.map((r) => ({
      employeeId: r.employeeId,
      employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '',
      department: r.employee?.department?.name || '',
      payableDays: r.attendance?.payableDays || 0,
      grossEarnings: r.grossEarnings,
      totalDeductions: r.totalDeductions,
      netSalary: r.netSalary,
      status: r.status,
    }));
    exportPDF(`payroll-${year}-${month + 1}.pdf`, `Payroll Report - ${MONTH_NAMES[month]} ${year}`, columns, payload);
  };

  if (loading && !rows.length) return <FullScreenLoader label="Loading payroll…" />;

  return (
    <div>
      <PageHeader title="Monthly Payroll" description="Generate and manage monthly payroll from attendance and salary data.">
        <Button variant="secondary" onClick={() => refetch()}><RefreshCw className="h-4 w-4" /> Refresh</Button>
        <Button variant="secondary" onClick={handleExportCSV} disabled={!rows.length}><Download className="h-4 w-4" /> CSV</Button>
        <Button variant="secondary" onClick={handleExportPDF} disabled={!rows.length}><Download className="h-4 w-4" /> PDF</Button>
        <Button onClick={handleGenerate} loading={generating}><Play className="h-4 w-4" /> Generate Payroll</Button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Employees" value={summary?.total || 0} icon={Users} tone="indigo" />
        <StatCard label="Gross Payroll" value={`₹${(summary?.totals?.gross || 0).toLocaleString()}`} icon={IndianRupee} tone="emerald" />
        <StatCard label="Total Deductions" value={`₹${(summary?.totals?.deductions || 0).toLocaleString()}`} icon={TrendingUp} tone="amber" />
        <StatCard label="Net Payroll" value={`₹${(summary?.totals?.net || 0).toLocaleString()}`} icon={Wallet} tone="violet" />
      </div>

      <Card className="mb-5 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search employee…" className="input pl-9" />
          </div>
          <Select value={month} onChange={(e) => { setMonth(parseInt(e.target.value)); setPage(1); }}>
            {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </Select>
          <Input type="number" value={year} onChange={(e) => { setYear(parseInt(e.target.value) || year); setPage(1); }} />
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <button onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }} className="btn-ghost text-sm">Clear filters</button>
        </div>
      </Card>

      <Card className="hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="th">Employee</th>
                <th className="th">Basis</th>
                <th className="th">Base</th>
                <th className="th">Days</th>
                <th className="th">Gross</th>
                <th className="th">Deductions</th>
                <th className="th">Net Salary</th>
                <th className="th">Status</th>
                <th className="th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9}><EmptyState title="No payroll records" message="Generate payroll for this period to see records here." /></td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r._id} className="border-b transition last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50">
                    <td className="td">
                      <p className="font-semibold text-slate-800 dark:text-slate-100">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : r.employeeId}</p>
                      <p className="text-xs text-slate-400">{r.employeeId}</p>
                    </td>
                    <td className="td text-xs">{r.salaryBasis}</td>
                    <td className="td">₹{r.baseSalary?.toLocaleString()}</td>
                    <td className="td">{r.attendance?.payableDays || 0}</td>
                    <td className="td font-medium">₹{r.grossEarnings?.toLocaleString()}</td>
                    <td className="td text-rose-600">₹{r.totalDeductions?.toLocaleString()}</td>
                    <td className="td font-semibold text-emerald-600">₹{r.netSalary?.toLocaleString()}</td>
                    <td className="td"><Badge>{r.status}</Badge></td>
                    <td className="td">
                      <div className="flex justify-end gap-1">
                        {r.status === 'Draft' && (
                          <Button size="sm" variant="secondary" onClick={() => handleStatusChange(r._id, 'Reviewed')}>Review</Button>
                        )}
                        {r.status === 'Reviewed' && (
                          <Button size="sm" variant="secondary" onClick={() => handleStatusChange(r._id, 'Approved')}>Approve</Button>
                        )}
                        {r.status === 'Approved' && (
                          <Button size="sm" onClick={() => handleStatusChange(r._id, 'Paid')}><CheckCircle2 className="h-3 w-3" /> Mark Paid</Button>
                        )}
                        {r.status === 'Paid' && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Lock className="h-3 w-3" /> Locked</span>
                        )}
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
          <Card><EmptyState title="No payroll records" /></Card>
        ) : (
          rows.map((r) => (
            <Card key={r._id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : r.employeeId}</p>
                  <p className="text-xs text-slate-400">{r.salaryBasis} · {r.attendance?.payableDays || 0} days</p>
                </div>
                <Badge>{r.status}</Badge>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-500">Net: <span className="font-semibold text-emerald-600">₹{r.netSalary?.toLocaleString()}</span></span>
                {r.status === 'Draft' && <Button size="sm" variant="secondary" onClick={() => handleStatusChange(r._id, 'Reviewed')}>Review</Button>}
                {r.status === 'Reviewed' && <Button size="sm" variant="secondary" onClick={() => handleStatusChange(r._id, 'Approved')}>Approve</Button>}
                {r.status === 'Approved' && <Button size="sm" onClick={() => handleStatusChange(r._id, 'Paid')}>Paid</Button>}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
