import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import type { RootState } from '../../store';
import { Warehouse as WarehouseIcon, MapPin, Plus } from 'lucide-react';
import { Button, Card, Badge, Modal, Input, Loader, EmptyState, Icon3D } from '../../components/ui';
import { API_URL } from '../../config/api';
import AddressMapPicker from '../../components/maps/AddressMapPicker';
import PlaceAutocompleteField from '../../components/maps/PlaceAutocompleteField';
import LocationMapView from '../../components/maps/LocationMapView';
import type { GeocodeSuccess } from '../../services/geocode.service';
import { fadeInUp } from '../../utils/motion';

interface WarehousesProps {
  // Warehouses and the stock ledger are separate tabs under the same parent
  // (see ../inventory/index.tsx) with no shared routing, so "View Stock" can't
  // be a real Link -- this callback lets the parent switch tabs for us.
  onViewStock?: () => void;
}

export default function Warehouses({ onViewStock }: WarehousesProps) {
  const { token } = useSelector((state: RootState) => state.auth);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = {
    name: '',
    code: '',
    address: '',
    managerName: '',
    phone: '',
    capacity: 0,
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
  // create-time synthesizeAddress fallback in warehouse.controller.ts).
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
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async () => {
    try {
      const res = await axios.get(`${API_URL}/warehouses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarehouses(res.data);
    } catch (error) {
      console.error('Failed to fetch warehouses', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API_URL}/warehouses/${editingId}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/warehouses`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowModal(false);
      setEditingId(null);
      fetchWarehouses();
      setFormData(emptyForm);
    } catch (error) {
      console.error('Failed to save warehouse', error);
      toast.error(editingId ? 'Failed to update warehouse.' : 'Failed to create warehouse. Please check the code is unique.');
    }
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const handleOpenEdit = (wh: any) => {
    setEditingId(wh.id);
    setFormData({
      name: wh.name || '',
      code: wh.code || '',
      address: wh.address || '',
      managerName: wh.managerName || '',
      phone: wh.phone || '',
      capacity: wh.capacity || 0,
      addressLine1: wh.addressLine1 || '',
      addressLine2: wh.addressLine2 || '',
      city: wh.city || '',
      state: wh.state || '',
      pincode: wh.pincode || '',
      country: wh.country || '',
      lat: wh.lat ?? null,
      lng: wh.lng ?? null,
      placeId: wh.placeId || '',
      formattedAddress: wh.formattedAddress || '',
    });
    setShowModal(true);
  };

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-content-primary tracking-tight flex items-center gap-2">
          <Icon3D name="warehouses" size={26} eager /> Manage Warehouses
        </h2>
        <Button icon={<Plus size={16} />} onClick={handleOpenAdd}>Add Warehouse</Button>
      </div>

      {loading ? (
        <Loader fullScreen />
      ) : warehouses.length === 0 ? (
        <EmptyState
          icon="warehouses"
          title="No Warehouses Found"
          description="You haven't added any warehouses yet. Add a warehouse to start tracking stock."
          action={<Button onClick={handleOpenAdd}>Add Your First Warehouse</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((wh) => (
            <Card key={wh.id}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center shrink-0">
                    <WarehouseIcon className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-content-primary">{wh.name}</h3>
                    <p className="text-xs text-content-muted font-mono">{wh.code}</p>
                  </div>
                </div>
                <Badge variant={wh.isActive ? 'success' : 'danger'} className="w-fit">
                  {wh.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-start gap-2 text-sm text-content-secondary">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-content-muted" />
                  <span>{wh.formattedAddress || wh.address}</span>
                </div>
                {wh.lat != null && wh.lng != null && (
                  <LocationMapView markers={[{ id: wh.id, lat: wh.lat, lng: wh.lng, label: wh.name }]} height={120} />
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-content-muted">Capacity:</span>
                  <span className="text-content-primary font-medium">{wh.capacity.toLocaleString()} units</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-content-muted">Unique SKUs:</span>
                  <span className="text-content-primary font-medium">{wh._count?.inventory || 0}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleOpenEdit(wh)}>
                  Edit
                </Button>
                {onViewStock && (
                  <Button variant="secondary" size="sm" className="flex-1" onClick={onViewStock}>
                    View Stock
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingId(null); }} title={editingId ? 'Edit Warehouse' : 'Add New Warehouse'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Name"
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
          <Input
            label="Code (Unique)"
            type="text"
            required
            value={formData.code}
            onChange={(e) => setFormData({...formData, code: e.target.value})}
            className="uppercase"
          />
          <Input
            label="Address"
            type="text"
            required
            value={formData.address}
            onChange={(e) => setFormData({...formData, address: e.target.value})}
          />

          <div className="space-y-3">
            <p className="text-sm font-bold text-content-primary flex items-center gap-2"><MapPin className="w-4 h-4" /> Precise Location (optional)</p>
            <PlaceAutocompleteField onSelect={applyGeocodeResult} placeholder="Search for warehouse address" />
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

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Manager"
              type="text"
              value={formData.managerName}
              onChange={(e) => setFormData({...formData, managerName: e.target.value})}
            />
            <Input
              label="Capacity"
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({...formData, capacity: Number(e.target.value)})}
            />
          </div>

          <div className="flex gap-3 mt-6">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => { setShowModal(false); setEditingId(null); }}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {editingId ? 'Save Changes' : 'Save Warehouse'}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
