import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// -------------------------------------------------------------
// USER ACTION REQUIRED: Replace these with your actual Firebase config
// You can find these in the Firebase Console under Project Settings > General > Your apps (Web app)
// -------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyASZymn8XoSNYAGbempjXkJzJk3wWCZxJM",
  authDomain: "mech-bazar.firebaseapp.com",
  projectId: "mech-bazar",
  storageBucket: "mech-bazar.firebasestorage.app",
  messagingSenderId: "631087649858",
  appId: "1:631087649858:web:c600e0750c8fccd53649db",
  measurementId: "G-801043FH1W"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

export { app, auth };
