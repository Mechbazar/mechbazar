// Google Maps integration point, mirroring apps/mobile/src/config/maps.ts.
// The store-location picker (screens/registration/OnboardingWizard.tsx,
// screens/ProfileScreen.tsx) imports MAPS_ENABLED and GOOGLE_MAPS_API_KEY
// from here so a missing/misconfigured key degrades to a plain address form
// instead of a broken embed.
//
// Requires EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (see .env.example) restricted to
// Maps JavaScript API + Places API in the Google Cloud Console -- this key
// is publicly visible in the compiled app either way. Native builds also
// need it wired into app.config.js's ios.config.googleMapsApiKey /
// android.config.googleMaps.apiKey (already reads this same env var).
// Shape-check mirrors apps/mobile/src/config/maps.ts: a non-empty key from a
// different Google product (e.g. an AI Studio "AQ." key) would otherwise pass
// the old bare `!!key` test and mount a map Google refuses to serve, showing a
// dead grey box instead of the honest placeholder. Map rendering only --
// geocoding/autocomplete go through the backend's server-side key.
export const isValidGoogleMapsKey = (key: string): boolean => /^AIza[0-9A-Za-z_-]{35}$/.test(key);

const RAW_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const GOOGLE_MAPS_API_KEY = isValidGoogleMapsKey(RAW_KEY) ? RAW_KEY : '';
export const MAPS_ENABLED = !!GOOGLE_MAPS_API_KEY;
