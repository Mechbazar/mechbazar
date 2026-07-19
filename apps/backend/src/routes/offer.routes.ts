import { Router } from 'express';
import { getOffers, getAllOffers, createOffer, updateOffer, deleteOffer } from '../controllers/offer.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER, Role.VENDOR_MANAGER];

router.get('/', getOffers);
router.get('/all', authenticate, authorize(admins), getAllOffers);
router.post('/', authenticate, authorize(admins), createOffer);
router.put('/:id', authenticate, authorize(admins), updateOffer);
router.delete('/:id', authenticate, authorize(admins), deleteOffer);

export default router;
