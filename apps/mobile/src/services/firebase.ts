import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// -------------------------------------------------------------
// USER ACTION REQUIRED: Replace these with your actual Firebase config
// You can find these in the Firebase Console under Project Settings > General > Your apps (Web app)
// -------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDGfDIni8X8FQyroo-KonEfbJQuHBV0nKk",
  authDomain: "mech-bazar-8fd86.firebaseapp.com",
  projectId: "mech-bazar-8fd86",
  storageBucket: "mech-bazar-8fd86.firebasestorage.app",
  messagingSenderId: "42514698096",
  appId: "1:42514698096:web:2da09e89e77068173149b5",
  measurementId: "G-9SN2NKNE34"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };
