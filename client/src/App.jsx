import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AuthLayout from './layouts/AuthLayout';
import AdminLayout from './layouts/AdminLayout';
import EmployeeLayout from './layouts/EmployeeLayout';
import { useAuth } from './context/AuthContext';
import { FullScreenLoader } from './components/ui/Button';

import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';

import Dashboard from './pages/admin/Dashboard';
import Employees from './pages/admin/Employees';
import EmployeeForm from './pages/admin/EmployeeForm';
import EmployeeProfile from './pages/admin/EmployeeProfile';
import FaceRegistrationList from './pages/admin/FaceRegistrationList';
import Attendance from './pages/admin/Attendance';
import TodayAttendance from './pages/admin/TodayAttendance';
import MonthlyAttendance from './pages/admin/MonthlyAttendance';
import AttendanceGallery from './pages/admin/AttendanceGallery';
import Departments from './pages/admin/Departments';
import Leaves from './pages/admin/Leaves';
import Reports from './pages/admin/Reports';
import Settings from './pages/admin/Settings';
import AttendanceSettings from './pages/admin/AttendanceSettings';
import SalaryConfig from './pages/admin/SalaryConfig';
import Payroll from './pages/admin/Payroll';
import SalarySlips from './pages/admin/SalarySlips';
import LeavePolicies from './pages/admin/LeavePolicies';
import LeaveBalances from './pages/admin/LeaveBalances';
import Holidays from './pages/admin/Holidays';
import Documents from './pages/admin/Documents';
import CompanySettings from './pages/admin/CompanySettings';
import WorkShifts from './pages/admin/WorkShifts';
import AttendancePolicies from './pages/admin/AttendancePolicies';
import EmailConfig from './pages/admin/EmailConfig';
import MarkAttendance from './pages/admin/MarkAttendance';

import EmployeeHome from './pages/employee/Dashboard';
import FaceAttendance from './pages/employee/FaceAttendance';
import History from './pages/employee/History';
import MyLeaves from './pages/employee/MyLeaves';
import Resignation from './pages/employee/Resignation';
import MyProfile from './pages/employee/MyProfile';

import NotFound from './pages/NotFound';

function Landing() {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader label="Loading FaceHR…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/employee'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="employees/new" element={<EmployeeForm />} />
        <Route path="employees/:id" element={<EmployeeProfile />} />
        <Route path="employees/:id/edit" element={<EmployeeForm />} />
        <Route path="employees/:id/face" element={<EmployeeProfile faceMode />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="attendance/today" element={<TodayAttendance />} />
        <Route path="attendance/monthly" element={<MonthlyAttendance />} />
        <Route path="attendance/gallery" element={<AttendanceGallery />} />
        <Route path="attendance/mark" element={<MarkAttendance />} />
        <Route path="attendance-settings" element={<AttendanceSettings />} />
        <Route path="face-registration" element={<FaceRegistrationList />} />
        <Route path="departments" element={<Departments />} />
        <Route path="leaves" element={<Leaves />} />
        <Route path="leave-policies" element={<LeavePolicies />} />
        <Route path="leave-balances" element={<LeaveBalances />} />
        <Route path="salary-config" element={<SalaryConfig />} />
        <Route path="payroll" element={<Payroll />} />
        <Route path="payroll/slips" element={<SalarySlips />} />
        <Route path="holidays" element={<Holidays />} />
        <Route path="documents" element={<Documents />} />
        <Route path="company-details" element={<CompanySettings />} />
        <Route path="work-shifts" element={<WorkShifts />} />
        <Route path="attendance-policies" element={<AttendancePolicies />} />
        <Route path="email-config" element={<EmailConfig />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route
        path="/employee"
        element={
          <ProtectedRoute employeeOnly>
            <EmployeeLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<EmployeeHome />} />
        <Route path="attendance" element={<FaceAttendance />} />
        <Route path="history" element={<History />} />
        <Route path="leave" element={<MyLeaves />} />
        <Route path="resignation" element={<Resignation />} />
        <Route path="profile" element={<MyProfile />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}