import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import type { RootState } from '../../store';
import { Calendar, DollarSign, ArrowRight } from 'lucide-react';
import { Button, Card, Badge, Modal, Input, DataTable, EmptyState, Icon3D } from '../../components/ui';
import type { Column } from '../../components/ui';
import { API_URL } from '../../config/api';

export default function PurchaseOrders() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [pos, setPos] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    supplierId: '',
    totalCost: '',
    expectedDate: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [poRes, supRes] = await Promise.all([
        axios.get(`${API_URL}/purchase-orders`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/suppliers`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setPos(poRes.data);
      setSuppliers(supRes.data);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/purchase-orders`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowModal(false);
      fetchData();
      setFormData({ supplierId: '', totalCost: '', expectedDate: '' });
    } catch (error) {
      console.error('Failed to create PO', error);
      toast.error('Failed to create Purchase Order.');
    }
  };

  const getStatusVariant = (status: string): 'neutral' | 'secondary' | 'info' | 'success' => {
    switch (status) {
      case 'DRAFT': return 'neutral';
      case 'APPROVED': return 'secondary';
      case 'ORDERED': return 'info';
      case 'RECEIVED': return 'success';
      default: return 'neutral';
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'po',
      header: 'Purchase Order',
      render: (po) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <Icon3D name="purchase_orders" size={22} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-content-primary">PO-{po.id.substring(0, 8).toUpperCase()}</p>
              <Badge variant={getStatusVariant(po.status)} size="sm">{po.status}</Badge>
            </div>
            <p className="text-xs text-content-muted truncate">{po.supplier?.name} · {po._count?.items || 0} Items</p>
          </div>
        </div>
      ),
    },
    {
      key: 'expected',
      header: 'Expected Date',
      render: (po) => (
        <span className="text-sm text-content-secondary flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-content-muted" />
          {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'TBD'}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total Value',
      render: (po) => (
        <span className="text-sm font-bold text-content-primary flex items-center gap-1">
          <DollarSign className="w-3.5 h-3.5 text-content-muted" />
          ₹{po.totalCost.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: () => (
        <button
          disabled
          title="Purchase order detail view isn't available yet"
          className="w-9 h-9 rounded-full bg-surface-sunken flex items-center justify-center opacity-40 cursor-not-allowed ml-auto"
        >
          <ArrowRight className="w-4 h-4 text-content-muted" />
        </button>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
            <Icon3D name="purchase_orders" size={30} eager /> Purchase Orders
          </h2>
          <p className="text-content-secondary mt-1 text-sm">Order stock from your suppliers and track incoming inventory.</p>
        </div>
        <Button onClick={() => setShowModal(true)}>Create PO</Button>
      </div>

      <Card padding="none">
        <DataTable
          columns={columns}
          data={pos}
          rowKey={(po) => po.id}
          loading={loading}
          pageSize={10}
          emptyState={
            <EmptyState
              icon="purchase_orders"
              title="No Purchase Orders"
              description="You haven't created any purchase orders yet. Create a PO to order stock from your suppliers."
              action={<Button onClick={() => setShowModal(true)}>Create First PO</Button>}
            />
          }
        />
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Purchase Order">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1.5">Select Supplier</label>
            <select
              required
              value={formData.supplierId}
              onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
              className="w-full bg-surface-sunken border border-border-default rounded-xl px-3.5 py-2.5 text-sm text-content-primary outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/20"
            >
              <option value="">-- Choose Supplier --</option>
              {suppliers.map(sup => (
                <option key={sup.id} value={sup.id}>{sup.name} ({sup.companyName})</option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <p className="text-xs text-danger-500 mt-1">You must add a supplier first.</p>
            )}
          </div>

          <Input
            label="Estimated Total Cost (₹)"
            type="number"
            required
            value={formData.totalCost}
            onChange={(e) => setFormData({ ...formData, totalCost: e.target.value })}
          />

          <Input
            label="Expected Delivery Date"
            type="date"
            required
            value={formData.expectedDate}
            onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
          />

          <div className="flex gap-3 mt-6 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.supplierId} className="flex-1">
              Create Draft PO
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
