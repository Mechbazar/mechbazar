// Maps a notification to where tapping it should navigate. seller-mobile
// has no per-order detail screen yet (OrdersScreen is a flat list with no
// `orderId` param) -- so an order notification lands on the Orders tab
// rather than a specific order, which is still strictly better than the
// previous no-op-on-tap behaviour.
export interface DeepLinkTarget {
  screen: string;
  params?: Record<string, unknown>;
}

export function resolveNotificationRoute(notification: { type?: string | null; data?: unknown }): DeepLinkTarget | null {
  const data = (notification.data && typeof notification.data === 'object' ? notification.data : {}) as Record<string, unknown>;

  if (typeof data.orderId === 'string') {
    return { screen: 'Orders' };
  }
  return null;
}
