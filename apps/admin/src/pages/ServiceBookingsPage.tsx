import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import type { RootState } from '../store';
import {
  ClipboardList, Search, Clock, Wrench, CheckCircle, UserPlus, X, FileText, IndianRupee,
  Ban, MapPin, Star, Navigation as NavigationIcon, PlayCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Badge, Dialog, Button, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

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
// mid-flow statuses.
const STATUS_TABS: { label: string; statuses?: string[] }[] = [
  { label: 'All' },
  { label: 'Today' },
  { label: 'Pending', statuses: ['PENDING', 'CONFIRMED'] },
  { label: 'Assigned', statuses: ['MECHANIC_ASSIGNED'] },
  { label: 'Accepted', statuses: ['MECHANIC_ACCEPTED'] },
  { label: 'On The Way', statuses: ['MECHANIC_ON_THE_WAY'] },
  { label: 'In Progress', statuses: ['ARRIVED', 'WORK_STARTED'] },
  { label: 'Completed', statuses: ['COMPLETED'] },
  { label: 'Cancelled', statuses: ['CANCELLED'] },
  // Not in the original filter spec, but a rejected job still needs
  // reassignment and must stay visible/actionable to the admin -- folding it
  // into "Pending" would hide that it needs attention for a different reason.
  { label: 'Rejected', statuses: ['REJECTED'] },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'PENDING': return <Badge variant="secondary" className="!rounded-full flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> Pending</Badge>;
    case 'CONFIRMED': return <Badge variant="secondary" className="!rounded-full flex items-center gap-1 w-fit">Confirmed</Badge>;
    case 'MECHANIC_ASSIGNED': return <Badge variant="warning" className="!rounded-full flex items-center gap-1 w-fit"><Wrench className="w-3 h-3" /> Assigned</Badge>;
    case 'MECHANIC_ACCEPTED': return <Badge variant="primary" className="!rounded-full flex items-center gap-1 w-fit">Accepted</Badge>;
    case 'MECHANIC_ON_THE_WAY': return <Badge variant="primary" className="!rounded-full flex items-center gap-1 w-fit">On The Way</Badge>;
    case 'ARRIVED': return <Badge variant="primary" className="!rounded-full flex items-center gap-1 w-fit">Arrived</Badge>;
    case 'WORK_STARTED': return <Badge variant="primary" className="!rounded-full flex items-center gap-1 w-fit">Work Started</Badge>;
    case 'COMPLETED': return <Badge variant="success" className="!rounded-full flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Completed</Badge>;
    case 'CANCELLED': return <Badge variant="danger" className="!rounded-full flex items-center gap-1 w-fit"><X className="w-3 h-3" /> Cancelled</Badge>;
    case 'REJECTED': return <Badge variant="danger" className="!rounded-full flex items-center gap-1 w-fit"><Ban className="w-3 h-3" /> Rejected</Badge>;
    default: return <Badge variant="neutral" className="!rounded-full">{status}</Badge>;
  }
};

export default function ServiceBookingsPage() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [searchParams] = useSearchParams();
  const [bookings, setBookings] = useState<any[]>([]);
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
  const [totalPages, setTotalPages] = useState(1);
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
      setTotalPages(res.data.pages);
      setTotalCount(res.data.total);
    } catch (error) {
      console.error('Failed to fetch bookings', error);
      setLoadError('Could not load bookings. Please sign out and sign in again.');
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchBookings();
    const interval = setInterval(fetchBookings, BOOKINGS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
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
      await axios.post(`${API_URL}/services/bookings/${assigningBooking.id}/assign`, { technicianId }, { headers: { Authorization: `Bearer ${token}` } });
      setAssigningBooking(null);
      fetchBookings();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to assign technician');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Cancel this booking?')) return;
    try {
      await axios.patch(`${API_URL}/services/bookings/${bookingId}/admin-status`, { status: 'CANCELLED' }, { headers: { Authorization: `Bearer ${token}` } });
      if (selectedBooking?.id === bookingId) setSelectedBooking(null);
      fetchBookings();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to cancel booking');
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
      alert(error.response?.data?.error || 'Failed to refund payment');
    }
  };

  const handleViewInvoice = async (bookingId: string) => {
    try {
      const res = await axios.get(`${API_URL}/services/bookings/${bookingId}/invoice`, { headers: { Authorization: `Bearer ${token}` } });
      setInvoice(res.data);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to load invoice');
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
      alert(error.response?.data?.error || `Failed to ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {loadError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      )}

      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <ClipboardList className="text-brand-primary w-8 h-8" />
            Service Bookings
          </h2>
          <p className="text-neutral-400 mt-1">Assign mechanics, track progress, and resolve issues</p>
        </div>
      </div>

      <div className="bg-neutral-900 rounded-2xl shadow-sm border border-neutral-800 overflow-visible">
        <div className="p-4 border-b border-neutral-800 flex flex-col gap-3 bg-neutral-950/50">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="flex gap-2 flex-wrap">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.label}
                  onClick={() => goToTab(tab.label)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeTab === tab.label ? 'bg-brand-primary text-white' : 'text-neutral-400 hover:bg-neutral-800'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-neutral-500 w-4 h-4" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search booking #, name, phone..."
                className="bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white outline-none focus:border-brand-primary w-64"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex gap-2">
              {(['All', 'Paid', 'Unpaid'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => goToPaymentFilter(opt)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${paymentFilter === opt ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:bg-neutral-800'}`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              {(['All', 'CAR', 'BIKE'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => goToVehicleFilter(opt)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${vehicleFilter === opt ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:bg-neutral-800'}`}
                >
                  {opt === 'CAR' ? 'Car' : opt === 'BIKE' ? 'Bike' : opt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950 text-neutral-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Booking ID</th>
                <th className="p-4 font-semibold">Customer</th>
                <th className="p-4 font-semibold">Phone</th>
                <th className="p-4 font-semibold">Vehicle</th>
                <th className="p-4 font-semibold">Service</th>
                <th className="p-4 font-semibold">Booking Date</th>
                <th className="p-4 font-semibold">Address</th>
                <th className="p-4 font-semibold">Payment</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Mechanic</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {bookings.length === 0 && (
                <tr><td colSpan={11} className="text-center py-12 text-neutral-500">No bookings found.</td></tr>
              )}
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-neutral-800/50 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-white cursor-pointer hover:text-brand-primary" onClick={() => setSelectedBooking(b)}>#{b.bookingNumber}</div>
                    <div className="text-xs text-neutral-500 mt-1">₹{b.finalAmount}</div>
                  </td>
                  <td className="p-4 text-sm text-white">{b.user?.name || 'Unknown'}</td>
                  <td className="p-4 text-sm text-neutral-400">{b.user?.phone}</td>
                  <td className="p-4 text-sm text-neutral-400">{b.vehicleBrand} {b.vehicleModel} ({b.vehicleType})</td>
                  <td className="p-4 text-sm text-neutral-400">{b.package?.name}</td>
                  <td className="p-4 text-sm text-neutral-400">{new Date(b.scheduledDate).toLocaleDateString()}</td>
                  <td className="p-4 text-xs text-neutral-500 max-w-[180px] truncate">{b.address ? `${b.address.city}, ${b.address.pincode}` : '—'}</td>
                  <td className="p-4">
                    <Badge variant={b.payment?.status === 'SUCCESS' ? 'success' : b.payment?.status === 'REFUNDED' ? 'warning' : 'secondary'} className="!rounded-full">
                      {b.payment?.status === 'SUCCESS' ? 'Paid' : b.payment?.status === 'REFUNDED' ? 'Refunded' : 'Unpaid'}
                    </Badge>
                  </td>
                  <td className="p-4">{getStatusBadge(b.status)}</td>
                  <td className="p-4">
                    {b.technician ? (
                      <span className="text-sm font-medium text-neutral-300">{b.technician.user?.name}</span>
                    ) : (
                      <span className="text-sm text-neutral-500 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      {!['COMPLETED', 'CANCELLED'].includes(b.status) && (
                        <button
                          onClick={() => openAssignDialog(b)}
                          className="bg-navy-500/10 text-navy-400 hover:bg-navy-500/20 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
                        >
                          <UserPlus className="w-4 h-4" /> {b.technician ? 'Reassign' : 'Assign'}
                        </button>
                      )}
                      {(ADMIN_STATUS_ACTIONS[b.status] || []).map((action) => (
                        <button
                          key={action.next}
                          onClick={() => handleAdminStatusChange(b.id, action.next, action.label)}
                          className="bg-success-500/10 text-success-400 hover:bg-success-500/20 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
                          title={action.label}
                        >
                          <PlayCircle className="w-4 h-4" /> {action.label}
                        </button>
                      ))}
                      {!['COMPLETED', 'CANCELLED'].includes(b.status) && (
                        <button onClick={() => handleCancelBooking(b.id)} className="text-danger-400 hover:text-danger-300 p-2 transition-colors" title="Cancel Booking">
                          <Ban className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-neutral-800 text-sm text-neutral-400">
          <span>{totalCount} booking{totalCount === 1 ? '' : 's'} total</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-neutral-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Assign Mechanic dialog -- shows a real comparison view (photo, rating,
          experience, skills, distance, current jobs, availability) instead of
          a bare name list. */}
      <Dialog
        isOpen={!!assigningBooking}
        onClose={() => setAssigningBooking(null)}
        title={`Assign Mechanic — #${assigningBooking?.bookingNumber || ''}`}
        size="xl"
      >
        {candidatesLoading ? (
          <Loader />
        ) : candidates.length === 0 ? (
          <p className="text-neutral-400 text-sm py-8 text-center">No approved mechanics match this booking's vehicle type.</p>
        ) : (
          <div className="space-y-3">
            {candidates.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <div className="flex items-center gap-4 min-w-0">
                  <TechnicianAvatar technicianId={c.id} documentId={c.photoDocumentId} name={c.name} token={token} />
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{c.name}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400 mt-1">
                      <span className="flex items-center gap-1"><Star className="w-3 h-3 text-warning-400" /> {(c.rating || 0).toFixed(1)}</span>
                      <span>{c.experienceYears != null ? `${c.experienceYears} yrs exp` : 'Exp N/A'}</span>
                      {c.distanceKm != null && <span className="flex items-center gap-1"><NavigationIcon className="w-3 h-3" /> {c.distanceKm.toFixed(1)} km</span>}
                      <span>{c.currentJobs} active job{c.currentJobs === 1 ? '' : 's'}</span>
                      <span className={c.isOnline ? 'text-success-400' : 'text-neutral-500'}>{c.isOnline ? 'Online' : 'Offline'}</span>
                    </div>
                    {c.skills?.length > 0 && (
                      <p className="text-xs text-neutral-500 mt-1 truncate">{c.skills.join(', ')}</p>
                    )}
                  </div>
                </div>
                <Button onClick={() => handleAssign(c.id)} className="shrink-0">Assign</Button>
              </div>
            ))}
          </div>
        )}
      </Dialog>

      {selectedBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-neutral-900 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-neutral-800">
              <h3 className="text-xl font-bold text-white">Booking #{selectedBooking.bookingNumber}</h3>
              <button onClick={() => { setSelectedBooking(null); setInvoice(null); }} className="text-neutral-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-sm text-neutral-500 mb-1">Customer</p>
                  <p className="font-bold text-white">{selectedBooking.user?.name}</p>
                  <p className="text-neutral-400 text-sm">{selectedBooking.user?.phone}</p>
                  {selectedBooking.address && (
                    <p className="text-neutral-400 text-sm mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {selectedBooking.address.line1}, {selectedBooking.address.city}, {selectedBooking.address.state} {selectedBooking.address.pincode}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-500 mb-1">Status</p>
                  {getStatusBadge(selectedBooking.status)}
                </div>
              </div>

              <div className="bg-neutral-950 p-4 rounded-lg mb-6">
                <p className="font-medium text-neutral-300 mb-1">{selectedBooking.package?.name}</p>
                <p className="text-sm text-neutral-500">{selectedBooking.vehicleBrand} {selectedBooking.vehicleModel} · {selectedBooking.category?.name}</p>
                {selectedBooking.issueDescription && (
                  <p className="text-sm text-neutral-400 mt-2 italic">"{selectedBooking.issueDescription}"</p>
                )}
              </div>

              <h4 className="font-bold text-white mb-4 border-b border-neutral-800 pb-2">Booking Timeline</h4>
              <div className="space-y-3 mb-6">
                {(selectedBooking.statusHistory || []).map((h: any) => (
                  <div key={h.id} className="flex justify-between items-center bg-neutral-950 p-3 rounded-lg">
                    <div>
                      <p className="font-medium text-white text-sm">{h.status.replace(/_/g, ' ')}</p>
                      {h.note && <p className="text-xs text-neutral-500 mt-1">{h.note}</p>}
                    </div>
                    <p className="text-xs text-neutral-500">{new Date(h.createdAt).toLocaleString()}</p>
                  </div>
                ))}
                {(!selectedBooking.statusHistory || selectedBooking.statusHistory.length === 0) && (
                  <p className="text-neutral-500 text-sm">No status history yet.</p>
                )}
              </div>

              <div className="bg-neutral-950 p-4 rounded-lg flex justify-between items-center mb-4">
                <p className="font-medium text-neutral-300">Total Amount</p>
                <p className="text-xl font-bold text-white">₹{selectedBooking.finalAmount?.toLocaleString()}</p>
              </div>

              {selectedBooking.payment && (
                <div className="bg-neutral-950 p-4 rounded-lg flex justify-between items-center mb-6">
                  <div>
                    <p className="font-medium text-neutral-300">Payment ({selectedBooking.payment.method})</p>
                    <p className={`text-sm font-bold ${selectedBooking.payment.status === 'REFUNDED' ? 'text-warning-400' : 'text-neutral-400'}`}>
                      {selectedBooking.payment.status}
                    </p>
                  </div>
                  {selectedBooking.payment.status !== 'REFUNDED' && (
                    <button onClick={() => handleRefund(selectedBooking.id)} className="flex items-center gap-2 text-sm font-bold text-warning-400 hover:text-warning-300">
                      <IndianRupee className="w-4 h-4" /> Refund
                    </button>
                  )}
                </div>
              )}

              {invoice && (
                <div className="bg-neutral-950 p-4 rounded-lg mb-6">
                  <p className="font-bold text-white mb-2">{invoice.invoiceNumber}</p>
                  <div className="text-sm text-neutral-400 space-y-1">
                    <div className="flex justify-between"><span>Subtotal</span><span>₹{invoice.subtotal}</span></div>
                    <div className="flex justify-between"><span>Additional Work</span><span>₹{invoice.additionalCost}</span></div>
                    <div className="flex justify-between"><span>Discount</span><span>₹{invoice.discountAmount}</span></div>
                    <div className="flex justify-between font-bold text-white"><span>Total</span><span>₹{invoice.totalAmount}</span></div>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => handleViewInvoice(selectedBooking.id)} className="flex-1 bg-neutral-800 text-neutral-300 py-2.5 rounded-lg font-bold hover:bg-neutral-700 flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" /> {invoice ? 'Refresh Invoice' : 'Generate / View Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
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
    return <img src={url} alt={name} className="w-12 h-12 rounded-full object-cover border border-neutral-700 shrink-0" />;
  }
  return (
    <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-lg font-bold text-brand-primary border border-neutral-700 shrink-0">
      {name ? name.charAt(0).toUpperCase() : 'M'}
    </div>
  );
}
