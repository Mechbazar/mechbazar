import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, switchMode, adminLogin, registerPushToken, clearPushToken, refreshToken, changePassword, forgotPassword, resendVerificationEmail } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Unauthenticated, takes an arbitrary email, and causes mail to be sent on the
// project's behalf. Without a limit it is both a way to have Firebase mail
// someone repeatedly and a way to probe addresses at speed -- the endpoint
// answers identically either way, but only if nobody can run it thousands of
// times. Matches the shape of the limiter on job.routes.ts's OTP endpoints.
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many password reset requests. Please try again in a few minutes.' },
});

// Same shape as forgotPasswordLimiter -- a valid idToken proves the caller
// owns the account, but not that they aren't just mail-bombing themselves
// (or anyone whose account they can get a token for) with resend requests.
const resendVerificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification email requests. Please try again in a few minutes.' },
});

router.post('/register', register);
router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/resend-verification-email', resendVerificationLimiter, resendVerificationEmail);
router.post('/switch-mode', authenticate, switchMode);
router.post('/refresh', authenticate, refreshToken);
router.patch('/change-password', authenticate, changePassword);
router.patch('/push-token', authenticate, registerPushToken);
router.delete('/push-token', authenticate, clearPushToken);

export default router;
