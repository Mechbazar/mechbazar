import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import {
  TrendingUp, Package, ShoppingCart,
  Wallet, ArrowUpRight, Clock, CheckCircle, RefreshCw
} from 'lucide-react';
import { Card, Badge, Loader, Alert } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';
import SalesChart from '../components/SalesChart';

interface DashboardStats {
  totalProducts: number;
  liveProducts: number;
  pendingProducts: number;
  lowStockProducts: number;
  totalOrders: number;
  totalRevenue: number;
  recentRevenue: number;
  walletBalance: number;
  recentOrders: any[];
}

const StatCard = ({ icon: Icon, label, value, sub, color, bg }: any) => (
  <Card variant="dark" className="!rounded-3xl !p-5 flex items-start gap-4">
    <div className={`p-3 rounded-2xl ${bg}`}>
      <Icon className={`w-6 h-6 ${color}`} />
    </div>
    <div>
      <p className="text-sm text-neutral-400 font-medium">{label}</p>
      <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
      {sub && <p className="text-xs text-neutral-500 mt-1">{sub}</p>}
    </div>
  </Card>
);

const statusBadge = (status: string) => {
  const map: any = {
    DELIVERED: { label: 'Delivered', variant: 'success' as const },
    PROCESSING: { label: 'Processing', variant: 'warning' as const },
    SHIPPED: { label: 'Shipped', variant: 'info' as const },
    CANCELLED: { label: 'Cancelled', variant: 'danger' as const },
    PENDING: { label: 'Pending', variant: 'warning' as const },
  };
  const s = map[status] || { label: status, variant: 'neutral' as const };
  return <Badge variant={s.variant} className="!rounded-lg">{s.label}</Badge>;
};

export default function Dashboard() {
  const { token } = useSelector((state: RootState) => state.auth);
  const { vendorProfile } = useSelector((state: RootState) => state.auth);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/vendors/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStats(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, [token]);

  if (loading) return <Loader fullScreen />;

  if (error) return (
    <Alert type="error" message={error} className="!rounded-3xl">
      <button onClick={fetchStats} className="mt-2 text-sm underline text-danger-300">Retry</button>
    </Alert>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-neutral-400 mt-1">Welcome back, <span className="text-primary font-semibold">{vendorProfile?.storeName || 'Seller'}</span></p>
        </div>
        <button onClick={fetchStats} className="flex items-center gap-2 text-neutral-400 hover:text-white border border-neutral-800 hover:border-primary px-3 py-2 rounded-2xl transition-all text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Total Revenue" value={`₹${Number(stats?.totalRevenue || 0).toLocaleString('en-IN')}`} sub={`₹${Number(stats?.recentRevenue || 0).toLocaleString('en-IN')} last 7 days`} color="text-success-300" bg="bg-success-500/10" />
        <StatCard icon={ShoppingCart} label="Total Orders" value={stats?.totalOrders ?? 0} sub="All time" color="text-info-300" bg="bg-info-500/10" />
        <StatCard icon={Package} label="Live Products" value={stats?.liveProducts ?? 0} sub={`${stats?.pendingProducts ?? 0} pending review`} color="text-primary" bg="bg-primary/10" />
        <StatCard icon={Wallet} label="Wallet Balance" value={`₹${Number(stats?.walletBalance || 0).toLocaleString('en-IN')}`} sub="Available to withdraw" color="text-purple-300" bg="bg-purple-400/10" />
      </div>

      {(stats?.lowStockProducts ?? 0) > 0 && (
        <Alert type="warning" title="Low Stock Alert" className="!rounded-3xl !items-center">
          <p className="text-xs">{stats?.lowStockProducts} product(s) are below their low-stock threshold. Update inventory to avoid stockouts.</p>
          <Link to="/inventory" className="inline-block mt-2 text-xs bg-warning-500/20 hover:bg-warning-500/30 text-warning-300 px-3 py-1.5 rounded-2xl font-semibold transition-colors whitespace-nowrap">View Inventory</Link>
        </Alert>
      )}

      <SalesChart />

      <Card variant="dark" className="!rounded-3xl !p-0 overflow-hidden">
        <div className="p-4 border-b border-neutral-800 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-white font-bold flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" /> Recent Orders
          </h2>
          <Link to="/orders" className="text-xs text-primary hover:text-primary/90 font-semibold flex items-center gap-1">View All <ArrowUpRight className="w-3 h-3" /></Link>
        </div>

        {!stats?.recentOrders?.length ? (
          <div className="p-12 text-center">
            <ShoppingCart className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
            <p className="text-neutral-300 font-medium">No orders yet</p>
            <p className="text-neutral-500 text-sm">Orders from your products will appear here</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-900 text-xs text-neutral-400 font-semibold uppercase">
                <th className="p-4">Order ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Items</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {stats.recentOrders.map((order: any) => {
                const orderTotal = order.items.reduce((sum: number, item: any) => sum + Number(item.price) * item.quantity, 0);
                return (
                  <tr key={order.id} className="hover:bg-neutral-900/50 transition-colors">
                    <td className="p-4 text-primary text-sm font-mono">#{order.id.slice(-8).toUpperCase()}</td>
                    <td className="p-4">
                      <p className="text-white text-sm font-medium">{order.user?.name || 'Customer'}</p>
                      <p className="text-neutral-500 text-xs">{order.user?.phone}</p>
                    </td>
                    <td className="p-4 text-sm text-neutral-300">{order.items.length} item(s)</td>
                    <td className="p-4 text-sm font-bold text-white">₹{orderTotal.toLocaleString('en-IN')}</td>
                    <td className="p-4">{statusBadge(order.status)}</td>
                    <td className="p-4 text-xs text-neutral-500">{new Date(order.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { href: '/products', icon: Package, title: 'Add Product', desc: 'List a new product for sale', color: 'text-primary', bg: 'bg-primary/10' },
          { href: '/orders', icon: CheckCircle, title: 'Manage Orders', desc: 'View and update order statuses', color: 'text-success-300', bg: 'bg-success-500/10' },
          { href: '/wallet', icon: Wallet, title: 'Request Payout', desc: 'Withdraw your wallet balance', color: 'text-purple-300', bg: 'bg-purple-400/10' },
        ].map(({ href, icon: Icon, title, desc, color, bg }) => (
          <Link key={href} to={href} className="bg-neutral-950 border border-neutral-800 rounded-3xl p-5 flex items-start gap-4 hover:border-primary/50 group transition-all cursor-pointer">
            <div className={`p-3 rounded-2xl ${bg} group-hover:scale-110 transition-transform`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
              <p className="text-white font-semibold">{title}</p>
              <p className="text-neutral-400 text-xs mt-1">{desc}</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-neutral-500 group-hover:text-primary ml-auto transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}
