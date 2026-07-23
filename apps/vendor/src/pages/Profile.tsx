import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { loginSuccess } from '../store/slices/authSlice';
import {
  User, Store, FileText, CreditCard, Save, CheckCircle, Building2, MapPin, Shield
} from 'lucide-react';
import { Button, Badge, Input } from '@mechbazar/shared/web';
import { API_URL, SERVER_ORIGIN } from '../config/api';

export default function Profile() {
  const { token, user, vendorProfile } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();

  const [form, setForm] = useState({
    name: '', city: '', state: '',
    storeName: '', gstNumber: '', panNumber: '', businessType: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    setForm({
      name: user?.name || '',
      city: user?.city || '',
      state: user?.state || '',
      storeName: vendorProfile?.storeName || '',
      gstNumber: vendorProfile?.gstNumber || '',
      panNumber: vendorProfile?.panNumber || '',
      businessType: vendorProfile?.businessType || '',
    });
  }, [user, vendorProfile]);

  useEffect(() => {
    // Fetch latest profile including bank accounts and documents
    const fetchProfile = async () => {
      try {
        const res = await axios.get(`${API_URL}/vendors/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // GET /vendors/profile returns the vendor object directly (spread,
        // not nested under a `.vendor` key) -- reading `.vendor?.bankAccounts`
        // always evaluated to undefined, so this list silently rendered empty
        // even when real bank accounts/documents existed.
        setBankAccounts(res.data?.bankAccounts || []);
        setDocuments(res.data?.documents || []);
      } catch (e) {
        console.error('Failed to fetch profile', e);
      }
    };
    fetchProfile();
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await axios.put(`${API_URL}/vendors/profile`, form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Update redux state
      dispatch(loginSuccess({ token: token!, user: res.data.user, vendor: res.data.vendor }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const f = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <User className="w-8 h-8 text-brand-secondary" /> Profile & Settings
          </h1>
          <p className="text-gray-400 mt-1">Manage your personal and store information</p>
        </div>
        <Button onClick={handleSave} isLoading={saving}>
          {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : saving ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
        </Button>
      </div>

      {/* Personal Info */}
      <div className="bg-brand-primary border border-brand-muted rounded-xl p-6">
        <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-brand-secondary" /> Personal Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Full Name" icon={<User className="w-4 h-4" />} value={form.name} onChange={f('name')} />
          <Input label="Email Address" icon={<FileText className="w-4 h-4" />} value={user?.email || ''} disabled />
          <Input label="Mobile Number" icon={<FileText className="w-4 h-4" />} value={user?.phone || ''} disabled />
          <Input label="City" icon={<MapPin className="w-4 h-4" />} value={form.city} onChange={f('city')} />
          <Input label="State" icon={<MapPin className="w-4 h-4" />} value={form.state} onChange={f('state')} />
        </div>
      </div>

      {/* Store Info */}
      <div className="bg-brand-primary border border-brand-muted rounded-xl p-6">
        <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-5">
          <Store className="w-5 h-5 text-brand-secondary" /> Store Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Store Name" icon={<Store className="w-4 h-4" />} value={form.storeName} onChange={f('storeName')} />
          <Input label="GST Number" icon={<Shield className="w-4 h-4" />} value={form.gstNumber} onChange={f('gstNumber')} />
          <Input label="PAN Number" icon={<FileText className="w-4 h-4" />} value={form.panNumber} onChange={f('panNumber')} />
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Business Type</label>
            <select
              value={form.businessType}
              onChange={f('businessType')}
              className="w-full pl-4 pr-4 py-2.5 rounded-lg border bg-brand-dark border-brand-muted text-white focus:border-brand-secondary focus:outline-none text-sm"
            >
              <option value="">Select type...</option>
              <option value="MANUFACTURER">Manufacturer</option>
              <option value="DEALER">Dealer / Distributor</option>
              <option value="RETAILER">Retailer</option>
              <option value="IMPORTER">Importer</option>
              <option value="SERVICE">Service Provider</option>
            </select>
          </div>
        </div>

        {/* Vendor Status Badge */}
        <div className="mt-5 pt-5 border-t border-brand-muted flex items-center gap-3">
          <p className="text-sm text-gray-400">Account Status:</p>
          <Badge
            variant={vendorProfile?.status === 'APPROVED' ? 'success' : vendorProfile?.status === 'REJECTED' ? 'danger' : 'warning'}
            className="!rounded-full"
          >
            {vendorProfile?.status || 'PENDING'}
          </Badge>
        </div>
      </div>

      {/* Bank Accounts */}
      <div className="bg-brand-primary border border-brand-muted rounded-xl p-6">
        <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-5">
          <CreditCard className="w-5 h-5 text-brand-secondary" /> Bank Accounts
        </h2>
        {bankAccounts.length === 0 ? (
          <p className="text-gray-500 text-sm">No bank accounts linked yet.</p>
        ) : (
          <div className="space-y-3">
            {bankAccounts.map((acc: any) => (
              <div key={acc.id} className="flex items-center gap-4 bg-brand-dark rounded-lg p-4 border border-brand-muted">
                <Building2 className="w-8 h-8 text-brand-secondary flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">{acc.bankName}</p>
                  <p className="text-gray-400 text-xs">A/C: ****{acc.accountNumber?.slice(-4)} • IFSC: {acc.ifscCode}</p>
                  <p className="text-gray-500 text-xs">{acc.accountHolder}</p>
                </div>
                {acc.isPrimary && (
                  <Badge variant="secondary" className="!rounded-lg">Primary</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="bg-brand-primary border border-brand-muted rounded-xl p-6">
        <h2 className="text-white font-bold text-lg flex items-center gap-2 mb-5">
          <FileText className="w-5 h-5 text-brand-secondary" /> Submitted Documents
        </h2>
        {documents.length === 0 ? (
          <p className="text-gray-500 text-sm">No documents submitted.</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc: any) => (
              <div key={doc.id} className="flex items-center gap-4 bg-brand-dark rounded-lg p-4 border border-brand-muted">
                <FileText className="w-6 h-6 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm capitalize">{doc.type?.replace(/_/g, ' ')}</p>
                  <p className="text-gray-500 text-xs">Uploaded {new Date(doc.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <Badge variant={doc.status === 'APPROVED' ? 'success' : doc.status === 'REJECTED' ? 'danger' : 'warning'} className="!rounded-lg">
                  {doc.status}
                </Badge>
                {doc.url && (
                  <a href={`${SERVER_ORIGIN}${doc.url}`} target="_blank" rel="noreferrer" className="text-xs text-brand-secondary hover:text-brand-accent underline">View</a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
