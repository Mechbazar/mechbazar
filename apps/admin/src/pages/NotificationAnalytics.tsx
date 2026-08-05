import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import { Card, StatCard, Icon3D, Loader } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';

interface Analytics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  deliveryRate: number;
  ctr: number;
  byCategory: Record<string, number>;
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const CATEGORY_LABEL: Record<string, string> = {
  ORDERS: 'Orders',
  SERVICES: 'Services',
  PAYMENTS: 'Payments',
  OFFERS: 'Offers',
  COUPONS: 'Coupons',
  ACCOUNT: 'Account',
  MECHANIC_UPDATES: 'Mechanic Updates',
  RIDER_UPDATES: 'Rider Updates',
  VENDOR_UPDATES: 'Vendor Updates',
  SYSTEM: 'System',
};

// Backs GET /api/admin/notifications/analytics -- built on the delivery/
// engagement columns notify.ts and customer.controller.ts's markNotification
// Read/Opened write (see Notification.deliveryStatus/deliveredAt/openedAt/
// clickedAt in the schema).
export default function NotificationAnalytics() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [from, setFrom] = useState(toInputDate(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(toInputDate(today));

  const fetchAnalytics = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/admin/notifications/analytics`, {
        params: { from, to },
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const maxCategoryCount = data ? Math.max(1, ...Object.values(data.byCategory)) : 1;

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
          <Icon3D name="reports" size={30} eager /> Notification Analytics
        </h1>
        <p className="text-content-secondary mt-1 text-sm">Delivery and engagement across every notification sent on the platform.</p>
      </div>

      <Card className="no-print">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1.5">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to}
              className="bg-surface-sunken border border-border-default rounded-xl px-3 py-2 text-sm text-content-primary outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/20" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-content-muted mb-1.5">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from} max={toInputDate(today)}
              className="bg-surface-sunken border border-border-default rounded-xl px-3 py-2 text-sm text-content-primary outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/20" />
          </div>
          <button onClick={fetchAnalytics} className="px-4 py-2 text-sm font-semibold rounded-xl bg-brand-primary text-white hover:bg-brand-accent transition-colors">
            Apply
          </button>
        </div>
      </Card>

      {loading ? (
        <Loader fullScreen />
      ) : !data ? (
        <Card><p className="text-content-muted text-sm text-center py-8">Failed to load analytics.</p></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard title="Sent" value={data.sent} icon="bell" gradient="red" />
            <StatCard title="Delivered" value={data.delivered} icon="check" gradient="green" trend={data.deliveryRate} trendLabel="delivery rate" />
            <StatCard title="Opened" value={data.opened} icon="search" gradient="blue" />
            <StatCard title="Clicked" value={data.clicked} icon="trophy" gradient="purple" trend={data.ctr} trendLabel="CTR" />
            <StatCard title="Failed" value={data.failed} icon="shield" gradient="amber" />
            <StatCard title="Delivery Rate" value={data.deliveryRate} valueSuffix="%" icon="revenue" gradient="indigo" />
          </div>

          <Card>
            <h2 className="text-base font-bold text-content-primary mb-4">By Category</h2>
            <div className="space-y-3">
              {(Object.entries(data.byCategory) as [string, number][])
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => (
                  <div key={category} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-sm text-content-secondary">{CATEGORY_LABEL[category] || category}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-surface-hover overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-primary"
                        style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-sm font-semibold text-content-primary tabular-nums">{count}</span>
                  </div>
                ))}
              {Object.keys(data.byCategory).length === 0 && (
                <p className="text-content-muted text-sm text-center py-4">No notifications in this range.</p>
              )}
            </div>
          </Card>
        </>
      )}
    </motion.div>
  );
}
