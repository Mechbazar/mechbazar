import { Router } from 'express';
import {
  checkPincode,
  getServiceablePincodes,
  addServiceablePincodes,
  updateServiceablePincode,
  deleteServiceablePincode,
} from '../controllers/serviceability.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER];

// Public -- the customer app checks this while entering/selecting an address.
router.get('/check', checkPincode);

router.get('/pincodes', authenticate, authorize(admins), getServiceablePincodes);
router.post('/pincodes', authenticate, authorize(admins), addServiceablePincodes);
router.patch('/pincodes/:id', authenticate, authorize(admins), updateServiceablePincode);
router.delete('/pincodes/:id', authenticate, authorize(admins), deleteServiceablePincode);

export default router;
