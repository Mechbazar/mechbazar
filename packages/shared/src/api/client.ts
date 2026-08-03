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
 * Requests a password reset email for an account.
 *
 * Unauthenticated -- this is for people who cannot sign in. The backend hands
 * delivery to Firebase, which owns the only verified mail channel this project
 * has, and answers with the same message whether or not the address has an
 * account, so nothing here can be used to discover who is registered. Callers
 * must present that outcome as-is and never claim more than "if an account
 * exists".
 *
 * Unlike changePassword above, this IS the right call for every app with a
 * password login, web panels included: the endpoint drives Firebase, and the
 * login paths reconcile the local hash afterwards, so one reset now unlocks
 * both credential stores.
 */
export const requestPasswordReset = async (email: string): Promise<{ message: string }> => {
  const response = await apiClient.post('/auth/forgot-password', { email });
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

/**
 * Push-token registration for apps whose account lives on the base User
 * model rather than a role-specific table (admin-mobile, seller-mobile --
 * both sign in through User.password, same as changePassword above). Riders
 * and technicians use their own /riders/me/push-token and
 * /technicians/me/push-token instead, which target DeliveryPartner /
 * ServiceTechnician directly.
 */
export const registerPushToken = async (token: string): Promise<void> => {
  await apiClient.patch('/auth/push-token', { token, type: 'expo' });
};

export const clearPushToken = async (): Promise<void> => {
  await apiClient.delete('/auth/push-token', { params: { type: 'expo' } });
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

// /auth/change-password's 401 means "current password is wrong", not "your
// session expired" (see its own backend handler and each app's
// ChangePasswordScreen, which already render that exact message) -- treating
// it like every other 401 here would delete a still-valid token and force-
// logout a user who just made a typo.
const isSessionExpired401 = (error: any) =>
  error?.response?.status === 401 &&
  !(typeof error?.config?.url === 'string' && error.config.url.includes('/auth/change-password'));

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (isSessionExpired401(error)) {
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
