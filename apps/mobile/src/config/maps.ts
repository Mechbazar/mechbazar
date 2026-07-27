// Google Maps integration point. Address picker (screens/AddressManagementScreen.tsx,
// components/services/AddressPickerSheet.tsx) and delivery/service tracking
// (components/shared/maps/*) all import from here rather than hardcoding a
// check, so a missing/misconfigured key degrades to <MapPlaceholder/> in each
// of those spots instead of a broken embed -- not a re-plumb of every screen.
//
// TWO separate keys, deliberately not one:
//
//   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY         -- web only. HTTP-referrer
//     restricted in Google Cloud Console to this app's web origins. Read by
//     the Docker web build (docker-compose.yml build arg, sourced from the
//     root .env) and consumed by *.web.tsx map components via useJsApiLoader.
//
//   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_NATIVE  -- native only (Android/iOS).
//     Must be restricted by Android package name + SHA-1 / iOS bundle ID
//     instead of HTTP referrer -- an app running on-device sends no HTTP
//     referrer header, so a referrer-restricted key is simply refused there.
//     Read by app.config.js (bakes it into android.config.googleMaps.apiKey /
//     ios.config.googleMapsApiKey) and by the native (non-.web.tsx) map
//     components below to decide whether to render <MapPlaceholder/>.
//
// A single shared var was the root cause of every "Map view coming soon"
// report on native builds: EAS Build never sees the local, gitignored .env
// (it packages the repo respecting .gitignore, and neither this app's nor
// seller-mobile's eas.json declared this var), so EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
// was always undefined at native build time regardless of what the local .env
// or Docker web build had configured. And even had EAS been given a value, the
// *same* referrer-restricted web key would still fail natively with
// RefererNotAllowedMapError -- referrer restriction and app-identity
// restriction are mutually exclusive on one key. Splitting the vars makes it
// possible for each platform's map to actually work, rather than only ever
// getting the placeholder or a silently-broken embed.
//
// Both are gates on map *rendering* only. Address search, reverse geocoding
// and place details all proxy through the backend's own server-side key (see
// services/geocode.service.ts), so address entry works in full either way.

// Google Maps Platform keys are always "AIza" + 35 more characters. Other
// Google products mint credentials in different formats -- notably AI Studio
// / Generative Language keys, which start "AQ." -- and one of those had once
// been pasted into this slot. A non-empty-but-wrong key is worse than no key
// at all: without this check, the app would mount a real map that Google then
// refuses (REQUEST_DENIED / InvalidKeyMapError), leaving a dead grey box with
// no explanation instead of the honest placeholder.
export const isValidGoogleMapsKey = (key: string): boolean => /^AIza[0-9A-Za-z_-]{35}$/.test(key);

function resolveKey(envVarName: string, raw: string): string {
  if (raw && !isValidGoogleMapsKey(raw)) {
    console.warn(
      `[maps] ${envVarName} is set but is not a Google Maps Platform key (expected "AIza..."). ` +
        'Falling back to the no-map placeholder; address search, GPS and manual entry are unaffected.'
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
