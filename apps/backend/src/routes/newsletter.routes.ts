import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { subscribeNewsletter } from '../controllers/newsletter.controller';
import { requireAppCheck } from '../middlewares/appCheck';

const router = Router();

// Unauthenticated and takes an arbitrary email -- without its own limit this
// only had the generic 600/15min/IP limiter in index.ts, generous enough to
// allow bulk fake-signup spam from a single IP. Same shape as
// auth.routes.ts's forgotPasswordLimiter.
const subscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many subscription requests. Please try again in a few minutes.' },
});

router.post('/subscribe', requireAppCheck, subscribeLimiter, subscribeNewsletter);

export default router;
