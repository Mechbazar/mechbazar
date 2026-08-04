import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import { Download, TrendingUp, Package, Percent } from 'lucide-react';
import { Card, Loader, Button, DataTable, EmptyState, Icon3D } from '../components/ui';
import type { Column } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';

interface ReportOrder {
  id: string;
  date: string;
  status: string;
  customer: string;
  phone: string;
  itemCount: number;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
}

interface SalesReport {
  range: { from: string; to: string };
  summary: { orderCount: number; totalRevenue: number; totalDiscount: number; avgOrderValue: number };
  revenueByCategory: { category: string; revenue: number }[];
  orders: ReportOrder[];
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function downloadCsv(report: SalesReport) {
  const header = ['Order ID', 'Date', 'Status', 'Customer', 'Phone', 'Items', 'Subtotal', 'Discount', 'Total'];
  const rows = report.orders.map((o) => [
    o.id, new Date(o.date).toLocaleDateString('en-IN'), o.status, o.customer, o.phone,
    o.itemCount, o.totalAmount, o.discountAmount, o.finalAmount,
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mechbazar-sales-report-${report.range.from.slice(0, 10)}_to_${report.range.to.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const { token } = useSelector((state: RootState) => state.auth);
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [from, setFrom] = useState(toInputDate(monthAgo));
  const [to, setTo] = useState(toInputDate(today));
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/admin/reports/sales`, {
        params: { from, to },
        headers: { Authorization: `Bearer ${token}` },
      });
      setReport(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const columns: Column<ReportOrder>[] = [
    { key: 'id', header: 'Order ID', render: (o) => <span className="text-brand-primary text-sm font-mono">#{o.id.slice(-8).toUpperCase()}</span> },
    { key: 'date', header: 'Date', render: (o) => <span className="text-sm text-content-secondary">{new Date(o.date).toLocaleDateString('en-IN')}</span> },
    { key: 'customer', header: 'Customer', render: (o) => <span className="text-sm text-content-primary">{o.customer}</span> },
    { key: 'items', header: 'Items', render: (o) => <span className="text-sm text-content-secondary">{o.itemCount}</span> },
    { key: 'discount', header: 'Discount', render: (o) => <span className="text-sm text-content-secondary">₹{o.discountAmount.toLocaleString('en-IN')}</span> },
    { key: 'total', header: 'Total', render: (o) => <span className="text-sm font-bold text-content-primary">₹{o.finalAmount.toLocaleString('en-IN')}</span> },
    { key: 'status', header: 'Status', render: (o) => <span className="text-xs text-content-muted">{o.status}</span> },
  ];

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-3"><Icon3D name="reports" size={30} eager /> Reports</h1>
          <p className="text-content-secondary mt-1 text-sm">Sales performance over a chosen date range.</p>
        </div>
        <Button icon={<Download className="w-4 h-4" />} onClick={() => report && downloadCsv(report)} disabled={!report || report.orders.length === 0}>
          Export CSV
        </Button>
      </div>

      <Card>
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
          <Button onClick={fetchReport}>Apply</Button>
        </div>
      </Card>

      {loading ? (
        <Loader fullScreen />
      ) : error ? (
        <Card><p className="text-danger-500">{error}</p></Card>
      ) : !report ? null : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <p className="text-content-secondary text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Total Revenue</p>
              <p className="text-3xl font-bold text-content-primary mt-2">₹{report.summary.totalRevenue.toLocaleString('en-IN')}</p>
              <p className="text-content-muted text-xs mt-1">{report.summary.orderCount} order(s)</p>
            </Card>
            <Card>
              <p className="text-content-secondary text-sm flex items-center gap-2"><Percent className="w-4 h-4" /> Total Discounts Given</p>
              <p className="text-3xl font-bold text-content-primary mt-2">₹{report.summary.totalDiscount.toLocaleString('en-IN')}</p>
            </Card>
            <Card>
              <p className="text-content-secondary text-sm flex items-center gap-2"><Package className="w-4 h-4" /> Avg Order Value</p>
              <p className="text-3xl font-bold text-content-primary mt-2">₹{Math.round(report.summary.avgOrderValue).toLocaleString('en-IN')}</p>
            </Card>
          </div>

          {report.revenueByCategory.length > 0 && (
            <Card>
              <h3 className="text-base font-bold text-content-primary mb-4">Revenue by Category</h3>
              <div className="space-y-2.5">
                {[...report.revenueByCategory].sort((a, b) => b.revenue - a.revenue).map((c) => {
                  const pct = report.summary.totalRevenue > 0 ? (c.revenue / report.summary.totalRevenue) * 100 : 0;
                  return (
                    <div key={c.category} className="flex items-center gap-3">
                      <span className="text-sm text-content-secondary w-40 truncate">{c.category}</span>
                      <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
                        <div className="h-full bg-brand-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm text-content-muted w-24 text-right">₹{c.revenue.toLocaleString('en-IN')}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card padding="none">
            <div className="p-4 border-b border-border-default">
              <h3 className="text-base font-bold text-content-primary">Orders in Range</h3>
            </div>
            <DataTable
              columns={columns}
              data={report.orders}
              rowKey={(o) => o.id}
              pageSize={10}
              emptyState={<EmptyState icon="reports" title="No orders in this date range" />}
              className="rounded-none border-none shadow-none"
            />
          </Card>
        </>
      )}
    </motion.div>
  );
}
