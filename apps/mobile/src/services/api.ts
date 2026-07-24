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
// production (the Docker web build, or any build not sitting on the same LAN
// as the backend), where there's no dev server host to derive an address from.
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

// A rejected/expired token previously just produced a confusing per-screen
// error (e.g. an empty orders list) while the app still looked "logged in".
// Force a real logout so the user lands back on Welcome and can re-authenticate,
// instead of being stuck on a broken screen. Lazy-imported to dodge a
// store <-> api require cycle (store doesn't import api, but several services
// that api-consumers import do import store; this keeps api.ts safe to import
// from anywhere including store/index.ts's own dependency graph).
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const { store } = require('../store');
      const { logout } = require('../store/authSlice');
      if (store.getState().auth.token) {
        store.dispatch(logout());
      }
    }
    return Promise.reject(error);
  }
);
