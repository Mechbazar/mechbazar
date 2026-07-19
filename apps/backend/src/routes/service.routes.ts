import { Router } from 'express';
import {
  getServiceCategories, getServiceCategoryById, createServiceCategory, updateServiceCategory, deleteServiceCategory,
  getServicePackages, getServicePackageById, createServicePackage, updateServicePackage, deleteServicePackage,
  getTimeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot,
  createBooking, getMyBookings, getBookingById, cancelBooking,
  respondToApproval, uploadBookingImage, getBookingImageFile, getBookingInvoice, createBookingReview,
  sendBookingMessage, getBookingMessages,
  getAllBookings, assignTechnician, updateAdminBookingStatus, refundBookingPayment, getServiceDashboard,
  getAssignableTechnicians, getBookingTechnicianPhoto,
} from '../controllers/service.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { technicianUpload } from '../middlewares/technicianUpload';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER];

// Categories
router.get('/categories', getServiceCategories);
router.post('/categories', authenticate, authorize(admins), createServiceCategory);
router.get('/categories/:id', getServiceCategoryById);
router.put('/categories/:id', authenticate, authorize(admins), updateServiceCategory);
router.delete('/categories/:id', authenticate, authorize(admins), deleteServiceCategory);

// Packages
router.get('/packages', getServicePackages);
router.post('/packages', authenticate, authorize(admins), createServicePackage);
router.get('/packages/:id', getServicePackageById);
router.put('/packages/:id', authenticate, authorize(admins), updateServicePackage);
router.delete('/packages/:id', authenticate, authorize(admins), deleteServicePackage);

// Time slots
router.get('/time-slots', getTimeSlots);
router.post('/time-slots', authenticate, authorize(admins), createTimeSlot);
router.put('/time-slots/:id', authenticate, authorize(admins), updateTimeSlot);
router.delete('/time-slots/:id', authenticate, authorize(admins), deleteTimeSlot);

// Admin dashboard
router.get('/dashboard', authenticate, authorize(admins), getServiceDashboard);

// Bookings — create + customer's own history first, mirrors order.routes.ts's
// "/my-orders"/"/all" pattern so neither is shadowed by the "/:id" route below.
router.post('/bookings', authenticate, createBooking);
router.get('/bookings/my-bookings', authenticate, getMyBookings);
router.get('/bookings/all', authenticate, authorize(admins), getAllBookings);

router.patch('/bookings/:id/cancel', authenticate, cancelBooking);
router.patch('/bookings/:id/approval', authenticate, respondToApproval);
router.post('/bookings/:id/images', authenticate, technicianUpload.single('file'), uploadBookingImage);
router.get('/bookings/images/:imageId/file', authenticate, getBookingImageFile);
router.get('/bookings/:id/invoice', authenticate, getBookingInvoice);
router.post('/bookings/:id/review', authenticate, createBookingReview);
router.post('/bookings/:id/messages', authenticate, sendBookingMessage);
router.get('/bookings/:id/messages', authenticate, getBookingMessages);

// Admin booking management
router.get('/bookings/:id/assignable-technicians', authenticate, authorize(admins), getAssignableTechnicians);
router.post('/bookings/:id/assign', authenticate, authorize(admins), assignTechnician);
router.patch('/bookings/:id/admin-status', authenticate, authorize(admins), updateAdminBookingStatus);
router.patch('/bookings/:id/refund', authenticate, authorize(admins), refundBookingPayment);

// Technician photo -- gated in the controller (owner customer, assigned
// technician, or admin), same pattern as getBookingImageFile.
router.get('/bookings/:id/technician-photo', authenticate, getBookingTechnicianPhoto);

// Registered last so it doesn't shadow the more specific routes above.
router.get('/bookings/:id', authenticate, getBookingById);

export default router;
