import { Router } from 'express';
import {
  getCommissionSettings,
  updateCommissionSettings,
  listOverrides,
  upsertOverride,
  deleteOverride,
  updateSettlementCycle,
  runRiderIncentives,
  getCommissionReports,
} from '../controllers/commission.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Reads: any admin-adjacent role can see current commission/payout config.
// Writes: Super-Admin-only -- see admin.controller.ts comment history, this
// is the first genuinely Super-Admin-only surface in the codebase (every
// other authorize(admins) call has always paired ADMIN and SUPER_ADMIN).
const admins = [Role.SUPER_ADMIN, Role.ADMIN, Role.VENDOR_MANAGER, Role.OPERATIONS_MANAGER, Role.FINANCE_MANAGER];
const superAdminOnly = [Role.SUPER_ADMIN];

router.get('/settings', authenticate, authorize(admins), getCommissionSettings);
router.put('/settings', authenticate, authorize(superAdminOnly), updateCommissionSettings);

router.get('/overrides/vendor', authenticate, authorize(admins), listOverrides('vendor'));
router.put('/overrides/vendor/:entityId', authenticate, authorize(superAdminOnly), upsertOverride('vendor'));
router.delete('/overrides/vendor/:entityId', authenticate, authorize(superAdminOnly), deleteOverride('vendor'));

router.get('/overrides/category', authenticate, authorize(admins), listOverrides('category'));
router.put('/overrides/category/:entityId', authenticate, authorize(superAdminOnly), upsertOverride('category'));
router.delete('/overrides/category/:entityId', authenticate, authorize(superAdminOnly), deleteOverride('category'));

router.get('/overrides/service-category', authenticate, authorize(admins), listOverrides('service-category'));
router.put('/overrides/service-category/:entityId', authenticate, authorize(superAdminOnly), upsertOverride('service-category'));
router.delete('/overrides/service-category/:entityId', authenticate, authorize(superAdminOnly), deleteOverride('service-category'));

router.get('/overrides/product', authenticate, authorize(admins), listOverrides('product'));
router.put('/overrides/product/:entityId', authenticate, authorize(superAdminOnly), upsertOverride('product'));
router.delete('/overrides/product/:entityId', authenticate, authorize(superAdminOnly), deleteOverride('product'));

router.get('/overrides/service-package', authenticate, authorize(admins), listOverrides('service-package'));
router.put('/overrides/service-package/:entityId', authenticate, authorize(superAdminOnly), upsertOverride('service-package'));
router.delete('/overrides/service-package/:entityId', authenticate, authorize(superAdminOnly), deleteOverride('service-package'));

router.patch('/settlement-cycle/vendor/:id', authenticate, authorize(superAdminOnly), updateSettlementCycle('vendor'));
router.patch('/settlement-cycle/rider/:id', authenticate, authorize(superAdminOnly), updateSettlementCycle('rider'));
router.patch('/settlement-cycle/mechanic/:id', authenticate, authorize(superAdminOnly), updateSettlementCycle('mechanic'));

router.post('/rider-incentives/run', authenticate, authorize(superAdminOnly), runRiderIncentives);

router.get('/reports', authenticate, authorize(admins), getCommissionReports);

export default router;
