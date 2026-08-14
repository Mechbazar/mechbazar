import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, DataTable, EmptyState, Input, Modal, Select, Tabs } from '../ui';
import type { Column, TabItem } from '../ui';
import { API_URL } from '../../config/api';
import { useConfirm } from '../../hooks/useConfirm';

const BRAND_TABS: TabItem[] = [
  { id: 'ALL', label: 'All' },
  { id: 'CAR', label: 'Car' },
  { id: 'BIKE', label: 'Bike' },
];

type Brand = {
  id: string;
  name: string;
  type: 'CAR' | 'BIKE';
  _count: { models: number; vehicles: number };
};

// The "Vehicle Brand Master" the client asked for -- manufacturers previously
// could only be created inline (as a "+ Add new make" escape hatch) from
// within the Add Vehicle form, with no way to see, rename, or remove one once
// created. This gives brands their own list with real CRUD, alongside the
// existing make/model/variant/fuel/year combination table.
export default function BrandMaster({ token }: { token: string | null }) {
  const headers = { Authorization: `Bearer ${token}` };
  const confirm = useConfirm();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'CAR' | 'BIKE'>('ALL');

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'CAR' | 'BIKE'>('CAR');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  const [renaming, setRenaming] = useState<Brand | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState('');

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/vehicles/manufacturers/admin`, { headers });
      setBrands(res.data);
    } catch (error) {
      console.error('Failed to fetch brands', error);
      toast.error('Failed to load brands.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = brands.filter((b) => filter === 'ALL' || b.type === filter);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      await axios.post(`${API_URL}/vehicles/manufacturers`, { name: newName.trim(), type: newType }, { headers });
      toast.success('Brand added.');
      setShowAdd(false);
      setNewName('');
      fetchBrands();
    } catch (error: any) {
      setAddError(error.response?.data?.error || 'Failed to add brand.');
    } finally {
      setAdding(false);
    }
  };

  const openRename = (brand: Brand) => {
    setRenaming(brand);
    setRenameValue(brand.name);
    setRenameError('');
  };

  const handleRename = async (e: FormEvent) => {
    e.preventDefault();
    if (!renaming || !renameValue.trim()) return;
    setRenameSaving(true);
    setRenameError('');
    try {
      await axios.put(`${API_URL}/vehicles/manufacturers/${renaming.id}`, { name: renameValue.trim() }, { headers });
      toast.success('Brand renamed.');
      setRenaming(null);
      fetchBrands();
    } catch (error: any) {
      setRenameError(error.response?.data?.error || 'Failed to rename brand.');
    } finally {
      setRenameSaving(false);
    }
  };

  const handleDelete = async (brand: Brand) => {
    if (!(await confirm({ title: 'Delete brand', message: `Delete brand "${brand.name}"? This cannot be undone.` }))) return;
    try {
      await axios.delete(`${API_URL}/vehicles/manufacturers/${brand.id}`, { headers });
      toast.success('Brand deleted.');
      fetchBrands();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete brand.');
    }
  };

  const columns: Column<Brand>[] = [
    { key: 'name', header: 'Brand', render: (b) => <span className="font-semibold text-content-primary">{b.name}</span> },
    { key: 'type', header: 'Type', render: (b) => <Badge variant={b.type === 'CAR' ? 'primary' : 'secondary'} size="sm">{b.type}</Badge> },
    { key: 'models', header: 'Models', render: (b) => <span className="text-content-secondary">{b._count.models}</span> },
    { key: 'vehicles', header: 'Vehicle Combos', render: (b) => <span className="text-content-secondary">{b._count.vehicles}</span> },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (b) => (
        <div className="flex items-center justify-end gap-4">
          <button className="text-brand-primary cursor-pointer font-medium hover:underline" onClick={() => openRename(b)}>Rename</button>
          <button className="text-danger-500 hover:text-danger-400 transition-colors inline-flex items-center" onClick={() => handleDelete(b)} title="Delete">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <Tabs tabs={BRAND_TABS} value={filter} onChange={(id) => setFilter(id as 'ALL' | 'CAR' | 'BIKE')} layoutId="brand-master-tab" />
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setShowAdd(true); setAddError(''); setNewName(''); }}>Add Brand</Button>
      </div>

      <Card padding="none">
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(b) => b.id}
          loading={loading}
          pageSize={10}
          emptyState={<EmptyState icon="vehicles" title="No brands yet" description='Click "Add Brand" to create your first make.' action={<Button onClick={() => setShowAdd(true)}>Add Brand</Button>} />}
        />
      </Card>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Brand">
        <form onSubmit={handleAdd} className="space-y-4">
          {addError && (
            <p className="text-sm text-danger-600 dark:text-danger-400 bg-danger-500/10 border border-danger-500/30 rounded-xl px-3 py-2">{addError}</p>
          )}
          <Input label="Brand Name" placeholder="e.g., Honda" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <Select label="Type" value={newType} onChange={(e) => setNewType(e.target.value as 'CAR' | 'BIKE')}>
            <option value="CAR">Car</option>
            <option value="BIKE">Bike</option>
          </Select>
          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" isLoading={adding}>Add Brand</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!renaming} onClose={() => setRenaming(null)} title={`Rename "${renaming?.name || ''}"`}>
        <form onSubmit={handleRename} className="space-y-4">
          {renameError && (
            <p className="text-sm text-danger-600 dark:text-danger-400 bg-danger-500/10 border border-danger-500/30 rounded-xl px-3 py-2">{renameError}</p>
          )}
          <Input label="Brand Name" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} required />
          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" isLoading={renameSaving}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
