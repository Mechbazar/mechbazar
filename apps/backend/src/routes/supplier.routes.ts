import { Router } from 'express';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplier.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const inventoryAdmins = [Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.OPERATIONS_MANAGER, Role.VENDOR_MANAGER];

router.get('/', authenticate, authorize(inventoryAdmins), getSuppliers);
router.post('/', authenticate, authorize(inventoryAdmins), createSupplier);
router.put('/:id', authenticate, authorize(inventoryAdmins), updateSupplier);
router.delete('/:id', authenticate, authorize(inventoryAdmins), deleteSupplier);

export default router;
