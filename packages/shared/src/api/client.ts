import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

let API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

export const setApiBaseUrl = (baseUrl: string) => {
  API_URL = baseUrl;
  apiClient.defaults.baseURL = baseUrl;
};

export const getApiBaseUrl = () => API_URL;

/**
 * Changes the signed-in user's password.
 *
 * Shared because admin-mobile and seller-mobile both authenticate against the
 * backend's own credential store (bcrypt over User.password) rather than
 * Firebase, so both need this exact call. Do NOT reuse it for apps/admin or
 * apps/vendor web: those sign in with Firebase, whose password lives in
 * Firebase Auth, and this endpoint would report success without touching the
 * credential they actually log in with.
 *
 * `currentPassword` is required whenever the account already has one; the
 * backend rejects the request otherwise.
 */
export const changePassword = async (currentPassword: string, newPassword: string) => {
  const response = await apiClient.patch('/auth/change-password', { currentPassword, newPassword });
  return response.data;
};

/**
 * Turns a stored image path into something <Image> can actually load.
 *
 * The upload endpoint returns an absolute URL when a Firebase Storage bucket
 * is configured, but a bare "/uploads/<file>" path when it is not. A browser
 * resolves that relative path against the page origin; React Native has no
 * page origin, so it must be made absolute against the API host or the image
 * silently fails to load.
 *
 * Reads getApiBaseUrl() at call time rather than caching, so it stays correct
 * after setApiBaseUrl(). Absolute URLs are returned untouched.
 */
export const resolveUploadUrl = (path?: string | null): string | null => {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${getApiBaseUrl().replace(/\/api\/?$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
};

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.error('Error fetching token from SecureStore', error);
  }
  return config;
});

// This client is shared by apps/seller-mobile, apps/mechanic and apps/rider,
// none of which had ANY 401 handling -- an expired/invalid token just left
// the user stuck on a screen that looked logged-in but silently failed every
// request. Fixed once here rather than three times per-app. Each app's own
// Redux store/logout action differs, so this file can't dispatch logout
// itself (no circular dependency on a specific app's store) -- instead it
// exposes a registration hook that each app's entry point (App.tsx) calls
// once at startup, mirroring apps/mobile's services/sessionGuard.ts pattern.
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      try {
        await SecureStore.deleteItemAsync('token');
      } catch {
        // Best-effort -- the handler below still fires either way.
      }
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);
