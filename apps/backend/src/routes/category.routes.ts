import { Router } from 'express';
import { getCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER];

router.get('/', getCategories);
router.post('/', authenticate, authorize(admins), createCategory);
router.put('/:id', authenticate, authorize(admins), updateCategory);
router.delete('/:id', authenticate, authorize(admins), deleteCategory);

export default router;
