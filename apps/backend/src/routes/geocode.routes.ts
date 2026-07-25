import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getReverseGeocode, getForwardGeocode, getAutocomplete, getPlaceDetails } from '../controllers/geocode.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// This proxies a paid, quota-metered external API (Google Maps Platform), so
// it gets its own tighter ceiling independent of the general /api limiter in
// index.ts -- same pattern as /api/auth's dedicated limiter there.
const geocodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(geocodeLimiter);

// Self-service, any authenticated role -- matches customer.routes.ts's
// /me/addresses pattern (no admin gating needed, nothing user-specific here).
router.get('/reverse', authenticate, getReverseGeocode);
router.get('/search', authenticate, getForwardGeocode);
router.get('/autocomplete', authenticate, getAutocomplete);
router.get('/place/:placeId', authenticate, getPlaceDetails);

export default router;
