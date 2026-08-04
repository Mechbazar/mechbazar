import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import { Navigation, Bike, Car, Truck, Search, Phone, CheckCircle, XCircle, Plus, FileText, Landmark, Eye, FileCheck } from 'lucide-react';
import { Button, Card, Badge, Checkbox, EmptyState, Input, Modal, Select, Tabs, Icon3D } from '../components/ui';
import type { TabItem } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';

const KYC_REVIEWABLE = new Set(['PENDING', 'UNDER_VERIFICATION', 'RESUBMISSION_REQUIRED']);

const RIDER_TABS: TabItem[] = [
  { id: 'ALL', label: 'All Riders' },
  { id: 'ONLINE', label: 'Online Now' },
  { id: 'OFFLINE', label: 'Offline' },
];

const getKycStatusBadge = (status: string) => {
  switch (status) {
    case 'APPROVED': return <Badge variant="success" size="sm" className="w-fit">Approved</Badge>;
    case 'PENDING': return <Badge variant="neutral" size="sm" className="w-fit">Not Submitted</Badge>;
    case 'UNDER_VERIFICATION': return <Badge variant="warning" size="sm" className="w-fit animate-pulse">Needs Review</Badge>;
    case 'RESUBMISSION_REQUIRED': return <Badge variant="warning" size="sm" className="w-fit">Resubmission Requested</Badge>;
    case 'REJECTED': return <Badge variant="danger" size="sm" className="w-fit">Rejected</Badge>;
    case 'SUSPENDED': return <Badge variant="danger" size="sm" className="w-fit">Suspended</Badge>;
    case 'BLOCKED': return <Badge variant="danger" size="sm" className="w-fit">Blocked</Badge>;
    default: return <Badge variant="neutral" size="sm" className="w-fit">{status || 'N/A'}</Badge>;
  }
};

export default function Riders() {
  const { token } = useSelector((state: RootState) => state.auth);
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_REGEX = /^\d{10}$/;
  const LICENSE_REGEX = /^[A-Z0-9-]{6,15}$/;
  const [riders, setRiders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    vehicleType: 'BIKE',
    licenseNumber: '',
    isActive: true,
    isOnline: false
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeRider, setActiveRider] = useState<any>(null);
  const [remarks, setRemarks] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchRiders();
  }, [token]);

  const fetchRiders = async () => {
    try {
      const res = await axios.get(`${API_URL}/riders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRiders(res.data);
    } catch (error) {
      console.error('Failed to fetch riders', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRiders = riders.filter(r => {
    if (filter === 'ONLINE' && !r.deliveryProfile?.isOnline) return false;
    if (filter === 'OFFLINE' && r.deliveryProfile?.isOnline) return false;

    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return (
        (r.name && r.name.toLowerCase().includes(search)) ||
        (r.phone && r.phone.includes(search)) ||
        (r.deliveryProfile?.vehicleType && r.deliveryProfile.vehicleType.toLowerCase().includes(search))
      );
    }
    return true;
  });

  const getVehicleIcon = (type: string) => {
    if (!type) return <Bike className="w-5 h-5 text-brand-primary" />;
    const lower = type.toLowerCase();
    if (lower.includes('bike') || lower.includes('scooter')) return <Bike className="w-5 h-5 text-brand-primary" />;
    if (lower.includes('truck') || lower.includes('tempo')) return <Truck className="w-5 h-5 text-brand-primary" />;
    return <Car className="w-5 h-5 text-brand-primary" />;
  };

  const handleOpenModal = (rider?: any) => {
    setFieldErrors({});
    setFormError('');
    if (rider) {
      setIsEditing(true);
      setFormData({
        id: rider.id,
        name: rider.name || '',
        phone: rider.phone || '',
        email: rider.email || '',
        city: rider.city || '',
        state: rider.state || '',
        vehicleType: rider.deliveryProfile?.vehicleType || 'BIKE',
        licenseNumber: rider.deliveryProfile?.licenseNumber || '',
        isActive: rider.deliveryProfile?.isActive ?? true,
        isOnline: rider.deliveryProfile?.isOnline ?? false
      });
    } else {
      setIsEditing(false);
      setFormData({
        id: '', name: '', phone: '', email: '', city: '', state: '', vehicleType: 'BIKE', licenseNumber: '', isActive: true, isOnline: false
      });
    }
    setShowModal(true);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const trimmedName = formData.name.trim();
    const normalizedPhone = formData.phone.replace(/\D/g, '');
    const trimmedEmail = formData.email.trim().toLowerCase();
    const trimmedCity = formData.city.trim();
    const normalizedLicense = formData.licenseNumber.trim().toUpperCase();
    const normalizedVehicleType = formData.vehicleType.trim().toUpperCase();

    if (!trimmedName) errors.name = 'Name is required';
    if (!PHONE_REGEX.test(normalizedPhone)) errors.phone = 'Phone must be exactly 10 digits';
    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) errors.email = 'Enter a valid email address';
    if (!trimmedCity) errors.city = 'City is required';
    if (!normalizedVehicleType) errors.vehicleType = 'Vehicle type is required';
    if (!LICENSE_REGEX.test(normalizedLicense)) {
      errors.licenseNumber = 'License must be 6-15 chars (A-Z, 0-9, hyphen)';
    }

    const normalizedState = formData.state.trim();
    const duplicatePhone = riders.find(
      (r) => r.phone === normalizedPhone && (!isEditing || r.id !== formData.id)
    );
    const duplicateEmail = trimmedEmail
      ? riders.find(
          (r) =>
            (r.email || '').toLowerCase() === trimmedEmail && (!isEditing || r.id !== formData.id)
        )
      : null;

    if (duplicatePhone) errors.phone = 'This phone number is already in use';
    if (duplicateEmail) errors.email = 'This email is already in use';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return null;

    return {
      ...formData,
      name: trimmedName,
      phone: normalizedPhone,
      email: trimmedEmail,
      city: trimmedCity,
      state: normalizedState,
      vehicleType: normalizedVehicleType,
      licenseNumber: normalizedLicense,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const payload = validateForm();
    if (!payload) return;

    try {
      if (isEditing) {
        await axios.put(`${API_URL}/riders/${formData.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/riders`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowModal(false);
      fetchRiders();
    } catch (error: any) {
      console.error('Failed to save rider', error);
      const apiError = error.response?.data?.error || 'Failed to save rider.';
      setFormError(apiError);
      if (/email/i.test(apiError)) {
        setFieldErrors((prev) => ({ ...prev, email: apiError }));
      }
      if (/phone/i.test(apiError)) {
        setFieldErrors((prev) => ({ ...prev, phone: apiError }));
      }
    }
  };

  const handleToggleStatus = async (rider: any) => {
    try {
      await axios.put(`${API_URL}/riders/${rider.id}`, {
        ...rider,
        vehicleType: rider.deliveryProfile?.vehicleType,
        licenseNumber: rider.deliveryProfile?.licenseNumber,
        isOnline: rider.deliveryProfile?.isOnline,
        isActive: !rider.deliveryProfile?.isActive
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchRiders();
    } catch (error) {
      console.error('Failed to toggle rider status', error);
    }
  };

  const handleOpenReviewModal = (rider: any) => {
    setActiveRider(rider);
    setRemarks(rider.deliveryProfile?.remarks || '');
    setShowReviewModal(true);
  };

  const handleUpdateRiderStatus = async (status: string) => {
    if (!activeRider?.deliveryProfile?.id) return;
    setReviewSubmitting(true);
    try {
      await axios.patch(`${API_URL}/riders/${activeRider.deliveryProfile.id}/status`, { status, remarks }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowReviewModal(false);
      fetchRiders();
    } catch (error: any) {
      console.error('Failed to update rider status', error);
      toast.error(error.response?.data?.error || 'Failed to update rider status');
    } finally {
      setReviewSubmitting(false);
    }
  };

  // Document files are behind an authenticated route (never a public URL),
  // so a plain <a href> can't carry the Authorization header -- fetch as a
  // blob with the token and open that instead.
  const viewDocument = async (deliveryPartnerId: string, documentId: string) => {
    try {
      const res = await axios.get(`${API_URL}/riders/${deliveryPartnerId}/documents/${documentId}/file`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Failed to load document', error);
      toast.error('Failed to load document.');
    }
  };

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
            <Icon3D name="riders" size={30} eager /> Delivery Riders
          </h1>
          <p className="text-content-secondary mt-1 text-sm">Manage delivery partners, KYC review, and availability</p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs tabs={RIDER_TABS} value={filter} onChange={(id) => setFilter(id as 'ALL' | 'ONLINE' | 'OFFLINE')} layoutId="riders-tab" />
          <Button icon={<Plus size={15} />} onClick={() => handleOpenModal()}>Add Rider</Button>
        </div>
      </div>

      <Card padding="sm" className="flex items-center gap-3 mb-6">
        <Search className="w-4 h-4 text-content-muted shrink-0" />
        <input
          type="text"
          placeholder="Search by rider name, phone, or vehicle type…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none focus:outline-none text-content-primary text-sm w-full"
        />
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-4 w-24 mb-3 rounded-lg bg-surface-hover" />
              <div className="h-8 w-32 rounded-lg bg-surface-hover" />
            </Card>
          ))}
        </div>
      ) : filteredRiders.length === 0 ? (
        <Card>
          <EmptyState
            icon="riders"
            title="No Riders Found"
            description="No delivery partners match your criteria."
            action={<Button onClick={() => handleOpenModal()}>Add Your First Rider</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRiders.map((rider) => (
            <Card key={rider.id} className="relative overflow-hidden">
              <div className="absolute top-4 right-4">
                {rider.deliveryProfile?.isOnline ? (
                  <Badge variant="success" size="sm" className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse" /> Online
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm" className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-content-muted" /> Offline
                  </Badge>
                )}
              </div>

              <div className="flex items-center mb-4 mt-2">
                <div className="w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center text-xl font-bold text-brand-primary border border-border-default shrink-0">
                  {rider.name ? rider.name.charAt(0).toUpperCase() : 'R'}
                </div>
                <div className="ml-4 min-w-0">
                  <h3 className="text-base font-bold text-content-primary truncate">{rider.name || 'Unnamed Rider'}</h3>
                  <div className="flex items-center text-xs text-content-muted mt-1">
                    <Phone className="w-3 h-3 mr-1" /> {rider.phone}
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6 bg-surface-sunken p-3 rounded-xl border border-border-default">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-content-muted">Vehicle Type</span>
                  <div className="flex items-center text-sm font-bold text-content-primary">
                    {getVehicleIcon(rider.deliveryProfile?.vehicleType)}
                    <span className="ml-2 uppercase">{rider.deliveryProfile?.vehicleType || 'Not Assigned'}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-content-muted">License Plate</span>
                  <span className="text-sm font-mono text-content-primary">{rider.deliveryProfile?.licenseNumber || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-content-muted">KYC Status</span>
                  {getKycStatusBadge(rider.deliveryProfile?.status)}
                </div>
              </div>

              {KYC_REVIEWABLE.has(rider.deliveryProfile?.status) && (
                <button
                  onClick={() => handleOpenReviewModal(rider)}
                  className="w-full mb-4 flex items-center justify-center gap-1.5 text-warning-600 dark:text-warning-400 hover:text-warning-700 dark:hover:text-warning-300 text-sm font-bold transition-colors border border-border-default rounded-xl py-2"
                >
                  <FileCheck className="w-4 h-4" /> Review KYC Application
                </button>
              )}

              <div className="flex items-center justify-between border-t border-border-default pt-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenModal(rider)}
                    className="text-brand-primary hover:text-brand-accent text-sm font-bold transition-colors"
                  >
                    Edit
                  </button>
                  <span className="text-border-strong">|</span>
                  <button
                    onClick={() => handleToggleStatus(rider)}
                    className={`text-sm font-bold transition-colors ${rider.deliveryProfile?.isActive ? 'text-content-muted hover:text-danger-500' : 'text-success-600 dark:text-success-400 hover:text-success-700 dark:hover:text-success-300'}`}
                  >
                    {rider.deliveryProfile?.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
                <div>
                  {rider.deliveryProfile?.isActive ? (
                    <span className="flex items-center text-xs font-medium text-content-muted">
                      <CheckCircle className="w-4 h-4 mr-1 text-success-500" /> Account Active
                    </span>
                  ) : (
                    <span className="flex items-center text-xs font-medium text-content-muted">
                      <XCircle className="w-4 h-4 mr-1 text-danger-500" /> Account Suspended
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* KYC REVIEW MODAL */}
      {showReviewModal && activeRider && (
        <Modal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          title="Review Rider Application"
          size="xl"
          footer={
            <>
              <Button variant="danger" isLoading={reviewSubmitting} onClick={() => handleUpdateRiderStatus('REJECTED')}>
                Reject
              </Button>
              <Button variant="outline" isLoading={reviewSubmitting} onClick={() => handleUpdateRiderStatus('RESUBMISSION_REQUIRED')}>
                Request Resubmission
              </Button>
              <Button variant="success" isLoading={reviewSubmitting} onClick={() => handleUpdateRiderStatus('APPROVED')}>
                Approve & Activate Rider
              </Button>
            </>
          }
        >
          <div className="space-y-8">
            <div>
              <h4 className="text-base font-bold text-brand-primary mb-4 flex items-center gap-2 border-b border-border-default pb-2">
                <Navigation className="w-5 h-5" /> Personal & Vehicle Details
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div><p className="text-sm text-content-muted">Full Name</p><p className="font-medium text-content-primary">{activeRider.name}</p></div>
                <div><p className="text-sm text-content-muted">Phone</p><p className="font-medium text-content-primary">{activeRider.phone}</p></div>
                <div><p className="text-sm text-content-muted">Email</p><p className="font-medium text-content-primary">{activeRider.email || 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">Address</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile?.addressLine || 'N/A'}, {activeRider.deliveryProfile?.city} {activeRider.deliveryProfile?.pincode}</p></div>
                <div><p className="text-sm text-content-muted">Aadhaar Number</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile?.aadhaarNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">Vehicle</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile?.vehicleType} — {activeRider.deliveryProfile?.vehicleModel || 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">Vehicle Reg. No. (RC)</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile?.vehicleRegistrationNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">License Number</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile?.licenseNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">Insurance Policy No.</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile?.insurancePolicyNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">PUC Number</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile?.pucNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">Emergency Contact</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile?.emergencyContactName || 'N/A'} — {activeRider.deliveryProfile?.emergencyContactPhone || ''}</p></div>
              </div>
            </div>

            <div>
              <h4 className="text-base font-bold text-brand-primary mb-4 flex items-center gap-2 border-b border-border-default pb-2">
                <Landmark className="w-5 h-5" /> Bank Details
              </h4>
              {activeRider.deliveryProfile?.bankAccounts && activeRider.deliveryProfile.bankAccounts.length > 0 ? (
                <div className="bg-surface-sunken p-4 rounded-xl border border-border-default grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-content-muted">Bank Name</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile.bankAccounts[0].bankName}</p></div>
                  <div><p className="text-sm text-content-muted">Account Holder</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile.bankAccounts[0].accountHolderName}</p></div>
                  <div><p className="text-sm text-content-muted">Account Number</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile.bankAccounts[0].accountNumber}</p></div>
                  <div><p className="text-sm text-content-muted">IFSC Code</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile.bankAccounts[0].ifscCode}</p></div>
                  <div><p className="text-sm text-content-muted">UPI ID</p><p className="font-medium text-content-primary">{activeRider.deliveryProfile.upiId || 'N/A'}</p></div>
                </div>
              ) : (
                <p className="text-content-muted text-sm italic">No bank details provided.</p>
              )}
            </div>

            <div>
              <h4 className="text-base font-bold text-brand-primary mb-4 flex items-center gap-2 border-b border-border-default pb-2">
                <FileText className="w-5 h-5" /> Uploaded Documents
              </h4>
              {activeRider.deliveryProfile?.documents && activeRider.deliveryProfile.documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {activeRider.deliveryProfile.documents.map((doc: any) => (
                    <button
                      key={doc.id}
                      onClick={() => viewDocument(activeRider.deliveryProfile.id, doc.id)}
                      className="flex flex-col items-center justify-center p-6 bg-surface-sunken hover:bg-brand-primary/10 border border-border-default hover:border-brand-primary rounded-xl transition-all group"
                    >
                      <FileText className="w-10 h-10 text-content-muted group-hover:text-brand-primary mb-2 transition-colors" />
                      <span className="text-sm font-bold text-content-primary group-hover:text-brand-primary transition-colors">{doc.type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-content-muted mt-1">{doc.status}</span>
                      <span className="text-xs text-content-muted mt-1 flex items-center gap-1"><Eye className="w-3 h-3" /> View Document</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-content-muted text-sm italic">No documents uploaded.</p>
              )}
            </div>

            <div>
              <h4 className="text-base font-bold text-content-primary mb-2">Remarks</h4>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add a note for the rider (e.g. which document to resubmit and why)..."
                className="w-full bg-surface-card border border-border-default rounded-xl px-4 py-2 text-content-primary placeholder-content-muted focus:outline-none focus:border-brand-primary"
                rows={3}
              />
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={isEditing ? 'Edit Rider' : 'Add New Rider'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError ? (
            <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-600 dark:text-danger-400">
              {formError}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Rider Name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (fieldErrors.name) {
                  setFieldErrors((prev) => ({ ...prev, name: '' }));
                }
              }}
              error={fieldErrors.name}
            />
            <Input
              label="Phone Number (Unique)"
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => {
                const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData({ ...formData, phone: digitsOnly });
                if (fieldErrors.phone) {
                  setFieldErrors((prev) => ({ ...prev, phone: '' }));
                }
              }}
              disabled={isEditing}
              error={fieldErrors.phone}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => {
                setFormData({ ...formData, email: e.target.value.trim() });
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: '' }));
                }
              }}
              error={fieldErrors.email}
            />
            <Input
              label="City"
              type="text"
              value={formData.city}
              onChange={(e) => {
                setFormData({ ...formData, city: e.target.value });
                if (fieldErrors.city) {
                  setFieldErrors((prev) => ({ ...prev, city: '' }));
                }
              }}
              error={fieldErrors.city}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Vehicle Type"
              value={formData.vehicleType}
              onChange={(e) => {
                setFormData({ ...formData, vehicleType: e.target.value });
                if (fieldErrors.vehicleType) {
                  setFieldErrors((prev) => ({ ...prev, vehicleType: '' }));
                }
              }}
              error={fieldErrors.vehicleType}
            >
              <option value="BIKE">Bike</option>
              <option value="SCOOTER">Scooter</option>
              <option value="CAR">Car</option>
              <option value="TRUCK">Truck</option>
              <option value="TEMPO">Tempo</option>
            </Select>
            <Input
              label="License Plate Number"
              type="text"
              required
              value={formData.licenseNumber}
              onChange={(e) => {
                const normalized = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                setFormData({ ...formData, licenseNumber: normalized });
                if (fieldErrors.licenseNumber) {
                  setFieldErrors((prev) => ({ ...prev, licenseNumber: '' }));
                }
              }}
              className="uppercase"
              error={fieldErrors.licenseNumber}
            />
          </div>

          {isEditing && (
            <div className="flex flex-col gap-3 pt-2">
              <Checkbox
                label="Account is Active"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              <Checkbox
                label="Mark as Online"
                checked={formData.isOnline}
                onChange={(e) => setFormData({ ...formData, isOnline: e.target.checked })}
              />
            </div>
          )}

          <div className="flex gap-4 mt-6 pt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {isEditing ? 'Save Changes' : 'Create Rider'}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
