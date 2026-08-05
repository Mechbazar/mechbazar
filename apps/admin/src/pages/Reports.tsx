import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import { Download, TrendingUp, Package, Percent, Printer, Store, Wrench, Bike, Clock, CheckCircle } from 'lucide-react';
import { Card, Loader, Button, DataTable, EmptyState, Icon3D, Tabs } from '../components/ui';
import type { Column, TabItem } from '../components/ui';
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

interface CommissionReport {
  range: { from: string | null; to: string | null };
  totalCommissionEarned: number;
  totalGrossRevenue: number;
  productCommission: number;
  serviceCommission: number;
  vendorEarnings: { vendorId: string; name: string; netPayout: number; commission: number; gross: number }[];
  mechanicEarnings: { technicianId: string; name: string; netPayout: number; commission: number; gross: number }[];
  riderEarnings: { riderId: string; name: string; totalPayout: number; deliveries: number }[];
  pendingSettlements: number;
  completedSettlements: number;
  revenueByCategory: { category: string; revenue: number }[];
  revenueByService: { service: string; revenue: number }[];
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

// Same CSV-blob approach as downloadCsv above -- opens natively in Excel, no
// server-side .xlsx generation needed. "PDF" is the browser's own print
// dialog via window.print() (see the .no-print / print:block rules below),
// not a second file format to generate and maintain server-side.
function downloadCommissionCsv(report: CommissionReport) {
  const rows: string[][] = [['Section', 'Name', 'Gross / Total', 'Commission', 'Net Payout / Deliveries']];
  report.vendorEarnings.forEach((v) => rows.push(['Vendor', v.name, String(v.gross), String(v.commission), String(v.netPayout)]));
  report.mechanicEarnings.forEach((m) => rows.push(['Mechanic', m.name, String(m.gross), String(m.commission), String(m.netPayout)]));
  report.riderEarnings.forEach((r) => rows.push(['Rider', r.name, '', '', `${r.totalPayout} (${r.deliveries} deliveries)`]));
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mechbazar-commission-report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

type SectionId = 'SALES' | 'COMMISSION';

export default function Reports() {
  const [section, setSection] = useState<SectionId>('SALES');

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          main { padding: 0 !important; }
        }
      `}</style>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-content-primary flex items-center gap-3"><Icon3D name="reports" size={30} eager /> Reports</h1>
          <p className="text-content-secondary mt-1 text-sm">Sales and commission performance over a chosen date range.</p>
        </div>
        <Tabs
          tabs={[{ id: 'SALES', label: 'Sales' }, { id: 'COMMISSION', label: 'Commission' }] as TabItem[]}
          value={section}
          onChange={(id) => setSection(id as SectionId)}
          layoutId="reports-section-tab"
        />
      </div>

      {section === 'SALES' ? <SalesSection /> : <CommissionSection />}
    </motion.div>
  );
}

function SalesSection() {
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
    <div className="space-y-6">
      <div className="flex justify-end gap-2 no-print">
        <Button variant="secondary" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>Print / Save as PDF</Button>
        <Button icon={<Download className="w-4 h-4" />} onClick={() => report && downloadCsv(report)} disabled={!report || report.orders.length === 0}>
          Export CSV
        </Button>
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
    </div>
  );
}

function CommissionSection() {
  const { token } = useSelector((state: RootState) => state.auth);
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);

  const [from, setFrom] = useState(toInputDate(monthAgo));
  const [to, setTo] = useState(toInputDate(today));
  const [report, setReport] = useState<CommissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API_URL}/admin/commission/reports`, {
        params: { from, to },
        headers: { Authorization: `Bearer ${token}` },
      });
      setReport(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load commission report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const vendorColumns: Column<CommissionReport['vendorEarnings'][number]>[] = [
    { key: 'name', header: 'Vendor', render: (v) => <span className="font-medium text-content-primary">{v.name}</span> },
    { key: 'gross', header: 'Gross Sales', render: (v) => <span className="text-content-secondary">₹{v.gross.toLocaleString('en-IN')}</span> },
    { key: 'commission', header: 'Commission Charged', render: (v) => <span className="text-content-secondary">₹{v.commission.toLocaleString('en-IN')}</span> },
    { key: 'net', header: 'Net Payout', render: (v) => <span className="font-bold text-content-primary">₹{v.netPayout.toLocaleString('en-IN')}</span> },
  ];
  const mechanicColumns: Column<CommissionReport['mechanicEarnings'][number]>[] = [
    { key: 'name', header: 'Mechanic', render: (m) => <span className="font-medium text-content-primary">{m.name}</span> },
    { key: 'gross', header: 'Gross Jobs', render: (m) => <span className="text-content-secondary">₹{m.gross.toLocaleString('en-IN')}</span> },
    { key: 'commission', header: 'Platform Commission', render: (m) => <span className="text-content-secondary">₹{m.commission.toLocaleString('en-IN')}</span> },
    { key: 'net', header: 'Net Payout', render: (m) => <span className="font-bold text-content-primary">₹{m.netPayout.toLocaleString('en-IN')}</span> },
  ];
  const riderColumns: Column<CommissionReport['riderEarnings'][number]>[] = [
    { key: 'name', header: 'Rider', render: (r) => <span className="font-medium text-content-primary">{r.name}</span> },
    { key: 'deliveries', header: 'Deliveries', render: (r) => <span className="text-content-secondary">{r.deliveries}</span> },
    { key: 'total', header: 'Total Payout', render: (r) => <span className="font-bold text-content-primary">₹{r.totalPayout.toLocaleString('en-IN')}</span> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 no-print">
        <Button variant="secondary" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>Print / Save as PDF</Button>
        <Button icon={<Download className="w-4 h-4" />} onClick={() => report && downloadCommissionCsv(report)} disabled={!report}>
          Export CSV
        </Button>
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
          <Button onClick={fetchReport}>Apply</Button>
        </div>
      </Card>

      {loading ? (
        <Loader fullScreen />
      ) : error ? (
        <Card><p className="text-danger-500">{error}</p></Card>
      ) : !report ? null : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-content-secondary text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Total Commission Earned</p>
              <p className="text-3xl font-bold text-content-primary mt-2">₹{report.totalCommissionEarned.toLocaleString('en-IN')}</p>
            </Card>
            <Card>
              <p className="text-content-secondary text-sm flex items-center gap-2"><Store className="w-4 h-4" /> Product Commission</p>
              <p className="text-3xl font-bold text-content-primary mt-2">₹{report.productCommission.toLocaleString('en-IN')}</p>
            </Card>
            <Card>
              <p className="text-content-secondary text-sm flex items-center gap-2"><Wrench className="w-4 h-4" /> Service Commission</p>
              <p className="text-3xl font-bold text-content-primary mt-2">₹{report.serviceCommission.toLocaleString('en-IN')}</p>
            </Card>
            <Card>
              <p className="text-content-secondary text-sm flex items-center gap-2"><Bike className="w-4 h-4" /> Rider Deliveries</p>
              <p className="text-3xl font-bold text-content-primary mt-2">{report.riderEarnings.reduce((s, r) => s + r.deliveries, 0)}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-warning-500" />
              <div>
                <p className="text-content-secondary text-sm">Pending Settlements</p>
                <p className="text-2xl font-bold text-content-primary">{report.pendingSettlements}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-success-500" />
              <div>
                <p className="text-content-secondary text-sm">Completed Settlements</p>
                <p className="text-2xl font-bold text-content-primary">{report.completedSettlements}</p>
              </div>
            </Card>
          </div>

          {report.revenueByCategory.length > 0 && (
            <Card>
              <h3 className="text-base font-bold text-content-primary mb-4">Revenue by Category</h3>
              <RevenueBars data={report.revenueByCategory.map((c) => ({ label: c.category, revenue: c.revenue }))} />
            </Card>
          )}

          {report.revenueByService.length > 0 && (
            <Card>
              <h3 className="text-base font-bold text-content-primary mb-4">Revenue by Service</h3>
              <RevenueBars data={report.revenueByService.map((s) => ({ label: s.service, revenue: s.revenue }))} />
            </Card>
          )}

          <Card padding="none">
            <div className="p-4 border-b border-border-default"><h3 className="text-base font-bold text-content-primary">Vendor Earnings</h3></div>
            <DataTable columns={vendorColumns} data={report.vendorEarnings} rowKey={(v) => v.vendorId} pageSize={8}
              emptyState={<EmptyState icon="vendors" title="No vendor commission activity in this range" />} className="rounded-none border-none shadow-none" />
          </Card>

          <Card padding="none">
            <div className="p-4 border-b border-border-default"><h3 className="text-base font-bold text-content-primary">Mechanic Earnings</h3></div>
            <DataTable columns={mechanicColumns} data={report.mechanicEarnings} rowKey={(m) => m.technicianId} pageSize={8}
              emptyState={<EmptyState icon="mechanics" title="No mechanic commission activity in this range" />} className="rounded-none border-none shadow-none" />
          </Card>

          <Card padding="none">
            <div className="p-4 border-b border-border-default"><h3 className="text-base font-bold text-content-primary">Rider Earnings</h3></div>
            <DataTable columns={riderColumns} data={report.riderEarnings} rowKey={(r) => r.riderId} pageSize={8}
              emptyState={<EmptyState icon="riders" title="No rider deliveries in this range" />} className="rounded-none border-none shadow-none" />
          </Card>
        </>
      )}
    </div>
  );
}

function RevenueBars({ data }: { data: { label: string; revenue: number }[] }) {
  const max = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="space-y-2.5">
      {[...data].sort((a, b) => b.revenue - a.revenue).map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-sm text-content-secondary w-40 truncate">{d.label}</span>
          <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
            <div className="h-full bg-brand-primary rounded-full" style={{ width: `${(d.revenue / max) * 100}%` }} />
          </div>
          <span className="text-sm text-content-muted w-24 text-right">₹{d.revenue.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
}
