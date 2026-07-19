import { Router } from 'express';
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '../controllers/warehouse.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Only specific admin roles can manage warehouses
const inventoryAdmins = [Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.OPERATIONS_MANAGER];

router.get('/', authenticate, authorize(inventoryAdmins), getWarehouses);
router.post('/', authenticate, authorize(inventoryAdmins), createWarehouse);
router.put('/:id', authenticate, authorize(inventoryAdmins), updateWarehouse);
router.delete('/:id', authenticate, authorize(inventoryAdmins), deleteWarehouse);

export default router;
