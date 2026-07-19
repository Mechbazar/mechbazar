import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../store';
import {
  Wrench, Search, Phone, CheckCircle, XCircle, Plus, FileText, Landmark, Eye, FileCheck, MapPin, Star,
  Users, Wifi, WifiOff, ShieldCheck, ShieldAlert, PauseCircle, PlayCircle, Trash2, ClipboardList, Wallet,
} from 'lucide-react';
import { Button, Card, Badge, Dialog, Input, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

const KYC_REVIEWABLE = new Set(['PENDING', 'UNDER_VERIFICATION', 'RESUBMISSION_REQUIRED']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;

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
  });
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
      setFormData({
        id: technician.id,
        name: technician.name || '',
        phone: technician.phone || '',
        email: technician.email || '',
        city: technician.city || '',
        state: technician.state || '',
        specializations: technician.technicianProfile?.specializations || [],
        skills: (technician.technicianProfile?.skills || []).join(', '),
        experienceYears: technician.technicianProfile?.experienceYears != null ? String(technician.technicianProfile.experienceYears) : '',
        isActive: technician.technicianProfile?.isActive ?? true,
        isOnline: technician.technicianProfile?.isOnline ?? false,
      });
    } else {
      setIsEditing(false);
      setFormData({ id: '', name: '', phone: '', email: '', city: '', state: '', specializations: ['CAR', 'BIKE'], skills: '', experienceYears: '', isActive: true, isOnline: false });
    }
    setShowModal(true);
  };

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
      alert(error.response?.data?.error || 'Failed to suspend technician');
    }
  };

  const handleActivate = async (technician: any) => {
    try {
      await axios.patch(`${API_URL}/technicians/${technician.technicianProfile.id}/status`, { status: 'APPROVED' }, { headers: { Authorization: `Bearer ${token}` } });
      fetchTechnicians();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to activate technician');
    }
  };

  const handleDelete = async (technician: any) => {
    if (!confirm(`Delete ${technician.name}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/technicians/${technician.id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchTechnicians();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete technician');
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
      alert(error.response?.data?.error || 'Failed to update technician status');
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
      alert('Failed to load document.');
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

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-brand-light flex items-center">
          <Wrench className="w-8 h-8 mr-3 text-brand-primary" />
          Mechanics
        </h1>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-5 h-5 mr-1" /> Add Mechanic
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { key: 'ALL', label: 'Total', value: stats.total, icon: Users, color: 'text-brand-primary' },
          { key: 'ONLINE', label: 'Online', value: stats.online, icon: Wifi, color: 'text-success-500' },
          { key: 'BUSY', label: 'Busy', value: stats.busy, icon: Wrench, color: 'text-warning-500' },
          { key: 'OFFLINE', label: 'Offline', value: stats.offline, icon: WifiOff, color: 'text-neutral-400' },
          { key: 'PENDING', label: 'Pending Approval', value: stats.pendingApproval, icon: ShieldAlert, color: 'text-warning-500' },
          { key: 'ALL', label: 'Verified', value: stats.verified, icon: ShieldCheck, color: 'text-success-500' },
          { key: 'SUSPENDED', label: 'Suspended', value: stats.suspended, icon: PauseCircle, color: 'text-danger-500' },
        ].map((s, idx) => (
          <Card key={idx} variant="dark" className="cursor-pointer" onClick={() => setFilter(s.key as any)}>
            <div className="flex items-center gap-3">
              <s.icon className={`w-6 h-6 ${s.color}`} />
              <div>
                <p className="text-neutral-400 text-xs font-medium">{s.label}</p>
                <p className="text-xl font-bold text-white">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="bg-brand-panel border border-brand-border rounded-xl p-4 flex items-center">
        <Search className="w-5 h-5 text-brand-muted mr-3" />
        <input
          type="text"
          placeholder="Search by name, phone, or skill..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none focus:outline-none text-brand-light w-full"
        />
      </div>

      {loading ? (
        <Loader fullScreen />
      ) : filteredTechnicians.length === 0 ? (
        <div className="bg-brand-panel border border-brand-border rounded-xl p-12 text-center">
          <Wrench className="w-12 h-12 text-brand-muted mx-auto mb-4" />
          <h3 className="text-xl font-bold text-brand-light mb-2">No Mechanics Found</h3>
          <p className="text-brand-muted mb-6">No mechanics match your criteria.</p>
          <Button onClick={() => handleOpenModal()}>Add Your First Mechanic</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTechnicians.map((technician) => (
            <Card key={technician.id} variant="dark" className="relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4">
                {technician.technicianProfile?.isOnline ? (
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
                  {technician.name ? technician.name.charAt(0).toUpperCase() : 'T'}
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-bold text-brand-light">{technician.name || 'Unnamed Mechanic'}</h3>
                  <div className="flex items-center text-xs text-brand-muted mt-1">
                    <Phone className="w-3 h-3 mr-1" /> {technician.phone}
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6 bg-brand-dark p-3 rounded-lg border border-brand-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-muted">Specializations</span>
                  <span className="text-sm font-bold text-brand-light">{(technician.technicianProfile?.specializations || []).join(', ') || 'N/A'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-muted">Rating</span>
                  <span className="text-sm font-bold text-brand-light flex items-center gap-1"><Star className="w-3 h-3 text-warning-400" /> {(technician.technicianProfile?.rating || 0).toFixed(1)} ({technician.technicianProfile?.totalJobs || 0} jobs)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-muted">Current Jobs</span>
                  <span className="text-sm font-bold text-brand-light">{technician.technicianProfile?.currentJobs || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-brand-muted">KYC Status</span>
                  {getKycStatusBadge(technician.technicianProfile?.status)}
                </div>
                {technician.technicianProfile?.currentLat != null && technician.technicianProfile?.currentLng != null && (
                  <a
                    href={`https://www.google.com/maps?q=${technician.technicianProfile.currentLat},${technician.technicianProfile.currentLng}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center justify-between text-brand-primary hover:text-brand-secondary text-xs font-bold"
                  >
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Track Live Location</span>
                  </a>
                )}
              </div>

              {KYC_REVIEWABLE.has(technician.technicianProfile?.status) && (
                <button
                  onClick={() => handleOpenReviewModal(technician)}
                  className="w-full mb-3 flex items-center justify-center text-yellow-500 hover:text-yellow-400 text-sm font-bold transition-colors border border-brand-border rounded-lg py-2"
                >
                  <FileCheck className="w-4 h-4 mr-1" /> Review KYC Application
                </button>
              )}

              <div className="grid grid-cols-2 gap-2 mb-3">
                <button onClick={() => navigate('/service-bookings?filter=pending')} className="flex items-center justify-center gap-1 text-xs font-bold text-brand-primary hover:text-brand-secondary border border-brand-border rounded-lg py-2">
                  <ClipboardList className="w-3.5 h-3.5" /> Assign Jobs
                </button>
                <button onClick={() => openJobsModal(technician)} className="flex items-center justify-center gap-1 text-xs font-bold text-brand-light hover:text-brand-primary border border-brand-border rounded-lg py-2">
                  <CheckCircle className="w-3.5 h-3.5" /> Completed Jobs
                </button>
                <button onClick={() => openEarningsModal(technician)} className="flex items-center justify-center gap-1 text-xs font-bold text-brand-light hover:text-brand-primary border border-brand-border rounded-lg py-2">
                  <Wallet className="w-3.5 h-3.5" /> Earnings
                </button>
                {technician.technicianProfile?.status === 'SUSPENDED' ? (
                  <button onClick={() => handleActivate(technician)} className="flex items-center justify-center gap-1 text-xs font-bold text-success-500 hover:text-success-400 border border-brand-border rounded-lg py-2">
                    <PlayCircle className="w-3.5 h-3.5" /> Activate
                  </button>
                ) : (
                  <button onClick={() => handleSuspend(technician)} className="flex items-center justify-center gap-1 text-xs font-bold text-warning-500 hover:text-warning-400 border border-brand-border rounded-lg py-2">
                    <PauseCircle className="w-3.5 h-3.5" /> Suspend
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-brand-border pt-4">
                <div className="flex space-x-2">
                  <button onClick={() => handleOpenModal(technician)} className="text-brand-primary hover:text-brand-secondary text-sm font-bold transition-colors">Edit</button>
                  <span className="text-brand-border">|</span>
                  <button
                    onClick={() => handleToggleStatus(technician)}
                    className={`text-sm font-bold transition-colors ${technician.technicianProfile?.isActive ? 'text-brand-muted hover:text-red-400' : 'text-green-500 hover:text-green-400'}`}
                  >
                    {technician.technicianProfile?.isActive ? 'Disable' : 'Enable'}
                  </button>
                  <span className="text-brand-border">|</span>
                  <button onClick={() => handleDelete(technician)} className="text-brand-muted hover:text-red-400 transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  {technician.technicianProfile?.isActive ? (
                    <span className="flex items-center text-xs font-medium text-brand-muted"><CheckCircle className="w-4 h-4 mr-1 text-green-500" /> Active</span>
                  ) : (
                    <span className="flex items-center text-xs font-medium text-brand-muted"><XCircle className="w-4 h-4 mr-1 text-red-500" /> Inactive</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showReviewModal && activeTechnician && (
        <Dialog
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
              <h4 className="text-lg font-bold text-brand-primary mb-4 flex items-center border-b border-brand-border pb-2">
                <Wrench className="w-5 h-5 mr-2" /> Personal & Skill Details
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div><p className="text-sm text-brand-muted">Full Name</p><p className="font-medium text-brand-light">{activeTechnician.name}</p></div>
                <div><p className="text-sm text-brand-muted">Phone</p><p className="font-medium text-brand-light">{activeTechnician.phone}</p></div>
                <div><p className="text-sm text-brand-muted">Email</p><p className="font-medium text-brand-light">{activeTechnician.email || 'N/A'}</p></div>
                <div><p className="text-sm text-brand-muted">Address / Service Area</p><p className="font-medium text-brand-light">{activeTechnician.technicianProfile?.addressLine || 'N/A'}, {activeTechnician.technicianProfile?.city} {activeTechnician.technicianProfile?.pincode}</p></div>
                <div><p className="text-sm text-brand-muted">Aadhaar Number</p><p className="font-medium text-brand-light">{activeTechnician.technicianProfile?.aadhaarNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-brand-muted">Specializations</p><p className="font-medium text-brand-light">{(activeTechnician.technicianProfile?.specializations || []).join(', ') || 'N/A'}</p></div>
                <div><p className="text-sm text-brand-muted">Skills</p><p className="font-medium text-brand-light">{(activeTechnician.technicianProfile?.skills || []).join(', ') || 'N/A'}</p></div>
                <div><p className="text-sm text-brand-muted">Experience</p><p className="font-medium text-brand-light">{activeTechnician.technicianProfile?.experienceYears != null ? `${activeTechnician.technicianProfile.experienceYears} years` : 'N/A'}</p></div>
                <div><p className="text-sm text-brand-muted">Emergency Contact</p><p className="font-medium text-brand-light">{activeTechnician.technicianProfile?.emergencyContactName || 'N/A'} — {activeTechnician.technicianProfile?.emergencyContactPhone || ''}</p></div>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-bold text-brand-primary mb-4 flex items-center border-b border-brand-border pb-2">
                <Landmark className="w-5 h-5 mr-2" /> Bank Details
              </h4>
              {activeTechnician.technicianProfile?.bankAccounts && activeTechnician.technicianProfile.bankAccounts.length > 0 ? (
                <div className="bg-brand-dark/50 p-4 rounded-xl border border-brand-border grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-brand-muted">Bank Name</p><p className="font-medium text-brand-light">{activeTechnician.technicianProfile.bankAccounts[0].bankName}</p></div>
                  <div><p className="text-sm text-brand-muted">Account Holder</p><p className="font-medium text-brand-light">{activeTechnician.technicianProfile.bankAccounts[0].accountHolderName}</p></div>
                  <div><p className="text-sm text-brand-muted">Account Number</p><p className="font-medium text-brand-light">{activeTechnician.technicianProfile.bankAccounts[0].accountNumber}</p></div>
                  <div><p className="text-sm text-brand-muted">IFSC Code</p><p className="font-medium text-brand-light">{activeTechnician.technicianProfile.bankAccounts[0].ifscCode}</p></div>
                </div>
              ) : (
                <p className="text-brand-muted text-sm italic">No bank details provided.</p>
              )}
            </div>

            <div>
              <h4 className="text-lg font-bold text-brand-primary mb-4 flex items-center border-b border-brand-border pb-2">
                <FileText className="w-5 h-5 mr-2" /> Uploaded Documents (Profile Photo, Aadhaar/ID, Driving License)
              </h4>
              {activeTechnician.technicianProfile?.documents && activeTechnician.technicianProfile.documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {activeTechnician.technicianProfile.documents.map((doc: any) => (
                    <button
                      key={doc.id}
                      onClick={() => viewDocument(activeTechnician.technicianProfile.id, doc.id)}
                      className="flex flex-col items-center justify-center p-6 bg-brand-dark hover:bg-brand-primary/10 border border-brand-border hover:border-brand-primary rounded-xl transition-all group"
                    >
                      <FileText className="w-10 h-10 text-brand-muted group-hover:text-brand-primary mb-2 transition-colors" />
                      <span className="text-sm font-bold text-brand-light group-hover:text-brand-primary transition-colors">{doc.type.replace(/_/g, ' ')}</span>
                      <span className="text-xs text-brand-muted mt-1">{doc.status}</span>
                      <span className="text-xs text-brand-muted mt-1 flex items-center"><Eye className="w-3 h-3 mr-1" /> View Document</span>
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
                placeholder="Add a note for the mechanic (e.g. which document to resubmit and why)..."
                className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-brand-light focus:outline-none focus:border-brand-primary"
                rows={3}
              />
            </div>
          </div>
        </Dialog>
      )}

      <Dialog isOpen={!!jobsModalTechnician} onClose={() => setJobsModalTechnician(null)} title={`Completed Jobs — ${jobsModalTechnician?.name || ''}`} size="lg">
        {jobsLoading ? <Loader /> : completedJobs.length === 0 ? (
          <p className="text-brand-muted text-sm py-8 text-center">No completed jobs yet.</p>
        ) : (
          <div className="space-y-2">
            {completedJobs.map((j) => (
              <div key={j.id} className="flex justify-between items-center bg-brand-dark p-3 rounded-lg border border-brand-border">
                <div>
                  <p className="font-medium text-brand-light text-sm">#{j.bookingNumber} — {j.package?.name}</p>
                  <p className="text-xs text-brand-muted">{j.user?.name}</p>
                </div>
                <p className="text-sm font-bold text-brand-light">₹{j.finalAmount}</p>
              </div>
            ))}
          </div>
        )}
      </Dialog>

      <Dialog isOpen={!!earningsModalTechnician} onClose={() => setEarningsModalTechnician(null)} title={`Earnings — ${earningsModalTechnician?.name || ''}`}>
        {earningsLoading || !earnings ? <Loader /> : (
          <div className="space-y-3">
            <div className="flex justify-between bg-brand-dark p-3 rounded-lg border border-brand-border"><span className="text-brand-muted text-sm">Wallet Balance</span><span className="font-bold text-brand-light">₹{earnings.walletBalance}</span></div>
            <div className="flex justify-between bg-brand-dark p-3 rounded-lg border border-brand-border"><span className="text-brand-muted text-sm">Total Earned</span><span className="font-bold text-brand-light">₹{earnings.totalEarned}</span></div>
            <div className="flex justify-between bg-brand-dark p-3 rounded-lg border border-brand-border"><span className="text-brand-muted text-sm">Today's Earnings</span><span className="font-bold text-brand-light">₹{earnings.todayEarned}</span></div>
          </div>
        )}
      </Dialog>

      <Dialog isOpen={showModal} onClose={() => setShowModal(false)} title={isEditing ? 'Edit Mechanic' : 'Add New Mechanic'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError ? <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div> : null}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label="Mechanic Name" type="text" required value={formData.name} onChange={(e) => { setFormData({ ...formData, name: e.target.value }); if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: '' })); }} />
              {fieldErrors.name ? <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p> : null}
            </div>
            <div>
              <Input label="Phone Number" type="tel" required value={formData.phone} onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 10); setFormData({ ...formData, phone: d }); if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: '' })); }} disabled={isEditing} />
              {fieldErrors.phone ? <p className="mt-1 text-xs text-red-500">{fieldErrors.phone}</p> : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input label="Email Address" type="email" value={formData.email} onChange={(e) => { setFormData({ ...formData, email: e.target.value.trim() }); if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: '' })); }} />
              {fieldErrors.email ? <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p> : null}
            </div>
            <Input label="City" type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-muted mb-1">Vehicle Specializations</label>
            <div className="flex gap-4">
              {['CAR', 'BIKE'].map((type) => (
                <label key={type} className="flex items-center gap-2 text-brand-light text-sm">
                  <input type="checkbox" checked={formData.specializations.includes(type)} onChange={() => toggleSpecialization(type)} className="w-4 h-4 text-brand-primary bg-brand-dark border-brand-border rounded" />
                  {type}
                </label>
              ))}
            </div>
            {fieldErrors.specializations ? <p className="mt-1 text-xs text-red-500">{fieldErrors.specializations}</p> : null}
          </div>

          <Input label="Skills (comma separated)" type="text" value={formData.skills} onChange={(e) => setFormData({ ...formData, skills: e.target.value })} placeholder="e.g. Battery, Brakes, AC Repair" />
          <Input label="Years of Experience" type="number" value={formData.experienceYears} onChange={(e) => setFormData({ ...formData, experienceYears: e.target.value })} />

          {isEditing && (
            <div className="flex flex-col space-y-3 pt-2">
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4 text-brand-primary bg-brand-dark border-brand-border rounded" />
                <label htmlFor="isActive" className="text-sm font-medium text-brand-light">Account is Active</label>
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" id="isOnline" checked={formData.isOnline} onChange={(e) => setFormData({ ...formData, isOnline: e.target.checked })} className="w-4 h-4 text-green-500 bg-brand-dark border-brand-border rounded" />
                <label htmlFor="isOnline" className="text-sm font-medium text-brand-light">Mark as Online</label>
              </div>
            </div>
          )}

          <div className="flex space-x-4 mt-6 pt-4">
            <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-brand-dark text-brand-light px-4 py-2 rounded-lg font-bold hover:bg-gray-800 transition-colors">Cancel</button>
            <Button type="submit" className="flex-1">{isEditing ? 'Save Changes' : 'Create Mechanic'}</Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
