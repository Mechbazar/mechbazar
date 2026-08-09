// Shared shape of a Notification row as returned by the backend's
// /customers/notifications endpoints (role-agnostic -- scoped by the
// authenticated user's own id server-side, reused by every RN app).
export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  type?: string | null;
  data?: unknown;
  imageUrl?: string | null;
  actions?: { label: string; deepLink: string }[] | null;
}

export interface NotificationPage {
  items: NotificationItem[];
  nextCursor: string | null;
}
