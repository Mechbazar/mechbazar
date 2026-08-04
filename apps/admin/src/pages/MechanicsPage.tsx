import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import {
  Search, Phone, CheckCircle, XCircle, Plus, FileText, Landmark, Eye, FileCheck, MapPin, Star,
  PauseCircle, PlayCircle, Trash2, ClipboardList, Wallet,
} from 'lucide-react';
import { Button, Card, Badge, Modal, Input, Checkbox, Loader, StatCard, EmptyState, Icon3D } from '../components/ui';
import { API_URL } from '../config/api';
import AddressMapPicker from '../components/maps/AddressMapPicker';
import PlaceAutocompleteField from '../components/maps/PlaceAutocompleteField';
import LocationMapView from '../components/maps/LocationMapView';
import type { GeocodeSuccess } from '../services/geocode.service';
import { fadeInUp } from '../utils/motion';

const KYC_REVIEWABLE = new Set(['PENDING', 'UNDER_VERIFICATION', 'RESUBMISSION_REQUIRED']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;

const getKycStatusBadge = (status: string) => {
  switch (status) {
    case 'APPROVED': return <Badge variant="success" size="sm">Approved</Badge>;
    case 'PENDING': return <Badge variant="neutral" size="sm">Not Submitted</Badge>;
    case 'UNDER_VERIFICATION': return <Badge variant="warning" size="sm" className="animate-pulse">Needs Review</Badge>;
    case 'RESUBMISSION_REQUIRED': return <Badge variant="warning" size="sm">Resubmission Requested</Badge>;
    case 'REJECTED': return <Badge variant="danger" size="sm">Rejected</Badge>;
    case 'SUSPENDED': return <Badge variant="danger" size="sm">Suspended</Badge>;
    case 'BLOCKED': return <Badge variant="danger" size="sm">Blocked</Badge>;
    default: return <Badge variant="neutral" size="sm">{status || 'N/A'}</Badge>;
  }
};

export default function MechanicsPage() {
  const { token } = useSelector((state: RootState) => state.auth);
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE' | 'BUSY' | 'PENDING' | 'SUSPENDED'>('ALL');

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: '', name: '', phone: '', email: '', city: '', state: '',
    specializations: ['CAR', 'BIKE'] as string[], skills: '', experienceYears: '',
    isActive: true, isOnline: false,
    addressLine: '', pincode: '', country: '',
    lat: null as number | null, lng: null as number | null,
    placeId: '', formattedAddress: '',
  });

  // Unconditional overwrite from an autocomplete selection -- matches the
  // applyGeocodeResult pattern used in apps/vendor's Register/Profile pages.
  const applyGeocodeResult = (result: GeocodeSuccess) => {
    setFormData((prev) => ({
      ...prev,
      addressLine: result.components.line1 || prev.addressLine,
      city: result.components.city || prev.city,
      state: result.components.state || prev.state,
      pincode: result.components.pincode || prev.pincode,
      country: result.components.country || prev.country,
      lat: result.lat,
      lng: result.lng,
      placeId: result.placeId,
      formattedAddress: result.formattedAddress,
    }));
  };
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeTechnician, setActiveTechnician] = useState<any>(null);
  const [remarks, setRemarks] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [jobsModalTechnician, setJobsModalTechnician] = useState<any>(null);
  const [completedJobs, setCompletedJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const [earningsModalTechnician, setEarningsModalTechnician] = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [earningsLoading, setEarningsLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchTechnicians();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchTechnicians = async () => {
    try {
      const res = await axios.get(`${API_URL}/technicians`, { headers: { Authorization: `Bearer ${token}` } });
      setTechnicians(res.data);
    } catch (error) {
      console.error('Failed to fetch technicians', error);
    } finally {
      setLoading(false);
    }
  };

  // Computed client-side from the already-fetched list (this page has no
  // pagination), same convention as the rest of this admin app.
  const stats = {
    total: technicians.length,
    online: technicians.filter((t) => t.technicianProfile?.isOnline).length,
    busy: technicians.filter((t) => (t.technicianProfile?.currentJobs || 0) > 0).length,
    offline: technicians.filter((t) => !t.technicianProfile?.isOnline).length,
    pendingApproval: technicians.filter((t) => KYC_REVIEWABLE.has(t.technicianProfile?.status)).length,
    verified: technicians.filter((t) => t.technicianProfile?.status === 'APPROVED').length,
    suspended: technicians.filter((t) => ['SUSPENDED', 'BLOCKED'].includes(t.technicianProfile?.status)).length,
  };

  const filteredTechnicians = technicians.filter((t) => {
    if (filter === 'ONLINE' && !t.technicianProfile?.isOnline) return false;
    if (filter === 'OFFLINE' && t.technicianProfile?.isOnline) return false;
    if (filter === 'BUSY' && !((t.technicianProfile?.currentJobs || 0) > 0)) return false;
    if (filter === 'PENDING' && !KYC_REVIEWABLE.has(t.technicianProfile?.status)) return false;
    if (filter === 'SUSPENDED' && !['SUSPENDED', 'BLOCKED'].includes(t.technicianProfile?.status)) return false;
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      return (
        (t.name && t.name.toLowerCase().includes(s)) ||
        (t.phone && t.phone.includes(s)) ||
        (t.technicianProfile?.skills || []).some((sk: string) => sk.toLowerCase().includes(s))
      );
    }
    return true;
  });

  const handleOpenModal = (technician?: any) => {
    setFieldErrors({});
    setFormError('');
    if (technician) {
      setIsEditing(true);
      const tp = technician.technicianProfile || {};
      setFormData({
        id: technician.id,
        name: technician.name || '',
        phone: technician.phone || '',
        email: technician.email || '',
        city: tp.city || technician.city || '',
        state: tp.state || technician.state || '',
        specializations: tp.specializations || [],
        skills: (tp.skills || []).join(', '),
        experienceYears: tp.experienceYears != null ? String(tp.experienceYears) : '',
        isActive: tp.isActive ?? true,
        isOnline: tp.isOnline ?? false,
        addressLine: tp.addressLine || '',
        pincode: tp.pincode || '',
        country: tp.country || '',
        lat: tp.lat ?? null,
        lng: tp.lng ?? null,
        placeId: tp.placeId || '',
        formattedAddress: tp.formattedAddress || '',
      });
    } else {
      setIsEditing(false);
      setFormData({
        id: '', name: '', phone: '', email: '', city: '', state: '',
        specializations: ['CAR', 'BIKE'], skills: '', experienceYears: '', isActive: true, isOnline: false,
        addressLine: '', pincode: '', country: '', lat: null, lng: null, placeId: '', formattedAddress: '',
      });
    }
    setShowModal(true);
  };

  // Lets the Dashboard's "Add Mechanic" quick action (?action=create) jump
  // straight into this page's existing create flow instead of duplicating
  // the mechanic-creation form there.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('action') === 'create') handleOpenModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSpecialization = (type: string) => {
    setFormData((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(type)
        ? prev.specializations.filter((s) => s !== type)
        : [...prev.specializations, type],
    }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const trimmedName = formData.name.trim();
    const normalizedPhone = formData.phone.replace(/\D/g, '');
    const trimmedEmail = formData.email.trim().toLowerCase();

    if (!trimmedName) errors.name = 'Name is required';
    if (!PHONE_REGEX.test(normalizedPhone)) errors.phone = 'Phone must be exactly 10 digits';
    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) errors.email = 'Enter a valid email address';
    if (formData.specializations.length === 0) errors.specializations = 'Select at least one vehicle specialization';

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return null;

    return {
      ...formData,
      name: trimmedName,
      phone: normalizedPhone,
      email: trimmedEmail,
      specializations: formData.specializations,
      skills: formData.skills.split(',').map((s) => s.trim()).filter(Boolean),
      experienceYears: formData.experienceYears ? Number(formData.experienceYears) : null,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const payload = validateForm();
    if (!payload) return;

    try {
      if (isEditing) {
        await axios.put(`${API_URL}/technicians/${formData.id}`, payload, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API_URL}/technicians`, payload, { headers: { Authorization: `Bearer ${token}` } });
      }
      setShowModal(false);
      fetchTechnicians();
    } catch (error: any) {
      const apiError = error.response?.data?.error || 'Failed to save technician';
      setFormError(apiError);
    }
  };

  // Sends the full technician record with only the active flag flipped -- the
  // backend's partial-update for name/phone/email/city/state isn't
  // undefined-guarded, so a payload with only { isActive } would null out the
  // technician's email. Mirrors Riders.tsx's handleToggleStatus exactly.
  const handleToggleStatus = async (technician: any) => {
    try {
      await axios.put(`${API_URL}/technicians/${technician.id}`, {
        ...technician,
        specializations: technician.technicianProfile?.specializations,
        skills: technician.technicianProfile?.skills,
        experienceYears: technician.technicianProfile?.experienceYears,
        isOnline: technician.technicianProfile?.isOnline,
        isActive: !technician.technicianProfile?.isActive,
      }, { headers: { Authorization: `Bearer ${token}` } });
      fetchTechnicians();
    } catch (error) {
      console.error('Failed to toggle technician status', error);
    }
  };

  // Suspend/Activate operate on the KYC status itself (SUSPENDED <-> APPROVED)
  // -- distinct from Enable/Disable above, which only flips isActive without
  // touching the underlying verification status.
  const handleSuspend = async (technician: any) => {
    if (!confirm(`Suspend ${technician.name}? They will stop receiving new jobs.`)) return;
    try {
      await axios.patch(`${API_URL}/technicians/${technician.technicianProfile.id}/status`, { status: 'SUSPENDED' }, { headers: { Authorization: `Bearer ${token}` } });
      fetchTechnicians();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to suspend technician');
    }
  };

  const handleActivate = async (technician: any) => {
    try {
      await axios.patch(`${API_URL}/technicians/${technician.technicianProfile.id}/status`, { status: 'APPROVED' }, { headers: { Authorization: `Bearer ${token}` } });
      fetchTechnicians();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to activate technician');
    }
  };

  const handleDelete = async (technician: any) => {
    if (!confirm(`Delete ${technician.name}? This cannot be undone.`)) return;
    try {
      // technician.id is the User id -- DELETE /technicians/:id expects the
      // ServiceTechnician (profile) id, same as every other technicianProfile-
      // scoped call on this page (suspend/activate/earnings). Passing the
      // wrong id here made every delete 404 with "Technician not found"
      // before it could even reach the technician's own data.
      await axios.delete(`${API_URL}/technicians/${technician.technicianProfile.id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchTechnicians();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete technician');
    }
  };

  const handleOpenReviewModal = (technician: any) => {
    setActiveTechnician(technician);
    setRemarks(technician.technicianProfile?.remarks || '');
    setShowReviewModal(true);
  };

  const handleUpdateStatus = async (status: string) => {
    if (!activeTechnician?.technicianProfile?.id) return;
    setReviewSubmitting(true);
    try {
      await axios.patch(`${API_URL}/technicians/${activeTechnician.technicianProfile.id}/status`, { status, remarks }, { headers: { Authorization: `Bearer ${token}` } });
      setShowReviewModal(false);
      fetchTechnicians();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update technician status');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const viewDocument = async (technicianId: string, documentId: string) => {
    try {
      const res = await axios.get(`${API_URL}/technicians/${technicianId}/documents/${documentId}/file`, {
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

  const openJobsModal = async (technician: any) => {
    setJobsModalTechnician(technician);
    setJobsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/services/bookings/all`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { technicianId: technician.technicianProfile.id, status: 'COMPLETED' },
      });
      setCompletedJobs(res.data);
    } catch (error) {
      console.error('Failed to fetch completed jobs', error);
    } finally {
      setJobsLoading(false);
    }
  };

  const openEarningsModal = async (technician: any) => {
    setEarningsModalTechnician(technician);
    setEarningsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/technicians/${technician.technicianProfile.id}/earnings`, { headers: { Authorization: `Bearer ${token}` } });
      setEarnings(res.data);
    } catch (error) {
      console.error('Failed to fetch earnings', error);
    } finally {
      setEarningsLoading(false);
    }
  };

  const statCards = [
    { key: 'ALL' as const, label: 'Total', value: stats.total, icon: 'mechanics' as const, gradient: 'red' as const },
    { key: 'ONLINE' as const, label: 'Online', value: stats.online, icon: 'check' as const, gradient: 'green' as const },
    { key: 'BUSY' as const, label: 'Busy', value: stats.busy, icon: 'gear' as const, gradient: 'amber' as const },
    { key: 'OFFLINE' as const, label: 'Offline', value: stats.offline, icon: 'mechanics' as const, gradient: 'indigo' as const },
    { key: 'PENDING' as const, label: 'Pending Approval', value: stats.pendingApproval, icon: 'shield' as const, gradient: 'amber' as const },
    { key: 'ALL' as const, label: 'Verified', value: stats.verified, icon: 'check' as const, gradient: 'green' as const },
    { key: 'SUSPENDED' as const, label: 'Suspended', value: stats.suspended, icon: 'shield' as const, gradient: 'red' as const },
  ];

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-content-primary flex items-center gap-3">
          <Icon3D name="mechanics" size={30} eager /> Mechanics
        </h1>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => handleOpenModal()}>Add Mechanic</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {statCards.map((s, idx) => (
          <StatCard key={idx} title={s.label} value={s.value} icon={s.icon} gradient={s.gradient} onClick={() => setFilter(s.key)} />
        ))}
      </div>

      <Card padding="sm" className="flex items-center gap-3">
        <Search className="w-5 h-5 text-content-muted shrink-0" />
        <input
          type="text"
          placeholder="Search by name, phone, or skill..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none focus:outline-none text-content-primary w-full text-sm"
        />
      </Card>

      {loading ? (
        <Loader fullScreen />
      ) : filteredTechnicians.length === 0 ? (
        <Card>
          <EmptyState icon="mechanics" title="No Mechanics Found" description="No mechanics match your criteria." action={<Button onClick={() => handleOpenModal()}>Add Your First Mechanic</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTechnicians.map((technician) => (
            <Card key={technician.id} className="relative overflow-hidden">
              <div className="absolute top-4 right-4">
                {technician.technicianProfile?.isOnline ? (
                  <Badge variant="success" size="sm" className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></span> Online
                  </Badge>
                ) : (
                  <Badge variant="neutral" size="sm" className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-content-muted"></span> Offline
                  </Badge>
                )}
              </div>

              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-surface-sunken flex items-center justify-center text-xl font-bold text-brand-primary border border-border-default">
                  {technician.name ? technician.name.charAt(0).toUpperCase() : 'T'}
                </div>
                <div className="ml-4">
                  <h3 className="text-base font-bold text-content-primary">{technician.name || 'Unnamed Mechanic'}</h3>
                  <div className="flex items-center text-xs text-content-muted mt-1">
                    <Phone className="w-3 h-3 mr-1" /> {technician.phone}
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4 bg-surface-sunken p-3 rounded-xl border border-border-default">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-content-muted">Specializations</span>
                  <span className="text-sm font-semibold text-content-primary">{(technician.technicianProfile?.specializations || []).join(', ') || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-content-muted">Rating</span>
                  <span className="text-sm font-semibold text-content-primary flex items-center gap-1"><Star className="w-3 h-3 text-warning-400" /> {(technician.technicianProfile?.rating || 0).toFixed(1)} ({technician.technicianProfile?.totalJobs || 0} jobs)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-content-muted">Current Jobs</span>
                  <span className="text-sm font-semibold text-content-primary">{technician.technicianProfile?.currentJobs || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-content-muted">KYC Status</span>
                  {getKycStatusBadge(technician.technicianProfile?.status)}
                </div>
                {technician.technicianProfile?.currentLat != null && technician.technicianProfile?.currentLng != null && (
                  <div className="pt-1 space-y-1.5">
                    <LocationMapView
                      markers={[{ id: technician.id, lat: technician.technicianProfile.currentLat, lng: technician.technicianProfile.currentLng, label: technician.name, color: 'green' }]}
                      height={120}
                    />
                    <a
                      href={`https://www.google.com/maps?q=${technician.technicianProfile.currentLat},${technician.technicianProfile.currentLng}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center justify-between text-brand-primary hover:text-brand-accent text-xs font-bold"
                    >
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Open in Google Maps</span>
                    </a>
                  </div>
                )}
              </div>

              {KYC_REVIEWABLE.has(technician.technicianProfile?.status) && (
                <button
                  onClick={() => handleOpenReviewModal(technician)}
                  className="w-full mb-3 flex items-center justify-center text-warning-600 dark:text-warning-400 hover:text-warning-500 text-sm font-bold transition-colors border border-border-default rounded-xl py-2"
                >
                  <FileCheck className="w-4 h-4 mr-1" /> Review KYC Application
                </button>
              )}

              <div className="grid grid-cols-2 gap-2 mb-3">
                <button onClick={() => navigate('/service-bookings?filter=pending')} className="flex items-center justify-center gap-1 text-xs font-bold text-brand-primary hover:text-brand-accent border border-border-default rounded-xl py-2">
                  <ClipboardList className="w-3.5 h-3.5" /> Assign Jobs
                </button>
                <button onClick={() => openJobsModal(technician)} className="flex items-center justify-center gap-1 text-xs font-bold text-content-primary hover:text-brand-primary border border-border-default rounded-xl py-2">
                  <CheckCircle className="w-3.5 h-3.5" /> Completed Jobs
                </button>
                <button onClick={() => openEarningsModal(technician)} className="flex items-center justify-center gap-1 text-xs font-bold text-content-primary hover:text-brand-primary border border-border-default rounded-xl py-2">
                  <Wallet className="w-3.5 h-3.5" /> Earnings
                </button>
                {technician.technicianProfile?.status === 'SUSPENDED' ? (
                  <button onClick={() => handleActivate(technician)} className="flex items-center justify-center gap-1 text-xs font-bold text-success-600 dark:text-success-400 hover:text-success-500 border border-border-default rounded-xl py-2">
                    <PlayCircle className="w-3.5 h-3.5" /> Activate
                  </button>
                ) : (
                  <button onClick={() => handleSuspend(technician)} className="flex items-center justify-center gap-1 text-xs font-bold text-warning-600 dark:text-warning-400 hover:text-warning-500 border border-border-default rounded-xl py-2">
                    <PauseCircle className="w-3.5 h-3.5" /> Suspend
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-border-default pt-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => handleOpenModal(technician)} className="text-brand-primary hover:text-brand-accent text-sm font-bold transition-colors">Edit</button>
                  <span className="text-border-default">|</span>
                  <button
                    onClick={() => handleToggleStatus(technician)}
                    className={`text-sm font-bold transition-colors ${technician.technicianProfile?.isActive ? 'text-content-muted hover:text-danger-500' : 'text-success-500 hover:text-success-400'}`}
                  >
                    {technician.technicianProfile?.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <span className="text-border-default">|</span>
                  <button onClick={() => handleDelete(technician)} className="text-content-muted hover:text-danger-500 transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  {technician.technicianProfile?.isActive ? (
                    <span className="flex items-center text-xs font-medium text-content-muted"><CheckCircle className="w-4 h-4 mr-1 text-success-500" /> Active</span>
                  ) : (
                    <span className="flex items-center text-xs font-medium text-content-muted"><XCircle className="w-4 h-4 mr-1 text-danger-500" /> Inactive</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showReviewModal && activeTechnician && (
        <Modal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          title="Review Mechanic Application"
          size="xl"
          footer={
            <>
              <Button variant="danger" isLoading={reviewSubmitting} onClick={() => handleUpdateStatus('REJECTED')}>Reject</Button>
              <Button variant="outline" isLoading={reviewSubmitting} onClick={() => handleUpdateStatus('RESUBMISSION_REQUIRED')}>Request Resubmission</Button>
              <Button variant="success" isLoading={reviewSubmitting} onClick={() => handleUpdateStatus('APPROVED')}>Approve & Activate</Button>
            </>
          }
        >
          <div className="space-y-8 flex-1">
            <div>
              <h4 className="text-base font-bold text-brand-primary mb-4 flex items-center border-b border-border-default pb-2">
                <Icon3D name="mechanics" size={20} className="mr-2" /> Personal & Skill Details
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div><p className="text-sm text-content-muted">Full Name</p><p className="font-medium text-content-primary">{activeTechnician.name}</p></div>
                <div><p className="text-sm text-content-muted">Phone</p><p className="font-medium text-content-primary">{activeTechnician.phone}</p></div>
                <div><p className="text-sm text-content-muted">Email</p><p className="font-medium text-content-primary">{activeTechnician.email || 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">Address / Service Area</p><p className="font-medium text-content-primary">{activeTechnician.technicianProfile?.addressLine || 'N/A'}, {activeTechnician.technicianProfile?.city} {activeTechnician.technicianProfile?.pincode}</p></div>
                <div><p className="text-sm text-content-muted">Aadhaar Number</p><p className="font-medium text-content-primary">{activeTechnician.technicianProfile?.aadhaarNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">Specializations</p><p className="font-medium text-content-primary">{(activeTechnician.technicianProfile?.specializations || []).join(', ') || 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">Skills</p><p className="font-medium text-content-primary">{(activeTechnician.technicianProfile?.skills || []).join(', ') || 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">Experience</p><p className="font-medium text-content-primary">{activeTechnician.technicianProfile?.experienceYears != null ? `${activeTechnician.technicianProfile.experienceYears} years` : 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">Emergency Contact</p><p className="font-medium text-content-primary">{activeTechnician.technicianProfile?.emergencyContactName || 'N/A'} — {activeTechnician.technicianProfile?.emergencyContactPhone || ''}</p></div>
              </div>
              {(activeTechnician.technicianProfile?.formattedAddress || activeTechnician.technicianProfile?.lat != null) && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-content-muted flex items-center"><MapPin className="w-4 h-4 mr-1" /> {activeTechnician.technicianProfile.formattedAddress || 'KYC address location'}</p>
                  <LocationMapView
                    markers={activeTechnician.technicianProfile.lat != null ? [{ id: 'kyc-address', lat: activeTechnician.technicianProfile.lat, lng: activeTechnician.technicianProfile.lng }] : []}
                    height={200}
                    emptyLabel="No geocoded address on file"
                  />
                </div>
              )}
            </div>

            <div>
              <h4 className="text-base font-bold text-brand-primary mb-4 flex items-center border-b border-border-default pb-2">
                <Landmark className="w-5 h-5 mr-2" /> Bank Details
              </h4>
              {activeTechnician.technicianProfile?.bankAccounts && activeTechnician.technicianProfile.bankAccounts.length > 0 ? (
                <div className="bg-surface-sunken p-4 rounded-xl border border-border-default grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-content-muted">Bank Name</p><p className="font-medium text-content-primary">{activeTechnician.technicianProfile.bankAccounts[0].bankName}</p></div>
                  <div><p className="text-sm text-content-muted">Account Holder</p><p className="font-medium text-content-primary">{activeTechnician.technicianProfile.bankAccounts[0].accountHolderName}</p></div>
                  <div><p className="text-sm text-content-muted">Account Number</p><p className="font-medium text-content-primary">{activeTechnician.technicianProfile.bankAccounts[0].accountNumber}</p></div>
                  <div><p className="text-sm text-content-muted">IFSC Code</p><p className="font-medium text-content-primary">{activeTechnician.technicianProfile.bankAccounts[0].ifscCode}</p></div>
                </div>
              ) : (
                <p className="text-content-muted text-sm italic">No bank details provided.</p>
              )}
            </div>

            <div>
              <h4 className="text-base font-bold text-brand-primary mb-4 flex items-center border-b border-border-default pb-2">
                <FileText className="w-5 h-5 mr-2" /> Uploaded Documents (Profile Photo, Aadhaar/ID, Driving License)
              </h4>
              {activeTechnician.technicianProfile?.documents && activeTechnician.technicianProfile.documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {activeTechnician.technicianProfile.documents.map((doc: any) => (
                    <button
                      key={doc.id}
                      onClick={() => viewDocument(activeTechnician.technicianProfile.id, doc.id)}
                      className="flex flex-col items-center justify-center p-6 bg-surface-sunken hover:bg-brand-primary/10 border border-border-default hover:border-brand-primary rounded-xl transition-all group"
                    >
                      <FileText className="w-10 h-10 text-content-muted group-hover:text-brand-primary mb-2 transition-colors" />
                      <span className="text-sm font-bold text-content-primary group-hover:text-brand-primary transition-colors">{doc.type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-content-muted mt-1">{doc.status}</span>
                      <span className="text-xs text-content-muted mt-1 flex items-center"><Eye className="w-3 h-3 mr-1" /> View Document</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-content-muted text-sm italic">No documents uploaded.</p>
              )}
            </div>

            <div>
              <h4 className="text-base font-bold text-brand-primary mb-2">Remarks</h4>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Add a note for the mechanic (e.g. which document to resubmit and why)..."
                className="w-full bg-surface-card border border-border-default rounded-xl px-4 py-2 text-content-primary focus:outline-none focus:ring-4 focus:ring-brand-primary/30 focus:border-brand-primary"
                rows={3}
              />
            </div>
          </div>
        </Modal>
      )}

      <Modal isOpen={!!jobsModalTechnician} onClose={() => setJobsModalTechnician(null)} title={`Completed Jobs — ${jobsModalTechnician?.name || ''}`} size="lg">
        {jobsLoading ? <Loader /> : completedJobs.length === 0 ? (
          <EmptyState icon="check" title="No completed jobs yet" />
        ) : (
          <div className="space-y-2">
            {completedJobs.map((j) => (
              <div key={j.id} className="flex justify-between items-center bg-surface-sunken p-3 rounded-xl border border-border-default">
                <div>
                  <p className="font-medium text-content-primary text-sm">#{j.bookingNumber} — {j.package?.name}</p>
                  <p className="text-xs text-content-muted">{j.user?.name}</p>
                </div>
                <p className="text-sm font-bold text-content-primary">₹{j.finalAmount}</p>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!earningsModalTechnician} onClose={() => setEarningsModalTechnician(null)} title={`Earnings — ${earningsModalTechnician?.name || ''}`}>
        {earningsLoading || !earnings ? <Loader /> : (
          <div className="space-y-3">
            <div className="flex justify-between bg-surface-sunken p-3 rounded-xl border border-border-default"><span className="text-content-muted text-sm">Wallet Balance</span><span className="font-bold text-content-primary">₹{earnings.walletBalance}</span></div>
            <div className="flex justify-between bg-surface-sunken p-3 rounded-xl border border-border-default"><span className="text-content-muted text-sm">Total Earned</span><span className="font-bold text-content-primary">₹{earnings.totalEarned}</span></div>
            <div className="flex justify-between bg-surface-sunken p-3 rounded-xl border border-border-default"><span className="text-content-muted text-sm">Today's Earnings</span><span className="font-bold text-content-primary">₹{earnings.todayEarned}</span></div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={isEditing ? 'Edit Mechanic' : 'Add New Mechanic'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError ? <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-600 dark:text-danger-400">{formError}</div> : null}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label="Mechanic Name" type="text" required value={formData.name} onChange={(e) => { setFormData({ ...formData, name: e.target.value }); if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: '' })); }} error={fieldErrors.name} />
            </div>
            <div>
              <Input label="Phone Number" type="tel" required value={formData.phone} onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 10); setFormData({ ...formData, phone: d }); if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: '' })); }} disabled={isEditing} error={fieldErrors.phone} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label="Email Address" type="email" value={formData.email} onChange={(e) => { setFormData({ ...formData, email: e.target.value.trim() }); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' })); }} error={fieldErrors.email} />
            </div>
            <Input label="City" type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-sm font-bold text-content-primary flex items-center"><MapPin className="w-4 h-4 mr-2" /> KYC Address / Service Location</p>
            <PlaceAutocompleteField onSelect={applyGeocodeResult} placeholder="Search for mechanic's address" />
            <AddressMapPicker
              latitude={formData.lat}
              longitude={formData.lng}
              onChange={({ latitude, longitude }) => setFormData({ ...formData, lat: latitude, lng: longitude })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Address Line" type="text" value={formData.addressLine} onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })} />
              <Input label="State" type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
              <Input label="Pincode" type="text" value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} />
              <Input label="Country" type="text" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1.5">Vehicle Specializations</label>
            <div className="flex gap-4">
              {['CAR', 'BIKE'].map((type) => (
                <Checkbox key={type} label={type} checked={formData.specializations.includes(type)} onChange={() => toggleSpecialization(type)} />
              ))}
            </div>
            {fieldErrors.specializations ? <p className="mt-1 text-xs text-danger-500">{fieldErrors.specializations}</p> : null}
          </div>

          <Input label="Skills (comma separated)" type="text" value={formData.skills} onChange={(e) => setFormData({ ...formData, skills: e.target.value })} placeholder="e.g. Battery, Brakes, AC Repair" />
          <Input label="Years of Experience" type="number" value={formData.experienceYears} onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })} />

          {isEditing && (
            <div className="flex flex-col space-y-3 pt-2">
              <Checkbox label="Account is Active" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />
              <Checkbox label="Mark as Online" checked={formData.isOnline} onChange={(e) => setFormData({ ...formData, isOnline: e.target.checked })} />
            </div>
          )}

          <div className="flex gap-4 mt-6 pt-4">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1">{isEditing ? 'Save Changes' : 'Create Mechanic'}</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
