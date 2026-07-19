import { Router } from 'express';
import { getBanners, getPublicBanners, createBanner, updateBanner, deleteBanner } from '../controllers/banner.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER, Role.VENDOR_MANAGER];

// Public banners (no auth) - must be before authenticated routes
router.get('/public', getPublicBanners);

// Public can view active banners, but for admin portal we need all banners (auth required)
router.get('/', authenticate, authorize(admins), getBanners);
router.post('/', authenticate, authorize(admins), createBanner);
router.put('/:id', authenticate, authorize(admins), updateBanner);
router.delete('/:id', authenticate, authorize(admins), deleteBanner);

export default router;
