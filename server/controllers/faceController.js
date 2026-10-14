const crypto = require('crypto');
const Employee = require('../models/Employee');
const FaceProfile = require('../models/FaceProfile');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { saveBuffer } = require('../middleware/upload');
const faceService = require('../services/faceService');
const { verifyAgainstProfile, parseDescriptor } = require('../services/faceVerification');
const { normalizeFaceDescriptor } = require('../controllers/employeeController');
const { createNotification } = require('../services/notificationService');

// Resolve an employee from either a Mongo ObjectId or a human Employee ID (e.g. NUX003).
async function resolveEmployee(ref) {
  const value = String(ref || '').trim();
  if (!value) return null;
  if (/^[0-9a-fA-F]{24}$/.test(value)) return Employee.findById(value);
  return Employee.findOne({ employeeId: value.toUpperCase() });
}

// @route  POST /api/face/register  (admin + profile photo upload)
const registerFace = asyncHandler(async (req, res) => {
  const { employeeId, force } = req.body;
  const descriptor = parseDescriptor(req.body.descriptor);
  const employee = await Employee.findById(employeeId);
  if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ success: false, message: 'A face photo is required' });
  }

  const existing = await FaceProfile.findOne({ employee: employee._id });
  if (existing && existing.active && force !== 'true' && force !== true) {
    return res.status(409).json({
      success: false,
      message: 'Face already registered for this employee. Use "Re-register" to replace it.',
      data: { faceId: existing.faceId },
    });
  }

  // 1. Try to extract the descriptor server-side (trusted).
  const serverResult = await faceService.extractDescriptorFromBuffer(req.file.buffer);
  let finalDescriptor = null;
  let source = 'client';

  if (serverResult && serverResult.descriptor) {
    finalDescriptor = serverResult.descriptor;
    source = 'server';
  } else {
    finalDescriptor = normalizeFaceDescriptor(descriptor);
  }

  if (!finalDescriptor) {
    return res.status(400).json({
      success: false,
      message:
        'Could not extract a valid face descriptor from this photo. Please retake the photo with better lighting and a clear, front-facing view.',
    });
  }

  // 2. Store the face still image (no video is ever stored).
  const ext = req.file.mimetype === 'image/png' ? 'png' : req.file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const faceImage = saveBuffer(req.file.buffer, ext);

  const payload = {
    employee: employee._id,
    faceId: crypto.randomUUID(),
    descriptor: finalDescriptor,
    faceImage,
    quality: serverResult ? serverResult.score : 0,
    registeredBy: req.user.id,
    active: true,
  };

  let profile;
  if (existing) {
    Object.assign(existing, payload);
    await existing.save();
    profile = existing;
  } else {
    profile = await FaceProfile.create(payload);
  }

  const user = await User.findOne({ employee: employee._id });
  if (user) {
    await createNotification({
      user: user._id,
      title: 'Face registered',
      message: 'Your face has been registered. You can now check in with face attendance.',
      type: 'success',
      link: '/employee',
    });
  }

  res.status(201).json({
    success: true,
    message: 'Face registered successfully',
    data: {
      faceId: profile.faceId,
      faceImage: profile.faceImage,
      descriptorSource: source,
      quality: profile.quality,
    },
  });
});

// @route  POST /api/face/verify
const verifyFace = asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ success: false, message: 'A face photo is required' });
  }

  let employeeId = req.user.employee;
  if (req.user.role === 'admin' && req.body.employeeId) {
    if (!/^[0-9a-fA-F]{24}$/.test(req.body.employeeId)) {
      return res.status(400).json({ success: false, message: 'Invalid employee reference' });
    }
    employeeId = req.body.employeeId;
  }
  if (!employeeId) {
    return res.status(400).json({ success: false, message: 'No employee identity available. Please sign in first.' });
  }

  const result = await verifyAgainstProfile({
    employeeId,
    buffer: req.file.buffer,
    clientDescriptor: parseDescriptor(req.body.descriptor),
  });

  res.json({ success: result.ok, message: result.message, data: result });
});

// @route  GET /api/face/:employeeId  (admin)
const getFaceStatus = asyncHandler(async (req, res) => {
  const employee = await resolveEmployee(req.params.employeeId);
  if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
  const profile = await FaceProfile.findOne({ employee: employee._id }).select('-descriptor');
  res.json({
    success: true,
    data: {
      registered: !!profile && profile.active,
      faceId: profile ? profile.faceId : null,
      faceImage: profile ? profile.faceImage : null,
      quality: profile ? profile.quality : 0,
      updatedAt: profile ? profile.updatedAt : null,
    },
  });
});

// @route  DELETE /api/face/:employeeId  (admin)
const deleteFace = asyncHandler(async (req, res) => {
  const employee = await resolveEmployee(req.params.employeeId);
  if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });

  const profile = await FaceProfile.findOneAndDelete({ employee: employee._id });
  if (!profile) return res.status(404).json({ success: false, message: 'No face profile found for this employee' });

  const user = await User.findOne({ employee: employee._id });
  if (user) {
    await createNotification({
      user: user._id,
      title: 'Face profile removed',
      message: 'Your registered face profile was removed by HR. Re-register to use face attendance.',
      type: 'warning',
      link: '/employee',
    });
  }

  res.json({ success: true, message: 'Face profile removed. The employee must re-register to use face attendance.' });
});

module.exports = { registerFace, verifyFace, getFaceStatus, deleteFace };