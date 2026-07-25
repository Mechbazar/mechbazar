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
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const MAPS_ENABLED = !!GOOGLE_MAPS_API_KEY;
