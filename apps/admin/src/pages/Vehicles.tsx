import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Button, Card, DataTable, EmptyState, Modal, Input, Select, Icon3D, Tabs } from '../components/ui';
import type { Column, TabItem } from '../components/ui';
import type { RootState } from '../store';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';
import BrandMaster from '../components/vehicles/BrandMaster';
import { useConfirm } from '../hooks/useConfirm';

const NEW = '__new__';

const VEHICLE_TABS: TabItem[] = [
  { id: 'VEHICLES', label: 'Vehicles' },
  { id: 'BRANDS', label: 'Brand Master' },
];

const emptyForm = {
  type: 'CAR' as 'CAR' | 'BIKE',
  manufacturerId: '',
  newManufacturerName: '',
  modelId: '',
  newModelName: '',
  variantId: '',
  newVariantName: '',
  fuelTypeId: '',
  newFuelTypeName: '',
  year: '',
  engineCc: '',
};

export default function Vehicles() {
  const { token } = useSelector((state: RootState) => state.auth);
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
  const confirm = useConfirm();

  const [section, setSection] = useState<'VEHICLES' | 'BRANDS'>('VEHICLES');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [variants, setVariants] = useState<any[]>([]);
  const [fuelTypes, setFuelTypes] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/vehicles`, authHeaders);
      setVehicles(res.data);
      setLoadError('');
    } catch (error) {
      setLoadError('Failed to load vehicles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchVehicles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchManufacturers = async (type: 'CAR' | 'BIKE') => {
    const res = await axios.get(`${API_URL}/vehicles/manufacturers?type=${type}`, authHeaders);
    setManufacturers(res.data);
  };

  const fetchModels = async (manufacturerId: string) => {
    const res = await axios.get(`${API_URL}/vehicles/models?manufacturerId=${manufacturerId}`, authHeaders);
    setModels(res.data);
  };

  const fetchVariants = async (modelId: string) => {
    const res = await axios.get(`${API_URL}/vehicles/variants?modelId=${modelId}`, authHeaders);
    setVariants(res.data);
  };

  const fetchFuelTypes = async () => {
    const res = await axios.get(`${API_URL}/vehicles/fuels`, authHeaders);
    setFuelTypes(res.data);
  };

  const openAddModal = async () => {
    setEditingId(null);
    setForm(emptyForm);
    setModels([]);
    setVariants([]);
    setFormError('');
    setIsModalOpen(true);
    await Promise.all([fetchManufacturers('CAR'), fetchFuelTypes()]);
  };

  const openEditModal = async (vehicle: any) => {
    setEditingId(vehicle.id);
    setFormError('');
    setForm({
      ...emptyForm,
      type: vehicle.manufacturer.type,
      manufacturerId: vehicle.manufacturerId,
      modelId: vehicle.modelId,
      variantId: vehicle.variantId || '',
      fuelTypeId: vehicle.fuelTypeId,
      year: String(vehicle.year),
      engineCc: vehicle.engineCc != null ? String(vehicle.engineCc) : '',
    });
    setIsModalOpen(true);
    await fetchManufacturers(vehicle.manufacturer.type);
    await fetchModels(vehicle.manufacturerId);
    await fetchVariants(vehicle.modelId);
    await fetchFuelTypes();
  };

  const closeModal = () => setIsModalOpen(false);

  const handleTypeChange = async (type: 'CAR' | 'BIKE') => {
    setForm((f) => ({ ...f, type, manufacturerId: '', newManufacturerName: '', modelId: '', newModelName: '', variantId: '', newVariantName: '' }));
    setModels([]);
    setVariants([]);
    await fetchManufacturers(type);
  };

  const handleManufacturerChange = async (manufacturerId: string) => {
    setForm((f) => ({ ...f, manufacturerId, newManufacturerName: '', modelId: '', newModelName: '', variantId: '', newVariantName: '' }));
    setVariants([]);
    if (manufacturerId && manufacturerId !== NEW) {
      await fetchModels(manufacturerId);
    } else {
      setModels([]);
    }
  };

  const handleModelChange = async (modelId: string) => {
    setForm((f) => ({ ...f, modelId, newModelName: '', variantId: '', newVariantName: '' }));
    if (modelId && modelId !== NEW) {
      await fetchVariants(modelId);
    } else {
      setVariants([]);
    }
  };

  const handleDelete = async (vehicle: any) => {
    const label = `${vehicle.manufacturer.name} ${vehicle.model.name}${vehicle.variant ? ' ' + vehicle.variant.name : ''} (${vehicle.year})`;
    if (!(await confirm({ title: 'Delete vehicle', message: `Delete ${label}? This cannot be undone.` }))) return;
    try {
      await axios.delete(`${API_URL}/vehicles/${vehicle.id}`, authHeaders);
      fetchVehicles();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete vehicle');
    }
  };

  const handleSave = async () => {
    if (
      (!form.manufacturerId || (form.manufacturerId === NEW && !form.newManufacturerName.trim())) ||
      (!form.modelId || (form.modelId === NEW && !form.newModelName.trim())) ||
      (form.variantId === NEW && !form.newVariantName.trim()) ||
      (!form.fuelTypeId || (form.fuelTypeId === NEW && !form.newFuelTypeName.trim())) ||
      !form.year
    ) {
      setFormError('Please fill in all required fields.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      let manufacturerId = form.manufacturerId;
      if (manufacturerId === NEW) {
        const res = await axios.post(`${API_URL}/vehicles/manufacturers`, { name: form.newManufacturerName.trim(), type: form.type }, authHeaders);
        manufacturerId = res.data.id;
      }

      let modelId = form.modelId;
      if (modelId === NEW) {
        const res = await axios.post(`${API_URL}/vehicles/models`, { manufacturerId, name: form.newModelName.trim() }, authHeaders);
        modelId = res.data.id;
      }

      let variantId: string | null = form.variantId;
      if (variantId === NEW) {
        const res = await axios.post(`${API_URL}/vehicles/variants`, { modelId, name: form.newVariantName.trim() }, authHeaders);
        variantId = res.data.id;
      } else if (!variantId) {
        variantId = null;
      }

      let fuelTypeId = form.fuelTypeId;
      if (fuelTypeId === NEW) {
        const res = await axios.post(`${API_URL}/vehicles/fuels`, { name: form.newFuelTypeName.trim() }, authHeaders);
        fuelTypeId = res.data.id;
      }

      const payload = {
        manufacturerId, modelId, variantId, fuelTypeId, year: Number(form.year),
        engineCc: form.engineCc.trim() ? Number(form.engineCc) : null,
      };
      if (editingId) {
        await axios.put(`${API_URL}/vehicles/${editingId}`, payload, authHeaders);
      } else {
        await axios.post(`${API_URL}/vehicles`, payload, authHeaders);
      }
      closeModal();
      fetchVehicles();
    } catch (error: any) {
      setFormError(error.response?.data?.error || 'Failed to save vehicle');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<any>[] = [
    { key: 'make', header: 'Make', render: (v) => <span className="text-content-primary">{v.manufacturer.name}</span> },
    { key: 'model', header: 'Model', render: (v) => <span className="text-content-primary">{v.model.name}</span> },
    { key: 'variant', header: 'Variant', render: (v) => <span className="text-content-secondary">{v.variant?.name || '—'}</span> },
    { key: 'year', header: 'Year', render: (v) => <span className="text-content-primary">{v.year}</span> },
    { key: 'fuel', header: 'Fuel', render: (v) => <span className="text-content-secondary">{v.fuelType.name}</span> },
    { key: 'engine', header: 'Engine', render: (v) => <span className="text-content-secondary">{v.engineCc ? `${v.engineCc} cc` : '—'}</span> },
    {
      key: 'actions',
      header: 'Actions',
      render: (v) => (
        <div className="flex items-center gap-4">
          <button className="text-brand-primary cursor-pointer font-medium hover:underline" onClick={() => openEditModal(v)}>Edit</button>
          <button className="text-danger-500 hover:text-danger-400 transition-colors inline-flex items-center" onClick={() => handleDelete(v)}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-content-primary flex items-center gap-3">
            <Icon3D name="vehicles" size={30} eager /> Vehicle Master Management
          </h2>
          <p className="text-content-secondary mt-1 text-sm">Manage the make/model/variant/fuel taxonomy used across the app's vehicle dropdowns.</p>
        </div>
        {section === 'VEHICLES' && (
          <Button icon={<span className="text-base leading-none">+</span>} onClick={openAddModal}>Add New Vehicle</Button>
        )}
      </div>

      <div className="mb-5">
        <Tabs tabs={VEHICLE_TABS} value={section} onChange={(id) => setSection(id as 'VEHICLES' | 'BRANDS')} layoutId="vehicles-tab" />
      </div>

      {section === 'BRANDS' ? (
        <BrandMaster token={token} />
      ) : (
        <>
          {loadError && (
            <div className="mb-4 rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-600 dark:text-danger-400">
              {loadError}
            </div>
          )}

          <Card padding="none">
            <DataTable
              columns={columns}
              data={vehicles}
              rowKey={(v) => v.id}
              loading={loading}
              pageSize={10}
              emptyState={<EmptyState icon="vehicles" title="No vehicles yet" description={'Click "Add New Vehicle" to add your first make/model/variant combination.'} action={<Button onClick={openAddModal}>Add New Vehicle</Button>} />}
            />
          </Card>
        </>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'Edit Vehicle' : 'Add Vehicle'}>
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-danger-600 dark:text-danger-400 bg-danger-500/10 border border-danger-500/30 rounded-xl px-3 py-2">{formError}</p>
          )}

          <Select label="Type" value={form.type} onChange={(e) => handleTypeChange(e.target.value as 'CAR' | 'BIKE')}>
            <option value="CAR">Car</option>
            <option value="BIKE">Bike</option>
          </Select>

          <div>
            <Select label="Make" value={form.manufacturerId} onChange={(e) => handleManufacturerChange(e.target.value)}>
              <option value="">Select make…</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value={NEW}>+ Add new make…</option>
            </Select>
            {form.manufacturerId === NEW && (
              <Input
                className="mt-2"
                placeholder="New make name (e.g., Honda)"
                value={form.newManufacturerName}
                onChange={(e) => setForm((f) => ({ ...f, newManufacturerName: e.target.value }))}
              />
            )}
          </div>

          <div>
            <Select label="Model" value={form.modelId} onChange={(e) => handleModelChange(e.target.value)} disabled={!form.manufacturerId}>
              <option value="">Select model…</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value={NEW}>+ Add new model…</option>
            </Select>
            {form.modelId === NEW && (
              <Input
                className="mt-2"
                placeholder="New model name (e.g., City)"
                value={form.newModelName}
                onChange={(e) => setForm((f) => ({ ...f, newModelName: e.target.value }))}
              />
            )}
          </div>

          <div>
            <Select
              label="Variant (optional)"
              value={form.variantId}
              onChange={(e) => setForm((f) => ({ ...f, variantId: e.target.value, newVariantName: '' }))}
              disabled={!form.modelId || form.modelId === NEW}
            >
              <option value="">None</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
              <option value={NEW}>+ Add new variant…</option>
            </Select>
            {form.variantId === NEW && (
              <Input
                className="mt-2"
                placeholder="New variant name (e.g., VX)"
                value={form.newVariantName}
                onChange={(e) => setForm((f) => ({ ...f, newVariantName: e.target.value }))}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select label="Fuel" value={form.fuelTypeId} onChange={(e) => setForm((f) => ({ ...f, fuelTypeId: e.target.value, newFuelTypeName: '' }))}>
                <option value="">Select fuel…</option>
                {fuelTypes.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
                <option value={NEW}>+ Add new…</option>
              </Select>
              {form.fuelTypeId === NEW && (
                <Input
                  className="mt-2"
                  placeholder="e.g., Hybrid"
                  value={form.newFuelTypeName}
                  onChange={(e) => setForm((f) => ({ ...f, newFuelTypeName: e.target.value }))}
                />
              )}
            </div>
            <Input
              label="Year"
              type="number"
              placeholder="2024"
              value={form.year}
              onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
            />
          </div>

          <Input
            label="Engine Size (cc, optional)"
            type="number"
            placeholder="e.g., 1197"
            value={form.engineCc}
            onChange={(e) => setForm((f) => ({ ...f, engineCc: e.target.value }))}
          />

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} isLoading={saving}>{editingId ? 'Save Changes' : 'Add Vehicle'}</Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
