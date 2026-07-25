import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Same Firebase project as the customer app (mech-bazar-8fd86) and the
// backend's Admin SDK -- these are public client identifiers, not secrets
// (Firebase security is enforced by Auth itself, not by hiding this config),
// so it's safe to source from build-time Vite env vars with real defaults
// here for local dev. See .env.example to override per environment.
// Matches config/api.ts's `env var || default` pattern -- defaults are the
// same values apps/mobile already ships hardcoded (same project), so local
// dev works with no .env.local needed; override per-environment via
// VITE_FIREBASE_* if this app is ever moved to its own Firebase web app entry.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDGfDIni8X8FQyroo-KonEfbJQuHBV0nKk',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'mech-bazar-8fd86.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'mech-bazar-8fd86',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'mech-bazar-8fd86.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '42514698096',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:42514698096:web:2da09e89e77068173149b5',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
