import { Router } from 'express';
import { getCoupons, createCoupon, updateCoupon, deleteCoupon, validateCoupon, getActiveCoupons } from '../controllers/coupon.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER, Role.FINANCE_MANAGER];

router.get('/active', authenticate, getActiveCoupons);
router.post('/validate', authenticate, validateCoupon);

router.get('/', authenticate, authorize(admins), getCoupons);
router.post('/', authenticate, authorize(admins), createCoupon);
router.put('/:id', authenticate, authorize(admins), updateCoupon);
router.delete('/:id', authenticate, authorize(admins), deleteCoupon);

export default router;
