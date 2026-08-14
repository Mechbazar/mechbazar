import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { Button, Card, Badge, Modal, Input, Select, Checkbox, DataTable, EmptyState, Icon3D } from '../components/ui';
import type { Column } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';
import { useConfirm } from '../hooks/useConfirm';

export default function Coupons() {
  const { token } = useSelector((state: RootState) => state.auth);
  const confirm = useConfirm();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: 0,
    minOrderValue: 0,
    isActive: true
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const res = await axios.get(`${API_URL}/coupons`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCoupons(res.data);
    } catch (error) {
      console.error('Failed to fetch coupons', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (coupon?: any) => {
    if (coupon) {
      setIsEditing(true);
      setFormData({
        id: coupon.id,
        code: coupon.code || '',
        discountType: coupon.discountType || 'PERCENTAGE',
        discountValue: coupon.discountValue || 0,
        minOrderValue: coupon.minOrderValue || 0,
        isActive: coupon.isActive ?? true
      });
    } else {
      setIsEditing(false);
      setFormData({
        id: '', code: '', discountType: 'PERCENTAGE', discountValue: 0, minOrderValue: 0, isActive: true
      });
    }
    setShowModal(true);
  };

  // Lets the Dashboard's "Create Coupon" quick action (?action=create) jump
  // straight into this page's existing create flow instead of duplicating
  // the coupon-creation form there.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('action') === 'create') handleOpenModal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        code: formData.code.toUpperCase(),
        discountValue: Number(formData.discountValue),
        minOrderValue: Number(formData.minOrderValue)
      };

      if (isEditing) {
        await axios.put(`${API_URL}/coupons/${formData.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/coupons`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowModal(false);
      fetchCoupons();
    } catch (error: any) {
      console.error('Failed to save coupon', error);
      toast.error(error.response?.data?.error || 'Failed to save coupon.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirm({ title: 'Delete coupon', message: 'Are you sure you want to delete this coupon? This cannot be undone.' }))) return;
    try {
      await axios.delete(`${API_URL}/coupons/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCoupons();
    } catch (error) {
      console.error('Failed to delete coupon', error);
    }
  };

  const handleToggleStatus = async (coupon: any) => {
    try {
      await axios.put(`${API_URL}/coupons/${coupon.id}`, {
        ...coupon,
        isActive: !coupon.isActive
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchCoupons();
    } catch (error) {
      console.error('Failed to toggle coupon status', error);
    }
  };

  const columns: Column<any>[] = [
    {
      key: 'code',
      header: 'Coupon Code',
      render: (coupon) => (
        <div className="bg-brand-primary/10 text-brand-primary border border-brand-primary/20 px-3 py-1 rounded-lg font-mono font-bold text-base w-fit">
          {coupon.code}
        </div>
      ),
    },
    {
      key: 'discount',
      header: 'Discount',
      render: (coupon) => (
        <span className="font-bold text-content-primary">
          {coupon.discountType === 'PERCENTAGE'
            ? `${coupon.discountValue}% OFF`
            : `₹${coupon.discountValue} OFF`}
        </span>
      ),
    },
    {
      key: 'minOrderValue',
      header: 'Min. Order Value',
      render: (coupon) => <span className="text-content-secondary font-medium">₹{coupon.minOrderValue}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (coupon) => (
        <button onClick={() => handleToggleStatus(coupon)}>
          {coupon.isActive ? (
            <Badge variant="success" className="flex items-center gap-1.5 w-fit">
              <span className="w-2 h-2 rounded-full bg-success-500"></span> Active
            </Badge>
          ) : (
            <Badge variant="neutral" className="flex items-center gap-1.5 w-fit">
              <span className="w-2 h-2 rounded-full bg-content-muted"></span> Inactive
            </Badge>
          )}
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (coupon) => (
        <div className="flex justify-end gap-3">
          <button
            onClick={() => handleOpenModal(coupon)}
            className="text-content-muted hover:text-brand-primary transition-colors"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleDelete(coupon.id)}
            className="text-content-muted hover:text-danger-500 transition-colors"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
          <Icon3D name="coupons" size={30} eager /> Discount Coupons
        </h1>
        <Button icon={<Plus size={16} />} onClick={() => handleOpenModal()}>Create Coupon</Button>
      </div>

      <Card padding="none" className="overflow-visible">
        <DataTable
          columns={columns}
          data={coupons}
          rowKey={(c) => c.id}
          loading={loading}
          pageSize={10}
          emptyState={
            <EmptyState
              icon="coupons"
              title="No Coupons Found"
              description="Create discount codes to boost your sales."
              action={<Button onClick={() => handleOpenModal()}>Create First Coupon</Button>}
            />
          }
          className="rounded-none border-none shadow-none"
        />
      </Card>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={isEditing ? 'Edit Coupon' : 'Create New Coupon'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Coupon Code"
            type="text"
            required
            value={formData.code}
            onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
            className="font-mono uppercase"
            placeholder="e.g. SUMMER50"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Discount Type"
              value={formData.discountType}
              onChange={(e) => setFormData({...formData, discountType: e.target.value})}
            >
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FLAT">Flat Amount (₹)</option>
            </Select>
            <Input
              label="Discount Value"
              type="number"
              min="0"
              required
              value={formData.discountValue}
              onChange={(e) => setFormData({...formData, discountValue: Number(e.target.value)})}
            />
          </div>

          <Input
            label="Minimum Order Value (₹)"
            type="number"
            min="0"
            required
            value={formData.minOrderValue}
            onChange={(e) => setFormData({...formData, minOrderValue: Number(e.target.value)})}
          />

          <Checkbox
            label="Coupon is Active"
            checked={formData.isActive}
            onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
          />

          <div className="flex gap-4 mt-6 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {isEditing ? 'Save Changes' : 'Create Coupon'}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
