import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import type { RootState } from '../../store';
import { ClipboardList, CalendarCheck, IndianRupee, Clock, CheckCircle, XCircle, Wrench, Users, Ban, Star, TrendingUp } from 'lucide-react';
import { Card, Badge, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../../config/api';

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

  const statCards = [
    { title: "Today's Bookings", value: stats.todayBookings, icon: CalendarCheck, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { title: 'Pending Jobs', value: stats.pendingBookings, icon: Clock, color: 'text-warning-500', bg: 'bg-warning-500/10' },
    { title: 'Active Jobs', value: stats.activeBookings, icon: Wrench, color: 'text-primary-500', bg: 'bg-primary-500/10' },
    { title: 'Completed Jobs', value: stats.completedBookings, icon: CheckCircle, color: 'text-success-500', bg: 'bg-success-500/10' },
    { title: 'Cancelled Jobs', value: stats.cancelledBookings, icon: XCircle, color: 'text-danger-500', bg: 'bg-danger-500/10' },
    { title: 'Rejected Jobs', value: stats.rejectedBookings, icon: Ban, color: 'text-danger-400', bg: 'bg-danger-500/10' },
    { title: "Today's Revenue", value: `₹${stats.todayRevenue.toLocaleString()}`, icon: IndianRupee, color: 'text-green-500', bg: 'bg-green-500/10' },
    { title: 'Total Revenue', value: `₹${stats.revenue.toLocaleString()}`, icon: IndianRupee, color: 'text-green-500', bg: 'bg-green-500/10' },
    { title: 'Average Rating', value: stats.averageRating.toFixed(1), icon: Star, color: 'text-warning-400', bg: 'bg-warning-500/10' },
    { title: 'Technicians Online', value: stats.techniciansOnline, icon: Wrench, color: 'text-success-500', bg: 'bg-success-500/10' },
    { title: 'Technicians Offline', value: stats.techniciansOffline, icon: Wrench, color: 'text-neutral-400', bg: 'bg-neutral-500/10' },
    { title: 'Total Customers', value: stats.totalCustomers, icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  ];

  const statusBadgeVariant = (status: string) => {
    if (status === 'COMPLETED') return 'success';
    if (status === 'CANCELLED' || status === 'REJECTED') return 'danger';
    if (status === 'PENDING' || status === 'CONFIRMED') return 'secondary';
    return 'secondary';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {statCards.map((stat, idx) => (
          <Card key={idx} variant="dark">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-neutral-400 text-sm font-medium mb-1">{stat.title}</p>
                <h3 className="text-3xl font-bold text-white">{stat.value}</h3>
              </div>
              <div className={`p-4 rounded-full ${stat.bg}`}>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card variant="dark">
        <h3 className="text-xl font-bold text-white mb-4">Recent Bookings</h3>
        <div className="space-y-4">
          {recentBookings.length === 0 ? (
            <p className="text-neutral-400 text-sm">No service bookings yet.</p>
          ) : (
            recentBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary-500/10 p-2 text-primary-500">
                    <ClipboardList className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-white">#{b.bookingNumber}</p>
                    <p className="text-sm text-neutral-400">{b.package?.name} • {b.user?.name || 'Unknown'} • ₹{b.finalAmount}</p>
                  </div>
                </div>
                <Badge variant={statusBadgeVariant(b.status)}>{b.status.replace(/_/g, ' ')}</Badge>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="dark">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary-500" /> Top Services</h3>
          <div className="space-y-3">
            {stats.topServices.length === 0 ? (
              <p className="text-neutral-400 text-sm">No completed bookings yet.</p>
            ) : (
              stats.topServices.map((s) => (
                <div key={s.packageId} className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                  <div>
                    <p className="font-bold text-white">{s.name}</p>
                    <p className="text-sm text-neutral-400">{s.bookings} booking{s.bookings === 1 ? '' : 's'}</p>
                  </div>
                  <p className="text-primary-500 font-bold">₹{s.revenue.toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card variant="dark">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Wrench className="w-5 h-5 text-primary-500" /> Top Mechanics</h3>
          <div className="space-y-3">
            {stats.topMechanics.length === 0 ? (
              <p className="text-neutral-400 text-sm">No completed jobs yet.</p>
            ) : (
              stats.topMechanics.map((m) => (
                <div key={m.technicianId} className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                  <div>
                    <p className="font-bold text-white">{m.name}</p>
                    <p className="text-sm text-neutral-400 flex items-center gap-1"><Star className="w-3 h-3 text-warning-400" /> {m.rating.toFixed(1)}</p>
                  </div>
                  <p className="text-white font-bold">{m.completedJobs} job{m.completedJobs === 1 ? '' : 's'}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
