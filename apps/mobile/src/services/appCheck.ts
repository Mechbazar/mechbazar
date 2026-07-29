import { Platform } from 'react-native';

// Native (iOS/Android) only -- Metro/this file's own guards keep the web
// build off this path entirely; see firebase.ts for the web equivalent
// (reCAPTCHA v3), which is a different package with a different API.
//
// @react-native-firebase/app-check is a native module Expo Go does not ship,
// same constraint as @react-native-firebase/auth in phoneAuth.ts -- so this
// is required lazily, inside the function that needs it, never at module
// top-level. App.tsx imports this file eagerly on boot; a top-level require
// here would red-screen the whole app under Expo Go exactly like the bug
// phoneAuth.ts's comment already documents.
//
// Debug provider tokens (EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN_ANDROID/_IOS) are
// only needed for a development build running against an App Check-enforced
// backend before the real Play Integrity / App Attest providers are
// registered in the Firebase Console -- generate one by running a dev build
// once and reading the token it logs, then register it under Firebase Console
// -> App Check -> Manage debug tokens. Unset is fine; it just means dev
// builds fall back to Play Integrity/App Attest too, which fails in an
// emulator or unregistered app but never throws past the try/catch below.
let cachedGetToken: (() => Promise<string | null>) | null = null;

export const initAppCheck = async (): Promise<void> => {
  if (Platform.OS === 'web') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getApp } = require('@react-native-firebase/app');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { initializeAppCheck, ReactNativeFirebaseAppCheckProvider, getToken } = require('@react-native-firebase/app-check');

    const provider = new ReactNativeFirebaseAppCheckProvider();
    provider.configure({
      android: {
        provider: __DEV__ ? 'debug' : 'playIntegrity',
        debugToken: process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN_ANDROID,
      },
      apple: {
        provider: __DEV__ ? 'debug' : 'appAttestWithDeviceCheckFallback',
        debugToken: process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN_IOS,
      },
    });

    const appCheckInstance = initializeAppCheck(getApp(), {
      provider,
      isTokenAutoRefreshEnabled: true,
    });

    cachedGetToken = async () => {
      try {
        const { token } = await getToken(appCheckInstance);
        return token || null;
      } catch (err) {
        console.warn('[appCheck] getToken failed:', err);
        return null;
      }
    };
  } catch (err) {
    // Expo Go (no native module) or a build where the provider genuinely
    // can't attest (emulator, unregistered app). Every other Firebase call in
    // this app already has to work without App Check today, so this is a
    // silent no-op rather than a hard failure -- see api.ts's request
    // interceptor, which just omits the header when this returns null.
    console.warn('[appCheck] native init skipped:', (err as Error)?.message ?? err);
  }
};

export const getAppCheckToken = async (): Promise<string | null> => {
  if (!cachedGetToken) return null;
  return cachedGetToken();
};
