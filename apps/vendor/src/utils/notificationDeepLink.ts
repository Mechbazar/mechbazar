// Maps a notification to where clicking it should navigate. apps/vendor has
// no per-order detail route yet (/orders is a flat list) -- so an order
// notification lands on the Orders page rather than a specific order, which
// is still strictly better than the previous no-op-on-click behaviour.
export interface DeepLinkTarget {
  path: string;
}

export function resolveNotificationRoute(notification: { type?: string | null; data?: unknown }): DeepLinkTarget | null {
  const data = (notification.data && typeof notification.data === 'object' ? notification.data : {}) as Record<string, unknown>;

  if (typeof data.orderId === 'string') {
    return { path: '/orders' };
  }
  return null;
}
