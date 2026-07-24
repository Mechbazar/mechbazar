import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Bell, Check, Trash2 } from 'lucide-react';
import { Card, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

interface VendorNotification {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export default function Notifications() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = () => {
    axios
      .get(`${API_URL}/customers/notifications`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setNotifications(res.data))
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotifications(); }, [token]);

  const markRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await axios.patch(`${API_URL}/customers/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      fetchNotifications();
    }
  };

  const remove = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await axios.delete(`${API_URL}/customers/notifications/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      fetchNotifications();
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) return <Loader fullScreen />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary" /> Notifications
            {unreadCount > 0 && <span className="text-sm bg-primary text-white rounded-full px-2.5 py-0.5">{unreadCount}</span>}
          </h1>
          <p className="text-neutral-400 mt-1">Approval updates, order alerts and other account activity.</p>
        </div>
      </div>

      {notifications.length === 0 ? (
        <Card variant="dark" className="!rounded-3xl">
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
            <p className="text-neutral-300 font-medium">No notifications yet</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <Card key={n.id} variant="dark" className={`!rounded-2xl !p-4 flex items-start justify-between gap-4 ${!n.isRead ? 'border-primary/40' : ''}`}>
              <div className="flex items-start gap-3">
                {!n.isRead && <span className="w-2 h-2 mt-1.5 rounded-full bg-primary flex-shrink-0" />}
                <div>
                  <p className={`font-semibold ${n.isRead ? 'text-neutral-300' : 'text-white'}`}>{n.title}</p>
                  <p className="text-sm text-neutral-400 mt-0.5">{n.body}</p>
                  <p className="text-xs text-neutral-600 mt-1">{new Date(n.createdAt).toLocaleString('en-IN')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {!n.isRead && (
                  <button onClick={() => markRead(n.id)} title="Mark as read" className="p-2 text-neutral-500 hover:text-success-400 transition-colors">
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => remove(n.id)} title="Delete" className="p-2 text-neutral-500 hover:text-danger-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
