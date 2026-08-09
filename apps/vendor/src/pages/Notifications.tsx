import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../store';
import { Bell, Check, CheckCheck, Trash2, Search } from 'lucide-react';
import { Card, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';
import { resolveNotificationRoute } from '../utils/notificationDeepLink';

interface VendorNotification {
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

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'ORDERS', label: 'Orders' },
  { key: 'PAYMENTS', label: 'Payments' },
  { key: 'VENDOR_UPDATES', label: 'Account' },
  { key: 'SYSTEM', label: 'System' },
];

export default function Notifications() {
  const { token } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('ALL');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timeout);
  }, [search]);

  const fetchPage = useCallback(
    (reset: boolean, cursor?: string | null) => {
      reset ? setLoading(true) : setLoadingMore(true);
      const params: Record<string, string> = { limit: '20' };
      if (cursor) params.cursor = cursor;
      if (debouncedSearch.trim()) params.q = debouncedSearch.trim();
      if (category !== 'ALL') params.category = category;
      axios
        .get(`${API_URL}/customers/notifications`, { headers: { Authorization: `Bearer ${token}` }, params })
        .then((res) => {
          setNotifications((prev) => (reset ? res.data.items : [...prev, ...res.data.items]));
          setNextCursor(res.data.nextCursor);
        })
        .catch(() => reset && setNotifications([]))
        .finally(() => {
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [token, debouncedSearch, category]
  );

  useEffect(() => {
    fetchPage(true);
  }, [fetchPage]);

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await axios.patch(`${API_URL}/customers/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      fetchPage(true);
    }
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await axios.patch(`${API_URL}/customers/notifications/read-all`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      fetchPage(true);
    }
  };

  const remove = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await axios.delete(`${API_URL}/customers/notifications/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      fetchPage(true);
    }
  };

  const openNotification = (n: VendorNotification) => {
    if (!n.isRead) markRead(n.id);
    axios.post(`${API_URL}/customers/notifications/${n.id}/opened`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    const target = resolveNotificationRoute(n);
    if (target) navigate(target.path);
  };

  const openAction = (deepLink: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (/^(https?:|tel:|mailto:)/i.test(deepLink)) window.open(deepLink, '_blank', 'noopener,noreferrer');
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) return <Loader fullScreen />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-content-primary flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary" /> Notifications
            {unreadCount > 0 && <span className="text-sm bg-primary text-white rounded-full px-2.5 py-0.5">{unreadCount}</span>}
          </h1>
          <p className="text-content-secondary mt-1">Approval updates, order alerts and other account activity.</p>
        </div>
        <button
          onClick={markAllRead}
          className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
        >
          <CheckCheck className="w-4 h-4" /> Mark all read
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-content-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notifications"
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-surface-sunken border border-border-default text-content-primary placeholder-content-muted text-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                category === c.key ? 'bg-primary text-white' : 'bg-surface-sunken text-content-secondary hover:bg-surface-hover'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card variant="dark" className="!rounded-3xl">
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-content-muted mx-auto mb-3" />
            <p className="text-content-secondary font-medium">No notifications yet</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card
              key={n.id}
              variant="dark"
              className={`!rounded-2xl !p-4 flex items-start justify-between gap-4 cursor-pointer ${!n.isRead ? 'border-primary/40' : ''}`}
              onClick={() => openNotification(n)}
            >
              <div className="flex items-start gap-3 min-w-0">
                {!n.isRead && <span className="w-2 h-2 mt-1.5 rounded-full bg-primary flex-shrink-0" />}
                <div className="min-w-0">
                  <p className={`font-semibold ${n.isRead ? 'text-content-secondary' : 'text-content-primary'}`}>{n.title}</p>
                  <p className="text-sm text-content-secondary mt-0.5">{n.body}</p>
                  {!!n.imageUrl && <img src={n.imageUrl} alt="" className="mt-2 rounded-lg max-h-40 object-cover" />}
                  {!!n.actions?.length && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {n.actions.map((action, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => openAction(action.deepLink, e)}
                          className="px-3 py-1 rounded-full border border-primary text-primary text-xs font-semibold hover:bg-primary/10 transition-colors"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-content-muted mt-1">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!n.isRead && (
                  <button onClick={(e) => { e.stopPropagation(); markRead(n.id); }} title="Mark as read" className="p-2 text-content-muted hover:text-success-400 transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); remove(n.id); }} title="Delete" className="p-2 text-content-muted hover:text-danger-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
          {nextCursor && (
            <div className="text-center pt-2">
              <button
                onClick={() => fetchPage(false, nextCursor)}
                disabled={loadingMore}
                className="px-4 py-2 rounded-xl bg-surface-sunken text-content-secondary text-sm font-medium hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
