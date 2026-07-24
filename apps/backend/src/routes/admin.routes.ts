import { Router } from 'express';
import { getDashboardStats, getRevenueChart, getSalesReport, getAuditLogs } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.SUPER_ADMIN, Role.ADMIN];

router.get('/dashboard', authenticate, authorize(admins), getDashboardStats);
router.get('/dashboard/revenue-chart', authenticate, authorize(admins), getRevenueChart);
router.get('/reports/sales', authenticate, authorize(admins), getSalesReport);
router.get('/audit-logs', authenticate, authorize(admins), getAuditLogs);

export default router;
