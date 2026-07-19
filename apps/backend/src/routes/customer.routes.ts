import { Router } from 'express';
import {
  getCustomers, updateCustomer, getMyNotifications, markNotificationRead,
  getMyAddresses, createMyAddress, updateMyAddress, deleteMyAddress,
  getMyProfile, updateMyProfile,
  getMyWishlist, addToMyWishlist, removeFromMyWishlist,
  getMyVehicles, createMyVehicle, updateMyVehicle, deleteMyVehicle,
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

router.get('/me/addresses', authenticate, getMyAddresses);
router.post('/me/addresses', authenticate, createMyAddress);
router.put('/me/addresses/:id', authenticate, updateMyAddress);
router.delete('/me/addresses/:id', authenticate, deleteMyAddress);

router.get('/me/profile', authenticate, getMyProfile);
router.patch('/me/profile', authenticate, updateMyProfile);

router.get('/me/wishlist', authenticate, getMyWishlist);
router.post('/me/wishlist', authenticate, addToMyWishlist);
router.delete('/me/wishlist/:productId', authenticate, removeFromMyWishlist);

router.get('/me/vehicles', authenticate, getMyVehicles);
router.post('/me/vehicles', authenticate, createMyVehicle);
router.put('/me/vehicles/:id', authenticate, updateMyVehicle);
router.delete('/me/vehicles/:id', authenticate, deleteMyVehicle);

export default router;
