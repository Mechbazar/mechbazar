// Google Maps integration point for the admin web app, mirroring
// apps/vendor/src/config/maps.ts. Admin pages import MAPS_ENABLED and
// GOOGLE_MAPS_API_KEY from here so a missing/misconfigured key degrades to a
// plain address/placeholder view instead of a broken embed.
//
// Requires VITE_GOOGLE_MAPS_API_KEY (see .env.example) restricted to Maps
// JavaScript API + Places API and HTTP-referrer restricted to this app's
// domains in the Google Cloud Console -- this key is publicly visible in the
// compiled bundle either way.
// Shape-check mirrors apps/vendor/src/config/maps.ts: a non-empty key from a
// different Google product (e.g. an AI Studio "AQ." key) would otherwise pass
// the old bare `!!key` test and mount a map Google refuses to serve
// (InvalidKeyMapError), showing a dead grey box instead of the honest
// placeholder. Map rendering only -- geocoding/autocomplete go through the
// backend's server-side key (see services/geocode.service.ts).
export const isValidGoogleMapsKey = (key: string): boolean => /^AIza[0-9A-Za-z_-]{35}$/.test(key);

const RAW_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
export const GOOGLE_MAPS_API_KEY = isValidGoogleMapsKey(RAW_KEY) ? RAW_KEY : '';
export const MAPS_ENABLED = !!GOOGLE_MAPS_API_KEY;
