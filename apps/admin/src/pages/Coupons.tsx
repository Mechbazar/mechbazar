import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Tag, Plus, Edit, Trash2 } from 'lucide-react';
import { Button, Badge, Dialog, Input, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function Coupons() {
  const { token } = useSelector((state: RootState) => state.auth);
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
      alert(error.response?.data?.error || 'Failed to save coupon.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
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

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-neutral-100 flex items-center">
          <Tag className="w-8 h-8 mr-3 text-primary-500" />
          Discount Coupons
        </h1>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-5 h-5 mr-1" /> Create Coupon
        </Button>
      </div>

      {loading ? (
        <Loader fullScreen />
      ) : coupons.length === 0 ? (
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-12 text-center">
          <Tag className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-neutral-100 mb-2">No Coupons Found</h3>
          <p className="text-neutral-400 mb-6">Create discount codes to boost your sales.</p>
          <Button onClick={() => handleOpenModal()}>
            Create First Coupon
          </Button>
        </div>
      ) : (
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900 text-neutral-400 text-sm uppercase">
                  <th className="px-6 py-4 font-bold">Coupon Code</th>
                  <th className="px-6 py-4 font-bold">Discount</th>
                  <th className="px-6 py-4 font-bold">Min. Order Value</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {coupons.map((coupon) => (
                  <tr key={coupon.id} className="hover:bg-neutral-900/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="bg-primary-500/10 text-primary-500 border border-primary-500/20 px-3 py-1 rounded font-mono font-bold text-lg">
                          {coupon.code}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-neutral-100">
                        {coupon.discountType === 'PERCENTAGE' 
                          ? `${coupon.discountValue}% OFF` 
                          : `₹${coupon.discountValue} OFF`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-neutral-400 font-medium">
                      ₹{coupon.minOrderValue}
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleToggleStatus(coupon)}>
                        {coupon.isActive ? (
                          <Badge variant="success" className="!rounded-full flex items-center">
                            <span className="w-2 h-2 rounded-full bg-success-500 mr-2"></span> Active
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="!rounded-full flex items-center">
                            <span className="w-2 h-2 rounded-full bg-neutral-400 mr-2"></span> Inactive
                          </Badge>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-3">
                        <button 
                          onClick={() => handleOpenModal(coupon)}
                          className="text-primary-500 hover:text-primary-400 transition-colors"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(coupon.id)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog
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
                <div>
                  <label className="block text-sm font-medium text-brand-muted mb-1">Discount Type</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({...formData, discountType: e.target.value})}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2 text-neutral-100 focus:outline-none focus:border-primary-500"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Amount (₹)</option>
                  </select>
                </div>
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

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="w-4 h-4 text-primary-500 bg-neutral-900 border border-neutral-800 rounded focus:ring-primary-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-neutral-100">
                  Coupon is Active
                </label>
              </div>

              <div className="flex space-x-4 mt-6 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-neutral-900 text-neutral-100 px-4 py-2 rounded-lg font-bold hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <Button type="submit" className="flex-1">
                  {isEditing ? 'Save Changes' : 'Create Coupon'}
                </Button>
              </div>
            </form>
      </Dialog>
    </div>
  );
}
