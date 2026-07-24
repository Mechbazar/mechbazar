import admin from '../config/firebase';

// Web-push counterpart to expoPush.ts's sendExpoPush -- same fire-and-forget
// contract (never throws; a missing/expired token must not block whatever
// triggered the notification). FCM's `data` payload only accepts string
// values, unlike Expo's, so non-string values are stringified.
export async function sendFcmPush(token: string, title: string, body: string, data?: Record<string, unknown>) {
  try {
    const stringData = data
      ? Object.fromEntries(Object.entries(data).map(([key, value]) => [key, String(value)]))
      : undefined;
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: stringData,
    });
  } catch (error) {
    console.error('FCM push send error:', error);
  }
}
