const rateLimit = require('express-rate-limit');
const config = require('../config/config');

const keyGenerator = (req) => req.ip || req.connection.remoteAddress || 'unknown';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { success: false, message: 'Too many sign-in attempts. Please try again later.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // The admin/employee SPA polls a few endpoints and each page load issues
  // several requests, so the default is generous. Override with
  // API_RATE_LIMIT in the environment if a stricter limit is required.
  max: parseInt(process.env.API_RATE_LIMIT, 10) || 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

const faceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator,
  message: { success: false, message: 'Face verification is being attempted too frequently. Please wait a moment.' },
});

module.exports = { authLimiter, apiLimiter, faceLimiter };