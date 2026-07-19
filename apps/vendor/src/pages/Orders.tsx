import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import {
  Package,
  Search,
  Clock,
  Truck,
  CheckCircle,
  MoreVertical,
  AlertCircle
} from 'lucide-react';
import { Badge, Card, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

const ORDERS_POLL_INTERVAL_MS = 20000;

export default function Orders() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      const res = await axios.get(`${API_URL}/vendors/orders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data);
    } catch (error) {
      console.error('Failed to fetch orders', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  // Live refresh -- no push channel on this deployment, so poll instead of
  // waiting for a manual refresh/navigation to pick up new orders.
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(fetchOrders, ORDERS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await axios.patch(`${API_URL}/vendors/orders/${orderId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setActionMenuOpen(null);
      fetchOrders();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update order status');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PLACED':
        return <Badge variant="secondary" className="!rounded-full flex items-center gap-1 w-fit"><Clock className="w-3 h-3"/> New Order</Badge>;
      case 'ACCEPTED':
      case 'PACKING':
        return <Badge variant="warning" className="!rounded-full flex items-center gap-1 w-fit"><Package className="w-3 h-3"/> Packing</Badge>;
      case 'PICKUP':
      case 'ON_THE_WAY':
        return <Badge variant="primary" className="!rounded-full flex items-center gap-1 w-fit"><Truck className="w-3 h-3"/> Out for Delivery</Badge>;
      case 'DELIVERED':
        return <Badge variant="success" className="!rounded-full flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3"/> Delivered</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger" className="!rounded-full flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3"/> Cancelled</Badge>;
      default:
        return <Badge variant="neutral" className="!rounded-full">{status}</Badge>;
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = o.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          o.user?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (activeTab === 'All') return true;
    if (activeTab === 'New' && o.status === 'PLACED') return true;
    if (activeTab === 'Packing' && (o.status === 'ACCEPTED' || o.status === 'PACKING')) return true;
    if (activeTab === 'Shipped' && (o.status === 'PICKUP' || o.status === 'ON_THE_WAY')) return true;
    if (activeTab === 'Completed' && o.status === 'DELIVERED') return true;
    
    return false;
  });

  const getAvailableActions = (status: string) => {
    switch (status) {
      case 'PLACED':
        return [
          { label: 'Accept Order', nextStatus: 'ACCEPTED' },
          { label: 'Cancel Order', nextStatus: 'CANCELLED' }
        ];
      case 'ACCEPTED':
        return [
          { label: 'Start Packing', nextStatus: 'PACKING' }
        ];
      case 'PACKING':
        return [
          { label: 'Ready for Pickup', nextStatus: 'PICKUP' }
        ];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Package className="w-8 h-8 mr-3 text-brand-secondary" />
          Order Management
        </h1>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card variant="dark">
          <h3 className="text-gray-400 font-medium mb-2 flex items-center gap-2"><Clock className="w-4 h-4 text-navy-400" /> New Orders</h3>
          <p className="text-3xl font-bold text-white">{orders.filter(o => o.status === 'PLACED').length}</p>
        </Card>
        <Card variant="dark">
          <h3 className="text-gray-400 font-medium mb-2 flex items-center gap-2"><Package className="w-4 h-4 text-warning-400" /> Packing</h3>
          <p className="text-3xl font-bold text-white">{orders.filter(o => o.status === 'ACCEPTED' || o.status === 'PACKING').length}</p>
        </Card>
        <Card variant="dark">
          <h3 className="text-gray-400 font-medium mb-2 flex items-center gap-2"><Truck className="w-4 h-4 text-primary-500" /> Out for Delivery</h3>
          <p className="text-3xl font-bold text-white">{orders.filter(o => o.status === 'PICKUP' || o.status === 'ON_THE_WAY').length}</p>
        </Card>
        <Card variant="dark">
          <h3 className="text-gray-400 font-medium mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4 text-success-400" /> Delivered Today</h3>
          <p className="text-3xl font-bold text-white">
            {orders.filter(o => o.status === 'DELIVERED' && new Date(o.updatedAt).toDateString() === new Date().toDateString()).length}
          </p>
        </Card>
      </div>

      <div className="bg-brand-primary border border-brand-muted rounded-xl overflow-visible">
        {/* Toolbar */}
        <div className="p-4 border-b border-brand-muted flex justify-between items-center bg-brand-dark/50">
          <div className="flex gap-2">
            {['All', 'New', 'Packing', 'Shipped', 'Completed'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${activeTab === tab ? 'bg-brand-secondary text-black' : 'text-gray-400 hover:bg-brand-muted'}`}
              >
                {tab}
              </button>
            ))}
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-500 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search Order ID or Customer..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-brand-dark border border-brand-muted rounded-lg pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-brand-secondary w-64"
            />
          </div>
        </div>

        {/* Table */}
        <div className="min-h-[400px] overflow-visible">
          {loading ? (
            <Loader fullScreen />
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No orders found.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-brand-dark text-gray-400 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Order ID & Time</th>
                  <th className="p-4 font-semibold">Customer</th>
                  <th className="p-4 font-semibold">My Items</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-muted">
                {filteredOrders.map((order) => {
                  // Calculate total price of ONLY the vendor's items in this order
                  const vendorItemsTotal = order.items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
                  const actions = getAvailableActions(order.status);
                  
                  return (
                    <tr key={order.id} className="hover:bg-brand-dark/30 transition-colors group">
                      <td className="p-4">
                        <div className="font-bold text-white">{order.id.substring(0, 13)}...</div>
                        <div className="text-xs text-gray-400 mt-1">{new Date(order.createdAt).toLocaleString()}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-white">{order.user?.name || 'Customer'}</div>
                        <div className="text-xs text-gray-400">{order.address?.city || ''}</div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-white">{order.items.length} items</div>
                        <div className="text-xs text-brand-secondary font-bold">₹{vendorItemsTotal}</div>
                        <div className="mt-1">
                          {order.items.map((item: any) => (
                            <div key={item.id} className="text-xs text-gray-400 truncate max-w-[200px]">
                              {item.quantity}x {item.product.name}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="relative inline-block text-left">
                          <button 
                            onClick={() => setActionMenuOpen(actionMenuOpen === order.id ? null : order.id)}
                            className="text-gray-400 hover:text-brand-secondary p-2 transition-colors"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>

                          {actionMenuOpen === order.id && (
                            <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-brand-dark border border-brand-muted ring-1 ring-black ring-opacity-5 z-20">
                              <div className="py-1">
                                {actions.map(action => (
                                  <button
                                    key={action.nextStatus}
                                    onClick={() => updateOrderStatus(order.id, action.nextStatus)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-brand-muted hover:text-white"
                                  >
                                    {action.label}
                                  </button>
                                ))}
                                {actions.length === 0 && (
                                  <div className="px-4 py-2 text-sm text-gray-500 italic">No actions available</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
