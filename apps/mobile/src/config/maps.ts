// Google Maps integration point. Address picker (screens/AddressManagementScreen.tsx,
// components/services/AddressPickerSheet.tsx) and delivery/service tracking
// (components/shared/maps/*) all import MAPS_ENABLED and GOOGLE_MAPS_API_KEY
// from here rather than hardcoding a check, so a missing/misconfigured key
// degrades to <MapPlaceholder/> in each of those spots instead of a broken
// embed -- not a re-plumb of every screen.
//
// Requires EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in apps/mobile/.env (see
// .env.example) -- the key must be restricted to Maps JavaScript API +
// Places API in the Google Cloud Console, and restricted by HTTP referrer
// (web) / package name + SHA-1 (native) -- this key is publicly visible in
// the compiled app either way. Native builds additionally need the same key
// wired into app.config.js's ios.config.googleMapsApiKey /
// android.config.googleMaps.apiKey (already reads this same env var).
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const MAPS_ENABLED = !!GOOGLE_MAPS_API_KEY;
