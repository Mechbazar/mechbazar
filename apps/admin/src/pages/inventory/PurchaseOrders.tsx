import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { FileText, Plus, Calendar, DollarSign, ArrowRight } from 'lucide-react';
import { Button, Card, Badge, Dialog, Input, Loader } from '@mechbazar/shared/web';
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
      alert('Failed to create Purchase Order.');
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

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-brand-light">Manage Purchase Orders</h2>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-5 h-5 mr-1" /> Create PO
        </Button>
      </div>

      {loading ? (
        <Loader fullScreen />
      ) : pos.length === 0 ? (
        <div className="bg-brand-panel border border-brand-border rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-brand-dark rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-brand-muted" />
          </div>
          <h3 className="text-xl font-bold text-brand-light mb-2">No Purchase Orders</h3>
          <p className="text-brand-muted max-w-md mx-auto mb-6">
            You haven't created any purchase orders yet. Create a PO to order stock from your suppliers.
          </p>
          <Button onClick={() => setShowModal(true)}>
            Create First PO
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {pos.map((po) => (
            <Card key={po.id} variant="dark" className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="w-12 h-12 bg-neutral-950 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-primary-500" />
                </div>

                <div>
                  <div className="flex items-center space-x-3 mb-1">
                    <span className="text-white font-bold">PO-{po.id.substring(0, 8).toUpperCase()}</span>
                    <Badge variant={getStatusVariant(po.status)} className="!rounded-md !text-[10px] uppercase tracking-wider">
                      {po.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-neutral-400 flex items-center">
                    <span className="text-white mr-1">{po.supplier?.name}</span>
                    • {po._count?.items || 0} Items
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-8">
                <div className="text-right">
                  <div className="text-xs text-neutral-400 mb-1 flex items-center justify-end">
                    <Calendar className="w-3 h-3 mr-1" /> Expected Date
                  </div>
                  <div className="text-sm font-medium text-white">
                    {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : 'TBD'}
                  </div>
                </div>

                <div className="text-right w-32">
                  <div className="text-xs text-neutral-400 mb-1 flex items-center justify-end">
                    <DollarSign className="w-3 h-3 mr-1" /> Total Value
                  </div>
                  <div className="text-lg font-bold text-primary-500">
                    ₹{po.totalCost.toLocaleString()}
                  </div>
                </div>

                {/* No GET /purchase-orders/:id or status-update endpoint exists yet on
                    the backend, so there's nowhere for this to navigate to -- shown
                    disabled rather than a click that silently does nothing. */}
                <button
                  disabled
                  title="Purchase order detail view isn't available yet"
                  className="w-10 h-10 rounded-full bg-neutral-950 flex items-center justify-center opacity-40 cursor-not-allowed"
                >
                  <ArrowRight className="w-5 h-5 text-neutral-400" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog isOpen={showModal} onClose={() => setShowModal(false)} title="Create Purchase Order">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-400 mb-1">Select Supplier</label>
                <select
                  required
                  value={formData.supplierId}
                  onChange={(e) => setFormData({...formData, supplierId: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(sup => (
                    <option key={sup.id} value={sup.id}>{sup.name} ({sup.companyName})</option>
                  ))}
                </select>
                {suppliers.length === 0 && (
                  <p className="text-xs text-primary-500 mt-1">You must add a supplier first.</p>
                )}
              </div>

              <Input
                label="Estimated Total Cost (₹)"
                type="number"
                required
                value={formData.totalCost}
                onChange={(e) => setFormData({...formData, totalCost: e.target.value})}
              />

              <Input
                label="Expected Delivery Date"
                type="date"
                required
                value={formData.expectedDate}
                onChange={(e) => setFormData({...formData, expectedDate: e.target.value})}
              />

              <div className="flex space-x-4 mt-6 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-neutral-950 text-neutral-300 px-4 py-2 rounded-lg font-bold hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <Button type="submit" disabled={!formData.supplierId} className="flex-1">
                  Create Draft PO
                </Button>
              </div>
            </form>
      </Dialog>
    </div>
  );
}
