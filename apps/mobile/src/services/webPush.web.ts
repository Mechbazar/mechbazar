import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app } from './firebase';

// Web build only (Metro picks this file over webPush.native.ts) -- Android
// push keeps using the existing Expo push pipeline (services/notifications.ts)
// unchanged; this is purely additive, for browsers, which had no push
// notification capability before.
export async function registerForWebPushAsync(): Promise<string | undefined> {
  try {
    if (typeof window === 'undefined' || !(await isSupported())) return undefined;

    const vapidKey = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.log('EXPO_PUBLIC_FIREBASE_VAPID_KEY not set -- skipping web push registration');
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
