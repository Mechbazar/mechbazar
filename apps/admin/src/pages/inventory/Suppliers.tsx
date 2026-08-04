import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import type { RootState } from '../../store';
import { Plus, Phone, Mail, Building, MapPin } from 'lucide-react';
import { Button, Badge, Modal, Input, DataTable, EmptyState, Icon3D } from '../../components/ui';
import type { Column } from '../../components/ui';
import { API_URL } from '../../config/api';
import AddressMapPicker from '../../components/maps/AddressMapPicker';
import PlaceAutocompleteField from '../../components/maps/PlaceAutocompleteField';
import type { GeocodeSuccess } from '../../services/geocode.service';
import { fadeInUp } from '../../utils/motion';

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
    address: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: '',
    lat: null as number | null,
    lng: null as number | null,
    placeId: '',
    formattedAddress: '',
  };
  const [formData, setFormData] = useState(emptyForm);

  // Unconditional overwrite from an autocomplete selection -- also
  // re-synthesizes the legacy free-text `address` field so it never goes
  // stale relative to the structured fields (matches the backend's own
  // create-time synthesizeAddress fallback in supplier.controller.ts).
  const applyGeocodeResult = (result: GeocodeSuccess) => {
    setFormData((prev) => {
      const addressLine1 = result.components.line1 || prev.addressLine1;
      const city = result.components.city || prev.city;
      const state = result.components.state || prev.state;
      const pincode = result.components.pincode || prev.pincode;
      const country = result.components.country || prev.country;
      return {
        ...prev,
        addressLine1,
        city,
        state,
        pincode,
        country,
        lat: result.lat,
        lng: result.lng,
        placeId: result.placeId,
        formattedAddress: result.formattedAddress,
        address: result.formattedAddress || [addressLine1, prev.addressLine2, city, state, pincode].filter(Boolean).join(', '),
      };
    });
  };

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
      toast.error(editingId ? 'Failed to update supplier.' : 'Failed to create supplier.');
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
      address: supplier.address || '',
      addressLine1: supplier.addressLine1 || '',
      addressLine2: supplier.addressLine2 || '',
      city: supplier.city || '',
      state: supplier.state || '',
      pincode: supplier.pincode || '',
      country: supplier.country || '',
      lat: supplier.lat ?? null,
      lng: supplier.lng ?? null,
      placeId: supplier.placeId || '',
      formattedAddress: supplier.formattedAddress || '',
    });
    setShowModal(true);
  };

  const columns: Column<any>[] = [
    {
      key: 'supplier',
      header: 'Supplier / Company',
      render: (supplier) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <Building className="w-5 h-5 text-brand-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-content-primary truncate">{supplier.name}</p>
            <p className="text-xs text-content-muted truncate">{supplier.companyName}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Info',
      render: (supplier) => (
        <div className="text-xs text-content-secondary space-y-1">
          {supplier.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3 text-content-muted" /> {supplier.phone}</div>}
          {supplier.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3 text-content-muted" /> {supplier.email}</div>}
        </div>
      ),
    },
    { key: 'gst', header: 'GST Number', render: (supplier) => <span className="text-content-secondary">{supplier.gstNumber || 'N/A'}</span> },
    {
      key: 'location',
      header: 'Location',
      className: 'max-w-[200px]',
      render: (supplier) => (supplier.formattedAddress || supplier.address) ? (
        <div className="flex items-start gap-1 text-xs text-content-muted">
          <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="truncate">{supplier.formattedAddress || supplier.address}</span>
        </div>
      ) : <span className="text-xs text-content-muted">N/A</span>,
    },
    {
      key: 'pos',
      header: 'Purchase Orders',
      render: (supplier) => <span className="text-sm font-medium text-content-secondary">{supplier._count?.purchaseOrders || 0} POs</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (supplier) => <Badge variant={supplier.isActive ? 'success' : 'danger'} className="w-fit">{supplier.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (supplier) => (
        <button
          onClick={() => handleOpenEdit(supplier)}
          className="text-brand-primary hover:text-brand-accent text-sm font-semibold transition-colors"
        >
          Edit
        </button>
      ),
    },
  ];

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-content-primary tracking-tight flex items-center gap-2">
          <Icon3D name="suppliers" size={26} eager /> Manage Suppliers
        </h2>
        <Button icon={<Plus size={16} />} onClick={handleOpenAdd}>Add Supplier</Button>
      </div>

      <DataTable
        columns={columns}
        data={suppliers}
        rowKey={(s) => s.id}
        loading={loading}
        pageSize={10}
        emptyState={
          <EmptyState
            icon="suppliers"
            title="No Suppliers Found"
            description="You haven't added any suppliers yet. Add suppliers to start generating Purchase Orders and tracking incoming stock."
            action={<Button onClick={handleOpenAdd}>Add Your First Supplier</Button>}
          />
        }
      />

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingId(null); }} title={editingId ? 'Edit Supplier' : 'Add New Supplier'} size="lg">
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
            <label className="block text-sm font-medium text-content-secondary mb-1.5">Address</label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full bg-surface-card border border-border-default rounded-xl px-3.5 py-2.5 text-sm text-content-primary transition-colors duration-150 focus:outline-none focus:ring-4 focus:ring-brand-primary/30 focus:border-brand-primary resize-none"
            ></textarea>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-bold text-content-primary flex items-center gap-2"><MapPin className="w-4 h-4" /> Precise Location (optional)</p>
            <PlaceAutocompleteField onSelect={applyGeocodeResult} placeholder="Search for supplier address" />
            <AddressMapPicker
              latitude={formData.lat}
              longitude={formData.lng}
              onChange={({ latitude, longitude }) => setFormData({ ...formData, lat: latitude, lng: longitude })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Address Line 1" type="text" value={formData.addressLine1} onChange={(e) => setFormData({...formData, addressLine1: e.target.value})} />
              <Input label="Address Line 2" type="text" value={formData.addressLine2} onChange={(e) => setFormData({...formData, addressLine2: e.target.value})} />
              <Input label="City" type="text" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />
              <Input label="State" type="text" value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})} />
              <Input label="Pincode" type="text" value={formData.pincode} onChange={(e) => setFormData({...formData, pincode: e.target.value})} />
              <Input label="Country" type="text" value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})} />
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => { setShowModal(false); setEditingId(null); }}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {editingId ? 'Save Changes' : 'Save Supplier'}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
