import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { FileText, Download, TrendingUp, Package, Percent } from 'lucide-react';
import { Card, Loader, Button } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

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

  useEffect(() => { fetchReport(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2"><FileText className="w-7 h-7 text-primary-500" /> Reports</h1>
          <p className="text-neutral-400 mt-1">Sales performance over a chosen date range.</p>
        </div>
        <Button onClick={() => report && downloadCsv(report)} disabled={!report || report.orders.length === 0}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card variant="dark">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from} max={toInputDate(today)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary-500" />
          </div>
          <Button onClick={fetchReport}>Apply</Button>
        </div>
      </Card>

      {loading ? (
        <Loader fullScreen />
      ) : error ? (
        <Card variant="dark"><p className="text-danger-400">{error}</p></Card>
      ) : !report ? null : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card variant="dark">
              <p className="text-neutral-400 text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Total Revenue</p>
              <p className="text-3xl font-bold text-white mt-2">₹{report.summary.totalRevenue.toLocaleString('en-IN')}</p>
              <p className="text-neutral-500 text-xs mt-1">{report.summary.orderCount} order(s)</p>
            </Card>
            <Card variant="dark">
              <p className="text-neutral-400 text-sm flex items-center gap-2"><Percent className="w-4 h-4" /> Total Discounts Given</p>
              <p className="text-3xl font-bold text-white mt-2">₹{report.summary.totalDiscount.toLocaleString('en-IN')}</p>
            </Card>
            <Card variant="dark">
              <p className="text-neutral-400 text-sm flex items-center gap-2"><Package className="w-4 h-4" /> Avg Order Value</p>
              <p className="text-3xl font-bold text-white mt-2">₹{Math.round(report.summary.avgOrderValue).toLocaleString('en-IN')}</p>
            </Card>
          </div>

          {report.revenueByCategory.length > 0 && (
            <Card variant="dark">
              <h3 className="text-lg font-bold text-white mb-4">Revenue by Category</h3>
              <div className="space-y-2">
                {[...report.revenueByCategory].sort((a, b) => b.revenue - a.revenue).map((c) => {
                  const pct = report.summary.totalRevenue > 0 ? (c.revenue / report.summary.totalRevenue) * 100 : 0;
                  return (
                    <div key={c.category} className="flex items-center gap-3">
                      <span className="text-sm text-neutral-300 w-40 truncate">{c.category}</span>
                      <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm text-neutral-400 w-24 text-right">₹{c.revenue.toLocaleString('en-IN')}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card variant="dark" className="!p-0 overflow-hidden">
            <div className="p-4 border-b border-neutral-800">
              <h3 className="text-lg font-bold text-white">Orders in Range</h3>
            </div>
            {report.orders.length === 0 ? (
              <p className="text-neutral-400 text-sm p-6 text-center">No orders in this date range.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-neutral-950 text-xs text-neutral-400 font-semibold uppercase">
                      <th className="p-4">Order ID</th>
                      <th className="p-4">Date</th>
                      <th className="p-4">Customer</th>
                      <th className="p-4">Items</th>
                      <th className="p-4">Discount</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {report.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-neutral-900/50">
                        <td className="p-4 text-primary-500 text-sm font-mono">#{o.id.slice(-8).toUpperCase()}</td>
                        <td className="p-4 text-sm text-neutral-400">{new Date(o.date).toLocaleDateString('en-IN')}</td>
                        <td className="p-4 text-sm text-white">{o.customer}</td>
                        <td className="p-4 text-sm text-neutral-300">{o.itemCount}</td>
                        <td className="p-4 text-sm text-neutral-400">₹{o.discountAmount.toLocaleString('en-IN')}</td>
                        <td className="p-4 text-sm font-bold text-white">₹{o.finalAmount.toLocaleString('en-IN')}</td>
                        <td className="p-4 text-xs text-neutral-400">{o.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
