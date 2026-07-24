import { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { RotateCcw, Package } from 'lucide-react';
import { Card, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function Returns() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API_URL}/vendors/orders`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setOrders(res.data.filter((o: any) => o.status === 'RETURNED')))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <Loader fullScreen />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white flex items-center gap-2"><RotateCcw className="w-7 h-7 text-primary" /> Returns</h1>
        <p className="text-neutral-400 mt-1">Orders containing your products that were returned after delivery.</p>
      </div>

      <Card variant="dark" className="!rounded-3xl !p-0 overflow-hidden">
        {orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
            <p className="text-neutral-300 font-medium">No returns</p>
            <p className="text-neutral-500 text-sm">Returned orders will appear here.</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-neutral-900 text-xs text-neutral-400 font-semibold uppercase">
                <th className="p-4">Order ID</th>
                <th className="p-4">Customer</th>
                <th className="p-4">My Items</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Reason</th>
                <th className="p-4">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {orders.map((order) => {
                const vendorItemsTotal = order.items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);
                return (
                  <tr key={order.id} className="hover:bg-neutral-900/50 transition-colors">
                    <td className="p-4 text-primary text-sm font-mono">#{order.id.slice(-8).toUpperCase()}</td>
                    <td className="p-4">
                      <p className="text-white text-sm font-medium">{order.user?.name || 'Customer'}</p>
                      <p className="text-neutral-500 text-xs">{order.user?.phone}</p>
                    </td>
                    <td className="p-4 text-sm text-neutral-300">
                      {order.items.map((item: any) => (
                        <div key={item.id} className="text-xs text-neutral-400 truncate max-w-[200px]">{item.quantity}x {item.product.name}</div>
                      ))}
                    </td>
                    <td className="p-4 text-sm font-bold text-white">₹{vendorItemsTotal.toLocaleString('en-IN')}</td>
                    <td className="p-4 text-sm text-neutral-400">{order.issueReason || '—'}</td>
                    <td className="p-4 text-xs text-neutral-500">{new Date(order.updatedAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      {orders.length > 0 && (
        <p className="text-xs text-neutral-500">Return handling (refund/restock decisions) is managed by MechBazar operations.</p>
      )}
    </div>
  );
}
