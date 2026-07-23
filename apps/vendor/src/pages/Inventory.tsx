import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Warehouse, AlertTriangle, RefreshCw, TrendingDown, CheckCircle } from 'lucide-react';
import { Badge, Alert, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function Inventory() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/vendors/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInventory(res.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [token]);

  const filtered = inventory.filter(inv => {
    if (filter === 'low') return inv.availableQty < inv.reorderLevel && inv.availableQty > 0;
    if (filter === 'out') return inv.availableQty === 0;
    return true;
  });

  const getStockStatus = (inv: any): { label: string; variant: 'danger' | 'warning' | 'success'; icon: any } => {
    if (inv.availableQty === 0) return { label: 'Out of Stock', variant: 'danger', icon: AlertTriangle };
    if (inv.availableQty < inv.reorderLevel) return { label: 'Low Stock', variant: 'warning', icon: TrendingDown };
    return { label: 'In Stock', variant: 'success', icon: CheckCircle };
  };

  const lowCount = inventory.filter(i => i.availableQty < i.reorderLevel && i.availableQty > 0).length;
  const outCount = inventory.filter(i => i.availableQty === 0).length;

  if (loading) return <Loader fullScreen />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-white">
            <Warehouse className="w-8 h-8 text-primary-500" /> Inventory
          </h1>
          <p className="text-neutral-400 mt-1">Live stock levels for all your products across warehouses</p>
        </div>
        <button
          onClick={fetch}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-300 transition hover:border-primary-500 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {(lowCount > 0 || outCount > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {outCount > 0 && (
            <Alert type="error" title={`${outCount} Product(s) Out of Stock`} message="These products cannot be ordered by customers." />
          )}
          {lowCount > 0 && (
            <Alert type="warning" title={`${lowCount} Product(s) Running Low`} message="Stock is below reorder level. Replenish soon." />
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'all', label: `All (${inventory.length})` },
          { key: 'low', label: `Low Stock (${lowCount})` },
          { key: 'out', label: `Out of Stock (${outCount})` },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key as any)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${filter === key ? 'bg-primary-500 text-white' : 'border border-neutral-700 bg-neutral-900 text-neutral-300 hover:text-white'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <Alert type="error" message={error} className="text-center" />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-12 text-center">
          <Warehouse className="mx-auto mb-4 h-16 w-16 text-neutral-400" />
          <h3 className="mb-2 text-xl font-bold text-white">No Inventory Records</h3>
          <p className="text-sm text-neutral-400">Once products are added to warehouses, stock levels will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-950 text-xs font-semibold uppercase tracking-wide text-neutral-400 border-b border-neutral-800">
                <th className="p-4">Product</th>
                <th className="p-4">Warehouse</th>
                <th className="p-4">Available</th>
                <th className="p-4">Reserved</th>
                <th className="p-4">Reorder Level</th>
                <th className="p-4">Status</th>
                <th className="p-4">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filtered.map((inv: any) => {
                const status = getStockStatus(inv);
                const StatusIcon = status.icon;
                return (
                  <tr key={inv.id} className="hover:bg-neutral-950/60 transition-colors">
                    <td className="p-4">
                      <p className="text-sm font-semibold text-white">{inv.product?.name}</p>
                      <p className="text-xs text-neutral-500">{inv.product?.category?.name} • {inv.product?.brand?.name}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-neutral-300">{inv.warehouse?.name || 'N/A'}</p>
                      <p className="text-xs text-neutral-500">{inv.warehouse?.city}</p>
                    </td>
                    <td className="p-4">
                      <span className={`text-lg font-bold ${inv.availableQty < inv.reorderLevel ? 'text-red-400' : 'text-white'}`}>
                        {inv.availableQty}
                      </span>
                      <span className="ml-1 text-xs text-neutral-500">units</span>
                    </td>
                    <td className="p-4 text-sm text-neutral-400">{inv.reservedQty ?? 0} units</td>
                    <td className="p-4 text-sm text-neutral-400">{inv.reorderLevel ?? 10} units</td>
                    <td className="p-4">
                      <Badge variant={status.variant} className="!rounded-lg flex items-center gap-1 w-fit">
                        <StatusIcon className="h-3 w-3" /> {status.label}
                      </Badge>
                    </td>
                    <td className="p-4 text-xs text-neutral-500">
                      {new Date(inv.updatedAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
