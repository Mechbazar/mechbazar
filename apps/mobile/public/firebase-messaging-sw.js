// Handles FCM web push while the site is not the focused tab (Firebase's
// required convention: this exact filename, served from the origin root --
// nginx's `try_files $uri ... /index.html` serves this real file directly
// before falling back to the SPA, see apps/mobile/nginx.conf). Foreground
// messages are handled in src/services/webPush.ts instead, via onMessage().
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.16.0/firebase-messaging-compat.js');

// Same config as src/services/firebase.ts -- a service worker runs in its own
// global scope with no access to app code/env vars, so it's duplicated here.
firebase.initializeApp({
  apiKey: 'AIzaSyASZymn8XoSNYAGbempjXkJzJk3wWCZxJM',
  authDomain: 'mech-bazar.firebaseapp.com',
  projectId: 'mech-bazar',
  storageBucket: 'mech-bazar.firebasestorage.app',
  messagingSenderId: '631087649858',
  appId: '1:631087649858:web:c600e0750c8fccd53649db',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'MechBazar', { body: body || '' });
});
