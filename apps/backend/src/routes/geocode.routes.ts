import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getReverseGeocode, getForwardGeocode, getAutocomplete, getPlaceDetails } from '../controllers/geocode.controller';

const router = Router();

// This proxies a paid, quota-metered external API (Google Maps Platform), so
// it gets its own tighter ceiling independent of the general /api limiter in
// index.ts -- same pattern as /api/auth's dedicated limiter there. That
// per-IP limit is the abuse guard here, not auth: these routes are
// deliberately public (no `authenticate`), not gated to logged-in roles --
// nothing here is user-specific, and the customer web/mobile Home screen's
// "Deliver to <city>" bar reverse-geocodes before a guest has ever logged in.
const geocodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(geocodeLimiter);

router.get('/reverse', getReverseGeocode);
router.get('/search', getForwardGeocode);
router.get('/autocomplete', getAutocomplete);
router.get('/place/:placeId', getPlaceDetails);

export default router;
