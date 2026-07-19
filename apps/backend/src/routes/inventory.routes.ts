import { Router } from 'express';
import { getInventory, adjustStock } from '../controllers/inventory.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const inventoryAdmins = [Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.OPERATIONS_MANAGER, Role.VENDOR_MANAGER];

router.get('/', authenticate, authorize(inventoryAdmins), getInventory);
router.post('/adjust', authenticate, authorize(inventoryAdmins), adjustStock);

export default router;
