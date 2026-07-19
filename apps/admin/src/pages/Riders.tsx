import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Navigation, Bike, Car, Truck, Search, Phone, CheckCircle, XCircle, Plus, FileText, Landmark, Eye, FileCheck } from 'lucide-react';
import { Button, Card, Badge, Dialog, Input, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

const KYC_REVIEWABLE = new Set(['PENDING', 'UNDER_VERIFICATION', 'RESUBMISSION_REQUIRED']);

const getKycStatusBadge = (status: string) => {
  switch (status) {
    case 'APPROVED': return <Badge variant="success" className="!rounded-full">Approved</Badge>;
    case 'PENDING': return <Badge variant="neutral" className="!rounded-full">Not Submitted</Badge>;
    case 'UNDER_VERIFICATION': return <Badge variant="warning" className="!rounded-full animate-pulse">Needs Review</Badge>;
    case 'RESUBMISSION_REQUIRED': return <Badge variant="warning" className="!rounded-full">Resubmission Requested</Badge>;
    case 'REJECTED': return <Badge variant="danger" className="!rounded-full">Rejected</Badge>;
    case 'SUSPENDED': return <Badge variant="danger" className="!rounded-full">Suspended</Badge>;
    case 'BLOCKED': return <Badge variant="danger" className="!rounded-full">Blocked</Badge>;
    default: return <Badge variant="neutral" className="!rounded-full">{status || 'N/A'}</Badge>;
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
      alert(error.response?.data?.error || 'Failed to update rider status');
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
      alert('Failed to load document.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-brand-light flex items-center">
          <Navigation className="w-8 h-8 mr-3 text-brand-primary" />
          Delivery Riders
        </h1>
        <div className="flex items-center space-x-4">
          <div className="flex bg-brand-dark rounded-lg border border-brand-border p-1">
            <button 
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${filter === 'ALL' ? 'bg-brand-primary text-brand-dark' : 'text-brand-muted hover:text-brand-light'}`}
              onClick={() => setFilter('ALL')}
            >All Riders</button>
            <button 
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${filter === 'ONLINE' ? 'bg-brand-primary text-brand-dark' : 'text-brand-muted hover:text-brand-light'}`}
              onClick={() => setFilter('ONLINE')}
            >Online Now</button>
            <button 
              className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${filter === 'OFFLINE' ? 'bg-brand-primary text-brand-dark' : 'text-brand-muted hover:text-brand-light'}`}
              onClick={() => setFilter('OFFLINE')}
            >Offline</button>
          </div>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="w-5 h-5 mr-1" /> Add Rider
          </Button>
        </div>
      </div>

      <div className="bg-brand-panel border border-brand-border rounded-xl p-4 flex items-center">
        <Search className="w-5 h-5 text-brand-muted mr-3" />
        <input 
          type="text" 
          placeholder="Search by rider name, phone, or vehicle type..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none focus:outline-none text-brand-light w-full"
        />
      </div>

      {loading ? (
        <Loader fullScreen />
      ) : filteredRiders.length === 0 ? (
        <div className="bg-brand-panel border border-brand-border rounded-xl p-12 text-center">
          <Navigation className="w-12 h-12 text-brand-muted mx-auto mb-4" />
          <h3 className="text-xl font-bold text-brand-light mb-2">No Riders Found</h3>
          <p className="text-brand-muted mb-6">No delivery partners match your criteria.</p>
          <Button onClick={() => handleOpenModal()}>
            Add Your First Rider
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRiders.map((rider) => (
            <Card key={rider.id} variant="dark" className="relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                {rider.deliveryProfile?.isOnline ? (
                  <Badge variant="success" className="!rounded-full flex items-center">
                    <span className="w-2 h-2 rounded-full bg-success-500 mr-2 animate-pulse"></span> Online
                  </Badge>
                ) : (
                  <Badge variant="neutral" className="!rounded-full flex items-center">
                    <span className="w-2 h-2 rounded-full bg-neutral-400 mr-2"></span> Offline
                  </Badge>
                )}
              </div>

              <div className="flex items-center mb-4 mt-2">
                <div className="w-12 h-12 rounded-full bg-brand-dark flex items-center justify-center text-xl font-bold text-brand-primary border border-brand-border">
                  {rider.name ? rider.name.charAt(0).toUpperCase() : 'R'}
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-brand-light">{rider.name || 'Unnamed Rider'}</h3>
                  <div className="flex items-center text-xs text-brand-muted mt-1">
                    <Phone className="w-3 h-3 mr-1" /> {rider.phone}
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6 bg-brand-dark p-3 rounded-lg border border-brand-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-muted">Vehicle Type</span>
                  <div className="flex items-center text-sm font-bold text-brand-light">
                    {getVehicleIcon(rider.deliveryProfile?.vehicleType)}
                    <span className="ml-2 uppercase">{rider.deliveryProfile?.vehicleType || 'Not Assigned'}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-muted">License Plate</span>
                  <span className="text-sm font-mono text-brand-light">{rider.deliveryProfile?.licenseNumber || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-muted">KYC Status</span>
                  {getKycStatusBadge(rider.deliveryProfile?.status)}
                </div>
              </div>

              {KYC_REVIEWABLE.has(rider.deliveryProfile?.status) && (
                <button
                  onClick={() => handleOpenReviewModal(rider)}
                  className="w-full mb-4 flex items-center justify-center text-yellow-500 hover:text-yellow-400 text-sm font-bold transition-colors border border-brand-border rounded-lg py-2"
                >
                  <FileCheck className="w-4 h-4 mr-1" /> Review KYC Application
                </button>
              )}

              <div className="flex items-center justify-between border-t border-brand-border pt-4">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleOpenModal(rider)}
                    className="text-brand-primary hover:text-brand-secondary text-sm font-bold transition-colors"
                  >
                    Edit
                  </button>
                  <span className="text-brand-border">|</span>
                  <button
                    onClick={() => handleToggleStatus(rider)}
                    className={`text-sm font-bold transition-colors ${rider.deliveryProfile?.isActive ? 'text-brand-muted hover:text-red-400' : 'text-green-500 hover:text-green-400'}`}
                  >
                    {rider.deliveryProfile?.isActive ? 'Disable' : 'Enable'}
                  </button>
                </div>
                <div>
                  {rider.deliveryProfile?.isActive ? (
                    <span className="flex items-center text-xs font-medium text-brand-muted">
                      <CheckCircle className="w-4 h-4 mr-1 text-green-500"/> Account Active
                    </span>
                  ) : (
                    <span className="flex items-center text-xs font-medium text-brand-muted">
                      <XCircle className="w-4 h-4 mr-1 text-red-500"/> Account Suspended
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
        <Dialog
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
          <div className="space-y-8 flex-1">
            <div>
              <h4 className="text-lg font-bold text-brand-primary mb-4 flex items-center border-b border-brand-border pb-2">
                <Navigation className="w-5 h-5 mr-2" /> Personal & Vehicle Details
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div><p className="text-sm text-brand-muted">Full Name</p><p className="font-medium text-brand-light">{activeRider.name}</p></div>
                <div><p className="text-sm text-brand-muted">Phone</p><p className="font-medium text-brand-light">{activeRider.phone}</p></div>
                <div><p className="text-sm text-brand-muted">Email</p><p className="font-medium text-brand-light">{activeRider.email || 'N/A'}</p></div>
                <div><p className="text-sm text-brand-muted">Address</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile?.addressLine || 'N/A'}, {activeRider.deliveryProfile?.city} {activeRider.deliveryProfile?.pincode}</p></div>
                <div><p className="text-sm text-brand-muted">Aadhaar Number</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile?.aadhaarNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-brand-muted">Vehicle</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile?.vehicleType} — {activeRider.deliveryProfile?.vehicleModel || 'N/A'}</p></div>
                <div><p className="text-sm text-brand-muted">Vehicle Reg. No. (RC)</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile?.vehicleRegistrationNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-brand-muted">License Number</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile?.licenseNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-brand-muted">Insurance Policy No.</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile?.insurancePolicyNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-brand-muted">PUC Number</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile?.pucNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-brand-muted">Emergency Contact</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile?.emergencyContactName || 'N/A'} — {activeRider.deliveryProfile?.emergencyContactPhone || ''}</p></div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold text-brand-primary mb-4 flex items-center border-b border-brand-border pb-2">
                <Landmark className="w-5 h-5 mr-2" /> Bank Details
              </h4>
              {activeRider.deliveryProfile?.bankAccounts && activeRider.deliveryProfile.bankAccounts.length > 0 ? (
                <div className="bg-brand-dark/50 p-4 rounded-xl border border-brand-border grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-brand-muted">Bank Name</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile.bankAccounts[0].bankName}</p></div>
                  <div><p className="text-sm text-brand-muted">Account Holder</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile.bankAccounts[0].accountHolderName}</p></div>
                  <div><p className="text-sm text-brand-muted">Account Number</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile.bankAccounts[0].accountNumber}</p></div>
                  <div><p className="text-sm text-brand-muted">IFSC Code</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile.bankAccounts[0].ifscCode}</p></div>
                  <div><p className="text-sm text-brand-muted">UPI ID</p><p className="font-medium text-brand-light">{activeRider.deliveryProfile.upiId || 'N/A'}</p></div>
                </div>
              ) : (
                <p className="text-brand-muted text-sm italic">No bank details provided.</p>
              )}
            </div>

            <div>
              <h4 className="text-lg font-bold text-brand-primary mb-4 flex items-center border-b border-brand-border pb-2">
                <FileText className="w-5 h-5 mr-2" /> Uploaded Documents
              </h4>
              {activeRider.deliveryProfile?.documents && activeRider.deliveryProfile.documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {activeRider.deliveryProfile.documents.map((doc: any) => (
                    <button
                      key={doc.id}
                      onClick={() => viewDocument(activeRider.deliveryProfile.id, doc.id)}
                      className="flex flex-col items-center justify-center p-6 bg-brand-dark hover:bg-brand-primary/10 border border-brand-border hover:border-brand-primary rounded-xl transition-all group"
                    >
                      <FileText className="w-10 h-10 text-brand-muted group-hover:text-brand-primary mb-2 transition-colors" />
                      <span className="text-sm font-bold text-brand-light group-hover:text-brand-primary transition-colors">{doc.type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-brand-muted mt-1">{doc.status}</span>
                      <span className="text-xs text-brand-muted mt-1 flex items-center"><Eye className="w-3 h-3 mr-1"/> View Document</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-brand-muted text-sm italic">No documents uploaded.</p>
              )}
            </div>

            <div>
              <h4 className="text-lg font-bold text-brand-primary mb-2">Remarks</h4>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add a note for the rider (e.g. which document to resubmit and why)..."
                className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-brand-light focus:outline-none focus:border-brand-primary"
                rows={3}
              />
            </div>
          </div>
        </Dialog>
      )}

      <Dialog
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={isEditing ? 'Edit Rider' : 'Add New Rider'}
      >
            <form onSubmit={handleSubmit} className="space-y-4">

              {formError ? (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div>
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
                  />
                  {fieldErrors.name ? <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p> : null}
                </div>
                <div>
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
                  />
                  {fieldErrors.phone ? <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p> : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
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
                  />
                  {fieldErrors.email ? <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p> : null}
                </div>
                <div>
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
                  />
                  {fieldErrors.city ? <p className="mt-1 text-xs text-red-500">{fieldErrors.city}</p> : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-brand-muted mb-1">Vehicle Type</label>
                  <select 
                    value={formData.vehicleType}
                    onChange={(e) => {
                      setFormData({ ...formData, vehicleType: e.target.value });
                      if (fieldErrors.vehicleType) {
                        setFieldErrors((prev) => ({ ...prev, vehicleType: '' }));
                      }
                    }}
                    className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-brand-light focus:outline-none focus:border-brand-primary" 
                  >
                    <option value="BIKE">Bike</option>
                    <option value="SCOOTER">Scooter</option>
                    <option value="CAR">Car</option>
                    <option value="TRUCK">Truck</option>
                    <option value="TEMPO">Tempo</option>
                  </select>
                  {fieldErrors.vehicleType ? <p className="mt-1 text-xs text-red-500">{fieldErrors.vehicleType}</p> : null}
                </div>
                <div>
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
                  />
                  {fieldErrors.licenseNumber ? <p className="mt-1 text-xs text-red-500">{fieldErrors.licenseNumber}</p> : null}
                </div>
              </div>

              {isEditing && (
                <div className="flex flex-col space-y-3 pt-2">
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox" 
                      id="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                      className="w-4 h-4 text-brand-primary bg-brand-dark border-brand-border rounded focus:ring-brand-primary"
                    />
                    <label htmlFor="isActive" className="text-sm font-medium text-brand-light">
                      Account is Active
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <input 
                      type="checkbox" 
                      id="isOnline"
                      checked={formData.isOnline}
                      onChange={(e) => setFormData({...formData, isOnline: e.target.checked})}
                      className="w-4 h-4 text-green-500 bg-brand-dark border-brand-border rounded focus:ring-green-500"
                    />
                    <label htmlFor="isOnline" className="text-sm font-medium text-brand-light">
                      Mark as Online
                    </label>
                  </div>
                </div>
              )}
              
              <div className="flex space-x-4 mt-6 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-brand-dark text-brand-light px-4 py-2 rounded-lg font-bold hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <Button type="submit" className="flex-1">
                  {isEditing ? 'Save Changes' : 'Create Rider'}
                </Button>
              </div>
            </form>
      </Dialog>
    </div>
  );
}
