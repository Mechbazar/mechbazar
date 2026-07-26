import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

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

export { app, auth };
