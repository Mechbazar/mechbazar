import { useEffect, useState } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

interface RevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

const RANGE_OPTIONS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs shadow-lg">
      <p className="text-neutral-400 mb-1">{new Date(label).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
      <p className="text-white font-semibold">₹{Number(payload[0].value).toLocaleString('en-IN')}</p>
      <p className="text-neutral-500">{payload[0].payload.orders} order(s)</p>
    </div>
  );
}

export default function RevenueChart() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const token = localStorage.getItem('adminToken');
    axios
      .get(`${API_URL}/admin/dashboard/revenue-chart?days=${days}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <Card variant="dark">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-500" /> Revenue
          </h3>
          <p className="text-neutral-500 text-xs mt-0.5">₹{totalRevenue.toLocaleString('en-IN')} platform-wide in the last {days} days</p>
        </div>
        <div className="flex gap-1 bg-neutral-950 border border-neutral-800 rounded-xl p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setDays(opt.days)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${days === opt.days ? 'bg-primary-500 text-white' : 'text-neutral-400 hover:text-white'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-neutral-500 text-sm">Loading chart...</div>
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-neutral-500 text-sm">No revenue in this period yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#DA3830" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#DA3830" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              stroke="#6B7480"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#6B7480"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)}
              width={48}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="revenue" stroke="#DA3830" strokeWidth={2} fill="url(#adminRevenueFill)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
