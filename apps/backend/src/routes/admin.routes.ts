import { Router } from 'express';
import {
  getDashboardStats,
  getRevenueChart,
  getSalesReport,
  getAuditLogs,
  getBookingsChart,
  getVendorEarningsChart,
  getCustomerGrowthChart,
  globalSearch,
  getRevenueTarget,
  updateRevenueTarget,
  broadcastNotification,
  createScheduledNotification,
  getScheduledNotifications,
  cancelScheduledNotification,
  getNotificationAnalytics,
  getStaffUsers,
  createStaffUser,
  updateStaffRole,
  setStaffActive,
} from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.SUPER_ADMIN, Role.ADMIN];
const superAdminOnly = [Role.SUPER_ADMIN];

router.get('/dashboard', authenticate, authorize(admins), getDashboardStats);
router.get('/dashboard/revenue-chart', authenticate, authorize(admins), getRevenueChart);
router.get('/dashboard/bookings-chart', authenticate, authorize(admins), getBookingsChart);
router.get('/dashboard/vendor-earnings-chart', authenticate, authorize(admins), getVendorEarningsChart);
router.get('/dashboard/customer-growth-chart', authenticate, authorize(admins), getCustomerGrowthChart);
router.get('/reports/sales', authenticate, authorize(admins), getSalesReport);
router.get('/audit-logs', authenticate, authorize(admins), getAuditLogs);
router.get('/search', authenticate, authorize(admins), globalSearch);
router.get('/settings/revenue-target', authenticate, authorize(admins), getRevenueTarget);
router.put('/settings/revenue-target', authenticate, authorize(admins), updateRevenueTarget);
router.post('/notifications/broadcast', authenticate, authorize(admins), broadcastNotification);
router.post('/notifications/scheduled', authenticate, authorize(admins), createScheduledNotification);
router.get('/notifications/scheduled', authenticate, authorize(admins), getScheduledNotifications);
router.delete('/notifications/scheduled/:id', authenticate, authorize(admins), cancelScheduledNotification);
router.get('/notifications/analytics', authenticate, authorize(admins), getNotificationAnalytics);

// Staff/administrator account management. Viewing is open to ADMIN too, but
// creating, re-role-ing, and (de)activating another admin account is
// Super-Admin-only -- same bar as commission-settings.
router.get('/staff', authenticate, authorize(admins), getStaffUsers);
router.post('/staff', authenticate, authorize(superAdminOnly), createStaffUser);
router.patch('/staff/:id/role', authenticate, authorize(superAdminOnly), updateStaffRole);
router.patch('/staff/:id/active', authenticate, authorize(superAdminOnly), setStaffActive);

export default router;
