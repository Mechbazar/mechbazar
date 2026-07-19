import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { Warehouse as WarehouseIcon, MapPin, Plus } from 'lucide-react';
import { Button, Card, Badge, Dialog, Input, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../../config/api';

export default function Warehouses() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    managerName: '',
    phone: '',
    capacity: 0
  });

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
      await axios.post(`${API_URL}/warehouses`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowModal(false);
      fetchWarehouses();
      setFormData({ name: '', code: '', address: '', managerName: '', phone: '', capacity: 0 });
    } catch (error) {
      console.error('Failed to create warehouse', error);
      alert('Failed to create warehouse. Please check the code is unique.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-brand-light">Manage Warehouses</h2>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-5 h-5 mr-1" /> Add Warehouse
        </Button>
      </div>

      {loading ? (
        <Loader fullScreen />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {warehouses.map((wh) => (
            <Card key={wh.id} variant="dark">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-500/10 rounded-lg flex items-center justify-center mr-3">
                    <WarehouseIcon className="w-5 h-5 text-primary-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{wh.name}</h3>
                    <p className="text-xs text-neutral-400 font-mono">{wh.code}</p>
                  </div>
                </div>
                <Badge variant={wh.isActive ? 'success' : 'danger'} className="!rounded-full">
                  {wh.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex items-start text-sm text-neutral-400">
                  <MapPin className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                  <span>{wh.address}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Capacity:</span>
                  <span className="text-white font-medium">{wh.capacity.toLocaleString()} units</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Unique SKUs:</span>
                  <span className="text-white font-medium">{wh._count?.inventory || 0}</span>
                </div>
              </div>

              <div className="flex space-x-2">
                <button className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-300 py-2 rounded-lg hover:text-primary-500 transition-colors text-sm font-medium">
                  Edit
                </button>
                <button className="flex-1 bg-neutral-950 border border-neutral-800 text-neutral-300 py-2 rounded-lg hover:text-primary-500 transition-colors text-sm font-medium">
                  View Stock
                </button>
              </div>
            </Card>
          ))}
          {warehouses.length === 0 && (
             <div className="col-span-full text-neutral-400 text-center py-8">No warehouses found. Please create one.</div>
          )}
        </div>
      )}

      <Dialog isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Warehouse">
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

              <div className="flex space-x-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-neutral-950 text-neutral-300 px-4 py-2 rounded-lg font-bold hover:bg-neutral-800 transition-colors"
                >
                  Cancel
                </button>
                <Button type="submit" className="flex-1">
                  Save Warehouse
                </Button>
              </div>
            </form>
      </Dialog>
    </div>
  );
}
