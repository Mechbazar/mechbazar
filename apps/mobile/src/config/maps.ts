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
const RAW_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Google Maps Platform browser/Android keys are always "AIza" + 35 more
// characters. Other Google products mint credentials in different formats --
// notably AI Studio / Generative Language keys, which start "AQ." -- and one
// of those had been pasted in here. A non-empty-but-wrong key is worse than
// no key at all: MAPS_ENABLED used to be a bare `!!key`, so the app skipped
// <MapPlaceholder/> and mounted a real map that Google then refused
// (REQUEST_DENIED / InvalidKeyMapError), leaving users a dead grey box with
// no explanation on the address form. Shape-check the key so a wrong one
// degrades exactly like a missing one.
//
// This only gates map *rendering*. Address search, reverse geocoding and
// place details all proxy through the backend's own server-side key (see
// services/geocode.service.ts), so address entry keeps working in full even
// when this is unset.
export const isValidGoogleMapsKey = (key: string): boolean => /^AIza[0-9A-Za-z_-]{35}$/.test(key);

export const GOOGLE_MAPS_API_KEY = isValidGoogleMapsKey(RAW_KEY) ? RAW_KEY : '';
export const MAPS_ENABLED = !!GOOGLE_MAPS_API_KEY;

if (RAW_KEY && !GOOGLE_MAPS_API_KEY) {
  console.warn(
    '[maps] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is set but is not a Google Maps Platform key ' +
      '(expected "AIza..."). Falling back to the no-map placeholder; address search, GPS ' +
      'and manual entry are unaffected.'
  );
}
