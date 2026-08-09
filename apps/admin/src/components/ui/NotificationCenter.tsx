import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Bell, Package, Store, UserPlus, Megaphone, Wrench, Sparkles, CheckCheck } from 'lucide-react';
import type { RootState } from '../../store';
import { API_URL } from '../../config/api';
import { getAdminSocket } from '../../services/adminRealtime';
import { EmptyState } from './EmptyState';
import { resolveNotificationRoute } from '../../utils/notificationDeepLink';

const POLL_INTERVAL_MS = 20000;

type Category = 'orders' | 'vendors' | 'customers' | 'bookings' | 'broadcast' | 'other';

const CATEGORY_META: Record<Category, { label: string; icon: React.ElementType; color: string }> = {
  orders: { label: 'Orders', icon: Package, color: 'text-blue-500 bg-blue-500/10' },
  vendors: { label: 'Vendors', icon: Store, color: 'text-purple-500 bg-purple-500/10' },
  customers: { label: 'Customers', icon: UserPlus, color: 'text-emerald-500 bg-emerald-500/10' },
  bookings: { label: 'Service Jobs', icon: Wrench, color: 'text-amber-500 bg-amber-500/10' },
  broadcast: { label: 'Announcements', icon: Megaphone, color: 'text-rose-500 bg-rose-500/10' },
  other: { label: 'Other', icon: Sparkles, color: 'text-content-secondary bg-surface-hover' },
};

function categorize(type: string | null): Category {
  if (!type) return 'other';
  if (type === 'ADMIN_NEW_ORDER') return 'orders';
  if (type === 'ADMIN_VENDOR_PENDING') return 'vendors';
  if (type === 'ADMIN_NEW_CUSTOMER') return 'customers';
  if (type === 'ADMIN_BROADCAST') return 'broadcast';
  if (type.startsWith('JOB_') || type.startsWith('OFFER_') || type === 'CHAT_MESSAGE') return 'bookings';
  return 'other';
}

export function NotificationCenter() {
  const { token } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/customers/notifications`, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications(res.data);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const socket = getAdminSocket();
    const onNotification = () => fetchNotifications();
    socket.on('notification', onNotification);
    return () => { socket.off('notification', onNotification); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unread = notifications.filter((n) => !n.isRead);
  const unreadCount = unread.length;

  const markRead = async (id: string) => {
    try {
      await axios.patch(`${API_URL}/customers/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (error) {
      console.error('Failed to mark notification read', error);
    }
  };

  const markAllRead = async () => {
    const ids = unread.map((n) => n.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await Promise.all(ids.map((id) => axios.patch(`${API_URL}/customers/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {})));
  };

  const openNotification = (n: any) => {
    markRead(n.id);
    axios.post(`${API_URL}/customers/notifications/${n.id}/opened`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    const target = resolveNotificationRoute(n);
    if (target) {
      setOpen(false);
      navigate(target.path);
    }
  };

  const grouped = notifications.slice(0, 40).reduce<Record<Category, any[]>>((acc, n) => {
    const cat = categorize(n.type);
    (acc[cat] ||= []).push(n);
    return acc;
  }, {} as Record<Category, any[]>);

  const categoriesWithData = (Object.keys(CATEGORY_META) as Category[]).filter((c) => grouped[c]?.length);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-xl text-content-secondary hover:text-content-primary hover:bg-surface-hover transition-colors"
        aria-label="Notifications"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-primary px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-96 max-h-[28rem] overflow-y-auto rounded-2xl border border-border-default bg-surface-overlay shadow-popover z-50"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-default sticky top-0 bg-surface-overlay">
              <span className="font-semibold text-sm text-content-primary">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:text-brand-accent transition-colors">
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <EmptyState icon="bell" title="You're all caught up" description="New activity across the platform will show up here." />
            ) : (
              categoriesWithData.map((cat) => {
                const meta = CATEGORY_META[cat];
                return (
                  <div key={cat}>
                    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-content-muted">{meta.label}</p>
                    {grouped[cat].map((n) => (
                      <button
                        key={n.id}
                        onClick={() => openNotification(n)}
                        className={`w-full text-left flex gap-3 px-4 py-2.5 hover:bg-surface-hover transition-colors ${n.isRead ? 'opacity-55' : ''}`}
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.color}`}>
                          <meta.icon size={15} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-content-primary">{n.title}</span>
                            {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-brand-primary shrink-0" />}
                          </span>
                          <span className="block truncate text-xs text-content-secondary">{n.body}</span>
                          {!!n.imageUrl && <img src={n.imageUrl} alt="" className="mt-1.5 rounded-lg max-h-24 w-full object-cover" />}
                          <span className="block text-[11px] text-content-muted mt-0.5">{new Date(n.createdAt).toLocaleString()}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
