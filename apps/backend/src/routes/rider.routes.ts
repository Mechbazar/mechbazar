import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  getRiders,
  getRiderById,
  createRider,
  updateRider,
  updateRiderVerificationStatus,
  updateRiderDocumentStatus,
  registerRider,
  loginRider,
  updateMyRegistration,
  uploadMyDocument,
  submitMyApplication,
  getRiderDocumentFile,
  getMyRiderProfile,
  updateMyAvailability,
  updateMyLocation,
  registerMyPushToken,
  clearMyPushToken,
  getMyDeliveries,
  getMyEarnings,
  addMyBankAccount,
  requestMyPayout,
  getAllRiderSettlements,
  updateRiderSettlementStatus,
} from '../controllers/rider.controller';
import { updateMyDeliveryStatus, generateDeliveryOtp } from '../controllers/order.controller';
import { authenticate, authorize, requireApprovedRider } from '../middlewares/auth';
import { accountLoginLimiter } from '../middlewares/accountLoginLimiter';
import { riderUpload } from '../middlewares/riderUpload';
import { redisBackedStore } from '../config/redis';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER];
const riderOnly = [Role.DELIVERY_PARTNER];

// MB-AUTH-004: matches the per-account lockout admin login already had.
const riderLoginLimiter = accountLoginLimiter(['phone'], 'rider');

// Delivery-code attempts are additionally capped per-code in the database
// (Order.deliveryOtpAttempts). This is the transport-level complement --
// mirrors job.routes.ts's otpLimiter -- so an attacker can't cycle through
// fresh codes to get five fresh guesses each time.
// updateMyDeliveryStatus handles every rider status transition, not just the
// OTP-guarded one -- skip counts every non-DELIVERED transition so a busy
// rider's ordinary picked-up/on-the-way updates are never throttled by this.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisBackedStore('rider-otp'),
  keyGenerator: (req) => req.headers.authorization || req.ip || 'unknown',
  skip: (req) => req.body?.status !== 'DELIVERED',
  message: { error: 'Too many verification attempts. Please wait before trying again.', code: 'RATE_LIMITED' },
});

// Public self-registration — no auth yet, this *creates* the account.
router.post('/register', registerRider);
router.post('/login', riderLoginLimiter, loginRider);

// Rider self-service — must be declared before "/:id" so "me" doesn't get
// captured as an :id param.
router.get('/me', authenticate, authorize(riderOnly), getMyRiderProfile);
router.patch('/me/registration', authenticate, authorize(riderOnly), updateMyRegistration);
router.post('/me/documents', authenticate, authorize(riderOnly), riderUpload.single('file'), uploadMyDocument);
router.post('/me/submit', authenticate, authorize(riderOnly), submitMyApplication);
router.get('/me/deliveries', authenticate, authorize(riderOnly), requireApprovedRider, getMyDeliveries);
router.patch('/me/availability', authenticate, authorize(riderOnly), requireApprovedRider, updateMyAvailability);
router.patch('/me/location', authenticate, authorize(riderOnly), requireApprovedRider, updateMyLocation);
router.post('/me/push-token', authenticate, authorize(riderOnly), registerMyPushToken);
router.delete('/me/push-token', authenticate, authorize(riderOnly), clearMyPushToken);
router.patch('/me/deliveries/:id/status', authenticate, authorize(riderOnly), requireApprovedRider, otpLimiter, updateMyDeliveryStatus);
router.post('/me/deliveries/:id/generate-otp', authenticate, authorize(riderOnly), requireApprovedRider, generateDeliveryOtp);
router.get('/me/earnings', authenticate, authorize(riderOnly), getMyEarnings);
router.post('/me/bank', authenticate, authorize(riderOnly), addMyBankAccount);
router.post('/me/wallet/withdraw', authenticate, authorize(riderOnly), requireApprovedRider, requestMyPayout);

// Admin payouts — must also be declared before "/:id".
router.get('/settlements', authenticate, authorize(admins), getAllRiderSettlements);
router.patch('/settlements/:id/status', authenticate, authorize(admins), updateRiderSettlementStatus);

// KYC document file — authenticated (owner rider or admin, checked in the
// controller since ownership can't be expressed by role alone).
router.get('/:deliveryPartnerId/documents/:documentId/file', authenticate, getRiderDocumentFile);

router.get('/', authenticate, authorize(admins), getRiders);
router.post('/', authenticate, authorize(admins), createRider);
router.get('/:id', authenticate, authorize(admins), getRiderById);
router.put('/:id', authenticate, authorize(admins), updateRider);
router.patch('/:id/status', authenticate, authorize(admins), updateRiderVerificationStatus);
router.patch('/:id/documents/:documentId/status', authenticate, authorize(admins), updateRiderDocumentStatus);

export default router;
