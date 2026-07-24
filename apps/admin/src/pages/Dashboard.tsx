import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Package, ShoppingBag, DollarSign, Activity, TrendingUp, AlertCircle, ClipboardList, Wrench, CheckCircle, XCircle, Clock, UserPlus, Navigation as NavigationIcon } from 'lucide-react';
import axios from 'axios';
import { Card, Badge } from '@mechbazar/shared/web';
import { API_URL, SERVER_ORIGIN } from '../config/api';
import RevenueChart from '../components/RevenueChart';

export default function Dashboard() {
  const [stats, setStats] = useState({
    users: 0,
    orders: 0,
    products: 0,
    revenue: 0,
    vendors: 0,
    lowStock: 0
  });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [serviceStats, setServiceStats] = useState<any | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        const res = await axios.get(`${API_URL}/admin/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setStats(res.data.stats);
        setRecentOrders(res.data.recentOrders || []);
        setTopProducts(res.data.topSellingProducts || []);
      } catch (err) {
        console.error('Failed to fetch dashboard stats', err);
      }
    };
    const fetchServiceStats = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        const res = await axios.get(`${API_URL}/services/dashboard`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setServiceStats(res.data);
      } catch (err) {
        console.error('Failed to fetch service dashboard stats', err);
      }
    };
    fetchStats();
    fetchServiceStats();
  }, []);

  const statCards = [
    // No dedicated finance/analytics page exists yet, so this card is informational only --
    // it previously linked to "/finance", a route that isn't registered in App.tsx and
    // silently bounced back to this same dashboard via the catch-all redirect.
    { title: "Today's Sales", value: `₹${stats.revenue.toLocaleString()}`, icon: DollarSign, color: "text-green-500", bg: "bg-green-500/10", link: null },
    { title: "Pending Orders", value: stats.orders, icon: Package, color: "text-brand-primary", bg: "bg-brand-primary/10", link: "/orders?status=PENDING" },
    { title: "Total Customers", value: stats.users, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", link: "/customers" },
    { title: "Total Vendors", value: stats.vendors, icon: Activity, color: "text-purple-500", bg: "bg-purple-500/10", link: "/vendors" },
    { title: "Inventory Count", value: stats.products, icon: ShoppingBag, color: "text-indigo-500", bg: "bg-indigo-500/10", link: "/products" },
    { title: "Low Stock Items", value: stats.lowStock, icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", link: "/inventory" },
  ];

  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard Overview</h1>
          <p className="text-neutral-400 mt-1">Welcome back, Super Admin</p>
        </div>
        <button
          onClick={() => navigate('/reports')}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
        >
          <TrendingUp className="w-4 h-4" />
          View Reports
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, idx) => (
          <Card
            key={idx}
            variant="dark"
            onClick={stat.link ? () => navigate(stat.link!) : undefined}
            className={stat.link ? 'cursor-pointer' : ''}
          >
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

      <RevenueChart />

      {serviceStats && (
        <Card variant="dark" onClick={() => navigate('/service-bookings')} className="cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary-500" /> Service Bookings</h3>
            <span className="text-sm font-medium text-primary-500">View Details →</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-neutral-400 text-xs">Total Bookings</p>
              <p className="text-2xl font-bold text-white">{serviceStats.totalBookings}</p>
            </div>
            <div>
              <p className="text-neutral-400 text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</p>
              <p className="text-2xl font-bold text-white">{serviceStats.pendingBookings}</p>
            </div>
            <div>
              <p className="text-neutral-400 text-xs flex items-center gap-1"><UserPlus className="w-3 h-3" /> Assigned</p>
              <p className="text-2xl font-bold text-white">{serviceStats.assignedBookings}</p>
            </div>
            <div>
              <p className="text-neutral-400 text-xs flex items-center gap-1"><Wrench className="w-3 h-3" /> In Progress</p>
              <p className="text-2xl font-bold text-white">{serviceStats.inProgressBookings}</p>
            </div>
            <div>
              <p className="text-neutral-400 text-xs flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Completed</p>
              <p className="text-2xl font-bold text-white">{serviceStats.completedBookings}</p>
            </div>
            <div>
              <p className="text-neutral-400 text-xs flex items-center gap-1"><XCircle className="w-3 h-3" /> Cancelled</p>
              <p className="text-2xl font-bold text-white">{serviceStats.cancelledBookings}</p>
            </div>
            <div>
              <p className="text-neutral-400 text-xs">Today's Revenue</p>
              <p className="text-2xl font-bold text-white">₹{serviceStats.todayRevenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-neutral-400 text-xs flex items-center gap-1"><NavigationIcon className="w-3 h-3" /> Available Mechanics</p>
              <p className="text-2xl font-bold text-white">{serviceStats.availableMechanics}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="dark">
          <h3 className="text-xl font-bold text-white mb-4">Recent Orders</h3>
          <div className="space-y-4">
            {recentOrders.length === 0 ? (
              <p className="text-neutral-400 text-sm">No recent orders found.</p>
            ) : (
              recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-primary-500/10 p-2 text-primary-500">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-white">Order #{order.id.slice(-6).toUpperCase()}</p>
                      <p className="text-sm text-neutral-400">{order.items?.length || 0} items • ₹{order.finalAmount?.toLocaleString()}</p>
                    </div>
                  </div>
                  <Badge variant={order.status === 'DELIVERED' ? 'success' : order.status === 'CANCELLED' ? 'danger' : 'warning'}>
                    {order.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card variant="dark">
          <h3 className="text-xl font-bold text-white mb-4">Top Selling Products</h3>
          <div className="space-y-4">
            {topProducts.length === 0 ? (
              <p className="text-neutral-400 text-sm">No sales data available yet.</p>
            ) : (
              topProducts.map((product) => (
                <div key={product.id} className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
                  <div className="flex items-center gap-4 overflow-hidden">
                    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-neutral-800 border border-neutral-800">
                      {product.images && product.images[0] ? (
                        <img src={`${SERVER_ORIGIN}${product.images[0]}`} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-neutral-400" />
                      )}
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <p className="truncate text-white font-bold">{product.name}</p>
                      <p className="truncate text-sm text-neutral-400">{product.vendor?.storeName || 'MechBazar'} • {product._count?.orderItems || 0} Sales</p>
                    </div>
                  </div>
                  <span className="text-primary-500 font-bold">₹{product.price?.toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
