import axios from 'axios';
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
// production (Vercel web build, or any build not sitting on the same LAN as
// the backend), where there's no dev server host to derive an address from.
export const SERVER_ORIGIN = `http://${resolveDevHost()}:${BACKEND_PORT}`;
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || `${SERVER_ORIGIN}/api`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};
