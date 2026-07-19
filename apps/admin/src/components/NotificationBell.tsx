import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Bell } from 'lucide-react';
import { API_URL } from '../config/api';

const POLL_INTERVAL_MS = 20000;

// Reuses the existing generic notifications endpoint (mounted under
// /api/customers, not /api/admin -- it's keyed purely on the authenticated
// user's own id via the JWT, which works identically for an admin-role user
// as it does for a customer). No new backend route needed for this bell.
export default function NotificationBell() {
  const { token } = useSelector((state: RootState) => state.auth);
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
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markRead = async (id: string) => {
    try {
      await axios.patch(`${API_URL}/customers/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (error) {
      console.error('Failed to mark notification read', error);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full text-neutral-500 hover:text-primary hover:bg-neutral-100 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg z-50">
          <div className="p-3 border-b border-neutral-100 font-semibold text-sm text-neutral-700">Notifications</div>
          {notifications.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500 text-center">No notifications yet.</p>
          ) : (
            notifications.slice(0, 30).map((n) => (
              <button
                key={n.id}
                onClick={() => markRead(n.id)}
                className={`w-full text-left px-4 py-3 border-b border-neutral-50 hover:bg-neutral-50 transition-colors ${n.isRead ? 'opacity-60' : ''}`}
              >
                <p className="text-sm font-semibold text-neutral-800">{n.title}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{n.body}</p>
                <p className="text-[10px] text-neutral-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
