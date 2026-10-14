require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const config = require('./config/config');
const faceService = require('./services/faceService');
const {
  seedDefaultDepartments,
  seedDefaultLocations,
  seedDefaultDesignations,
  seedAdmin,
  seedSettings,
  seedDefaultLeavePolicies,
  seedDefaultWorkShifts,
  seedDefaultAttendancePolicies,
  seedDefaultCompanySettings,
} = require('./config/seed');

const app = express();

// ---- middlewares ----
// Behind a reverse proxy (Render), trust the first proxy hop so the real client
// IP is used for rate limiting. Required by express-rate-limit v7 + X-Forwarded-For.
if (!config.isDev) app.set('trust proxy', 1);

app.use(
  cors({
    origin: (origin, cb) => {
      // Requests without an Origin header (health checks, curl, server-to-server)
      // are allowed; browser origins must be explicitly whitelisted.
      if (!origin) return cb(null, true);
      if (config.corsOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use('/uploads', express.static(config.uploadsDir));

// ---- optional: serve built client in production ----
const clientDist = path.join(__dirname, '..', 'client', 'dist');
try {
  if (require('fs').existsSync(clientDist)) {
    app.use(express.static(clientDist));
  }
} catch (e) {
  /* noop */
}

// ---- routes ----
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'FaceHR API is running',
    timestamp: new Date().toISOString(),
    face: faceService.status(),
  });
});

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/face', require('./routes/faceRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/leaves', require('./routes/leaveRoutes'));
app.use('/api/leave-policies', require('./routes/leavePolicyRoutes'));
app.use('/api/holidays', require('./routes/holidayRoutes'));
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/company', require('./routes/companyRoutes'));
app.use('/api/documents', require('./routes/documentRoutes'));
app.use('/api/emails', require('./routes/emailRoutes'));
app.use('/api/resignations', require('./routes/resignationRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/locations', require('./routes/locationRoutes'));
app.use('/api/designations', require('./routes/designationRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/activity', require('./routes/activityRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));

const { notFound, errorHandler } = require('./middleware/error');
app.use(notFound);
app.use(errorHandler);

// ---- start ----
const start = async () => {
  try {
    await connectDB();
    await seedDefaultDepartments();
    await seedDefaultLocations();
    await seedDefaultDesignations();
    await seedAdmin();
    await seedSettings();
    await seedDefaultLeavePolicies();
    await seedDefaultWorkShifts();
    await seedDefaultAttendancePolicies();
    await seedDefaultCompanySettings();

    // Initialize face service in the background (non-blocking, graceful)
    faceService.init().catch((err) => console.warn('[FaceService] init error:', err.message));

    app.listen(config.port, () => {
      console.log(`[FaceHR] API running on http://localhost:${config.port}`);
    });
  } catch (err) {
    console.error('[FaceHR] Failed to start server:', err.message);
    process.exit(1);
  }
};

start();