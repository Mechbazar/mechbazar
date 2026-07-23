import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { Users, Plus, Phone, Mail, Building } from 'lucide-react';
import { Button, Badge, Dialog, Input, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../../config/api';

export default function Suppliers() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = {
    name: '',
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    gstNumber: '',
    address: ''
  };
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await axios.get(`${API_URL}/suppliers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuppliers(res.data);
    } catch (error) {
      console.error('Failed to fetch suppliers', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API_URL}/suppliers/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/suppliers`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowModal(false);
      setEditingId(null);
      fetchSuppliers();
      setFormData(emptyForm);
    } catch (error) {
      console.error('Failed to save supplier', error);
      alert(editingId ? 'Failed to update supplier.' : 'Failed to create supplier.');
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const handleOpenEdit = (supplier: any) => {
    setEditingId(supplier.id);
    setFormData({
      name: supplier.name || '',
      companyName: supplier.companyName || '',
      contactPerson: supplier.contactPerson || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      gstNumber: supplier.gstNumber || '',
      address: supplier.address || ''
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-brand-light">Manage Suppliers</h2>
        <Button onClick={handleOpenAdd}>
          <Plus className="w-5 h-5 mr-1" /> Add Supplier
        </Button>
      </div>

      {loading ? (
        <Loader fullScreen />
      ) : suppliers.length === 0 ? (
        <div className="bg-brand-panel border border-brand-border rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-brand-dark rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-brand-muted" />
          </div>
          <h3 className="text-xl font-bold text-brand-light mb-2">No Suppliers Found</h3>
          <p className="text-brand-muted max-w-md mx-auto mb-6">
            You haven't added any suppliers yet. Add suppliers to start generating Purchase Orders and tracking incoming stock.
          </p>
          <Button onClick={() => setShowModal(true)}>
            Add Your First Supplier
          </Button>
        </div>
      ) : (
        <div className="bg-brand-panel border border-brand-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-dark border-b border-brand-border">
                <th className="p-4 text-sm font-semibold text-brand-muted">Supplier / Company</th>
                <th className="p-4 text-sm font-semibold text-brand-muted">Contact Info</th>
                <th className="p-4 text-sm font-semibold text-brand-muted">GST Number</th>
                <th className="p-4 text-sm font-semibold text-brand-muted">Purchase Orders</th>
                <th className="p-4 text-sm font-semibold text-brand-muted">Status</th>
                <th className="p-4 text-sm font-semibold text-brand-muted text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-brand-dark/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                        <Building className="w-5 h-5 text-brand-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-brand-light">{supplier.name}</p>
                        <p className="text-xs text-brand-muted">{supplier.companyName}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs text-brand-light space-y-1">
                      {supplier.phone && <div className="flex items-center"><Phone className="w-3 h-3 mr-1 text-brand-muted" /> {supplier.phone}</div>}
                      {supplier.email && <div className="flex items-center"><Mail className="w-3 h-3 mr-1 text-brand-muted" /> {supplier.email}</div>}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-brand-light">
                    {supplier.gstNumber || 'N/A'}
                  </td>
                  <td className="p-4 text-sm text-brand-light font-medium">
                    {supplier._count?.purchaseOrders || 0} POs
                  </td>
                  <td className="p-4">
                    <Badge variant={supplier.isActive ? 'success' : 'danger'} className="!rounded-full">
                      {supplier.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleOpenEdit(supplier)}
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

      <Dialog isOpen={showModal} onClose={() => { setShowModal(false); setEditingId(null); }} title={editingId ? 'Edit Supplier' : 'Add New Supplier'}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Supplier Name"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
              <Input
                label="Company Name"
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Contact Person"
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                />
                <Input
                  label="GST Number"
                  type="text"
                  value={formData.gstNumber}
                  onChange={(e) => setFormData({...formData, gstNumber: e.target.value})}
                  className="uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Address</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500 resize-none"
                ></textarea>
              </div>

              <div className="flex space-x-4 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingId(null); }}
                  className="flex-1 bg-neutral-950 text-neutral-300 px-4 py-2 rounded-lg font-bold hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <Button type="submit" className="flex-1">
                  {editingId ? 'Save Changes' : 'Save Supplier'}
                </Button>
              </div>
            </form>
      </Dialog>
    </div>
  );
}
