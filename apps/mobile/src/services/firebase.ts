import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider, getToken as getAppCheckTokenWeb, AppCheck } from 'firebase/app-check';

// Firebase JS SDK config for the WEB build only.
//
// Native (iOS/Android) does not use this file at all -- it goes through
// @react-native-firebase, which reads google-services.json /
// GoogleService-Info.plist. Metro picks services/phoneAuth.ts over
// phoneAuth.web.ts on native, and only the .web.ts variants (phoneAuth.web.ts,
// webPush.web.ts) import from here.
//
// These are PUBLIC client identifiers, not secrets: Firebase security is
// enforced by Auth rules and by the API key's own referrer/package
// restrictions, not by hiding this config. They are nonetheless sourced from
// EXPO_PUBLIC_FIREBASE_* env vars, with the current project's values as
// defaults, so the web build can be pointed at a different Firebase project
// without a code change -- matching the pattern apps/admin already uses.
//
// (The previous "USER ACTION REQUIRED: Replace these with your actual Firebase
// config" comment was stale -- the real values have been in place for a long
// time.)
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDGfDIni8X8FQyroo-KonEfbJQuHBV0nKk',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'mech-bazar-8fd86.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'mech-bazar-8fd86',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mech-bazar-8fd86.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '42514698096',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:42514698096:web:2da09e89e77068173149b5',
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-9SN2NKNE34',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// App Check (web): reCAPTCHA v3 is the only web provider Firebase offers.
// Requires a site key created under Firebase Console -> App Check -> Apps ->
// this web app -> reCAPTCHA v3, which does not exist yet for this project --
// EXPO_PUBLIC_RECAPTCHA_V3_SITE_KEY is unset until then, and initialization is
// skipped entirely rather than calling initializeAppCheck with an invalid key
// (which throws). api.ts's request interceptor already tolerates
// getWebAppCheckToken() returning null, so this being unset changes nothing
// about whether the app works today.
const RECAPTCHA_V3_SITE_KEY = process.env.EXPO_PUBLIC_RECAPTCHA_V3_SITE_KEY || '';
let appCheckInstance: AppCheck | null = null;
if (RECAPTCHA_V3_SITE_KEY) {
  if (__DEV__ && typeof window !== 'undefined') {
    // Lets a local `expo start --web` dev session pass App Check without a
    // real reCAPTCHA solve -- register the token Firebase logs to the console
    // under Firebase Console -> App Check -> Manage debug tokens. Never set in
    // a production web build (EXPO_PUBLIC_* vars are compiled in, but __DEV__
    // is stripped false for prod builds, so this branch never ships).
    (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    appCheckInstance = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(RECAPTCHA_V3_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('[appCheck] web init failed:', err);
  }
}

export const getWebAppCheckToken = async (): Promise<string | null> => {
  if (!appCheckInstance) return null;
  try {
    const { token } = await getAppCheckTokenWeb(appCheckInstance);
    return token || null;
  } catch (err) {
    console.warn('[appCheck] web getToken failed:', err);
    return null;
  }
};

export { app, auth };
