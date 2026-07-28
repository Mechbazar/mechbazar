import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import { loginSuccess } from '../store/slices/authSlice';
import {
  User, Store, FileText, CreditCard, Save, CheckCircle, Building2, MapPin, Shield, Loader2
} from 'lucide-react';
import { Button, Badge, Input } from '@mechbazar/shared/web';
import { API_URL, resolveUploadUrl } from '../config/api';
import { reverseGeocode } from '../services/geocode.service';
import type { GeocodeSuccess } from '../services/geocode.service';
import AddressMapPicker from '../components/maps/AddressMapPicker';
import PlaceAutocompleteField from '../components/maps/PlaceAutocompleteField';

export default function Profile() {
  const { token, user, vendorProfile } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();

  const [form, setForm] = useState({
    name: '', city: '', state: '',
    storeName: '', gstNumber: '', panNumber: '', businessType: '',
    addressLine1: '', addressLine2: '', pincode: '',
    country: null as string | null, lat: null as number | null, lng: null as number | null,
    placeId: null as string | null, formattedAddress: null as string | null,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);
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
      addressLine1: vendorProfile?.addressLine1 || '',
      addressLine2: vendorProfile?.addressLine2 || '',
      pincode: vendorProfile?.pincode || '',
      country: vendorProfile?.country || null,
      lat: vendorProfile?.lat ?? null,
      lng: vendorProfile?.lng ?? null,
      placeId: vendorProfile?.placeId || null,
      formattedAddress: vendorProfile?.formattedAddress || null,
    });
  }, [user, vendorProfile]);

  // Shared by "use my current location", pin drag, and Places Autocomplete
  // selection -- syncs every field to the new location, including clearing a
  // field this result has no component for (see Register.tsx's identical
  // helper for the same rationale).
  const applyGeocodeResult = (result: GeocodeSuccess) => {
    setForm((f) => ({
      ...f,
      addressLine1: result.components.line1 || '',
      city: result.components.city || '',
      state: result.components.state || '',
      pincode: result.components.pincode || '',
      country: result.components.country || null,
      lat: result.lat,
      lng: result.lng,
      placeId: result.placeId,
      formattedAddress: result.formattedAddress,
    }));
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const result = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
        if (result.ok) {
          applyGeocodeResult(result);
        } else {
          setForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        }
      },
      () => setLocating(false)
    );
  };

  const handleMapPinChange = async (c: { latitude: number; longitude: number }) => {
    setForm((f) => ({ ...f, lat: c.latitude, lng: c.longitude }));
    const result = await reverseGeocode(c.latitude, c.longitude);
    if (result.ok) applyGeocodeResult(result);
  };

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

        <div className="mt-5 pt-5 border-t border-brand-muted">
          <label className="block text-sm font-medium text-gray-300 mb-1">Store Location</label>
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="w-full mb-3 flex items-center justify-center gap-2 bg-brand-secondary/10 border border-brand-secondary/20 text-brand-secondary rounded-lg py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            {locating ? 'Locating...' : 'Use my current location'}
          </button>
          <div className="mb-3">
            <PlaceAutocompleteField onSelect={applyGeocodeResult} placeholder="Search for your store address" />
          </div>
          <AddressMapPicker latitude={form.lat} longitude={form.lng} onChange={handleMapPinChange} height={200} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Input label="Address Line 1" value={form.addressLine1} onChange={f('addressLine1')} />
            <Input label="Address Line 2 (Optional)" value={form.addressLine2} onChange={f('addressLine2')} />
            <Input label="Pincode" value={form.pincode} onChange={f('pincode')} />
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
                  <a href={resolveUploadUrl(doc.url)} target="_blank" rel="noreferrer" className="text-xs text-brand-secondary hover:text-brand-accent underline">View</a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
