import { Router } from 'express';
import { getProducts, getProductById, getRelatedProducts, getSearchSuggestions, createProduct, updateProductStatus, bulkCreateProducts, getBrands, updateProduct, deleteProduct } from '../controllers/product.controller';
import { getProductReviews, createProductReview, deleteProductReview, getFeaturedReviews } from '../controllers/review.controller';
import { authenticate, authorize, optionalAuthenticate } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', optionalAuthenticate, getProducts);
router.get('/brands', getBrands);
router.get('/suggestions', getSearchSuggestions);
router.get('/:id/related', getRelatedProducts);
router.get('/reviews/featured', getFeaturedReviews);
router.get('/:productId/reviews', getProductReviews);
router.post('/:productId/reviews', authenticate, authorize([Role.CUSTOMER]), createProductReview);
router.delete('/:productId/reviews', authenticate, authorize([Role.CUSTOMER]), deleteProductReview);
const productWriters = [Role.VENDOR, Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.VENDOR_MANAGER];

router.post('/bulk', authenticate, authorize(productWriters), bulkCreateProducts);
router.post('/', authenticate, authorize(productWriters), createProduct);
router.patch('/:id/status', authenticate, authorize([Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.VENDOR_MANAGER]), updateProductStatus);
router.put('/:id', authenticate, authorize([Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER]), updateProduct);
router.delete('/:id', authenticate, authorize([Role.ADMIN, Role.SUPER_ADMIN, Role.INVENTORY_MANAGER]), deleteProduct);
router.get('/:id', getProductById);

export default router;
