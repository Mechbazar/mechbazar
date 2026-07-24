// Google Maps integration point -- intentionally not wired to a real map
// yet (no API key provided). Every screen that will eventually need a map
// (address picker, vendor/store locator, delivery tracking, mechanic
// service-area picker) should import MAPS_ENABLED and GOOGLE_MAPS_API_KEY
// from here rather than hardcoding a check, so flipping this on later is a
// one-line env change plus swapping <MapPlaceholder/> for the real map
// component in each of those spots -- not a re-plumb of every screen.
//
// To enable: set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in apps/mobile/.env (see
// .env.example), restrict the key to Maps JavaScript API + Places API in
// the Google Cloud Console, and restrict it by HTTP referrer (web) /
// package name + SHA-1 (native) before shipping it in a client bundle --
// this key is publicly visible in the compiled app either way.
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const MAPS_ENABLED = !!GOOGLE_MAPS_API_KEY;
