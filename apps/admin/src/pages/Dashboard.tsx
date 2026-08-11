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
  Plus, Store, Wrench, Tag, PackageSearch, Megaphone, Target, ChevronDown,
  Calendar, FileText, Radio, Package, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import type { RootState } from '../store';
import { API_URL } from '../config/api';
import { getAdminSocket } from '../services/adminRealtime';
import {
  Card, Button, Badge, Modal, Input, Select, EmptyState, StatCard, Tabs,
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
  { id: 'revenue', label: 'Revenue', endpoint: 'revenue-chart', dataKey: 'revenue', color: '#E11D2E', prefix: '₹' },
  { id: 'orders', label: 'Orders', endpoint: 'revenue-chart', dataKey: 'orders', color: '#E11D2E' },
  { id: 'bookings', label: 'Service Bookings', endpoint: 'bookings-chart', dataKey: 'bookings', color: '#E11D2E' },
  { id: 'vendor-earnings', label: 'Vendor Earnings', endpoint: 'vendor-earnings-chart', dataKey: 'revenue', color: '#E11D2E', prefix: '₹' },
  { id: 'customer-growth', label: 'Customer Growth', endpoint: 'customer-growth-chart', dataKey: 'cumulative', color: '#E11D2E' },
];

const BROADCAST_AUDIENCES = [
  { value: 'ALL_CUSTOMERS', label: 'All Customers' },
  { value: 'ALL_VENDORS', label: 'All Vendors' },
  { value: 'ALL_TECHNICIANS', label: 'All Mechanics' },
  { value: 'ALL_RIDERS', label: 'All Riders' },
];

const READY_STATUSES = ['ACCEPTED', 'PACKING', 'PICKUP'];
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HEATMAP_WEEKS = 6;

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// Last two points of a day-bucketed series -> a real day-over-day % change,
// instead of a fabricated trend number.
function dayOverDayTrend(rows: { v: number }[]): number | undefined {
  if (rows.length < 2) return undefined;
  const prev = rows[rows.length - 2].v;
  const curr = rows[rows.length - 1].v;
  if (prev === 0) return curr > 0 ? 100 : undefined;
  return ((curr - prev) / prev) * 100;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { token, user } = useSelector((state: RootState) => state.auth);
  const authHeaders = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ users: 0, orders: 0, products: 0, revenue: 0, vendors: 0, lowStock: 0 });

  const [revenueTarget, setRevenueTarget] = useState<{ target: number; monthToDateRevenue: number } | null>(null);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [targetInput, setTargetInput] = useState('');

  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<{ vendors: any[]; technicians: any[]; products: any[] }>({ vendors: [], technicians: [], products: [] });
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [allOrders, setAllOrders] = useState<any[]>([]);

  // Fixed-window series (independent of the interactive analytics chart below)
  // used to derive real KPI sparklines/trends and the booking heatmap.
  const [revenueSeries, setRevenueSeries] = useState<{ date: string; revenue: number; orders: number }[]>([]);
  const [bookingsSeries, setBookingsSeries] = useState<{ date: string; bookings: number }[]>([]);
  const [customerGrowthSeries, setCustomerGrowthSeries] = useState<{ date: string; newCustomers: number; cumulative: number }[]>([]);

  const [activeMetric, setActiveMetric] = useState('revenue');
  const [activeRange, setActiveRange] = useState('30');
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const [activity, setActivity] = useState<{ id: string; title: string; body: string; createdAt: string }[]>([]);
  const [activityVisible, setActivityVisible] = useState(5);

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ title: '', body: '', audience: 'ALL_CUSTOMERS' });
  const [broadcastSending, setBroadcastSending] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [
          dashRes, targetRes, leaderboardRes, vendorsPending, techPending, productsPending, inventoryRes,
          ordersRes, revenueSeriesRes, bookingsSeriesRes, growthSeriesRes,
        ] = await Promise.all([
          axios.get(`${API_URL}/admin/dashboard`, authHeaders),
          axios.get(`${API_URL}/admin/settings/revenue-target`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/vendors/leaderboard?days=30&limit=5`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/vendors?status=UNDER_VERIFICATION`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/technicians?status=UNDER_VERIFICATION`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/products?status=PENDING`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/inventory`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/orders/all`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/admin/dashboard/revenue-chart?days=30`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/admin/dashboard/bookings-chart?days=${HEATMAP_WEEKS * 7}`, authHeaders).catch(() => null),
          axios.get(`${API_URL}/admin/dashboard/customer-growth-chart?days=30`, authHeaders).catch(() => null),
        ]);

        setStats(dashRes.data.stats);
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
        if (ordersRes) setAllOrders(ordersRes.data || []);
        if (revenueSeriesRes) setRevenueSeries(revenueSeriesRes.data || []);
        if (bookingsSeriesRes) setBookingsSeries(bookingsSeriesRes.data || []);
        if (growthSeriesRes) setCustomerGrowthSeries(growthSeriesRes.data || []);
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

  // ---- Derived, real data for the reference layout's widgets (no fabricated numbers) ----

  const today = new Date();

  const orderBuckets = useMemo(() => {
    const pending = allOrders.filter((o) => o.status === 'PLACED').length;
    const readyToDispatch = allOrders.filter((o) => READY_STATUSES.includes(o.status)).length;
    const deliveredToday = allOrders.filter((o) => o.status === 'DELIVERED' && isSameDay(new Date(o.updatedAt || o.createdAt), today)).length;
    const cancelledToday = allOrders.filter((o) => o.status === 'CANCELLED' && isSameDay(new Date(o.updatedAt || o.createdAt), today)).length;
    return { pending, readyToDispatch, deliveredToday, cancelledToday };
  }, [allOrders]); // eslint-disable-line react-hooks/exhaustive-deps

  const revenueRows = useMemo(() => revenueSeries.map((r) => ({ ...r, v: r.revenue })), [revenueSeries]);
  const ordersRows = useMemo(() => revenueSeries.map((r) => ({ ...r, v: r.orders })), [revenueSeries]);
  const bookingsRows = useMemo(() => bookingsSeries.map((r) => ({ ...r, v: r.bookings })), [bookingsSeries]);

  const revenueSparkline = revenueRows.slice(-14).map((r) => r.v);
  const ordersSparkline = ordersRows.slice(-14).map((r) => r.v);
  const bookingsSparkline = bookingsRows.slice(-14).map((r) => r.v);

  const revenueTrend = dayOverDayTrend(revenueRows);
  const ordersTrend = dayOverDayTrend(ordersRows);
  const bookingsTrend = dayOverDayTrend(bookingsRows);

  // Same source as the trend/sparkline above (not the separate stats.revenue
  // field, which uses a different day-boundary convention server-side) so
  // the headline number and its "vs yesterday" badge never contradict each
  // other -- e.g. showing "₹0" next to "+382.9%".
  const revenueToday = revenueRows.length ? revenueRows[revenueRows.length - 1].v : 0;
  const ordersToday = ordersRows.length ? ordersRows[ordersRows.length - 1].v : 0;
  const bookingsToday = bookingsRows.length ? bookingsRows[bookingsRows.length - 1].v : 0;

  const newCustomers30d = customerGrowthSeries.reduce((sum, r) => sum + r.newCustomers, 0);
  const avgOrderValue30d = revenueSeries.length
    ? Math.round(revenueSeries.reduce((s, r) => s + r.revenue, 0) / Math.max(1, revenueSeries.reduce((s, r) => s + r.orders, 0)))
    : 0;

  // Calendar-style heatmap: most recent HEATMAP_WEEKS weeks x 7 weekdays,
  // built purely from bookingsSeries (real per-day counts).
  const heatmap = useMemo(() => {
    const byDate = new Map(bookingsSeries.map((r) => [r.date, r.bookings]));
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    // Align the grid to end on the most recent Sunday-completed week.
    const endWeekday = (end.getDay() + 6) % 7; // Mon=0..Sun=6
    end.setDate(end.getDate() - endWeekday + 6);
    const start = new Date(end);
    start.setDate(start.getDate() - (HEATMAP_WEEKS * 7 - 1));

    const weeks: number[][] = [];
    let max = 0;
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      const row: number[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(start);
        cellDate.setDate(start.getDate() + w * 7 + d);
        const key = cellDate.toISOString().slice(0, 10);
        const value = cellDate > today ? -1 : byDate.get(key) || 0;
        if (value > max) max = value;
        row.push(value);
      }
      weeks.push(row);
    }
    return { weeks, max };
  }, [bookingsSeries]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6 max-w-[2000px] mx-auto">
      {/* Hero */}
      <motion.div variants={staggerItem}>
        <Card variant="glass" padding="lg" className="relative overflow-hidden">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-content-primary">
                {greeting()}, {user?.name || 'Admin'} <span className="align-middle">👋</span>
              </h1>
              <p className="mt-1 text-sm text-content-secondary">Here's what's happening with your business today.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm font-medium text-content-secondary">
                <Calendar size={15} className="text-content-muted" />
                {today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
              <Button onClick={() => navigate('/reports')} icon={<FileText size={15} />}>
                Generate Report
              </Button>
            </div>
          </div>

          <div className="relative mt-6 flex flex-wrap items-end gap-6">
            <div className="min-w-[14rem]">
              <button onClick={openTargetModal} className="flex items-center gap-1.5 text-xs text-content-muted hover:text-content-primary transition-colors">
                <Target size={12} /> Monthly Revenue Target · Edit
              </button>
              <div className="mt-2 h-2 w-64 max-w-full rounded-full bg-surface-hover overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary"
                  initial={{ width: 0 }}
                  animate={{ width: `${targetProgress}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="mt-1.5 text-xs text-content-secondary">
                ₹{(revenueTarget?.monthToDateRevenue || 0).toLocaleString('en-IN')} of ₹{(revenueTarget?.target || 0).toLocaleString('en-IN')}
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 ml-auto">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={action.onClick}
                  className="flex items-center gap-2 rounded-xl border border-border-default bg-surface-card px-3.5 py-2.5 hover:border-brand-primary/40 hover:-translate-y-0.5 transition-all shadow-card"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                    <action.icon size={14} />
                  </span>
                  <span className="text-xs font-semibold text-content-primary whitespace-nowrap">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </motion.div>

      {/* KPI Grid */}
      <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          loading={loading} title="Total Revenue" value={revenueToday} valuePrefix="₹" icon="revenue"
          trend={revenueTrend} trendLabel="vs yesterday" sparkline={revenueSparkline}
          onClick={() => navigate('/reports')}
        />
        <StatCard
          loading={loading} title="Orders Today" value={ordersToday} icon="orders"
          trend={ordersTrend} trendLabel="vs yesterday" sparkline={ordersSparkline}
          onClick={() => navigate('/orders')}
        />
        <StatCard
          loading={loading} title="Service Bookings" value={bookingsToday} icon="bookings"
          trend={bookingsTrend} trendLabel="vs yesterday" sparkline={bookingsSparkline}
          onClick={() => navigate('/service-bookings')}
        />
        <StatCard loading={loading} title="Total Vendors" value={stats.vendors} icon="vendors" onClick={() => navigate('/vendors')} />
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6 min-w-0">
          {/* Revenue Overview */}
          <motion.div variants={staggerItem}>
            <Card padding="md">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
                <h3 className="text-base font-bold text-content-primary">Revenue Overview</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Tabs tabs={METRICS.map((m) => ({ id: m.id, label: m.label }))} value={activeMetric} onChange={setActiveMetric} layoutId="metric-tabs" />
                  <Tabs tabs={RANGE_OPTIONS} value={activeRange} onChange={setActiveRange} layoutId="range-tabs" />
                </div>
              </div>

              {!chartLoading && chartData.length > 0 && (
                <div className="flex flex-wrap gap-8 mb-5 pb-5 border-b border-border-default">
                  {(() => {
                    const values = chartData.map((d) => Number(d[activeMetricMeta.dataKey]) || 0);
                    const total = values.reduce((a, b) => a + b, 0);
                    const growth = values.length > 1 && values[0] !== 0 ? ((values[values.length - 1] - values[0]) / values[0]) * 100 : 0;
                    const avg = values.length ? total / values.length : 0;
                    const fmt = (n: number) => activeMetricMeta.prefix ? `${activeMetricMeta.prefix}${n >= 100000 ? `${(n / 100000).toFixed(2)}L` : n.toLocaleString('en-IN')}` : n.toLocaleString('en-IN');
                    const txns = chartData.reduce((s, d) => s + (Number(d.orders) || 0), 0);
                    return (
                      <>
                        <div>
                          <p className="text-xl font-bold text-content-primary">{fmt(total)}</p>
                          <p className="text-xs text-content-muted">Total {activeMetricMeta.label}</p>
                        </div>
                        <div>
                          <p className={`text-xl font-bold ${growth >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                            {growth >= 0 ? '↑' : '↓'} {Math.abs(growth).toFixed(1)}%
                          </p>
                          <p className="text-xs text-content-muted">Growth</p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-content-primary">{fmt(avg)}</p>
                          <p className="text-xs text-content-muted">Avg Daily {activeMetricMeta.label}</p>
                        </div>
                        {activeMetricMeta.dataKey === 'revenue' && activeMetricMeta.endpoint === 'revenue-chart' && (
                          <div>
                            <p className="text-xl font-bold text-content-primary">{txns.toLocaleString('en-IN')}</p>
                            <p className="text-xs text-content-muted">Total Transactions</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="h-64">
                {chartLoading ? (
                  <div className="h-full w-full animate-pulse rounded-xl bg-surface-hover" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="dashboardMetricFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={activeMetricMeta.color} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={activeMetricMeta.color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--content-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--content-muted)' }} axisLine={false} tickLine={false} width={44} />
                      <Tooltip
                        contentStyle={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-default)', borderRadius: 12, fontSize: 12 }}
                        labelStyle={{ color: 'var(--content-secondary)' }}
                        itemStyle={{ color: 'var(--content-primary)' }}
                        formatter={(value) => [activeMetricMeta.prefix ? `₹${Number(value).toLocaleString('en-IN')}` : value, activeMetricMeta.label] as [string | number, string]}
                      />
                      <Area type="monotone" dataKey={activeMetricMeta.dataKey} stroke={activeMetricMeta.color} strokeWidth={2} fill="url(#dashboardMetricFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Widgets grid: Pending Orders / Inventory Alerts / Pending Approvals / Top Vendors */}
          <motion.div variants={staggerItem} className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
            <Card padding="md" className="flex h-full flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-content-primary">Pending Orders</h3>
                <button onClick={() => navigate('/orders')} className="text-xs font-semibold text-brand-primary hover:text-brand-accent transition-colors">View All</button>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Pending', value: orderBuckets.pending, variant: 'warning' as const },
                  { label: 'Ready to Dispatch', value: orderBuckets.readyToDispatch, variant: 'info' as const },
                  { label: 'Delivered Today', value: orderBuckets.deliveredToday, variant: 'success' as const },
                  { label: 'Cancelled Today', value: orderBuckets.cancelledToday, variant: 'danger' as const },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-content-secondary">{row.label}</span>
                    <Badge variant={row.variant} size="sm">{row.value}</Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card padding="md" className="flex h-full flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-content-primary">Inventory Alerts</h3>
                <button onClick={() => navigate('/inventory')} className="text-xs font-semibold text-brand-primary hover:text-brand-accent transition-colors">View All</button>
              </div>
              {lowStockItems.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2.5 py-2 text-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-500/10 text-success-600 dark:text-success-400">
                    <CheckCircle2 size={16} />
                  </span>
                  <p className="text-xs text-content-muted">All stock levels healthy.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {lowStockItems.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 min-w-0 text-content-primary">
                        <AlertTriangle size={13} className="text-amber-400 shrink-0" />
                        <span className="truncate">{inv.product?.name}</span>
                      </span>
                      <Badge variant={inv.availableStock === 0 ? 'danger' : 'warning'} size="sm">{inv.availableStock} items left</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card padding="md" className="flex h-full flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-content-primary">Pending Approvals</h3>
                <button onClick={() => navigate('/vendors?status=UNDER_VERIFICATION')} className="text-xs font-semibold text-brand-primary hover:text-brand-accent transition-colors">View All</button>
              </div>
              <div className="space-y-2.5">
                {[
                  { label: 'Vendors', value: pendingApprovals.vendors.length, onClick: () => navigate('/vendors?status=UNDER_VERIFICATION') },
                  { label: 'Mechanics', value: pendingApprovals.technicians.length, onClick: () => navigate('/mechanics') },
                  { label: 'Products', value: pendingApprovals.products.length, onClick: () => navigate('/products') },
                ].map((row) => (
                  <button key={row.label} onClick={row.onClick} className="flex w-full items-center justify-between text-sm hover:text-brand-primary transition-colors">
                    <span className="text-content-secondary">{row.label}</span>
                    <span className="font-semibold text-content-primary">{row.value}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card padding="md" className="flex h-full flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-content-primary">Top Vendors</h3>
                <button onClick={() => navigate('/vendors')} className="text-xs font-semibold text-brand-primary hover:text-brand-accent transition-colors">View All</button>
              </div>
              {leaderboard.length === 0 ? (
                <div className="flex flex-1 items-center justify-center py-2 text-center">
                  <p className="text-xs text-content-muted">No vendor sales in the last 30 days.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {leaderboard.map((v, i) => (
                    <div key={v.vendorId} className="flex items-center gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-hover text-xs font-bold text-content-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-content-primary">{v.storeName}</span>
                      <span className="shrink-0 text-xs font-semibold text-content-secondary">₹{v.revenue.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </motion.div>

          {/* Customer Insights + Service Bookings heatmap */}
          <motion.div variants={staggerItem} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card padding="md">
              <h3 className="text-sm font-bold text-content-primary mb-4">Customer Insights</h3>
              <div className="grid grid-cols-2 gap-5">
                {[
                  { label: 'New Customers (30d)', value: newCustomers30d.toLocaleString('en-IN') },
                  { label: 'Avg. Order Value', value: `₹${avgOrderValue30d.toLocaleString('en-IN')}` },
                  { label: 'Total Customers', value: stats.users.toLocaleString('en-IN') },
                  { label: 'Low Stock Items', value: stats.lowStock.toLocaleString('en-IN') },
                ].map((s) => (
                  <div key={s.label}>
                    <p className="text-xs text-content-muted">{s.label}</p>
                    <p className="mt-1 text-lg font-bold text-content-primary">{s.value}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card padding="md">
              <h3 className="text-sm font-bold text-content-primary mb-4">Service Bookings Overview</h3>
              <div className="flex gap-3">
                <div className="flex-1 overflow-x-auto">
                  <div className="grid grid-cols-7 gap-1.5 min-w-[16rem]">
                    {WEEKDAY_LABELS.map((d) => (
                      <span key={d} className="text-center text-[10px] font-semibold text-content-muted">{d}</span>
                    ))}
                    {heatmap.weeks.map((row, wi) =>
                      row.map((value, di) => {
                        const intensity = value < 0 || heatmap.max === 0 ? 0 : value / heatmap.max;
                        return (
                          <div
                            key={`${wi}-${di}`}
                            title={value < 0 ? undefined : `${value} bookings`}
                            className="aspect-square rounded-md border border-border-default"
                            style={{
                              background: value < 0
                                ? 'transparent'
                                : `color-mix(in srgb, var(--color-brand-primary) ${Math.round(12 + intensity * 88)}%, var(--surface-sunken))`,
                            }}
                          />
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-center justify-between text-[10px] text-content-muted py-0.5">
                  <span>High</span>
                  <div className="flex flex-col gap-1 my-1">
                    {[100, 75, 50, 25, 10].map((pct) => (
                      <span key={pct} className="h-2.5 w-2.5 rounded-sm" style={{ background: `color-mix(in srgb, var(--color-brand-primary) ${pct}%, var(--surface-sunken))` }} />
                    ))}
                  </div>
                  <span>Low</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Live Activity */}
        <motion.div variants={staggerItem} className="xl:col-span-1 min-w-0">
          <Card padding="md" className="sticky top-20">
            <h3 className="text-sm font-bold text-content-primary mb-4 flex items-center gap-2">
              <Radio size={15} className="text-brand-primary" /> Live Activity
            </h3>
            {activity.length === 0 ? (
              <EmptyState icon="bell" title="Watching for activity" description="New orders, vendor signups, and bookings will appear here in real time." />
            ) : (
              <>
                <div className="space-y-1 max-h-[32rem] overflow-y-auto">
                  {activity.slice(0, activityVisible).map((a) => (
                    <motion.div key={a.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="flex gap-3 py-2">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                        <Package size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-content-primary truncate">{a.title}</p>
                        <p className="text-xs text-content-secondary truncate">{a.body}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-content-muted">{new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </motion.div>
                  ))}
                </div>
                {activityVisible < activity.length && (
                  <button
                    onClick={() => setActivityVisible((v) => v + 5)}
                    className="mt-2 flex w-full items-center justify-center gap-1 text-xs font-semibold text-brand-primary hover:text-brand-accent transition-colors"
                  >
                    Load more activities <ChevronDown size={13} />
                  </button>
                )}
              </>
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
