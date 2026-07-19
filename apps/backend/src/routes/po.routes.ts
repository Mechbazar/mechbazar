import { Router } from 'express';
import { getPurchaseOrders, createPurchaseOrder } from '../controllers/po.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const inventoryAdmins = [Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.OPERATIONS_MANAGER, Role.VENDOR_MANAGER];

router.get('/', authenticate, authorize(inventoryAdmins), getPurchaseOrders);
router.post('/', authenticate, authorize(inventoryAdmins), createPurchaseOrder);

export default router;
