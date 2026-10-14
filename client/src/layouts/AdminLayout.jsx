import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ScanFace,
  Building2,
  Plane,
  BarChart3,
  Settings as SettingsIcon,
  MapPinned,
  Menu,
  X,
  Search,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
  KeyRound,
  Wallet,
  FileText,
  CalendarRange,
  Mail,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import Logo from '../components/Logo';
import Avatar from '../components/Avatar';
import NotificationBell from '../components/NotificationBell';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useNavigateSearch } from '../utils/navigation';
import clsx from 'clsx';

const NAV_SECTIONS = [
  {
    title: 'Dashboard',
    items: [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    ],
  },
  {
    title: 'Employees',
    items: [
      { to: '/admin/employees', label: 'Employee Directory', icon: Users },
      { to: '/admin/employees/new', label: 'Add Employee', icon: Users },
      { to: '/admin/documents', label: 'Employee Documents', icon: FileText },
    ],
  },
  {
    title: 'Attendance',
    items: [
      { to: '/admin/attendance', label: 'Attendance Records', icon: CalendarDays },
      { to: '/admin/attendance/mark', label: 'Mark Attendance', icon: CalendarDays },
      { to: '/admin/face-registration', label: 'Face Registration', icon: ScanFace },
      { to: '/admin/attendance-settings', label: 'Attendance Settings', icon: MapPinned },
    ],
  },
  {
    title: 'Leave Management',
    items: [
      { to: '/admin/leaves', label: 'Leave Requests', icon: Plane },
      { to: '/admin/leave-policies', label: 'Leave Policies', icon: ShieldCheck },
      { to: '/admin/leave-balances', label: 'Leave Balances', icon: Plane },
    ],
  },
  {
    title: 'Payroll',
    items: [
      { to: '/admin/salary-config', label: 'Salary Configuration', icon: Wallet },
      { to: '/admin/payroll', label: 'Monthly Payroll', icon: Wallet },
      { to: '/admin/payroll/slips', label: 'Salary Slips', icon: FileText },
    ],
  },
  {
    title: 'Company Settings',
    items: [
      { to: '/admin/attendance-policies', label: 'Attendance Policies', icon: Clock },
      { to: '/admin/work-shifts', label: 'Work Shifts', icon: Clock },
      { to: '/admin/holidays', label: 'Holidays & Weekly Offs', icon: CalendarRange },
      { to: '/admin/company-details', label: 'Company Details', icon: Building2 },
      { to: '/admin/email-config', label: 'Email Configuration', icon: Mail },
    ],
  },
  {
    title: 'Reports',
    items: [
      { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
      { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const navigateSearch = useNavigateSearch();
  const [drawer, setDrawer] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [query, setQuery] = useState('');

  const onSearch = (e) => {
    e.preventDefault();
    navigateSearch('/admin/employees', query.trim());
  };

  const doLogout = () => {
    logout();
    toast.info('Signed out successfully');
    navigate('/login');
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-5">
        <Link to="/admin" onClick={() => setDrawer(false)}>
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-2">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {section.title}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setDrawer(false)}
                className={({ isActive }) =>
                  clsx(
                    'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t p-4 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-400">FaceHR Admin</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
          Smart HR Management with Face-Based Attendance
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-light dark:bg-surface-dark">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-white dark:border-slate-700 dark:bg-slate-900 lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-lift animate-slide-up dark:bg-slate-900">
            <button
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white/90 px-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90 sm:px-6">
          <button
            onClick={() => setDrawer(true)}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <form onSubmit={onSearch} className="relative hidden flex-1 md:block md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search employees by name, ID, email…"
              className="input pl-9"
            />
          </form>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={toggle}
              className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Toggle dark mode"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <NotificationBell admin />

            <div className="relative">
              <button
                onClick={() => setProfileOpen((o) => !o)}
                className="ml-1 flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Avatar user={user} size="sm" />
                <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
              </button>
              {profileOpen && (
                <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border bg-white shadow-lift dark:bg-slate-900">
                  <div className="border-b px-4 py-3 dark:border-slate-700">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{user?.name}</p>
                    <p className="truncate text-xs text-slate-400">{user?.email}</p>
                  </div>
                  <button onClick={() => { setProfileOpen(false); setPwOpen(true); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800">
                    <KeyRound className="h-4 w-4" /> Change Password
                  </button>
                  <button onClick={doLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10">
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}