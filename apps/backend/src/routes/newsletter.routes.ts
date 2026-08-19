import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { subscribeNewsletter } from '../controllers/newsletter.controller';
import { redisBackedStore } from '../config/redis';

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
  store: redisBackedStore('newsletter-subscribe'),
  message: { error: 'Too many subscription requests. Please try again in a few minutes.' },
});

router.post('/subscribe', subscribeLimiter, subscribeNewsletter);

export default router;
