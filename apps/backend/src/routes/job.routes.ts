import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  createEmergencyJob, getMyActiveJob, getJob, getJobOtpForCustomer, cancelJob,
  getJobTrailHandler, rateJob, callCounterparty, callStatusWebhook,
  getMyOffers, acceptJob, declineJob, markEnRoute, markArrived,
  startWork, requestCompletion, completeJob,
  uploadJobPhoto, listJobPhotos, postLocationBatch,
} from '../controllers/job.controller';
import {
  getLiveOps, getJobAdminDetail, adminAssign, adminRedispatch, adminForceStatus, getDispatchMetrics,
} from '../controllers/jobAdmin.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { technicianUpload } from '../middlewares/technicianUpload';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER];
const adminsAndSupport = [...admins, Role.CUSTOMER_SUPPORT, Role.FINANCE_MANAGER];
const mechanicOnly = [Role.SERVICE_TECHNICIAN];

// Creating an emergency job rings every mechanic in a radius. That is exactly
// the kind of action worth a tight per-account limit -- a scripted loop here
// would be a denial-of-service against the mechanic fleet, not just against
// the API.
const createLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers.authorization || req.ip || 'unknown',
  message: { error: 'Too many emergency requests. Please wait a few minutes or call support.', code: 'RATE_LIMITED' },
});

// OTP verification attempts are additionally capped per-code in the database
// (JobOtp.attempts). This is the transport-level complement: it stops an
// attacker cycling through fresh codes to get five fresh guesses each time.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers.authorization || req.ip || 'unknown',
  message: { error: 'Too many verification attempts. Please wait before trying again.', code: 'RATE_LIMITED' },
});

// Placing calls costs real money per attempt and is a plausible harassment
// vector, so it is limited independently of everything else.
const callLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers.authorization || req.ip || 'unknown',
  message: { error: 'Too many call attempts. Please use chat.', code: 'RATE_LIMITED' },
});

// ---------------------------------------------------------------------------
// Provider webhook -- must come before `authenticate`, it has no bearer token.
// Authenticated instead by a shared secret in the query string, compared in
// constant time inside the handler.
// ---------------------------------------------------------------------------
router.post('/call-status', callStatusWebhook);

// ---------------------------------------------------------------------------
// Admin -- declared before "/:id" so "admin" isn't captured as an id.
// ---------------------------------------------------------------------------
router.get('/admin/live', authenticate, authorize(adminsAndSupport), getLiveOps);
router.get('/admin/metrics', authenticate, authorize(adminsAndSupport), getDispatchMetrics);
router.get('/admin/:id', authenticate, authorize(adminsAndSupport), getJobAdminDetail);
router.post('/admin/:id/assign', authenticate, authorize(admins), adminAssign);
router.post('/admin/:id/redispatch', authenticate, authorize(admins), adminRedispatch);
router.post('/admin/:id/force-status', authenticate, authorize(admins), adminForceStatus);

// ---------------------------------------------------------------------------
// Mechanic -- also before "/:id".
// ---------------------------------------------------------------------------
router.get('/offers', authenticate, authorize(mechanicOnly), getMyOffers);

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------
router.post('/', authenticate, createLimiter, createEmergencyJob);
router.get('/active', authenticate, getMyActiveJob);

// ---------------------------------------------------------------------------
// Per-job. Every handler resolves the caller's relationship to the job itself
// (loadJobFor), so role middleware here is only a coarse first filter.
// ---------------------------------------------------------------------------
router.get('/:id', authenticate, getJob);
router.get('/:id/otp', authenticate, otpLimiter, getJobOtpForCustomer);
router.get('/:id/trail', authenticate, getJobTrailHandler);
router.get('/:id/photos', authenticate, listJobPhotos);
router.post('/:id/photos', authenticate, technicianUpload.single('file'), uploadJobPhoto);
router.post('/:id/cancel', authenticate, cancelJob);
router.post('/:id/rating', authenticate, technicianUpload.single('file'), rateJob);
router.post('/:id/call', authenticate, callLimiter, callCounterparty);

// Mechanic actions on a specific job.
router.post('/:id/accept', authenticate, authorize(mechanicOnly), acceptJob);
router.post('/:id/decline', authenticate, authorize(mechanicOnly), declineJob);
router.post('/:id/en-route', authenticate, authorize(mechanicOnly), markEnRoute);
router.post('/:id/arrived', authenticate, authorize(mechanicOnly), markArrived);
router.post('/:id/start', authenticate, authorize(mechanicOnly), otpLimiter, startWork);
router.post('/:id/request-completion', authenticate, authorize(mechanicOnly), requestCompletion);
router.post('/:id/complete', authenticate, authorize(mechanicOnly), otpLimiter, completeJob);
router.post('/:id/location', authenticate, authorize(mechanicOnly), postLocationBatch);

export default router;
