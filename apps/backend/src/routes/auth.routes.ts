import { Router } from 'express';
import { register, login, switchMode, adminLogin, registerPushToken, requestOtp } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/send-otp', requestOtp);
// In a real app, switchMode would be protected by an auth middleware
router.post('/switch-mode', switchMode);
router.patch('/push-token', authenticate, registerPushToken);

export default router;
