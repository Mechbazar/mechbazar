import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { motion } from 'framer-motion';
import type { RootState } from '../../store';
import { ClipboardList, TrendingUp, Wrench, Star } from 'lucide-react';
import { Card, Badge, Loader, StatCard, Icon3D } from '../../components/ui';
import { API_URL } from '../../config/api';
import { fadeInUp } from '../../utils/motion';

interface DashboardStats {
  totalBookings: number;
  todayBookings: number;
  pendingBookings: number;
  activeBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  rejectedBookings: number;
  revenue: number;
  todayRevenue: number;
  techniciansOnline: number;
  techniciansOffline: number;
  totalCustomers: number;
  averageRating: number;
  topServices: { packageId: string; name: string; bookings: number; revenue: number }[];
  topMechanics: { technicianId: string | null; name: string; rating: number; completedJobs: number }[];
}

export default function ServicesDashboard() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [statsRes, bookingsRes] = await Promise.all([
          axios.get(`${API_URL}/services/dashboard`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/services/bookings/all`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setStats(statsRes.data);
        setRecentBookings(bookingsRes.data.slice(0, 5));
      } catch (err) {
        console.error('Failed to fetch services dashboard', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading || !stats) {
    return <Loader fullScreen />;
  }

  const statusBadgeVariant = (status: string): 'success' | 'danger' | 'secondary' => {
    if (status === 'COMPLETED') return 'success';
    if (status === 'CANCELLED' || status === 'REJECTED') return 'danger';
    return 'secondary';
  };

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-content-primary tracking-tight flex items-center gap-3">
          <Icon3D name="service_catalog" size={28} eager /> Services Overview
        </h2>
        <p className="text-content-secondary mt-1 text-sm">Live snapshot of bookings, revenue, and mechanic performance</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard title="Today's Bookings" value={stats.todayBookings} icon="bookings" gradient="blue" />
        <StatCard title="Pending Jobs" value={stats.pendingBookings} icon="bell" gradient="amber" />
        <StatCard title="Active Jobs" value={stats.activeBookings} icon="mechanics" gradient="indigo" />
        <StatCard title="Completed Jobs" value={stats.completedBookings} icon="check" gradient="green" />
        <StatCard title="Cancelled Jobs" value={stats.cancelledBookings} icon="shield" gradient="red" />
        <StatCard title="Rejected Jobs" value={stats.rejectedBookings} icon="audit" gradient="red" />
        <StatCard title="Today's Revenue" value={stats.todayRevenue} valuePrefix="₹" icon="revenue" gradient="green" />
        <StatCard title="Total Revenue" value={stats.revenue} valuePrefix="₹" icon="payouts" gradient="green" />

        <Card className="relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-content-secondary truncate">Average Rating</p>
              <p className="mt-2 text-2xl font-bold text-content-primary tabular-nums flex items-center gap-1.5">
                {stats.averageRating.toFixed(1)}
                <Star size={16} className="text-warning-400 fill-warning-400" />
              </p>
            </div>
            <div className="shrink-0 h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center shadow-card">
              <Icon3D name="star" size={28} eager />
            </div>
          </div>
        </Card>

        <StatCard title="Technicians Online" value={stats.techniciansOnline} icon="mechanics" gradient="green" />
        <StatCard title="Technicians Offline" value={stats.techniciansOffline} icon="mechanics" gradient="indigo" />
        <StatCard title="Total Customers" value={stats.totalCustomers} icon="customers" gradient="purple" />
      </div>

      <Card>
        <h3 className="text-lg font-bold text-content-primary mb-4 flex items-center gap-2">
          <ClipboardList size={18} className="text-brand-primary" /> Recent Bookings
        </h3>
        <div className="space-y-3">
          {recentBookings.length === 0 ? (
            <p className="text-content-muted text-sm">No service bookings yet.</p>
          ) : (
            recentBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-4 rounded-xl border border-border-default bg-surface-sunken p-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-brand-primary/10 p-2 text-brand-primary">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-content-primary">#{b.bookingNumber}</p>
                    <p className="text-sm text-content-muted">{b.package?.name} · {b.user?.name || 'Unknown'} · ₹{b.finalAmount}</p>
                  </div>
                </div>
                <Badge variant={statusBadgeVariant(b.status)}>{b.status.replace(/_/g, ' ')}</Badge>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="text-lg font-bold text-content-primary mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-brand-primary" /> Top Services
          </h3>
          <div className="space-y-3">
            {stats.topServices.length === 0 ? (
              <p className="text-content-muted text-sm">No completed bookings yet.</p>
            ) : (
              stats.topServices.map((s) => (
                <div key={s.packageId} className="flex items-center justify-between gap-4 rounded-xl border border-border-default bg-surface-sunken p-4">
                  <div>
                    <p className="font-bold text-content-primary">{s.name}</p>
                    <p className="text-sm text-content-muted">{s.bookings} booking{s.bookings === 1 ? '' : 's'}</p>
                  </div>
                  <p className="text-brand-primary font-bold">₹{s.revenue.toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-bold text-content-primary mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-brand-primary" /> Top Mechanics
          </h3>
          <div className="space-y-3">
            {stats.topMechanics.length === 0 ? (
              <p className="text-content-muted text-sm">No completed jobs yet.</p>
            ) : (
              stats.topMechanics.map((m) => (
                <div key={m.technicianId} className="flex items-center justify-between gap-4 rounded-xl border border-border-default bg-surface-sunken p-4">
                  <div>
                    <p className="font-bold text-content-primary">{m.name}</p>
                    <p className="text-sm text-content-muted flex items-center gap-1">
                      <Star className="w-3 h-3 text-warning-400" /> {m.rating.toFixed(1)}
                    </p>
                  </div>
                  <p className="text-content-primary font-bold">{m.completedJobs} job{m.completedJobs === 1 ? '' : 's'}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
