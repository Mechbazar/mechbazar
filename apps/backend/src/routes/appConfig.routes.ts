import { Router } from 'express';
import { getMobileVersion, setMobileVersion } from '../controllers/appConfig.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const admins = [Role.ADMIN, Role.SUPER_ADMIN, Role.OPERATIONS_MANAGER];

// Public -- the customer app checks this from its About screen.
router.get('/mobile-version', getMobileVersion);

router.put('/mobile-version', authenticate, authorize(admins), setMobileVersion);

export default router;
