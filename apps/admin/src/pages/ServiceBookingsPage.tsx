import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import {
  Clock, Wrench, CheckCircle, UserPlus, X, FileText, IndianRupee,
  Ban, MapPin, Star, Navigation as NavigationIcon, PlayCircle,
} from 'lucide-react';
import { API_URL } from '../config/api';
import { getAdminSocket } from '../services/adminRealtime';
import { Badge, Button, Card, DataTable, EmptyState, Loader, Modal, Tabs, Icon3D } from '../components/ui';
import type { Column, TabItem } from '../components/ui';
import { fadeInUp } from '../utils/motion';

const BOOKINGS_POLL_INTERVAL_MS = 15000;
const PAGE_SIZE = 20;
// Admin can force these transitions directly for support/escalation use (e.g.
// a customer calls in because the technician's app didn't update status).
// This reuses the existing admin-status endpoint, which was already callable
// with any status -- these are just the first UI buttons for it. Completing
// a job this way skips the technician-side OTP check (that check only lives
// in the technician's own status-update endpoint), so it's gated behind an
// extra confirmation below.
const ADMIN_STATUS_ACTIONS: Record<string, { next: string; label: string }[]> = {
  MECHANIC_ACCEPTED: [{ next: 'MECHANIC_ON_THE_WAY', label: 'Start Service' }],
  MECHANIC_ON_THE_WAY: [{ next: 'ARRIVED', label: 'Mark Arrived' }],
  ARRIVED: [{ next: 'WORK_STARTED', label: 'Start Service' }],
  WORK_STARTED: [{ next: 'COMPLETED', label: 'Complete Service' }],
};

// "Today" is a date filter, not a status -- handled separately from the
// status-bucket tabs below. "In Progress" groups ARRIVED+WORK_STARTED, same
// grouping convention the previous single-tab page used for its wider
// mid-flow statuses. "Pending Assignment" is now the primary admin queue --
// there is no more automatic matching, so this is where every fresh booking
// (and every booking a mechanic declined/ignored) lands and waits for an
// admin to manually assign a mechanic.
const STATUS_TABS: { label: string; statuses?: string[] }[] = [
  { label: 'All' },
  { label: 'Today' },
  { label: 'Pending Assignment', statuses: ['PENDING_ADMIN_ASSIGNMENT', 'REJECTED'] },
  { label: 'Assigned', statuses: ['MECHANIC_ASSIGNED'] },
  { label: 'Accepted', statuses: ['MECHANIC_ACCEPTED'] },
  { label: 'On The Way', statuses: ['MECHANIC_ON_THE_WAY'] },
  { label: 'In Progress', statuses: ['ARRIVED', 'WORK_STARTED'] },
  { label: 'Completed', statuses: ['COMPLETED'] },
  { label: 'Cancelled', statuses: ['CANCELLED'] },
];

const TABS: TabItem[] = STATUS_TABS.map((t) => ({ id: t.label, label: t.label }));

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PENDING_ADMIN_ASSIGNMENT': return <Badge variant="secondary" className="flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> Pending Assignment</Badge>;
    case 'MECHANIC_ASSIGNED': return <Badge variant="warning" className="flex items-center gap-1 w-fit"><Wrench className="w-3 h-3" /> Assigned</Badge>;
    case 'MECHANIC_ACCEPTED': return <Badge variant="primary" className="flex items-center gap-1 w-fit">Accepted</Badge>;
    case 'MECHANIC_ON_THE_WAY': return <Badge variant="primary" className="flex items-center gap-1 w-fit">On The Way</Badge>;
    case 'ARRIVED': return <Badge variant="primary" className="flex items-center gap-1 w-fit">Arrived</Badge>;
    case 'WORK_STARTED': return <Badge variant="primary" className="flex items-center gap-1 w-fit">Work Started</Badge>;
    case 'COMPLETED': return <Badge variant="success" className="flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Completed</Badge>;
    case 'CANCELLED': return <Badge variant="danger" className="flex items-center gap-1 w-fit"><X className="w-3 h-3" /> Cancelled</Badge>;
    case 'REJECTED': return <Badge variant="danger" className="flex items-center gap-1 w-fit"><Ban className="w-3 h-3" /> Rejected</Badge>;
    default: return <Badge variant="neutral" className="w-fit">{status}</Badge>;
  }
};

export default function ServiceBookingsPage() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [searchParams] = useSearchParams();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    const initial = searchParams.get('filter');
    const match = STATUS_TABS.find((t) => t.label.toLowerCase() === initial?.toLowerCase());
    return match?.label || 'All';
  });
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');
  const [vehicleFilter, setVehicleFilter] = useState<'All' | 'CAR' | 'BIKE'>('All');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [invoice, setInvoice] = useState<any | null>(null);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [assigningBooking, setAssigningBooking] = useState<any | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);

  // Debounce the search box so every keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearchQuery(searchInput.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const goToTab = (label: string) => { setPage(1); setActiveTab(label); };
  const goToPaymentFilter = (opt: 'All' | 'Paid' | 'Unpaid') => { setPage(1); setPaymentFilter(opt); };
  const goToVehicleFilter = (opt: 'All' | 'CAR' | 'BIKE') => { setPage(1); setVehicleFilter(opt); };

  const buildParams = () => {
    const tab = STATUS_TABS.find((t) => t.label === activeTab);
    const params: Record<string, string | number> = { page, limit: PAGE_SIZE, sortBy: 'createdAt', sortOrder: 'desc' };
    if (tab?.statuses) params.status = tab.statuses.join(',');
    if (activeTab === 'Today') {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date(); end.setHours(23, 59, 59, 999);
      params.dateFrom = start.toISOString();
      params.dateTo = end.toISOString();
    }
    if (paymentFilter !== 'All') params.paymentStatus = paymentFilter.toUpperCase();
    if (vehicleFilter !== 'All') params.vehicleType = vehicleFilter;
    if (searchQuery) params.search = searchQuery;
    return params;
  };

  const fetchBookings = async () => {
    if (!token) return;
    try {
      setLoadError('');
      const res = await axios.get(`${API_URL}/services/bookings/all`, {
        headers: { Authorization: `Bearer ${token}` },
        params: buildParams(),
      });
      setBookings(res.data.bookings);
      setTotalCount(res.data.total);
    } catch (error) {
      console.error('Failed to fetch bookings', error);
      setLoadError('Could not load bookings. Please sign out and sign in again.');
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchBookings();
    const interval = setInterval(fetchBookings, BOOKINGS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, page, activeTab, paymentFilter, vehicleFilter, searchQuery]);

  // New booking, admin assignment, mechanic accept/reject -- every status
  // change now broadcasts admin:job-update (see realtimeBooking.ts and
  // jobState.ts's broadcastJobStatus), so this page can refresh instantly
  // instead of waiting up to BOOKINGS_POLL_INTERVAL_MS for the next poll.
  useEffect(() => {
    if (!token) return;
    const socket = getAdminSocket();
    const onUpdate = () => fetchBookings();
    socket.on('admin:job-update', onUpdate);
    return () => {
      socket.off('admin:job-update', onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, activeTab, paymentFilter, vehicleFilter, searchQuery]);

  const openAssignDialog = async (booking: any) => {
    setAssigningBooking(booking);
    setCandidates([]);
    setCandidatesLoading(true);
    try {
      const res = await axios.get(`${API_URL}/services/bookings/${booking.id}/assignable-technicians`, { headers: { Authorization: `Bearer ${token}` } });
      setCandidates(res.data);
    } catch (error) {
      console.error('Failed to fetch assignable technicians', error);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const handleAssign = async (technicianId: string) => {
    if (!assigningBooking) return;
    try {
      // Emergency jobs must go through the dispatch-aware endpoint (it also
      // closes any still-open offer) -- the plain scheduled-booking endpoint
      // rejects them outright. See jobAdmin.controller.ts's adminAssign vs.
      // service.controller.ts's assignTechnician.
      const endpoint = assigningBooking.isEmergency
        ? `${API_URL}/jobs/admin/${assigningBooking.id}/assign`
        : `${API_URL}/services/bookings/${assigningBooking.id}/assign`;
      await axios.post(endpoint, { technicianId }, { headers: { Authorization: `Bearer ${token}` } });
      setAssigningBooking(null);
      fetchBookings();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to assign technician');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      await axios.patch(`${API_URL}/services/bookings/${bookingId}/admin-status`, { status: 'CANCELLED' }, { headers: { Authorization: `Bearer ${token}` } });
      if (selectedBooking?.id === bookingId) setSelectedBooking(null);
      fetchBookings();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to cancel booking');
    }
  };

  const handleRefund = async (bookingId: string) => {
    if (!confirm("Mark this booking's payment as refunded?")) return;
    try {
      await axios.patch(`${API_URL}/services/bookings/${bookingId}/refund`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchBookings();
      const res = await axios.get(`${API_URL}/services/bookings/all`, { headers: { Authorization: `Bearer ${token}` } });
      setSelectedBooking(res.data.find((b: any) => b.id === bookingId) || null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to refund payment');
    }
  };

  const handleViewInvoice = async (bookingId: string) => {
    try {
      const res = await axios.get(`${API_URL}/services/bookings/${bookingId}/invoice`, { headers: { Authorization: `Bearer ${token}` } });
      setInvoice(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load invoice');
    }
  };

  const handleAdminStatusChange = async (bookingId: string, next: string, label: string) => {
    const confirmMsg =
      next === 'COMPLETED'
        ? `${label}? This skips the technician's OTP confirmation from the customer -- only use this for support overrides.`
        : `${label} for this booking?`;
    if (!confirm(confirmMsg)) return;
    try {
      await axios.patch(`${API_URL}/services/bookings/${bookingId}/admin-status`, { status: next }, { headers: { Authorization: `Bearer ${token}` } });
      fetchBookings();
    } catch (error: any) {
      toast.error(error.response?.data?.error || `Failed to ${label.toLowerCase()}`);
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'bookingId',
      header: 'Booking ID',
      render: (b) => (
        <div>
          <button className="font-semibold text-content-primary hover:text-brand-primary transition-colors" onClick={() => setSelectedBooking(b)}>
            #{b.bookingNumber}
          </button>
          <div className="text-xs text-content-muted mt-0.5">₹{b.finalAmount}</div>
        </div>
      ),
    },
    { key: 'customer', header: 'Customer', render: (b) => <span className="text-sm text-content-primary">{b.user?.name || 'Unknown'}</span> },
    { key: 'phone', header: 'Phone', render: (b) => <span className="text-sm text-content-secondary">{b.user?.phone}</span> },
    { key: 'vehicle', header: 'Vehicle', render: (b) => <span className="text-sm text-content-secondary">{b.vehicleBrand} {b.vehicleModel} ({b.vehicleType})</span> },
    { key: 'service', header: 'Service', render: (b) => <span className="text-sm text-content-secondary">{b.package?.name}</span> },
    { key: 'date', header: 'Booking Date', render: (b) => <span className="text-sm text-content-secondary">{b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString() : 'Not scheduled'}</span> },
    {
      key: 'address',
      header: 'Address',
      render: (b) => (
        <span className="text-xs text-content-muted block max-w-[180px] truncate">
          {b.address ? `${b.address.city}, ${b.address.pincode}` : '—'}
        </span>
      ),
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (b) => (
        <Badge variant={b.payment?.status === 'SUCCESS' ? 'success' : b.payment?.status === 'REFUNDED' ? 'warning' : 'secondary'}>
          {b.payment?.status === 'SUCCESS' ? 'Paid' : b.payment?.status === 'REFUNDED' ? 'Refunded' : 'Unpaid'}
        </Badge>
      ),
    },
    { key: 'status', header: 'Status', render: (b) => getStatusBadge(b.status) },
    {
      key: 'mechanic',
      header: 'Mechanic',
      render: (b) => b.technician
        ? <span className="text-sm font-medium text-content-secondary">{b.technician.user?.name}</span>
        : <span className="text-sm text-content-muted italic">Unassigned</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (b) => (
        <div className="flex justify-end gap-2">
          {!['COMPLETED', 'CANCELLED'].includes(b.status) && (
            <button
              onClick={() => openAssignDialog(b)}
              className="bg-navy-500/10 text-navy-600 dark:text-navy-400 hover:bg-navy-500/20 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> {b.technician ? 'Reassign' : 'Assign'}
            </button>
          )}
          {(ADMIN_STATUS_ACTIONS[b.status] || []).map((action) => (
            <button
              key={action.next}
              onClick={() => handleAdminStatusChange(b.id, action.next, action.label)}
              className="bg-success-500/10 text-success-600 dark:text-success-400 hover:bg-success-500/20 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
              title={action.label}
            >
              <PlayCircle className="w-4 h-4" /> {action.label}
            </button>
          ))}
          {!['COMPLETED', 'CANCELLED'].includes(b.status) && (
            <button onClick={() => handleCancelBooking(b.id)} className="text-danger-500 hover:text-danger-400 p-2 transition-colors" title="Cancel Booking">
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>
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

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
            <Icon3D name="bookings" size={30} eager /> Service Bookings
          </h2>
          <p className="text-content-secondary mt-1 text-sm">Assign mechanics, track progress, and resolve issues</p>
        </div>
      </div>

      <Card padding="none" className="overflow-visible">
        <div className="p-4 border-b border-border-default flex flex-col gap-3">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <Tabs tabs={TABS} value={activeTab} onChange={goToTab} layoutId="bookings-tab" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search booking #, name, phone..."
              className="bg-surface-sunken border border-border-default rounded-xl pl-4 pr-4 py-2 text-sm text-content-primary outline-none focus:border-brand-primary w-64"
            />
          </div>

          <div className="flex flex-wrap gap-5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-content-muted uppercase tracking-wide">Payment</span>
              {(['All', 'Paid', 'Unpaid'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => goToPaymentFilter(opt)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${paymentFilter === opt ? 'bg-brand-primary/10 text-brand-primary' : 'text-content-muted hover:bg-surface-hover hover:text-content-primary'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-content-muted uppercase tracking-wide">Vehicle</span>
              {(['All', 'CAR', 'BIKE'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => goToVehicleFilter(opt)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${vehicleFilter === opt ? 'bg-brand-primary/10 text-brand-primary' : 'text-content-muted hover:bg-surface-hover hover:text-content-primary'}`}
                >
                  {opt === 'CAR' ? 'Car' : opt === 'BIKE' ? 'Bike' : opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={bookings}
          rowKey={(b) => b.id}
          loading={loadingBookings}
          serverPagination={{ page, pageSize: PAGE_SIZE, total: totalCount, onPageChange: setPage }}
          emptyState={<EmptyState icon="bookings" title="No bookings found" description="Try a different tab or search term." />}
          className="rounded-none border-none shadow-none"
        />
      </Card>

      {/* Assign Mechanic modal -- shows a real comparison view (photo, rating,
          experience, skills, distance, current jobs, availability) instead of
          a bare name list. */}
      <Modal
        isOpen={!!assigningBooking}
        onClose={() => setAssigningBooking(null)}
        title={`Assign Mechanic — #${assigningBooking?.bookingNumber || ''}`}
        size="xl"
      >
        {candidatesLoading ? (
          <div className="flex justify-center py-8"><Loader /></div>
        ) : candidates.length === 0 ? (
          <p className="text-content-muted text-sm py-8 text-center">No approved mechanics match this booking's vehicle type.</p>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 rounded-xl border border-border-default bg-surface-sunken p-4">
                <div className="flex items-center gap-4 min-w-0">
                  <TechnicianAvatar technicianId={c.id} documentId={c.photoDocumentId} name={c.name} token={token} />
                  <div className="min-w-0">
                    <p className="font-bold text-content-primary truncate">{c.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted mt-1">
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 text-warning-400" /> {(c.rating || 0).toFixed(1)}</span>
                      <span>{c.experienceYears != null ? `${c.experienceYears} yrs exp` : 'Exp N/A'}</span>
                      {c.distanceKm != null && <span className="flex items-center gap-1"><NavigationIcon className="w-3 h-3" /> {c.distanceKm.toFixed(1)} km</span>}
                      <span>{c.currentJobs} active job{c.currentJobs === 1 ? '' : 's'}</span>
                      <span className={c.isOnline ? 'text-success-600 dark:text-success-400' : 'text-content-muted'}>{c.isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                    {c.skills?.length > 0 && (
                      <p className="text-xs text-content-muted mt-1 truncate">{c.skills.join(', ')}</p>
                    )}
                  </div>
                </div>
                <Button onClick={() => handleAssign(c.id)} className="shrink-0">Assign</Button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Booking Details modal */}
      <Modal
        isOpen={!!selectedBooking}
        onClose={() => { setSelectedBooking(null); setInvoice(null); }}
        title={selectedBooking ? `Booking #${selectedBooking.bookingNumber}` : ''}
        size="lg"
      >
        {selectedBooking && (
          <>
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-sm text-content-muted mb-1">Customer</p>
                <p className="font-bold text-content-primary">{selectedBooking.user?.name}</p>
                <p className="text-content-secondary text-sm">{selectedBooking.user?.phone}</p>
                {selectedBooking.address && (
                  <p className="text-content-secondary text-sm mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {selectedBooking.address.line1}, {selectedBooking.address.city}, {selectedBooking.address.state} {selectedBooking.address.pincode}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-content-muted mb-1">Status</p>
                {getStatusBadge(selectedBooking.status)}
              </div>
            </div>

            <div className="bg-surface-sunken p-4 rounded-xl mb-6">
              <p className="font-medium text-content-secondary mb-1">{selectedBooking.package?.name}</p>
              <p className="text-sm text-content-muted">{selectedBooking.vehicleBrand} {selectedBooking.vehicleModel} · {selectedBooking.category?.name}</p>
              {selectedBooking.issueDescription && (
                <p className="text-sm text-content-secondary mt-2 italic">"{selectedBooking.issueDescription}"</p>
              )}
            </div>

            <h4 className="font-bold text-content-primary mb-3 border-b border-border-default pb-2">Booking Timeline</h4>
            <div className="space-y-3 mb-6">
              {(selectedBooking.statusHistory || []).map((h: any) => (
                <div key={h.id} className="flex justify-between items-center bg-surface-sunken p-3 rounded-xl">
                  <div>
                    <p className="font-medium text-content-primary text-sm">{h.status.replace(/_/g, ' ')}</p>
                    {h.note && <p className="text-xs text-content-muted mt-1">{h.note}</p>}
                  </div>
                  <p className="text-xs text-content-muted">{new Date(h.createdAt).toLocaleString()}</p>
                </div>
              ))}
              {(!selectedBooking.statusHistory || selectedBooking.statusHistory.length === 0) && (
                <p className="text-content-muted text-sm">No status history yet.</p>
              )}
            </div>

            <div className="bg-surface-sunken p-4 rounded-xl flex justify-between items-center mb-4">
              <p className="font-medium text-content-secondary">Total Amount</p>
              <p className="text-xl font-bold text-content-primary">₹{selectedBooking.finalAmount?.toLocaleString()}</p>
            </div>

            {selectedBooking.payment && (
              <div className="bg-surface-sunken p-4 rounded-xl flex justify-between items-center mb-6">
                <div>
                  <p className="font-medium text-content-secondary">Payment ({selectedBooking.payment.method})</p>
                  <p className={`text-sm font-bold ${selectedBooking.payment.status === 'REFUNDED' ? 'text-warning-600 dark:text-warning-400' : 'text-content-secondary'}`}>
                    {selectedBooking.payment.status}
                  </p>
                </div>
                {selectedBooking.payment.status !== 'REFUNDED' && (
                  <button onClick={() => handleRefund(selectedBooking.id)} className="flex items-center gap-2 text-sm font-bold text-warning-600 dark:text-warning-400 hover:text-warning-500">
                    <IndianRupee className="w-4 h-4" /> Refund
                  </button>
                )}
              </div>
            )}

            {invoice && (
              <div className="bg-surface-sunken p-4 rounded-xl mb-6">
                <p className="font-bold text-content-primary mb-2">{invoice.invoiceNumber}</p>
                <div className="text-sm text-content-secondary space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>₹{invoice.subtotal}</span></div>
                  <div className="flex justify-between"><span>Additional Work</span><span>₹{invoice.additionalCost}</span></div>
                  <div className="flex justify-between"><span>Discount</span><span>₹{invoice.discountAmount}</span></div>
                  <div className="flex justify-between font-bold text-content-primary"><span>Total</span><span>₹{invoice.totalAmount}</span></div>
                </div>
              </div>
            )}

            <Button variant="secondary" className="w-full" icon={<FileText className="w-4 h-4" />} onClick={() => handleViewInvoice(selectedBooking.id)}>
              {invoice ? 'Refresh Invoice' : 'Generate / View Invoice'}
            </Button>
          </>
        )}
      </Modal>
    </motion.div>
  );
}

// Small self-contained fetcher for a technician's SELFIE document, reusing the
// existing per-document blob-file endpoint (same pattern Technicians.tsx's
// viewDocument already uses) -- falls back to an initial-letter avatar when
// there's no photo, rather than any placeholder image.
function TechnicianAvatar({ technicianId, documentId, name, token }: { technicianId: string; documentId: string | null; name: string; token: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    if (documentId && token) {
      axios
        .get(`${API_URL}/technicians/${technicianId}/documents/${documentId}/file`, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' })
        .then((res) => {
          objectUrl = URL.createObjectURL(res.data);
          setUrl(objectUrl);
        })
        .catch(() => setUrl(null));
    }
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [technicianId, documentId, token]);

  if (url) {
    return <img src={url} alt={name} className="w-12 h-12 rounded-full object-cover border border-border-default shrink-0" />;
  }
  return (
    <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center text-lg font-bold text-brand-primary border border-border-default shrink-0">
      {name ? name.charAt(0).toUpperCase() : 'M'}
    </div>
  );
}
