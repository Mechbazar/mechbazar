import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

let API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

export const setApiBaseUrl = (baseUrl: string) => {
  API_URL = baseUrl;
  apiClient.defaults.baseURL = baseUrl;
};

export const getApiBaseUrl = () => API_URL;

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
