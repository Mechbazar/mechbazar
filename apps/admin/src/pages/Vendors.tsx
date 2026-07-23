import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Store, Phone, Search, Plus, Eye, FileText, Landmark, Building, FileCheck } from 'lucide-react';
import { Button, Badge, Dialog, Input, Loader } from '@mechbazar/shared/web';
import { API_URL, SERVER_ORIGIN } from '../config/api';

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
    id: '', name: '', phone: '', email: '', city: '', state: '', storeName: '', gstNumber: '', isActive: true
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
      setFormData({
        id: vendor.id,
        name: vendor.name || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        city: vendor.city || '',
        state: vendor.state || '',
        storeName: vendor.vendorProfile?.storeName || '',
        gstNumber: vendor.vendorProfile?.gstNumber || '',
        isActive: vendor.vendorProfile?.isActive ?? true
      });
    } else {
      setFormData({
        id: '', name: '', phone: '', email: '', city: '', state: '', storeName: '', gstNumber: '', isActive: true
      });
    }
    setShowEditModal(true);
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
      alert(error.response?.data?.error || 'Failed to save vendor.');
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
      alert(error.response?.data?.error || 'Failed to update vendor status');
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

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'APPROVED': return <Badge variant="success" className="!rounded-full">Approved</Badge>;
      case 'PENDING': return <Badge variant="warning" className="!rounded-full animate-pulse">Needs Review</Badge>;
      case 'UNDER_VERIFICATION': return <Badge variant="warning" className="!rounded-full animate-pulse">Needs Review</Badge>;
      case 'REJECTED': return <Badge variant="danger" className="!rounded-full">Rejected</Badge>;
      default: return <Badge variant="neutral" className="!rounded-full">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-brand-light flex items-center">
          <Store className="w-8 h-8 mr-3 text-brand-primary" />
          Marketplace Vendors
        </h1>
        <Button onClick={() => handleOpenEditModal()}>
          <Plus className="w-5 h-5 mr-1" /> Add Vendor
        </Button>
      </div>

      <div className="bg-brand-panel border border-brand-border rounded-xl p-4 flex items-center">
        <Search className="w-5 h-5 text-brand-muted mr-3" />
        <input 
          type="text" 
          placeholder="Search by vendor name, store name, or phone..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none focus:outline-none text-brand-light w-full"
        />
      </div>

      {loading ? (
        <Loader fullScreen />
      ) : filteredVendors.length === 0 ? (
        <div className="bg-brand-panel border border-brand-border rounded-xl p-12 text-center">
          <Store className="w-12 h-12 text-brand-muted mx-auto mb-4" />
          <h3 className="text-xl font-bold text-brand-light mb-2">No Vendors Found</h3>
        </div>
      ) : (
        <div className="bg-brand-panel border border-brand-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-dark border-b border-brand-border">
                <th className="p-4 text-sm font-semibold text-brand-muted">Vendor Info</th>
                <th className="p-4 text-sm font-semibold text-brand-muted">Store Details</th>
                <th className="p-4 text-sm font-semibold text-brand-muted">Status</th>
                <th className="p-4 text-sm font-semibold text-brand-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {filteredVendors.map(vendor => (
                <tr key={vendor.id} className="hover:bg-brand-dark/50 transition-colors">
                  <td className="p-4">
                    <div className="text-sm font-bold text-brand-light">{vendor.name || 'N/A'}</div>
                    <div className="text-xs text-brand-muted flex items-center mt-1">
                      <Phone className="w-3 h-3 mr-1" /> {vendor.phone}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-medium text-brand-light">{vendor.vendorProfile?.storeName || 'Not Set'}</div>
                    <div className="text-xs text-brand-muted mt-1">{vendor.vendorProfile?.businessType || 'Retail'}</div>
                  </td>
                  <td className="p-4">
                    {getStatusBadge(vendor.vendorProfile?.status)}
                  </td>
                  <td className="p-4 text-right space-x-3">
                    {(vendor.vendorProfile?.status === 'UNDER_VERIFICATION' || vendor.vendorProfile?.status === 'PENDING') && (
                      <button 
                        onClick={() => handleOpenReviewModal(vendor)}
                        className="text-yellow-500 hover:text-yellow-400 text-sm font-bold transition-colors inline-flex items-center"
                      >
                        <FileCheck className="w-4 h-4 mr-1" /> Review KYC
                      </button>
                    )}
                    <button 
                      onClick={() => handleOpenEditModal(vendor)}
                      className="text-brand-primary hover:text-brand-secondary text-sm font-medium transition-colors"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* KYC REVIEW MODAL */}
      {showReviewModal && activeVendor && (
        <Dialog
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
            <div className="space-y-8 flex-1">
              {/* Business Details */}
              <div>
                <h4 className="text-lg font-bold text-brand-primary mb-4 flex items-center border-b border-brand-border pb-2">
                  <Building className="w-5 h-5 mr-2" /> Business Details
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div><p className="text-sm text-brand-muted">Store Name</p><p className="font-medium text-brand-light">{activeVendor.vendorProfile.storeName}</p></div>
                  <div><p className="text-sm text-brand-muted">Owner Name</p><p className="font-medium text-brand-light">{activeVendor.name}</p></div>
                  <div><p className="text-sm text-brand-muted">Business Type</p><p className="font-medium text-brand-light">{activeVendor.vendorProfile.businessType}</p></div>
                  <div><p className="text-sm text-brand-muted">GST Number</p><p className="font-medium text-brand-light">{activeVendor.vendorProfile.gstNumber || 'N/A'}</p></div>
                  <div><p className="text-sm text-brand-muted">PAN Number</p><p className="font-medium text-brand-light">{activeVendor.vendorProfile.panNumber}</p></div>
                  <div><p className="text-sm text-brand-muted">Location</p><p className="font-medium text-brand-light">{activeVendor.city}, {activeVendor.state}</p></div>
                </div>
              </div>

              {/* Bank Details */}
              <div>
                <h4 className="text-lg font-bold text-brand-primary mb-4 flex items-center border-b border-brand-border pb-2">
                  <Landmark className="w-5 h-5 mr-2" /> Bank Details
                </h4>
                {activeVendor.vendorProfile.bankAccounts && activeVendor.vendorProfile.bankAccounts.length > 0 ? (
                  <div className="bg-brand-dark/50 p-4 rounded-xl border border-brand-border grid grid-cols-2 gap-4">
                    <div><p className="text-sm text-brand-muted">Bank Name</p><p className="font-medium text-brand-light">{activeVendor.vendorProfile.bankAccounts[0].bankName}</p></div>
                    <div><p className="text-sm text-brand-muted">Account Holder</p><p className="font-medium text-brand-light">{activeVendor.vendorProfile.bankAccounts[0].accountHolderName}</p></div>
                    <div><p className="text-sm text-brand-muted">Account Number</p><p className="font-medium text-brand-light">{activeVendor.vendorProfile.bankAccounts[0].accountNumber}</p></div>
                    <div><p className="text-sm text-brand-muted">IFSC Code</p><p className="font-medium text-brand-light">{activeVendor.vendorProfile.bankAccounts[0].ifscCode}</p></div>
                  </div>
                ) : (
                  <p className="text-brand-muted text-sm italic">No bank details provided.</p>
                )}
              </div>

              {/* Documents */}
              <div>
                <h4 className="text-lg font-bold text-brand-primary mb-4 flex items-center border-b border-brand-border pb-2">
                  <FileText className="w-5 h-5 mr-2" /> Uploaded Documents
                </h4>
                {activeVendor.vendorProfile.documents && activeVendor.vendorProfile.documents.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {activeVendor.vendorProfile.documents.map((doc: any) => (
                      <a 
                        key={doc.id}
                        href={`${SERVER_ORIGIN}${doc.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center justify-center p-6 bg-brand-dark hover:bg-brand-primary/10 border border-brand-border hover:border-brand-primary rounded-xl transition-all group"
                      >
                        <FileText className="w-10 h-10 text-brand-muted group-hover:text-brand-primary mb-2 transition-colors" />
                        <span className="text-sm font-bold text-brand-light group-hover:text-brand-primary transition-colors">{doc.type}</span>
                        <span className="text-xs text-brand-muted mt-1 flex items-center"><Eye className="w-3 h-3 mr-1"/> View Document</span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-brand-muted text-sm italic">No documents uploaded.</p>
                )}
              </div>
            </div>
        </Dialog>
      )}

      {/* Basic Edit Modal (Kept for backward compatibility) */}
      <Dialog
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Vendor Core Details"
      >
            <form onSubmit={handleSubmitEdit} className="space-y-4">
               <div className="grid grid-cols-2 gap-4">
                  <Input label="Owner Name" type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  <Input label="Store Name" type="text" required value={formData.storeName} onChange={(e) => setFormData({...formData, storeName: e.target.value})} />
                  <div className="col-span-2 flex items-center mt-2">
                    <input type="checkbox" id="isActive" checked={formData.isActive} onChange={(e) => setFormData({...formData, isActive: e.target.checked})} className="mr-2" />
                    <label htmlFor="isActive" className="text-sm font-medium text-brand-muted">Vendor is Active (can sell on platform)</label>
                  </div>
               </div>

               <div className="flex space-x-4 mt-6 pt-4 border-t border-brand-border">
                 <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 bg-brand-dark text-brand-light px-4 py-2 rounded-lg font-bold">Cancel</button>
                 <Button type="submit" className="flex-1">Save Changes</Button>
               </div>
            </form>
      </Dialog>

    </div>
  );
}
