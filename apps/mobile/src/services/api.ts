import { Platform } from 'react-native';
import Constants from 'expo-constants';

const BACKEND_PORT = Number(process.env.EXPO_PUBLIC_BACKEND_PORT || 5001);

// A hand-typed LAN IP only works on the one network it was typed on -- it breaks
// the moment the dev machine changes networks or someone else on the team runs
// this. Derive the dev machine's address instead: on web the app is served from
// that machine already (use the browser's own hostname); on a native device the
// Expo dev server already knows its own LAN IP (Metro/Expo Go connects to it to
// load the bundle), so reuse that instead of a value someone has to hand-edit.
function resolveDevHost(): string {
  if (Platform.OS === 'web') {
    return typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : 'localhost';
  }
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri ||
    (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    return hostUri.split(':')[0];
  }
  return 'localhost';
}

// EXPO_PUBLIC_API_URL overrides the dev-host guess entirely -- required in
// production (the Docker web build, or any build not sitting on the same LAN
// as the backend), where there's no dev server host to derive an address from.
const DEV_ORIGIN = `http://${resolveDevHost()}:${BACKEND_PORT}`;

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || `${DEV_ORIGIN}/api`;

// The origin behind API_BASE_URL. Used to turn the relative "/uploads/..."
// paths the upload endpoint returns (upload.controller.ts, when no Firebase
// Storage bucket is configured) into absolute URLs that <Image> can load --
// React Native cannot resolve a relative URI, since it has no page origin the
// way a browser does.
//
// Derived from API_BASE_URL rather than from resolveDevHost(), which is the
// whole point: a standalone production build has no Expo dev server, so
// hostUri is undefined, resolveDevHost() fell back to "localhost", and every
// relative product image resolved to http://localhost:5001/uploads/... and
// failed to load on device. EXPO_PUBLIC_API_URL was already being honoured for
// API calls, so only the image origin was wrong.
export const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');
