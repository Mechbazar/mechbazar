import { Router } from 'express';
import {
  getTechnicians,
  getTechnicianById,
  createTechnician,
  updateTechnician,
  updateTechnicianVerificationStatus,
  updateTechnicianDocumentStatus,
  registerTechnician,
  updateMyRegistration,
  uploadMyDocument,
  submitMyApplication,
  getTechnicianDocumentFile,
  getMyTechnicianProfile,
  updateMyAvailability,
  updateMyLocation,
  registerMyPushToken,
  clearMyPushToken,
  getMyBookings,
  getMyEarnings,
  getMyReviews,
  addMyBankAccount,
  requestMyPayout,
  getAllTechnicianSettlements,
  updateTechnicianSettlementStatus,
  getTechnicianEarnings,
  deleteTechnician,
} from '../controllers/technician.controller';
import {
  updateMyBookingStatus, createBookingApprovalRequest,
  acceptBookingJob, rejectBookingJob, generateBookingCompletionOtp,
} from '../controllers/service.controller';
import { authenticate, authorize, requireApprovedTechnician } from '../middlewares/auth';
import { technicianUpload } from '../middlewares/technicianUpload';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER];
const technicianOnly = [Role.SERVICE_TECHNICIAN];

// Public self-registration — no auth yet, this *creates* the account.
router.post('/register', registerTechnician);

// Technician self-service — must be declared before "/:id" so "me" doesn't
// get captured as an :id param.
router.get('/me', authenticate, authorize(technicianOnly), getMyTechnicianProfile);
router.patch('/me/registration', authenticate, authorize(technicianOnly), updateMyRegistration);
router.post('/me/documents', authenticate, authorize(technicianOnly), technicianUpload.single('file'), uploadMyDocument);
router.post('/me/submit', authenticate, authorize(technicianOnly), submitMyApplication);
router.get('/me/bookings', authenticate, authorize(technicianOnly), requireApprovedTechnician, getMyBookings);
router.patch('/me/availability', authenticate, authorize(technicianOnly), requireApprovedTechnician, updateMyAvailability);
router.patch('/me/location', authenticate, authorize(technicianOnly), requireApprovedTechnician, updateMyLocation);
router.post('/me/push-token', authenticate, authorize(technicianOnly), registerMyPushToken);
router.delete('/me/push-token', authenticate, authorize(technicianOnly), clearMyPushToken);
router.patch('/me/bookings/:id/status', authenticate, authorize(technicianOnly), requireApprovedTechnician, updateMyBookingStatus);
router.post('/me/bookings/:id/accept', authenticate, authorize(technicianOnly), requireApprovedTechnician, acceptBookingJob);
router.post('/me/bookings/:id/reject', authenticate, authorize(technicianOnly), requireApprovedTechnician, rejectBookingJob);
router.post('/me/bookings/:id/generate-otp', authenticate, authorize(technicianOnly), requireApprovedTechnician, generateBookingCompletionOtp);
router.post('/me/bookings/:id/approval-request', authenticate, authorize(technicianOnly), requireApprovedTechnician, createBookingApprovalRequest);
router.get('/me/earnings', authenticate, authorize(technicianOnly), getMyEarnings);
router.get('/me/reviews', authenticate, authorize(technicianOnly), getMyReviews);
router.post('/me/bank', authenticate, authorize(technicianOnly), addMyBankAccount);
router.post('/me/wallet/withdraw', authenticate, authorize(technicianOnly), requireApprovedTechnician, requestMyPayout);

// Admin payouts — must also be declared before "/:id".
router.get('/settlements', authenticate, authorize(admins), getAllTechnicianSettlements);
router.patch('/settlements/:id/status', authenticate, authorize(admins), updateTechnicianSettlementStatus);

// KYC document file — authenticated (owner technician or admin, checked in
// the controller since ownership can't be expressed by role alone).
router.get('/:technicianId/documents/:documentId/file', authenticate, getTechnicianDocumentFile);

router.get('/', authenticate, authorize(admins), getTechnicians);
router.post('/', authenticate, authorize(admins), createTechnician);
router.get('/:id', authenticate, authorize(admins), getTechnicianById);
router.put('/:id', authenticate, authorize(admins), updateTechnician);
router.delete('/:id', authenticate, authorize(admins), deleteTechnician);
router.get('/:id/earnings', authenticate, authorize(admins), getTechnicianEarnings);
router.patch('/:id/status', authenticate, authorize(admins), updateTechnicianVerificationStatus);
router.patch('/:id/documents/:documentId/status', authenticate, authorize(admins), updateTechnicianDocumentStatus);

export default router;
