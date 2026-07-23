import { Router } from 'express';
import { getProducts, getProductById, createProduct, updateProductStatus, bulkCreateProducts, getBrands, updateProduct, deleteProduct } from '../controllers/product.controller';
import { authenticate, authorize, optionalAuthenticate } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', optionalAuthenticate, getProducts);
router.get('/brands', getBrands);
const productWriters = [Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.VENDOR_MANAGER];

router.post('/bulk', authenticate, authorize(productWriters), bulkCreateProducts);
router.post('/', authenticate, authorize(productWriters), createProduct);
router.patch('/:id/status', authenticate, authorize([Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.VENDOR_MANAGER]), updateProductStatus);
router.put('/:id', authenticate, authorize([Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER]), updateProduct);
router.delete('/:id', authenticate, authorize([Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER]), deleteProduct);
router.get('/:id', getProductById);

export default router;
