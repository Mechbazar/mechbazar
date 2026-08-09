// Maps a notification to where tapping it should navigate. Keyed off `data`
// shape first (works even for the many existing order notifications that
// carry {orderId} but no `type`), falling back to `type` for cases with no
// navigable data of their own.
export interface DeepLinkTarget {
  screen: string;
  params?: Record<string, unknown>;
}

export function resolveNotificationRoute(notification: { type?: string | null; data?: unknown }): DeepLinkTarget | null {
  const data = (notification.data && typeof notification.data === 'object' ? notification.data : {}) as Record<string, unknown>;

  if (typeof data.orderId === 'string') {
    return { screen: 'DeliveryTracking', params: { orderId: data.orderId } };
  }
  if (typeof data.bookingId === 'string') {
    return { screen: 'ServiceTracking', params: { bookingId: data.bookingId } };
  }
  return null;
}
