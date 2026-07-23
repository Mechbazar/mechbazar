import { Router } from 'express';
import { register, login, switchMode, adminLogin, registerPushToken, clearPushToken, requestOtp, refreshToken, changePassword } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/send-otp', requestOtp);
router.post('/switch-mode', authenticate, switchMode);
router.post('/refresh', authenticate, refreshToken);
router.patch('/change-password', authenticate, changePassword);
router.patch('/push-token', authenticate, registerPushToken);
router.delete('/push-token', authenticate, clearPushToken);

export default router;
