import { Router } from 'express';
import { getDashboardStats } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

router.get('/dashboard', authenticate, authorize([Role.SUPER_ADMIN, Role.ADMIN]), getDashboardStats);

export default router;
