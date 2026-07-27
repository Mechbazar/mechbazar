// Google Maps integration point, mirroring apps/mobile/src/config/maps.ts.
// The store-location picker (screens/registration/OnboardingWizard.tsx,
// screens/ProfileScreen.tsx) imports from here so a missing/misconfigured key
// degrades to a plain address form instead of a broken embed.
//
// TWO separate keys, deliberately not one -- see apps/mobile/src/config/maps.ts
// for the full rationale:
//
//   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY         -- web only, HTTP-referrer
//     restricted. Consumed by AddressMapPicker.web.tsx via useJsApiLoader.
//   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_NATIVE  -- native only (Android/iOS),
//     restricted by package name + SHA-1 / bundle ID instead -- a referrer
//     restriction is meaningless on-device and Google refuses it there. Read
//     by app.config.js for the native Maps SDK config, and by
//     AddressMapPicker.tsx (native) below to gate rendering.
//
// A single shared var was why this picker's map never rendered in any real
// (EAS) build: EAS Build never sees the local, gitignored .env, and this
// app's eas.json never declared the var, so it was always undefined at native
// build time -- and even given a value, the referrer-restricted web key would
// still be refused natively (RefererNotAllowedMapError). Splitting the vars
// makes it possible for either platform's map to actually work, rather than
// only ever getting the placeholder or a silently-broken embed.
//
// Both keys gate map *rendering* only -- geocoding/autocomplete go through
// the backend's server-side key regardless.
export const isValidGoogleMapsKey = (key: string): boolean => /^AIza[0-9A-Za-z_-]{35}$/.test(key);

function resolveKey(envVarName: string, raw: string): string {
  if (raw && !isValidGoogleMapsKey(raw)) {
    console.warn(
      `[maps] ${envVarName} is set but is not a Google Maps Platform key (expected "AIza..."). ` +
        'Falling back to the no-map placeholder.'
    );
    return '';
  }
  return raw;
}

export const GOOGLE_MAPS_API_KEY = resolveKey(
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || ''
);
export const MAPS_ENABLED = !!GOOGLE_MAPS_API_KEY;

export const GOOGLE_MAPS_API_KEY_NATIVE = resolveKey(
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_NATIVE',
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_NATIVE || ''
);
export const MAPS_ENABLED_NATIVE = !!GOOGLE_MAPS_API_KEY_NATIVE;
