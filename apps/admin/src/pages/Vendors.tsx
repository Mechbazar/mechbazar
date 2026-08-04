import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import { Phone, Plus, Eye, FileText, Landmark, Building, FileCheck, MapPin, Package, Trash2 } from 'lucide-react';
import { Button, Badge, Card, Checkbox, DataTable, EmptyState, Input, Modal, Icon3D } from '../components/ui';
import type { Column } from '../components/ui';
import { API_URL } from '../config/api';
import AddressMapPicker from '../components/maps/AddressMapPicker';
import PlaceAutocompleteField from '../components/maps/PlaceAutocompleteField';
import LocationMapView from '../components/maps/LocationMapView';
import type { GeocodeSuccess } from '../services/geocode.service';
import { fadeInUp } from '../utils/motion';

const emptyAddress = {
  addressLine1: '', addressLine2: '', city: '', state: '', pincode: '', country: '',
  lat: null as number | null, lng: null as number | null, placeId: '', formattedAddress: '',
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'APPROVED': return <Badge variant="success" size="sm" className="w-fit">Approved</Badge>;
    case 'PENDING': return <Badge variant="warning" size="sm" className="w-fit animate-pulse">Needs Review</Badge>;
    case 'UNDER_VERIFICATION': return <Badge variant="warning" size="sm" className="w-fit animate-pulse">Needs Review</Badge>;
    case 'REJECTED': return <Badge variant="danger" size="sm" className="w-fit">Rejected</Badge>;
    default: return <Badge variant="neutral" size="sm" className="w-fit">{status}</Badge>;
  }
};

export default function Vendors() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadError, setLoadError] = useState('');

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [activeVendor, setActiveVendor] = useState<any>(null);

  const [formData, setFormData] = useState({
    id: '', name: '', phone: '', email: '', storeName: '', gstNumber: '', isActive: true, ...emptyAddress
  });

  useEffect(() => {
    if (!token) return;
    fetchVendors();
  }, [token]);

  const fetchVendors = async () => {
    if (!token) return;
    try {
      setLoadError('');
      const res = await axios.get(`${API_URL}/vendors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVendors(res.data);
    } catch (error) {
      console.error('Failed to fetch vendors', error);
      setLoadError('Could not load vendors. Please sign out and sign in again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (vendor?: any) => {
    if (vendor) {
      const vp = vendor.vendorProfile || {};
      setFormData({
        id: vendor.id,
        name: vendor.name || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        storeName: vp.storeName || '',
        gstNumber: vp.gstNumber || '',
        isActive: vp.isActive ?? true,
        addressLine1: vp.addressLine1 || '',
        addressLine2: vp.addressLine2 || '',
        city: vp.city || vendor.city || '',
        state: vp.state || vendor.state || '',
        pincode: vp.pincode || '',
        country: vp.country || '',
        lat: vp.lat ?? null,
        lng: vp.lng ?? null,
        placeId: vp.placeId || '',
        formattedAddress: vp.formattedAddress || '',
      });
    } else {
      setFormData({
        id: '', name: '', phone: '', email: '', storeName: '', gstNumber: '', isActive: true, ...emptyAddress
      });
    }
    setShowEditModal(true);
  };

  // Lets the Dashboard's "Add Vendor" quick action (?action=create) jump
  // straight into this page's existing create flow instead of duplicating
  // the vendor-creation form there.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('action') === 'create') handleOpenEditModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Unconditional overwrite from an autocomplete selection -- matches the
  // applyGeocodeResult pattern used in apps/vendor's Register/Profile pages.
  const applyGeocodeResult = (result: GeocodeSuccess) => {
    setFormData((prev) => ({
      ...prev,
      addressLine1: result.components.line1 || prev.addressLine1,
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

  // Document files are behind an authenticated route (never a public URL) --
  // a plain <a href> can't carry the Authorization header, so fetch as a
  // blob with the token and open that instead. Mirrors this same file's
  // Riders.tsx / MechanicsPage.tsx equivalents.
  const viewDocument = async (vendorId: string, documentId: string) => {
    const res = await axios.get(`${API_URL}/vendors/${vendorId}/documents/${documentId}/file`, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    window.open(url, '_blank');
  };

  const handleOpenReviewModal = (vendor: any) => {
    setActiveVendor(vendor);
    setShowReviewModal(true);
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await axios.put(`${API_URL}/vendors/${formData.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/vendors`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowEditModal(false);
      fetchVendors();
    } catch (error: any) {
      console.error('Failed to save vendor', error);
      toast.error(error.response?.data?.error || 'Failed to save vendor.');
    }
  };

  const handleUpdateStatus = async (vendorId: string, status: string) => {
    try {
      await axios.patch(`${API_URL}/vendors/${vendorId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowReviewModal(false);
      fetchVendors();
    } catch (error: any) {
      console.error('Failed to update vendor status', error);
      toast.error(error.response?.data?.error || 'Failed to update vendor status');
    }
  };

  const handleDelete = async (vendor: any) => {
    if (!confirm(`Delete ${vendor.vendorProfile?.storeName || vendor.name}? This cannot be undone.`)) return;
    try {
      // vendor.id is the User id -- DELETE /vendors/:id expects the Vendor
      // (profile) id, same convention as the status route above.
      await axios.delete(`${API_URL}/vendors/${vendor.vendorProfile.id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchVendors();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete vendor');
    }
  };

  const filteredVendors = vendors.filter(v => {
    if (searchQuery) {
      const search = searchQuery.toLowerCase();
      return (
        (v.name && v.name.toLowerCase().includes(search)) ||
        (v.vendorProfile?.storeName && v.vendorProfile.storeName.toLowerCase().includes(search)) ||
        (v.phone && v.phone.includes(search))
      );
    }
    return true;
  });

  const columns: Column<any>[] = [
    {
      key: 'vendor',
      header: 'Vendor Info',
      render: (vendor) => (
        <div>
          <div className="font-semibold text-content-primary">{vendor.name || 'N/A'}</div>
          <div className="text-xs text-content-muted flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {vendor.phone}</div>
        </div>
      ),
    },
    {
      key: 'store',
      header: 'Store Details',
      render: (vendor) => (
        <div>
          <div className="text-sm font-medium text-content-primary">{vendor.vendorProfile?.storeName || 'Not Set'}</div>
          <div className="text-xs text-content-muted mt-0.5">{vendor.vendorProfile?.businessType || 'Retail'}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (vendor) => getStatusBadge(vendor.vendorProfile?.status),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (vendor) => (
        <div className="flex items-center justify-end gap-3">
          {(vendor.vendorProfile?.status === 'UNDER_VERIFICATION' || vendor.vendorProfile?.status === 'PENDING') && (
            <button
              onClick={() => handleOpenReviewModal(vendor)}
              className="text-warning-600 dark:text-warning-400 hover:text-warning-700 dark:hover:text-warning-300 text-sm font-semibold transition-colors inline-flex items-center gap-1"
            >
              <FileCheck className="w-4 h-4" /> Review KYC
            </button>
          )}
          <button
            onClick={() => handleOpenEditModal(vendor)}
            className="text-brand-primary hover:text-brand-accent text-sm font-medium transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(vendor)}
            className="text-danger-500 hover:text-danger-600 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
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

      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
            <Icon3D name="vendors" size={30} eager /> Marketplace Vendors
          </h1>
          <p className="text-content-secondary mt-1 text-sm">Manage vendor onboarding, KYC review, and store details</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Every product belongs to a real vendor -- this is where staff
              review pending vendor submissions, low stock, and B2B pricing
              across all of them, so it's linked here rather than living as
              its own top-level nav item. */}
          <Link to="/products">
            <Button variant="outline" icon={<Package size={15} />}>Review Vendor Products</Button>
          </Link>
          <Button icon={<Plus size={15} />} onClick={() => handleOpenEditModal()}>Add Vendor</Button>
        </div>
      </div>

      <Card padding="none" className="overflow-visible">
        <div className="p-4 border-b border-border-default flex justify-end">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vendor name, store name, or phone…"
              className="bg-surface-sunken border border-border-default rounded-xl pl-4 pr-4 py-2 text-sm text-content-primary outline-none focus:border-brand-primary w-72"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredVendors}
          rowKey={(v) => v.id}
          loading={loading}
          pageSize={10}
          emptyState={<EmptyState icon="vendors" title="No vendors found" description="No vendors match your current search." />}
          className="rounded-none border-none shadow-none"
        />
      </Card>

      {/* KYC REVIEW MODAL */}
      {showReviewModal && activeVendor && (
        <Modal
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          title="Review Vendor Application"
          size="xl"
          footer={
            <>
              <Button variant="danger" onClick={() => handleUpdateStatus(activeVendor.vendorProfile.id, 'REJECTED')}>
                Reject Application
              </Button>
              <Button variant="success" onClick={() => handleUpdateStatus(activeVendor.vendorProfile.id, 'APPROVED')}>
                Approve & Activate Vendor
              </Button>
            </>
          }
        >
          <div className="space-y-8">
            {/* Business Details */}
            <div>
              <h4 className="text-base font-bold text-brand-primary mb-4 flex items-center gap-2 border-b border-border-default pb-2">
                <Building className="w-5 h-5" /> Business Details
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div><p className="text-sm text-content-muted">Store Name</p><p className="font-medium text-content-primary">{activeVendor.vendorProfile.storeName}</p></div>
                <div><p className="text-sm text-content-muted">Owner Name</p><p className="font-medium text-content-primary">{activeVendor.name}</p></div>
                <div><p className="text-sm text-content-muted">Business Type</p><p className="font-medium text-content-primary">{activeVendor.vendorProfile.businessType}</p></div>
                <div><p className="text-sm text-content-muted">GST Number</p><p className="font-medium text-content-primary">{activeVendor.vendorProfile.gstNumber || 'N/A'}</p></div>
                <div><p className="text-sm text-content-muted">PAN Number</p><p className="font-medium text-content-primary">{activeVendor.vendorProfile.panNumber}</p></div>
                <div><p className="text-sm text-content-muted">Location</p><p className="font-medium text-content-primary">{activeVendor.city}, {activeVendor.state}</p></div>
              </div>
              {(activeVendor.vendorProfile.formattedAddress || activeVendor.vendorProfile.lat != null) && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm text-content-muted flex items-center gap-1"><MapPin className="w-4 h-4" /> {activeVendor.vendorProfile.formattedAddress || 'Store location'}</p>
                  <LocationMapView
                    markers={activeVendor.vendorProfile.lat != null ? [{ id: 'store', lat: activeVendor.vendorProfile.lat, lng: activeVendor.vendorProfile.lng, label: activeVendor.vendorProfile.storeName }] : []}
                    height={200}
                    emptyLabel="No store location set"
                  />
                </div>
              )}
            </div>

            {/* Bank Details */}
            <div>
              <h4 className="text-base font-bold text-brand-primary mb-4 flex items-center gap-2 border-b border-border-default pb-2">
                <Landmark className="w-5 h-5" /> Bank Details
              </h4>
              {activeVendor.vendorProfile.bankAccounts && activeVendor.vendorProfile.bankAccounts.length > 0 ? (
                <div className="bg-surface-sunken p-4 rounded-xl border border-border-default grid grid-cols-2 gap-4">
                  <div><p className="text-sm text-content-muted">Bank Name</p><p className="font-medium text-content-primary">{activeVendor.vendorProfile.bankAccounts[0].bankName}</p></div>
                  <div><p className="text-sm text-content-muted">Account Holder</p><p className="font-medium text-content-primary">{activeVendor.vendorProfile.bankAccounts[0].accountHolderName}</p></div>
                  <div><p className="text-sm text-content-muted">Account Number</p><p className="font-medium text-content-primary">{activeVendor.vendorProfile.bankAccounts[0].accountNumber}</p></div>
                  <div><p className="text-sm text-content-muted">IFSC Code</p><p className="font-medium text-content-primary">{activeVendor.vendorProfile.bankAccounts[0].ifscCode}</p></div>
                </div>
              ) : (
                <p className="text-content-muted text-sm italic">No bank details provided.</p>
              )}
            </div>

            {/* Documents */}
            <div>
              <h4 className="text-base font-bold text-brand-primary mb-4 flex items-center gap-2 border-b border-border-default pb-2">
                <FileText className="w-5 h-5" /> Uploaded Documents
              </h4>
              {activeVendor.vendorProfile.documents && activeVendor.vendorProfile.documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {activeVendor.vendorProfile.documents.map((doc: any) => (
                    <button
                      type="button"
                      key={doc.id}
                      onClick={() => viewDocument(activeVendor.vendorProfile.id, doc.id)}
                      className="flex flex-col items-center justify-center p-6 bg-surface-sunken hover:bg-brand-primary/10 border border-border-default hover:border-brand-primary rounded-xl transition-all group"
                    >
                      <FileText className="w-10 h-10 text-content-muted group-hover:text-brand-primary mb-2 transition-colors" />
                      <span className="text-sm font-bold text-content-primary group-hover:text-brand-primary transition-colors">{doc.type}</span>
                      <span className="text-xs text-content-muted mt-1 flex items-center gap-1"><Eye className="w-3 h-3" /> View Document</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-content-muted text-sm italic">No documents uploaded.</p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Basic Edit Modal (Kept for backward compatibility) */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Vendor Core Details"
      >
        <form onSubmit={handleSubmitEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Owner Name" type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            <Input label="Store Name" type="text" required value={formData.storeName} onChange={(e) => setFormData({ ...formData, storeName: e.target.value })} />
            <div className="col-span-2 mt-2">
              <Checkbox
                label="Vendor is Active (can sell on platform)"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border-default space-y-3">
            <p className="text-sm font-bold text-content-primary flex items-center gap-2"><MapPin className="w-4 h-4" /> Store Location</p>
            <PlaceAutocompleteField onSelect={applyGeocodeResult} placeholder="Search for store address" />
            <AddressMapPicker
              latitude={formData.lat}
              longitude={formData.lng}
              onChange={({ latitude, longitude }) => setFormData({ ...formData, lat: latitude, lng: longitude })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Address Line 1" type="text" value={formData.addressLine1} onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })} />
              <Input label="Address Line 2" type="text" value={formData.addressLine2} onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })} />
              <Input label="City" type="text" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
              <Input label="State" type="text" value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} />
              <Input label="Pincode" type="text" value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} />
              <Input label="Country" type="text" value={formData.country} onChange={(e) => setFormData({ ...formData, country: e.target.value })} />
            </div>
          </div>

          <div className="flex gap-4 mt-6 pt-4 border-t border-border-default">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button type="submit" className="flex-1">Save Changes</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
