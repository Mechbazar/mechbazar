import { Router } from 'express';
import {
  getCustomers, getCustomerById, updateCustomer, deleteCustomer,
  getMyNotifications, markNotificationRead, deleteMyNotification,
  getMyAddresses, createMyAddress, updateMyAddress, deleteMyAddress,
  getMyProfile, updateMyProfile,
  confirmPhoneChange,
  getMyWishlist, addToMyWishlist, removeFromMyWishlist,
  getMyVehicles, createMyVehicle, updateMyVehicle, deleteMyVehicle,
  deleteMyAccount,
} from '../controllers/customer.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.CUSTOMER_SUPPORT];

router.get('/', authenticate, authorize(admins), getCustomers);
router.patch('/:id', authenticate, authorize(admins), updateCustomer);

// Self-service, any authenticated role -- not admin-gated like the routes above.
router.get('/notifications', authenticate, getMyNotifications);
router.patch('/notifications/:id/read', authenticate, markNotificationRead);
router.delete('/notifications/:id', authenticate, deleteMyNotification);

router.get('/me/addresses', authenticate, getMyAddresses);
router.post('/me/addresses', authenticate, createMyAddress);
router.put('/me/addresses/:id', authenticate, updateMyAddress);
router.delete('/me/addresses/:id', authenticate, deleteMyAddress);

router.get('/me/profile', authenticate, getMyProfile);
router.patch('/me/profile', authenticate, updateMyProfile);
router.patch('/me/phone', authenticate, confirmPhoneChange);

router.get('/me/wishlist', authenticate, getMyWishlist);
router.post('/me/wishlist', authenticate, addToMyWishlist);
router.delete('/me/wishlist/:productId', authenticate, removeFromMyWishlist);

// Self-service account deletion. Must be registered before the '/:id'
// catch-all below, and is deliberately NOT admin-gated -- it acts only on the
// caller's own account (req.user.userId), which is what Google Play's data
// deletion policy and Apple Guideline 5.1.1(v) require.
router.delete('/me', authenticate, deleteMyAccount);

router.get('/me/vehicles', authenticate, getMyVehicles);
router.post('/me/vehicles', authenticate, createMyVehicle);
router.put('/me/vehicles/:id', authenticate, updateMyVehicle);
router.delete('/me/vehicles/:id', authenticate, deleteMyVehicle);

// Registered last so the literal '/notifications' and '/me/...' paths above are
// matched before these catch-all id params.
//
// DELETE '/:id' in particular MUST stay below DELETE '/me': it used to sit at
// the top of this file, where it swallowed DELETE /customers/me as id="me" and
// bounced the caller with 403 "Forbidden: Insufficient privileges" (its
// authorize() gate rejects the customer deleting their own account). That made
// the self-service account deletion required by Google Play's data deletion
// policy and Apple Guideline 5.1.1(v) unreachable in production.
router.get('/:id', authenticate, authorize(admins), getCustomerById);
// Deleting another user's account is destructive, so unlike the read/approve
// routes above it is not open to CUSTOMER_SUPPORT.
router.delete('/:id', authenticate, authorize([Role.ADMIN, Role.SUPER_ADMIN]), deleteCustomer);

export default router;
