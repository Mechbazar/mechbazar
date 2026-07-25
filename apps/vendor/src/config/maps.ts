// Google Maps integration point for the vendor web app, mirroring
// apps/mobile/src/config/maps.ts. The store-location picker (pages/Register.tsx
// business step, pages/Profile.tsx store info card) imports MAPS_ENABLED and
// GOOGLE_MAPS_API_KEY from here so a missing/misconfigured key degrades to a
// plain address form instead of a broken embed.
//
// Requires VITE_GOOGLE_MAPS_API_KEY (see .env.example) restricted to Maps
// JavaScript API + Places API and HTTP-referrer restricted to this app's
// domains in the Google Cloud Console -- this key is publicly visible in the
// compiled bundle either way.
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
export const MAPS_ENABLED = !!GOOGLE_MAPS_API_KEY;
