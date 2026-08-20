import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import { Clock, Truck, CheckCircle, MoreVertical, UserPlus, X, Printer } from 'lucide-react';
import { API_URL, resolveUploadUrl } from '../config/api';
import { getAdminSocket } from '../services/adminRealtime';
import { formatINR } from '@mechbazar/shared/web';
import LocationMapView from '../components/maps/LocationMapView';
import { Badge, Button, Card, DataTable, EmptyState, Modal, StatCard, Tabs, Icon3D } from '../components/ui';
import type { Column, TabItem } from '../components/ui';
import { fadeInUp } from '../utils/motion';
import { useConfirm } from '../hooks/useConfirm';

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

const TABS: TabItem[] = [
  { id: 'All', label: 'All' },
  { id: 'Pending', label: 'Pending' },
  { id: 'Processing', label: 'Processing' },
  { id: 'Delivering', label: 'Delivering' },
  { id: 'Delivered', label: 'Delivered' },
];

export default function Orders() {
  const { token } = useSelector((state: RootState) => state.auth);
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState(() => STATUS_PARAM_TO_TAB[searchParams.get('status') || ''] || 'All');
  const [searchQuery, setSearchQuery] = useState('');
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchOrders();
    fetchDrivers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Poll as a fallback in case the socket below is disconnected/reconnecting.
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(fetchOrders, ORDERS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // The backend already emits admin:order-update on every order status change
  // (orderState.ts's broadcastOrderStatus) -- mirrors ServiceBookingsPage's
  // admin:job-update listener so this page refreshes instantly instead of
  // waiting up to ORDERS_POLL_INTERVAL_MS for the next poll.
  useEffect(() => {
    if (!token) return;
    const socket = getAdminSocket();
    const onUpdate = () => fetchOrders();
    socket.on('admin:order-update', onUpdate);
    return () => {
      socket.off('admin:order-update', onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchOrders = async () => {
    if (!token) return null;
    try {
      setLoadError('');
      const res = await axios.get(`${API_URL}/orders/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOrders(res.data);
      return res.data;
    } catch (error) {
      console.error('Failed to fetch orders', error);
      setLoadError('Could not load orders. Please sign out and sign in again.');
      return null;
    } finally {
      setLoadingOrders(false);
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
      toast.error('Failed to assign driver');
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
      toast.error('Failed to update status');
    }
  };

  // Must match the real Prisma OrderStatus enum exactly (schema.prisma):
  // PLACED, ACCEPTED, PACKING, PICKUP, ON_THE_WAY, DELIVERED, CANCELLED, RETURNED.
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PLACED':
        return <Badge variant="secondary" className="flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> New Order</Badge>;
      case 'ACCEPTED':
      case 'PACKING':
        return <Badge variant="warning" className="flex items-center gap-1 w-fit"><Icon3D name="orders" size={12} /> {status === 'ACCEPTED' ? 'Accepted' : 'Packing'}</Badge>;
      case 'PICKUP':
      case 'ON_THE_WAY':
        return <Badge variant="primary" className="flex items-center gap-1 w-fit"><Truck className="w-3 h-3" /> {status === 'PICKUP' ? 'Awaiting Pickup' : 'Out for Delivery'}</Badge>;
      case 'DELIVERED':
        return <Badge variant="success" className="flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Delivered</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger" className="flex items-center gap-1 w-fit"><X className="w-3 h-3" /> Cancelled</Badge>;
      case 'RETURNED':
        return <Badge variant="danger" className="flex items-center gap-1 w-fit"><X className="w-3 h-3" /> Returned</Badge>;
      default:
        return <Badge variant="neutral" className="w-fit">{status}</Badge>;
    }
  };

  // Payment.method/status only ever diverge from COD/PENDING once Razorpay is
  // configured on the backend -- see apps/backend/src/services/payment.service.ts.
  // Rendered defensively (falls back to COD) since orders placed before this
  // column existed have no payment row shape guarantees beyond method/status.
  const getPaymentBadge = (payment: any) => {
    const method = payment?.method || 'COD';
    if (method === 'COD') {
      return <Badge variant="neutral" className="w-fit">COD</Badge>;
    }
    const status = payment?.status || 'PENDING';
    switch (status) {
      case 'SUCCESS':
        return <Badge variant="success" className="w-fit">Paid Online</Badge>;
      case 'FAILED':
        return <Badge variant="danger" className="w-fit">Payment Failed</Badge>;
      case 'REFUNDED':
        return <Badge variant="warning" className="w-fit">Refunded</Badge>;
      default:
        return <Badge variant="warning" className="w-fit">Payment Pending</Badge>;
    }
  };

  const handleReconcilePayment = async (orderId: string) => {
    setReconciling(true);
    try {
      const res = await axios.post(`${API_URL}/payments/${orderId}/reconcile`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(res.data.message || 'Reconciliation complete.');
      const refreshed = await fetchOrders();
      const refreshedOrder = refreshed?.find((o: any) => o.id === orderId);
      if (refreshedOrder) setSelectedOrder(refreshedOrder);
    } catch (error: any) {
      console.error('Failed to reconcile payment', error);
      toast.error(error.response?.data?.error || 'Failed to check payment status');
    } finally {
      setReconciling(false);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
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

  const columns: Column<any>[] = [
    {
      key: 'id',
      header: 'Order ID & Time',
      render: (order) => (
        <div>
          <button className="font-semibold text-content-primary hover:text-brand-primary transition-colors" onClick={() => setSelectedOrder(order)}>
            Order #{order.id.slice(-6).toUpperCase()}
          </button>
          <div className="text-xs text-content-muted mt-0.5">{new Date(order.createdAt).toLocaleString()}</div>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (order) => {
        const itemCount = order.items?.reduce((acc: number, curr: any) => acc + curr.quantity, 0) || 0;
        return (
          <div>
            <div className="font-medium text-content-primary">{order.user?.name || 'Unknown'}</div>
            <div className="text-xs text-content-muted">{itemCount} items · ₹{order.finalAmount}</div>
          </div>
        );
      },
    },
    { key: 'type', header: 'Type', render: () => <Badge variant="neutral" size="sm">RETAIL</Badge> },
    { key: 'status', header: 'Status', render: (order) => getStatusBadge(order.status) },
    { key: 'payment', header: 'Payment', render: (order) => getPaymentBadge(order.payment) },
    {
      key: 'driver',
      header: 'Driver',
      render: (order) => order.deliveryPartner
        ? <span className="text-sm font-medium text-content-secondary">{order.deliveryPartner.user?.name}</span>
        : <span className="text-sm text-content-muted italic">Unassigned</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (order) => (
        !order.deliveryPartner && !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(order.status) ? (
          <div className="relative inline-block text-left">
            <button
              onClick={() => setAssigningOrderId(assigningOrderId === order.id ? null : order.id)}
              className="bg-navy-500/10 text-navy-600 dark:text-navy-400 hover:bg-navy-500/20 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 ml-auto transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Assign Driver
            </button>
            {assigningOrderId === order.id && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-popover bg-surface-overlay ring-1 ring-border-default z-20">
                <div className="py-1">
                  {availableDrivers.length === 0 && <p className="px-4 py-2 text-sm text-content-muted">No active drivers</p>}
                  {availableDrivers.map((driver) => (
                    <button
                      key={driver.id}
                      onClick={() => handleAssignDriver(order.id, driver)}
                      className="w-full text-left px-4 py-2 text-sm text-content-secondary hover:bg-surface-hover hover:text-content-primary"
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
            <button onClick={() => setAssigningOrderId(assigningOrderId === order.id ? null : order.id)} className="text-content-muted hover:text-brand-primary p-2 transition-colors">
              <MoreVertical className="w-5 h-5" />
            </button>
            {assigningOrderId === order.id && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-popover bg-surface-overlay ring-1 ring-border-default z-20">
                <div className="py-1">
                  <button onClick={() => { setSelectedOrder(order); setAssigningOrderId(null); }} className="w-full text-left px-4 py-2 text-sm text-content-secondary hover:bg-surface-hover">
                    View Details
                  </button>
                  {order.status === 'PLACED' && (
                    <button onClick={() => handleUpdateStatus(order.id, 'ACCEPTED')} className="w-full text-left px-4 py-2 text-sm text-navy-600 dark:text-navy-400 hover:bg-surface-hover font-medium">
                      Accept Order
                    </button>
                  )}
                  {order.status === 'ACCEPTED' && (
                    <button onClick={() => handleUpdateStatus(order.id, 'PACKING')} className="w-full text-left px-4 py-2 text-sm text-navy-600 dark:text-navy-400 hover:bg-surface-hover font-medium">
                      Mark as Packing
                    </button>
                  )}
                  {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
                    <button
                      onClick={async () => { if (await confirm({ title: 'Cancel order', message: 'Are you sure you want to cancel this order?' })) handleUpdateStatus(order.id, 'CANCELLED'); }}
                      className="w-full text-left px-4 py-2 text-sm text-danger-500 hover:bg-danger-500/10"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      ),
    },
  ];

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="max-w-7xl mx-auto">
      {loadError && (
        <div className="mb-4 rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-600 dark:text-danger-400">
          {loadError}
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
            <Icon3D name="orders" size={30} eager /> Orders Dashboard
          </h2>
          <p className="text-content-secondary mt-1 text-sm">Manage incoming retail and wholesale orders</p>
        </div>
        <Button variant="outline" icon={<Printer size={15} />} onClick={() => window.print()}>Export / Print Report</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="New Orders" value={orders.filter(o => o.status === 'PLACED').length} icon="orders" gradient="blue" onClick={() => setActiveTab('Pending')} />
        <StatCard title="Processing" value={orders.filter(o => o.status === 'ACCEPTED' || o.status === 'PACKING').length} icon="gear" gradient="amber" onClick={() => setActiveTab('Processing')} />
        <StatCard title="Out for Delivery" value={orders.filter(o => o.status === 'PICKUP' || o.status === 'ON_THE_WAY').length} icon="riders" gradient="red" onClick={() => setActiveTab('Delivering')} />
        <StatCard title="Delivered Today" value={orders.filter(o => o.status === 'DELIVERED').length} icon="check" gradient="green" onClick={() => setActiveTab('Delivered')} />
      </div>

      <Card padding="none" className="overflow-visible">
        <div className="p-4 border-b border-border-default flex flex-wrap gap-3 justify-between items-center">
          <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} layoutId="orders-tab" />
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, name, phone…"
              className="bg-surface-sunken border border-border-default rounded-xl pl-4 pr-4 py-2 text-sm text-content-primary outline-none focus:border-brand-primary w-64"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredOrders}
          rowKey={(o) => o.id}
          loading={loadingOrders}
          pageSize={10}
          emptyState={<EmptyState icon="orders" title="No orders found" description="Try a different tab or search term." />}
          className="rounded-none border-none shadow-none"
        />
      </Card>

      {/* Order Details Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Order #${selectedOrder.id.slice(-6).toUpperCase()}` : ''}
        size="lg"
        footer={selectedOrder && (
          <>
            <Button variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>Print Invoice</Button>
            {selectedOrder.status === 'PLACED' && (
              <Button onClick={() => handleUpdateStatus(selectedOrder.id, 'ACCEPTED')}>Accept Order</Button>
            )}
          </>
        )}
      >
        {selectedOrder && (
          <>
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-sm text-content-muted mb-1">Customer Details</p>
                <p className="font-bold text-content-primary">{selectedOrder.user?.name}</p>
                <p className="text-content-secondary text-sm">{selectedOrder.user?.email}</p>
                {selectedOrder.address && (
                  <p className="text-content-secondary text-sm mt-1">
                    {selectedOrder.address.line1}{selectedOrder.address.line2 ? `, ${selectedOrder.address.line2}` : ''}, {selectedOrder.address.city}, {selectedOrder.address.state} {selectedOrder.address.pincode}<br />
                    Phone: {selectedOrder.user?.phone}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-content-muted mb-1">Order Status</p>
                {getStatusBadge(selectedOrder.status)}
              </div>
            </div>

            {(selectedOrder.address?.lat != null || selectedOrder.deliveryPartner?.currentLat != null) && (
              <div className="mb-6">
                <h4 className="font-bold text-content-primary mb-2 border-b border-border-default pb-2">Delivery Tracking</h4>
                <LocationMapView
                  markers={[
                    ...(selectedOrder.address?.lat != null
                      ? [{ id: 'destination', lat: selectedOrder.address.lat, lng: selectedOrder.address.lng, label: 'Delivery Address', color: 'red' as const }]
                      : []),
                    ...(selectedOrder.deliveryPartner?.currentLat != null
                      ? [{ id: 'rider', lat: selectedOrder.deliveryPartner.currentLat, lng: selectedOrder.deliveryPartner.currentLng, label: selectedOrder.deliveryPartner.user?.name || 'Rider', color: 'green' as const }]
                      : []),
                  ]}
                  height={220}
                />
                {selectedOrder.deliveryPartner?.currentLat == null && selectedOrder.deliveryPartner && (
                  <p className="text-xs text-content-muted mt-1.5 italic">Rider's live location not yet available.</p>
                )}
              </div>
            )}

            <h4 className="font-bold text-content-primary mb-3 border-b border-border-default pb-2">Order Items</h4>
            <div className="space-y-3 mb-6">
              {selectedOrder.items?.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center bg-surface-sunken p-3 rounded-xl">
                  <div>
                    <p className="font-medium text-content-primary">{item.product?.name}</p>
                    <p className="text-sm text-content-muted">Qty: {item.quantity} × ₹{item.price}</p>
                  </div>
                  <p className="font-bold text-content-primary">₹{item.quantity * item.price}</p>
                </div>
              ))}
            </div>

            <div className="bg-surface-sunken p-4 rounded-xl flex justify-between items-center mb-6">
              <p className="font-medium text-content-secondary">Total Amount</p>
              <p className="text-xl font-bold text-content-primary">{selectedOrder.finalAmount != null ? formatINR(selectedOrder.finalAmount) : '—'}</p>
            </div>

            <div className="bg-surface-sunken p-4 rounded-xl mb-6">
              <div className="flex justify-between items-center">
                <p className="font-medium text-content-secondary">Payment</p>
                {getPaymentBadge(selectedOrder.payment)}
              </div>
              {(!selectedOrder.payment || selectedOrder.payment.method === 'COD') ? (
                <div className="flex justify-between items-center mt-3">
                  <p className="text-sm text-content-secondary">Cash Collection</p>
                  <p className={`text-sm font-bold ${selectedOrder.codCollected ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                    {selectedOrder.codCollected ? 'Collected' : 'Not yet collected'}
                  </p>
                </div>
              ) : (
                <>
                  {selectedOrder.payment.status === 'FAILED' && selectedOrder.payment.failureReason && (
                    <p className="text-sm text-danger-500 mt-3">{selectedOrder.payment.failureReason}</p>
                  )}
                  {selectedOrder.payment.gatewayPaymentId && (
                    <p className="text-xs text-content-muted mt-3">Gateway payment ID: {selectedOrder.payment.gatewayPaymentId}</p>
                  )}
                  {selectedOrder.payment.status === 'PENDING' && (
                    <Button variant="secondary" className="mt-3 w-full" onClick={() => handleReconcilePayment(selectedOrder.id)} isLoading={reconciling}>
                      Recheck Payment Status
                    </Button>
                  )}
                </>
              )}
            </div>

            {selectedOrder.proofImageUrl && (
              <div className="mb-6">
                <p className="font-bold text-content-primary mb-2 border-b border-border-default pb-2">Delivery Proof</p>
                <img src={resolveUploadUrl(selectedOrder.proofImageUrl)} alt="Delivery proof" className="rounded-xl max-h-64 object-cover" />
              </div>
            )}

            {selectedOrder.issueReason && (
              <div className="bg-danger-500/10 p-4 rounded-xl">
                <p className="font-medium text-danger-600 dark:text-danger-400">Reported Issue</p>
                <p className="text-sm text-danger-500 mt-1">{selectedOrder.issueReason}</p>
              </div>
            )}
          </>
        )}
      </Modal>
    </motion.div>
  );
}
