// Maps a notification to where clicking it should navigate. apps/admin has
// no per-entity detail route yet (vendors/customers/riders/orders are all
// flat list pages) -- so a notification lands on the relevant list page
// rather than a specific row, which is still strictly better than the
// previous no-op-on-click behaviour.
export interface DeepLinkTarget {
  path: string;
}

export function resolveNotificationRoute(notification: { type?: string | null; data?: unknown }): DeepLinkTarget | null {
  const data = (notification.data && typeof notification.data === 'object' ? notification.data : {}) as Record<string, unknown>;

  if (typeof data.vendorId === 'string') return { path: '/vendors' };
  if (typeof data.orderId === 'string') return { path: '/orders' };
  if (typeof data.riderId === 'string') return { path: '/riders' };
  if (typeof data.userId === 'string') return { path: '/customers' };
  return null;
}
