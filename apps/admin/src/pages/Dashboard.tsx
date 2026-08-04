import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Plus, Store, Wrench, Tag, PackageSearch, Megaphone, Target, ChevronRight,
  Clock, CheckCircle, XCircle, UserPlus, Navigation as NavigationIcon, Radio,
} from 'lucide-react';
import type { RootState } from '../store';
import { API_URL, resolveUploadUrl } from '../config/api';
import { getAdminSocket } from '../services/adminRealtime';
import {
  Card, Button, Badge, Modal, Input, Select, EmptyState, StatCard, Tabs, Icon3D, AnimatedCounter,
} from '../components/ui';
import type { TabItem } from '../components/ui';
import { staggerContainer, staggerItem } from '../utils/motion';

const RANGE_OPTIONS: TabItem[] = [
  { id: '7', label: '7D' },
  { id: '30', label: '30D' },
  { id: '90', label: '90D' },
  { id: '365', label: '1Y' },
];

const METRICS: { id: string; label: string; endpoint: string; dataKey: string; color: string; prefix?: string }[] = [
  { id: 'revenue', label: 'Revenue', endpoint: 'revenue-chart', dataKey: 'revenue', color: '#DA3830', prefix: '₹' },
  { id: 'orders', label: 'Orders', endpoint: 'revenue-chart', dataKey: 'orders', color: '#3B82F6' },
  { id: 'bookings', label: 'Service Bookings', endpoint: 'bookings-chart', dataKey: 'bookings', color: '#F59E0B' },
  { id: 'vendor-earnings', label: 'Vendor Earnings', endpoint: 'vendor-earnings-chart', dataKey: 'revenue', color: '#8B5CF6', prefix: '₹' },
  { id: 'customer-growth', label: 'Customer Growth', endpoint: 'customer-growth-chart', dataKey: 'cumulative', color: '#10B981' },
];

const BROADCAST_AUDIENCES = [
  { value: 'ALL_CUSTOMERS', label: 'All Customers' },
  { value: 'ALL_VENDORS', label: 'All Vendors' },
  { value: 'ALL_TECHNICIANS', label: 'All Mechanics' },
  { value: 'ALL_RIDERS', label: 'All Riders' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { token, user } = useSelector((state: RootState) => state.auth);
  const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, orders: 0, products: 0, revenue: 0, vendors: 0, lowStock: 0 });
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [serviceStats, setServiceStats] = useState<any | null>(null);

  const [revenueTarget, setRevenueTarget] = useState<{ target: number; monthToDateRevenue: number } | null>(null);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<{ vendors: any[]; technicians: any[]; products: any[] }>({ vendors: [], technicians: [], products: [] });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);

  const [activeMetric, setActiveMetric] = useState('revenue');
  const [activeRange, setActiveRange] = useState('30');
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const [activity, setActivity] = useState<{ id: string; title: string; body: string; createdAt: string }[]>([]);

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ title: '', body: '', audience: 'ALL_CUSTOMERS' });
  const [broadcastSending, setBroadcastSending] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [dashRes, serviceRes, targetRes, leaderboardRes, vendorsPending, techPending, productsPending, inventoryRes] = await Promise.all([
          axios.get(`${API_URL}/admin/dashboard`, authHeaders),
          axios.get(`${API_URL}/services/dashboard`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/admin/settings/revenue-target`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/vendors/leaderboard?days=30&limit=5`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/vendors?status=UNDER_VERIFICATION`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/technicians?status=UNDER_VERIFICATION`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/products?status=PENDING`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/inventory`, authHeaders).catch(() => null),
        ]);

        setStats(dashRes.data.stats);
        setRecentOrders(dashRes.data.recentOrders || []);
        setTopProducts(dashRes.data.topSellingProducts || []);
        if (serviceRes) setServiceStats(serviceRes.data);
        if (targetRes) setRevenueTarget(targetRes.data);
        if (leaderboardRes) setLeaderboard(leaderboardRes.data || []);
        setPendingApprovals({
          vendors: vendorsPending?.data || [],
          technicians: techPending?.data || [],
          products: (productsPending?.data?.products || productsPending?.data) ?? [],
        });
        if (inventoryRes) {
          const low = (inventoryRes.data || [])
            .filter((inv: any) => inv.availableStock <= inv.reorderLevel)
            .sort((a: any, b: any) => a.availableStock - b.availableStock)
            .slice(0, 5);
          setLowStockItems(low);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const metric = METRICS.find((m) => m.id === activeMetric)!;
    setChartLoading(true);
    axios
      .get(`${API_URL}/admin/dashboard/${metric.endpoint}?days=${activeRange}`, authHeaders)
      .then((res) => setChartData(res.data))
      .catch((err) => console.error('Failed to fetch analytics chart', err))
      .finally(() => setChartLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMetric, activeRange, token]);

  useEffect(() => {
    const socket = getAdminSocket();
    const onNotification = (payload: any) => {
      setActivity((prev) => [
        { id: payload.id || `${Date.now()}`, title: payload.title, body: payload.body, createdAt: payload.createdAt || new Date().toISOString() },
        ...prev,
      ].slice(0, 20));
    };
    socket.on('notification', onNotification);
    return () => { socket.off('notification', onNotification); };
  }, []);

  const openTargetModal = () => {
    setTargetInput(revenueTarget?.target ? String(revenueTarget.target) : '');
    setTargetModalOpen(true);
  };

  const saveTarget = async () => {
    const value = Number(targetInput);
    if (!Number.isFinite(value) || value < 0) { toast.error('Enter a valid amount'); return; }
    try {
      await axios.put(`${API_URL}/admin/settings/revenue-target`, { target: value }, authHeaders);
      setRevenueTarget((prev) => ({ target: value, monthToDateRevenue: prev?.monthToDateRevenue || 0 }));
      setTargetModalOpen(false);
      toast.success('Revenue target updated');
    } catch {
      toast.error('Failed to update target');
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastForm.title.trim() || !broadcastForm.body.trim()) { toast.error('Title and message are required'); return; }
    setBroadcastSending(true);
    try {
      const res = await axios.post(`${API_URL}/admin/notifications/broadcast`, broadcastForm, authHeaders);
      toast.success(`Sent to ${res.data.sent} recipients`);
      setBroadcastOpen(false);
      setBroadcastForm({ title: '', body: '', audience: 'ALL_CUSTOMERS' });
    } catch {
      toast.error('Failed to send notification');
    } finally {
      setBroadcastSending(false);
    }
  };

  const quickActions = [
    { label: 'Add Vendor', icon: Store, onClick: () => navigate('/vendors?action=create') },
    { label: 'Add Mechanic', icon: Wrench, onClick: () => navigate('/mechanics?action=create') },
    { label: 'Create Coupon', icon: Tag, onClick: () => navigate('/coupons?action=create') },
    { label: 'Review Products', icon: PackageSearch, onClick: () => navigate('/products') },
    { label: 'Send Notification', icon: Megaphone, onClick: () => setBroadcastOpen(true) },
  ];

  const activeMetricMeta = METRICS.find((m) => m.id === activeMetric)!;
  const targetProgress = revenueTarget?.target ? Math.min(100, (revenueTarget.monthToDateRevenue / revenueTarget.target) * 100) : 0;
  const pendingApprovalsCount = pendingApprovals.vendors.length + pendingApprovals.technicians.length + pendingApprovals.products.length;
  const pendingOrdersList = recentOrders.filter((o) => !['DELIVERED', 'CANCELLED'].includes(o.status)).slice(0, 5);

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6 max-w-[1600px]">
      {/* Hero */}
      <motion.div variants={staggerItem}>
        <Card variant="glass" padding="lg" className="relative overflow-hidden">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-content-secondary">Welcome back,</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-content-primary mt-0.5">
                {user?.name || 'Admin'} <span className="text-content-muted font-medium text-lg">· {user?.role?.replace(/_/g, ' ')}</span>
              </h1>
              <div className="flex flex-wrap gap-6 mt-4">
                <div>
                  <p className="text-xs text-content-muted">Today's Revenue</p>
                  <p className="text-xl font-bold text-content-primary"><AnimatedCounter value={stats.revenue} prefix="₹" /></p>
                </div>
                <div>
                  <p className="text-xs text-content-muted">Pending Orders</p>
                  <p className="text-xl font-bold text-content-primary"><AnimatedCounter value={stats.orders} /></p>
                </div>
                <div className="min-w-[12rem]">
                  <button onClick={openTargetModal} className="flex items-center gap-1.5 text-xs text-content-muted hover:text-content-primary transition-colors">
                    <Target size={12} /> Monthly Target · Edit
                  </button>
                  <div className="mt-1.5 h-2 w-48 rounded-full bg-surface-hover overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary"
                      initial={{ width: 0 }}
                      animate={{ width: `${targetProgress}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-content-secondary">
                    ₹{(revenueTarget?.monthToDateRevenue || 0).toLocaleString('en-IN')} of ₹{(revenueTarget?.target || 0).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border-default bg-surface-card px-3 py-3.5 hover:border-brand-primary/40 hover:-translate-y-0.5 transition-all shadow-card"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                  <action.icon size={17} />
                </span>
                <span className="text-xs font-semibold text-content-primary text-center leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* KPI Grid */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard loading={loading} title="Today's Sales" value={stats.revenue} valuePrefix="₹" icon="revenue" gradient="red" onClick={() => navigate('/reports')} />
        <StatCard loading={loading} title="Pending Orders" value={stats.orders} icon="orders" gradient="blue" onClick={() => navigate('/orders?status=PENDING')} />
        <StatCard loading={loading} title="Total Customers" value={stats.users} icon="customers" gradient="green" onClick={() => navigate('/customers')} />
        <StatCard loading={loading} title="Total Vendors" value={stats.vendors} icon="vendors" gradient="purple" onClick={() => navigate('/vendors')} />
        <StatCard loading={loading} title="Inventory Count" value={stats.products} icon="warehouses" gradient="indigo" onClick={() => navigate('/products')} />
        <StatCard loading={loading} title="Low Stock Items" value={stats.lowStock} icon="check" gradient="amber" onClick={() => navigate('/inventory')} />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Analytics */}
          <motion.div variants={staggerItem}>
            <Card padding="md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <Tabs tabs={METRICS.map((m) => ({ id: m.id, label: m.label }))} value={activeMetric} onChange={setActiveMetric} layoutId="metric-tabs" />
                <Tabs tabs={RANGE_OPTIONS} value={activeRange} onChange={setActiveRange} layoutId="range-tabs" />
              </div>
              <div className="h-64">
                {chartLoading ? (
                  <div className="h-full w-full animate-pulse rounded-xl bg-surface-hover" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="dashboardMetricFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={activeMetricMeta.color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={activeMetricMeta.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--content-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--content-muted)' }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip
                        contentStyle={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-default)', borderRadius: 12, fontSize: 12 }}
                        formatter={(value) => [activeMetricMeta.prefix ? `₹${Number(value).toLocaleString('en-IN')}` : value, activeMetricMeta.label] as [string | number, string]}
                      />
                      <Area type="monotone" dataKey={activeMetricMeta.dataKey} stroke={activeMetricMeta.color} strokeWidth={2} fill="url(#dashboardMetricFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Service bookings snapshot */}
          {serviceStats && (
            <motion.div variants={staggerItem}>
              <Card hover onClick={() => navigate('/service-bookings')}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-content-primary flex items-center gap-2">
                    <Icon3D name="bookings" size={24} /> Service Bookings
                  </h3>
                  <ChevronRight size={16} className="text-content-muted" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total', value: serviceStats.totalBookings },
                    { label: 'Pending', value: serviceStats.pendingBookings, icon: Clock },
                    { label: 'Assigned', value: serviceStats.assignedBookings, icon: UserPlus },
                    { label: 'In Progress', value: serviceStats.inProgressBookings, icon: Wrench },
                    { label: 'Completed', value: serviceStats.completedBookings, icon: CheckCircle },
                    { label: 'Cancelled', value: serviceStats.cancelledBookings, icon: XCircle },
                    { label: "Today's Revenue", value: `₹${serviceStats.todayRevenue?.toLocaleString('en-IN')}` },
                    { label: 'Available Mechanics', value: serviceStats.availableMechanics, icon: NavigationIcon },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className="text-content-muted text-xs flex items-center gap-1">{s.icon && <s.icon size={12} />} {s.label}</p>
                      <p className="text-lg font-bold text-content-primary">{s.value}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* Recent Orders + Top Products */}
          <div className="grid gap-6 lg:grid-cols-2">
            <motion.div variants={staggerItem}>
              <Card padding="md">
                <h3 className="text-base font-bold text-content-primary mb-4">Recent Orders</h3>
                {recentOrders.length === 0 ? (
                  <EmptyState icon="orders" title="No recent orders" description="New orders will show up here as they come in." />
                ) : (
                  <div className="space-y-2.5">
                    {recentOrders.map((order) => (
                      <div key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-sunken p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="rounded-lg bg-brand-primary/10 p-2 text-brand-primary shrink-0"><Icon3D name="orders" size={18} /></span>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-content-primary truncate">Order #{order.id.slice(-6).toUpperCase()}</p>
                            <p className="text-xs text-content-muted">{order.items?.length || 0} items · ₹{order.finalAmount?.toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                        <Badge variant={order.status === 'DELIVERED' ? 'success' : order.status === 'CANCELLED' ? 'danger' : 'warning'} size="sm">{order.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card padding="md">
                <h3 className="text-base font-bold text-content-primary mb-4">Top Selling Products</h3>
                {topProducts.length === 0 ? (
                  <EmptyState icon="orders" title="No sales yet" description="Best-selling products will be ranked here." />
                ) : (
                  <div className="space-y-2.5">
                    {topProducts.map((product) => (
                      <div key={product.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-default bg-surface-sunken p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-surface-hover border border-border-default shrink-0">
                            {product.images?.[0] ? (
                              <img src={resolveUploadUrl(product.images[0])} alt={product.name} className="h-full w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              <Icon3D name="orders" size={18} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-content-primary">{product.name}</p>
                            <p className="truncate text-xs text-content-muted">{product.vendor?.storeName || 'MechBazar'} · {product._count?.orderItems || 0} sales</p>
                          </div>
                        </div>
                        <span className="text-brand-primary font-bold text-sm shrink-0">₹{product.price?.toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          </div>

          {/* Widgets grid */}
          <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card padding="md" hover onClick={() => navigate('/vendors')}>
              <h3 className="text-sm font-bold text-content-primary mb-3 flex items-center gap-2"><Icon3D name="trophy" size={20} /> Vendor Leaderboard</h3>
              {leaderboard.length === 0 ? (
                <p className="text-xs text-content-muted">No vendor sales in the last 30 days.</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((v, i) => (
                    <div key={v.vendorId} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-5 text-content-muted text-xs font-semibold">#{i + 1}</span>
                        <span className="truncate text-content-primary font-medium">{v.storeName}</span>
                      </span>
                      <span className="text-content-secondary text-xs font-semibold shrink-0">₹{v.revenue.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="md" hover onClick={() => navigate('/vendors?status=UNDER_VERIFICATION')}>
              <h3 className="text-sm font-bold text-content-primary mb-3 flex items-center gap-2"><Icon3D name="check" size={20} /> Pending Approvals</h3>
              <div className="flex items-center gap-6">
                <div><p className="text-2xl font-bold text-content-primary">{pendingApprovalsCount}</p><p className="text-xs text-content-muted">Total pending</p></div>
                <div className="text-xs text-content-secondary space-y-0.5">
                  <p>{pendingApprovals.vendors.length} vendors</p>
                  <p>{pendingApprovals.technicians.length} mechanics</p>
                  <p>{pendingApprovals.products.length} products</p>
                </div>
              </div>
            </Card>

            <Card padding="md" hover onClick={() => navigate('/inventory')}>
              <h3 className="text-sm font-bold text-content-primary mb-3 flex items-center gap-2"><Icon3D name="warehouses" size={20} /> Inventory Alerts</h3>
              {lowStockItems.length === 0 ? (
                <p className="text-xs text-content-muted">All stock levels healthy.</p>
              ) : (
                <div className="space-y-1.5">
                  {lowStockItems.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-sm">
                      <span className="truncate text-content-primary">{inv.product?.name}</span>
                      <Badge variant={inv.availableStock === 0 ? 'danger' : 'warning'} size="sm">{inv.availableStock} left</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="md" hover onClick={() => navigate('/orders')}>
              <h3 className="text-sm font-bold text-content-primary mb-3 flex items-center gap-2"><Icon3D name="orders" size={20} /> Pending Orders</h3>
              {pendingOrdersList.length === 0 ? (
                <p className="text-xs text-content-muted">No orders awaiting action.</p>
              ) : (
                <div className="space-y-1.5">
                  {pendingOrdersList.map((o) => (
                    <div key={o.id} className="flex items-center justify-between text-sm">
                      <span className="text-content-primary">#{o.id.slice(-6).toUpperCase()}</span>
                      <Badge variant="warning" size="sm">{o.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Activity feed */}
        <motion.div variants={staggerItem} className="xl:col-span-1">
          <Card padding="md" className="sticky top-20">
            <h3 className="text-sm font-bold text-content-primary mb-4 flex items-center gap-2">
              <Radio size={15} className="text-brand-primary" /> Live Activity
            </h3>
            {activity.length === 0 ? (
              <EmptyState icon="bell" title="Watching for activity" description="New orders, vendor signups, and bookings will appear here in real time." />
            ) : (
              <div className="space-y-3 max-h-[32rem] overflow-y-auto">
                {activity.map((a) => (
                  <motion.div key={a.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="border-l-2 border-brand-primary/40 pl-3">
                    <p className="text-sm font-semibold text-content-primary">{a.title}</p>
                    <p className="text-xs text-content-secondary">{a.body}</p>
                    <p className="text-[11px] text-content-muted mt-0.5">{new Date(a.createdAt).toLocaleTimeString()}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Set revenue target modal */}
      <Modal
        isOpen={targetModalOpen}
        onClose={() => setTargetModalOpen(false)}
        title="Monthly Revenue Target"
        footer={<><Button variant="ghost" onClick={() => setTargetModalOpen(false)}>Cancel</Button><Button onClick={saveTarget}>Save</Button></>}
      >
        <Input label="Target amount (₹)" type="number" min={0} value={targetInput} onChange={(e) => setTargetInput(e.target.value)} placeholder="e.g. 500000" />
      </Modal>

      {/* Broadcast notification modal */}
      <Modal
        isOpen={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        title="Send Notification"
        footer={<><Button variant="ghost" onClick={() => setBroadcastOpen(false)}>Cancel</Button><Button onClick={sendBroadcast} isLoading={broadcastSending} icon={<Plus size={15} />}>Send</Button></>}
      >
        <div className="space-y-4">
          <Select label="Audience" value={broadcastForm.audience} onChange={(e) => setBroadcastForm((f) => ({ ...f, audience: e.target.value }))}>
            {BROADCAST_AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </Select>
          <Input label="Title" value={broadcastForm.title} onChange={(e) => setBroadcastForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Weekend Sale Live Now" />
          <Input label="Message" value={broadcastForm.body} onChange={(e) => setBroadcastForm((f) => ({ ...f, body: e.target.value }))} placeholder="Short notification body" />
        </div>
      </Modal>
    </motion.div>
  );
}
