import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app } from '../config/firebase';

// Vendor is web-only (no native/.web split needed the way apps/mobile has) --
// ported from apps/mobile/src/services/webPush.web.ts, same Firebase project,
// same VAPID-key convention.
export async function registerForWebPushAsync(): Promise<string | undefined> {
  try {
    if (typeof window === 'undefined' || !(await isSupported())) return undefined;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.log('VITE_FIREBASE_VAPID_KEY not set -- skipping web push registration');
      return undefined;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return undefined;

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(app);
    return await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  } catch (error) {
    console.log('Web push registration failed:', error);
    return undefined;
  }
}
