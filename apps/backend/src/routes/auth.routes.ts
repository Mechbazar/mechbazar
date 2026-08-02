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

// Per-account lockout for the admin login's legacy password path, independent
// of the generic /api/auth IP limiter above it in index.ts -- that one only
// slows down a single attacking IP, so a distributed (multi-IP) guess/stuffing
// attempt against one known admin email wouldn't be throttled at all without
// this. Keyed on the submitted email (not IP) and only counts failed
// attempts (skipSuccessfulRequests), so a legitimately-logging-in admin never
// trips it. Covers the Firebase idToken path too since both share this route,
// though that path can't be brute-forced the same way.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => String(req.body?.email || '').trim().toLowerCase() || req.ip || 'unknown',
  message: { error: 'Too many failed login attempts for this account. Please try again in 15 minutes.' },
});

router.post('/register', register);
router.post('/login', login);
router.post('/admin/login', adminLoginLimiter, adminLogin);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/resend-verification-email', resendVerificationLimiter, resendVerificationEmail);
router.post('/switch-mode', authenticate, switchMode);
router.post('/refresh', authenticate, refreshToken);
router.patch('/change-password', authenticate, changePassword);
router.patch('/push-token', authenticate, registerPushToken);
router.delete('/push-token', authenticate, clearPushToken);

export default router;
