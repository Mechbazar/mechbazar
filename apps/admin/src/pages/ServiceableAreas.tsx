import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Info, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, DataTable, EmptyState, Icon3D, Input, Modal } from '../components/ui';
import type { Column } from '../components/ui';
import type { RootState } from '../store';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';
import { useConfirm } from '../hooks/useConfirm';

type ServiceablePincode = {
  id: string;
  pincode: string;
  city: string | null;
  state: string | null;
  isActive: boolean;
  createdAt: string;
};

export default function ServiceableAreas() {
  const { token } = useSelector((state: RootState) => state.auth);
  const headers = { Authorization: `Bearer ${token}` };
  const confirm = useConfirm();

  const [rows, setRows] = useState<ServiceablePincode[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [bulkPincodes, setBulkPincodes] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState('');

  const fetchRows = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/serviceability/pincodes`, { headers });
      setRows(res.data);
    } catch (error) {
      console.error('Failed to fetch serviceable pincodes', error);
      toast.error('Failed to load serviceable areas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = rows.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return r.pincode.includes(q) || (r.city || '').toLowerCase().includes(q) || (r.state || '').toLowerCase().includes(q);
  });

  const handleToggleActive = async (row: ServiceablePincode) => {
    try {
      const res = await axios.patch(`${API_URL}/serviceability/pincodes/${row.id}`, { isActive: !row.isActive }, { headers });
      setRows((prev) => prev.map((r) => (r.id === row.id ? res.data : r)));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update pincode.');
    }
  };

  const handleDelete = async (row: ServiceablePincode) => {
    if (!(await confirm({ title: 'Remove pincode', message: `Remove pincode ${row.pincode} from the serviceable list?` }))) return;
    try {
      await axios.delete(`${API_URL}/serviceability/pincodes/${row.id}`, { headers });
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success('Pincode removed.');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to remove pincode.');
    }
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    setAddError('');
    const pincodes = bulkPincodes.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean);
    if (pincodes.length === 0) {
      setAddError('Enter at least one 6-digit pincode.');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API_URL}/serviceability/pincodes`,
        { pincodes, city: city.trim() || undefined, state: state.trim() || undefined },
        { headers }
      );
      toast.success(`${pincodes.length} pincode${pincodes.length === 1 ? '' : 's'} added.`);
      setShowAdd(false);
      setBulkPincodes('');
      setCity('');
      setState('');
      fetchRows();
    } catch (error: any) {
      setAddError(error.response?.data?.error || 'Failed to add pincodes.');
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<ServiceablePincode>[] = [
    { key: 'pincode', header: 'Pincode', render: (r) => <span className="font-semibold text-content-primary">{r.pincode}</span> },
    { key: 'city', header: 'City', render: (r) => <span className="text-content-secondary">{r.city || '—'}</span> },
    { key: 'state', header: 'State', render: (r) => <span className="text-content-secondary">{r.state || '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <button onClick={() => handleToggleActive(r)}>
          <Badge variant={r.isActive ? 'success' : 'neutral'} size="sm">{r.isActive ? 'Serviceable' : 'Disabled'}</Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (r) => (
        <button className="text-danger-500 hover:text-danger-400 transition-colors inline-flex items-center" onClick={() => handleDelete(r)} title="Remove">
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="max-w-6xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
            <Icon3D name="warehouses" size={30} eager /> Serviceable Areas
          </h1>
          <p className="text-content-secondary mt-1 text-sm">Pincodes where product delivery and mechanic booking are allowed.</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => { setShowAdd(true); setAddError(''); }}>Add Pincodes</Button>
      </div>

      {!loading && rows.length === 0 && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-info-500/30 bg-info-500/10 px-4 py-3 text-sm text-info-600 dark:text-info-400">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          <span>No pincodes added yet -- every pincode is currently serviceable (unrestricted). Add pincodes below to start restricting checkout and booking to specific delivery areas.</span>
        </div>
      )}

      <Card padding="sm" className="flex items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by pincode, city, or state..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none focus:outline-none text-content-primary w-full text-sm"
        />
      </Card>

      <Card padding="none">
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          loading={loading}
          pageSize={15}
          emptyState={<EmptyState icon="warehouses" title="No serviceable areas configured" description="Every pincode is currently serviceable. Add pincodes to start restricting coverage." action={<Button onClick={() => setShowAdd(true)}>Add Pincodes</Button>} />}
        />
      </Card>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Serviceable Pincodes">
        <form onSubmit={handleAdd} className="space-y-4">
          {addError && (
            <p className="text-sm text-danger-600 dark:text-danger-400 bg-danger-500/10 border border-danger-500/30 rounded-xl px-3 py-2">{addError}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1.5">Pincodes</label>
            <textarea
              value={bulkPincodes}
              onChange={(e) => setBulkPincodes(e.target.value)}
              placeholder="e.g. 400001, 400002, 400099&#10;Paste multiple, separated by commas, spaces, or new lines."
              rows={4}
              className="w-full bg-surface-card border border-border-default rounded-xl px-3.5 py-2.5 text-sm text-content-primary outline-none focus:ring-4 focus:ring-brand-primary/30 focus:border-brand-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="City (optional)" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Mumbai" />
            <Input label="State (optional)" value={state} onChange={(e) => setState(e.target.value)} placeholder="e.g. Maharashtra" />
          </div>
          <p className="text-content-muted text-xs">Applied to every pincode in this batch. Leave blank if adding a mixed set.</p>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowAdd(false)} disabled={saving} className="flex-1">Cancel</Button>
            <Button type="submit" isLoading={saving} disabled={saving} className="flex-1">Add</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
