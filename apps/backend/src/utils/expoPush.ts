// Minimal Expo push sender — no SDK dependency needed, Expo's push service
// accepts a plain HTTP POST. Send failures are logged, never thrown: a
// missing/expired push token must not block the order-assignment flow.
// Returns whether the send succeeded -- notify.ts uses this to record
// Notification.deliveryStatus/deliveredAt (see the delivery-retry sweep in
// jobs/sweeper.ts); every other existing caller already ignores the return
// value, so this is additive, not a behavior change for them.
export async function sendExpoPush(to: string, title: string, body: string, data?: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, title, body, data, sound: 'default' }),
    });
    if (!res.ok) {
      console.error('Expo push send failed:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Expo push send error:', error);
    return false;
  }
}
