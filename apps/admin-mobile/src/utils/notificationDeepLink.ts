// Maps a notification to where tapping it should navigate. Keyed off `data`
// shape (most admin-facing types carry an entity id but no `type` beyond
// ADMIN_*), most-specific first.
export interface DeepLinkTarget {
  screen: string;
  params?: Record<string, unknown>;
}

export function resolveNotificationRoute(notification: { type?: string | null; data?: unknown }): DeepLinkTarget | null {
  const data = (notification.data && typeof notification.data === 'object' ? notification.data : {}) as Record<string, unknown>;

  if (typeof data.vendorId === 'string') return { screen: 'VendorDetail', params: { vendorId: data.vendorId } };
  if (typeof data.orderId === 'string') return { screen: 'OrderDetail', params: { orderId: data.orderId } };
  if (typeof data.riderId === 'string') return { screen: 'RiderDetail', params: { riderId: data.riderId } };
  if (typeof data.technicianId === 'string') return { screen: 'TechnicianDetail', params: { technicianId: data.technicianId } };
  if (typeof data.userId === 'string') return { screen: 'CustomerDetail', params: { customerId: data.userId } };
  return null;
}
