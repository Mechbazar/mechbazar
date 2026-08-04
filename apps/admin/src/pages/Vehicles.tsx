import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { Trash2 } from 'lucide-react';
import { Button, Card, Dialog, Input, Loader } from '@mechbazar/shared/web';
import type { RootState } from '../store';
import { API_URL } from '../config/api';

const NEW = '__new__';

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
};

export default function Vehicles() {
  const { token } = useSelector((state: RootState) => state.auth);
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

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
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/vehicles/${vehicle.id}`, authHeaders);
      fetchVehicles();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete vehicle');
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

      const payload = { manufacturerId, modelId, variantId, fuelTypeId, year: Number(form.year) };
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

  const selectClass = 'w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-primary';

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-white">Vehicle Master Management</h2>
        <Button onClick={openAddModal}>+ Add New Vehicle</Button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-danger-700/50 bg-danger-950/30 px-4 py-3 text-sm text-danger-300">
          {loadError}
        </div>
      )}

      {loading ? (
        <Loader fullScreen />
      ) : vehicles.length === 0 ? (
        <Card variant="dark" className="p-12 text-center text-neutral-400">
          No vehicles yet. Click "Add New Vehicle" to add your first make/model/variant combination.
        </Card>
      ) : (
        <Card variant="dark" className="!p-0 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950 border-b border-neutral-800 text-neutral-400">
                <th className="p-4 font-semibold">Make</th>
                <th className="p-4 font-semibold">Model</th>
                <th className="p-4 font-semibold">Variant</th>
                <th className="p-4 font-semibold">Year</th>
                <th className="p-4 font-semibold">Fuel</th>
                <th className="p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-neutral-950/70">
                  <td className="p-4 text-neutral-100">{v.manufacturer.name}</td>
                  <td className="p-4 text-neutral-100">{v.model.name}</td>
                  <td className="p-4 text-neutral-100">{v.variant?.name || '—'}</td>
                  <td className="p-4 text-neutral-100">{v.year}</td>
                  <td className="p-4 text-neutral-100">{v.fuelType.name}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-4">
                      <button
                        className="text-primary-500 cursor-pointer font-medium hover:underline"
                        onClick={() => openEditModal(v)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-danger-500 hover:text-danger-400 transition-colors inline-flex items-center"
                        onClick={() => handleDelete(v)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Dialog isOpen={isModalOpen} onClose={closeModal} title={editingId ? 'Edit Vehicle' : 'Add Vehicle'}>
        <div className="space-y-4">
          {formError && (
            <p className="text-sm text-danger-400 bg-danger-950/30 border border-danger-700/50 rounded-lg px-3 py-2">{formError}</p>
          )}

          <div>
            <label className="block text-sm font-semibold text-neutral-400 mb-2">Type</label>
            <select className={selectClass} value={form.type} onChange={(e) => handleTypeChange(e.target.value as 'CAR' | 'BIKE')}>
              <option value="CAR">Car</option>
              <option value="BIKE">Bike</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-400 mb-2">Make</label>
            <select className={selectClass} value={form.manufacturerId} onChange={(e) => handleManufacturerChange(e.target.value)}>
              <option value="">Select make…</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value={NEW}>+ Add new make…</option>
            </select>
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
            <label className="block text-sm font-semibold text-neutral-400 mb-2">Model</label>
            <select
              className={selectClass}
              value={form.modelId}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={!form.manufacturerId}
            >
              <option value="">Select model…</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value={NEW}>+ Add new model…</option>
            </select>
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
            <label className="block text-sm font-semibold text-neutral-400 mb-2">Variant (optional)</label>
            <select
              className={selectClass}
              value={form.variantId}
              onChange={(e) => setForm((f) => ({ ...f, variantId: e.target.value, newVariantName: '' }))}
              disabled={!form.modelId || form.modelId === NEW}
            >
              <option value="">None</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
              <option value={NEW}>+ Add new variant…</option>
            </select>
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
              <label className="block text-sm font-semibold text-neutral-400 mb-2">Fuel</label>
              <select
                className={selectClass}
                value={form.fuelTypeId}
                onChange={(e) => setForm((f) => ({ ...f, fuelTypeId: e.target.value, newFuelTypeName: '' }))}
              >
                <option value="">Select fuel…</option>
                {fuelTypes.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
                <option value={NEW}>+ Add new…</option>
              </select>
              {form.fuelTypeId === NEW && (
                <Input
                  className="mt-2"
                  placeholder="e.g., Hybrid"
                  value={form.newFuelTypeName}
                  onChange={(e) => setForm((f) => ({ ...f, newFuelTypeName: e.target.value }))}
                />
              )}
            </div>
            <div>
              <Input
                label="Year"
                type="number"
                placeholder="2024"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-4">
            <button className="px-4 py-2 text-neutral-400 hover:text-white" onClick={closeModal}>Cancel</button>
            <Button onClick={handleSave} isLoading={saving}>{editingId ? 'Save Changes' : 'Add Vehicle'}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
