import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import type { RootState } from '../store';
import { Package, Search, Clock, Truck, CheckCircle, MoreVertical, UserPlus, X } from 'lucide-react';
import { Badge, Card } from '@mechbazar/shared/web';
import { API_URL, SERVER_ORIGIN } from '../config/api';

const ORDERS_POLL_INTERVAL_MS = 20000;

// Maps the ?status= value used by Dashboard's stat-card links to this page's tabs.
const STATUS_PARAM_TO_TAB: Record<string, string> = {
  PLACED: 'Pending',
  PENDING: 'Pending',
  ACCEPTED: 'Processing',
  PACKING: 'Processing',
  PICKUP: 'Delivering',
  ON_THE_WAY: 'Delivering',
  DELIVERED: 'Delivered',
};

export default function Orders() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState(() => STATUS_PARAM_TO_TAB[searchParams.get('status') || ''] || 'All');
  const [searchQuery, setSearchQuery] = useState('');
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchOrders();
    fetchDrivers();
  }, [token]);

  // Live refresh -- no push channel on this deployment, so poll instead of
  // waiting for a manual refresh/navigation to pick up new orders.
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(fetchOrders, ORDERS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token]);

  const fetchOrders = async () => {
    if (!token) return;
    try {
      setLoadError('');
      const res = await axios.get(`${API_URL}/orders/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data);
    } catch (error) {
      console.error('Failed to fetch orders', error);
      setLoadError('Could not load orders. Please sign out and sign in again.');
    }
  };

  const fetchDrivers = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/riders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const onlineDrivers = res.data.filter((rider: any) => rider.deliveryProfile?.isOnline);
      setAvailableDrivers(onlineDrivers);
    } catch (error) {
      console.error('Failed to fetch riders', error);
    }
  };

  const handleAssignDriver = async (orderId: string, driver: any) => {
    try {
      await axios.put(`${API_URL}/orders/${orderId}/assign-rider`,
        { riderId: driver.deliveryProfile.id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssigningOrderId(null);
      fetchOrders();
    } catch (error) {
      console.error('Failed to assign driver', error);
      alert('Failed to assign driver');
    }
  };

  const handleUpdateStatus = async (orderId: string, status: string) => {
    try {
      await axios.put(`${API_URL}/orders/${orderId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAssigningOrderId(null);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder(null);
      }
      fetchOrders();
    } catch (error) {
      console.error('Failed to update order status', error);
      alert('Failed to update status');
    }
  };

  // Must match the real Prisma OrderStatus enum exactly (schema.prisma):
  // PLACED, ACCEPTED, PACKING, PICKUP, ON_THE_WAY, DELIVERED, CANCELLED, RETURNED.
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PLACED':
        return <Badge variant="secondary" className="!rounded-full flex items-center gap-1 w-fit"><Clock className="w-3 h-3"/> New Order</Badge>;
      case 'ACCEPTED':
      case 'PACKING':
        return <Badge variant="warning" className="!rounded-full flex items-center gap-1 w-fit"><Package className="w-3 h-3"/> {status === 'ACCEPTED' ? 'Accepted' : 'Packing'}</Badge>;
      case 'PICKUP':
      case 'ON_THE_WAY':
        return <Badge variant="primary" className="!rounded-full flex items-center gap-1 w-fit"><Truck className="w-3 h-3"/> {status === 'PICKUP' ? 'Awaiting Pickup' : 'Out for Delivery'}</Badge>;
      case 'DELIVERED':
        return <Badge variant="success" className="!rounded-full flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3"/> Delivered</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger" className="!rounded-full flex items-center gap-1 w-fit"><X className="w-3 h-3"/> Cancelled</Badge>;
      case 'RETURNED':
        return <Badge variant="danger" className="!rounded-full flex items-center gap-1 w-fit"><X className="w-3 h-3"/> Returned</Badge>;
      default:
        return <Badge variant="neutral" className="!rounded-full flex items-center gap-1 w-fit">{status}</Badge>;
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Filter by tab
      const statusMap: any = {
        'Pending': ['PLACED'],
        'Processing': ['ACCEPTED', 'PACKING'],
        'Delivering': ['PICKUP', 'ON_THE_WAY'],
        'Delivered': ['DELIVERED'],
      };
      const allowedStatuses = statusMap[activeTab];
      if (allowedStatuses && !allowedStatuses.includes(order.status)) {
        return false;
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesId = order.id.toLowerCase().includes(query);
        const matchesUser = order.user?.name?.toLowerCase().includes(query);
        const matchesPhone = order.shippingAddress?.phone?.toLowerCase().includes(query);
        if (!matchesId && !matchesUser && !matchesPhone) {
          return false;
        }
      }
      return true;
    });
  }, [orders, activeTab, searchQuery]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(start, start + itemsPerPage);
  }, [filteredOrders, currentPage]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {loadError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Package className="text-brand-primary w-8 h-8" />
            Orders Dashboard
          </h2>
          <p className="text-neutral-400 mt-1">Manage incoming retail and wholesale orders</p>
        </div>
        <button onClick={() => window.print()} className="bg-brand-primary text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm hover:bg-brand-accent transition-all">
          Export / Print Report
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card variant="dark" className="cursor-pointer" onClick={() => setActiveTab('Pending')}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-navy-500/10 text-navy-400 rounded-lg"><Clock className="w-5 h-5" /></div>
            <h3 className="text-neutral-400 font-medium">New Orders</h3>
          </div>
          <p className="text-3xl font-bold text-white">{orders.filter(o => o.status === 'PLACED').length}</p>
        </Card>

        <Card variant="dark" className="cursor-pointer" onClick={() => setActiveTab('Processing')}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-warning-500/10 text-warning-400 rounded-lg"><Package className="w-5 h-5" /></div>
            <h3 className="text-neutral-400 font-medium">Processing</h3>
          </div>
          <p className="text-3xl font-bold text-white">{orders.filter(o => o.status === 'ACCEPTED' || o.status === 'PACKING').length}</p>
        </Card>

        <Card variant="dark" className="cursor-pointer" onClick={() => setActiveTab('Delivering')}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-lg"><Truck className="w-5 h-5" /></div>
            <h3 className="text-neutral-400 font-medium">Out for Delivery</h3>
          </div>
          <p className="text-3xl font-bold text-white">{orders.filter(o => o.status === 'PICKUP' || o.status === 'ON_THE_WAY').length}</p>
        </Card>

        <Card variant="dark" className="cursor-pointer" onClick={() => setActiveTab('Delivered')}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-success-500/10 text-success-400 rounded-lg"><CheckCircle className="w-5 h-5" /></div>
            <h3 className="text-neutral-400 font-medium">Delivered Today</h3>
          </div>
          <p className="text-3xl font-bold text-white">{orders.filter(o => o.status === 'DELIVERED').length}</p>
        </Card>
      </div>

      {/* Main Table Card */}
      <div className="bg-neutral-900 rounded-2xl shadow-sm border border-neutral-800 overflow-visible">
        {/* Toolbar */}
        <div className="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-950/50">
          <div className="flex gap-2">
            {['All', 'Pending', 'Processing', 'Delivering', 'Delivered'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === tab ? 'bg-brand-primary text-white' : 'text-neutral-400 hover:bg-neutral-800'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-neutral-500 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ID, name, phone..."
                className="bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-brand-primary w-64"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950 text-neutral-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Order ID & Time</th>
                <th className="p-4 font-semibold">Customer</th>
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Driver</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {paginatedOrders.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-neutral-500">No orders found.</td>
                </tr>
              )}
              {paginatedOrders.map((order) => {
                const itemCount = order.items?.reduce((acc: number, curr: any) => acc + curr.quantity, 0) || 0;
                return (
                <tr key={order.id} className="hover:bg-neutral-800/50 transition-colors group relative">
                  <td className="p-4">
                    <div className="font-bold text-white cursor-pointer hover:text-brand-primary" onClick={() => setSelectedOrder(order)}>Order #{order.id.slice(-6).toUpperCase()}</div>
                    <div className="text-xs text-neutral-500 mt-1">{new Date(order.createdAt).toLocaleString()}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-medium text-white">{order.user?.name || 'Unknown'}</div>
                    <div className="text-xs text-neutral-500">{itemCount} items • ₹{order.finalAmount}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold bg-neutral-800 text-neutral-300`}>
                      RETAIL
                    </span>
                  </td>
                  <td className="p-4">
                    {getStatusBadge(order.status)}
                  </td>
                  <td className="p-4">
                    {order.deliveryPartner ? (
                      <span className="text-sm font-medium text-neutral-300">{order.deliveryPartner.user?.name}</span>
                    ) : (
                      <span className="text-sm text-neutral-500 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {!order.deliveryPartner && !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(order.status) ? (
                      <div className="relative inline-block text-left">
                        <button
                          onClick={() => setAssigningOrderId(assigningOrderId === order.id ? null : order.id)}
                          className="bg-navy-500/10 text-navy-400 hover:bg-navy-500/20 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 ml-auto transition-colors"
                        >
                          <UserPlus className="w-4 h-4" />
                          Assign Driver
                        </button>

                        {/* Driver Dropdown */}
                        {assigningOrderId === order.id && (
                          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-neutral-900 ring-1 ring-neutral-800 z-20">
                            <div className="py-1" role="menu" aria-orientation="vertical">
                              {availableDrivers.length === 0 && (
                                <p className="px-4 py-2 text-sm text-neutral-500">No active drivers</p>
                              )}
                              {availableDrivers.map(driver => (
                                <button
                                  key={driver.id}
                                  onClick={() => handleAssignDriver(order.id, driver)}
                                  className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white"
                                >
                                  {driver.user?.name} - {driver.deliveryProfile?.vehicleType || 'Bike'}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative inline-block text-left">
                        <button
                          onClick={() => setAssigningOrderId(assigningOrderId === order.id ? null : order.id)}
                          className="text-neutral-500 hover:text-brand-primary p-2 transition-colors"
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>

                        {/* General Actions Dropdown */}
                        {assigningOrderId === order.id && (
                          <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-neutral-900 ring-1 ring-neutral-800 z-20">
                            <div className="py-1" role="menu" aria-orientation="vertical">
                              <button
                                onClick={() => { setSelectedOrder(order); setAssigningOrderId(null); }}
                                className="w-full text-left px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
                              >
                                View Details
                              </button>
                              {order.status === 'PLACED' && (
                                <button
                                  onClick={() => handleUpdateStatus(order.id, 'ACCEPTED')}
                                  className="w-full text-left px-4 py-2 text-sm text-navy-400 hover:bg-neutral-800 font-medium"
                                >
                                  Accept Order
                                </button>
                              )}
                              {order.status === 'ACCEPTED' && (
                                <button
                                  onClick={() => handleUpdateStatus(order.id, 'PACKING')}
                                  className="w-full text-left px-4 py-2 text-sm text-navy-400 hover:bg-neutral-800 font-medium"
                                >
                                  Mark as Packing
                                </button>
                              )}
                              {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                                <button
                                  onClick={() => {
                                    if(confirm('Are you sure you want to cancel this order?')) {
                                      handleUpdateStatus(order.id, 'CANCELLED');
                                    }
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-danger-400 hover:bg-danger-500/10"
                                >
                                  Cancel Order
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 border-t border-neutral-800 bg-neutral-950/50">
              <span className="text-sm text-neutral-500">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredOrders.length)} of {filteredOrders.length} orders
              </span>
              <div className="flex gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1 border border-neutral-800 rounded-lg bg-neutral-900 disabled:opacity-50 text-sm font-medium text-neutral-300 hover:bg-neutral-800"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 border border-neutral-800 rounded-lg bg-neutral-900 disabled:opacity-50 text-sm font-medium text-neutral-300 hover:bg-neutral-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-neutral-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-neutral-800">
              <h3 className="text-xl font-bold text-white">Order #{selectedOrder.id.slice(-6).toUpperCase()}</h3>
              <button onClick={() => setSelectedOrder(null)} className="text-neutral-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-sm text-neutral-500 mb-1">Customer Details</p>
                  <p className="font-bold text-white">{selectedOrder.user?.name}</p>
                  <p className="text-neutral-400 text-sm">{selectedOrder.user?.email}</p>
                  {selectedOrder.address && (
                    <p className="text-neutral-400 text-sm mt-1">
                      {selectedOrder.address.line1}{selectedOrder.address.line2 ? `, ${selectedOrder.address.line2}` : ''}, {selectedOrder.address.city}, {selectedOrder.address.state} {selectedOrder.address.pincode}<br />
                      Phone: {selectedOrder.user?.phone}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-500 mb-1">Order Status</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
              </div>

              <h4 className="font-bold text-white mb-4 border-b border-neutral-800 pb-2">Order Items</h4>
              <div className="space-y-4 mb-6">
                {selectedOrder.items?.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center bg-neutral-950 p-3 rounded-lg">
                    <div>
                      <p className="font-medium text-white">{item.product?.name}</p>
                      <p className="text-sm text-neutral-500">Qty: {item.quantity} × ₹{item.price}</p>
                    </div>
                    <p className="font-bold text-white">₹{item.quantity * item.price}</p>
                  </div>
                ))}
              </div>

              <div className="bg-neutral-950 p-4 rounded-lg flex justify-between items-center mb-6">
                <p className="font-medium text-neutral-300">Total Amount</p>
                <p className="text-xl font-bold text-white">₹{selectedOrder.finalAmount?.toLocaleString()}</p>
              </div>

              {selectedOrder.payment?.method === 'COD' && (
                <div className="bg-neutral-950 p-4 rounded-lg flex justify-between items-center mb-6">
                  <p className="font-medium text-neutral-300">COD Collection</p>
                  <p className={`text-sm font-bold ${selectedOrder.codCollected ? 'text-success-400' : 'text-danger-400'}`}>
                    {selectedOrder.codCollected ? 'Collected' : 'Not yet collected'}
                  </p>
                </div>
              )}

              {selectedOrder.proofImageUrl && (
                <div className="mb-6">
                  <p className="font-bold text-white mb-2 border-b border-neutral-800 pb-2">Delivery Proof</p>
                  <img src={`${SERVER_ORIGIN}${selectedOrder.proofImageUrl}`} alt="Delivery proof" className="rounded-lg max-h-64 object-cover" />
                </div>
              )}

              {selectedOrder.issueReason && (
                <div className="bg-danger-500/10 p-4 rounded-lg mb-6">
                  <p className="font-medium text-danger-400">Reported Issue</p>
                  <p className="text-sm text-danger-300 mt-1">{selectedOrder.issueReason}</p>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => window.print()} className="flex-1 bg-neutral-800 text-neutral-300 py-2.5 rounded-lg font-bold hover:bg-neutral-700">
                  Print Invoice
                </button>
                {selectedOrder.status === 'PLACED' && (
                  <button onClick={() => handleUpdateStatus(selectedOrder.id, 'ACCEPTED')} className="flex-1 bg-navy-500 text-white py-2.5 rounded-lg font-bold hover:bg-navy-600">
                    Accept Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
