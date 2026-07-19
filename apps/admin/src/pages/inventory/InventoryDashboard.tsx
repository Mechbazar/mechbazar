import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { AlertCircle, ArrowDownCircle, CheckCircle, Package, Search } from 'lucide-react';
import { Button, Card, Badge, Dialog, Input } from '@mechbazar/shared/web';
import { API_URL } from '../../config/api';

export default function InventoryDashboard() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Adjust Stock Form State
  const [adjustData, setAdjustData] = useState({
    inventoryId: '',
    newQuantity: 0,
    reason: '',
    actionType: 'ADJUSTMENT'
  });

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const res = await axios.get(`${API_URL}/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInventory(res.data);
    } catch (error) {
      console.error('Failed to fetch inventory', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInventory = inventory.filter((inv) => {
    const matchesSearch = (inv.product?.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                          (inv.product?.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'IN_STOCK') matchesStatus = inv.availableStock > inv.reorderLevel;
    if (statusFilter === 'LOW_STOCK') matchesStatus = inv.availableStock > 0 && inv.availableStock <= inv.reorderLevel;
    if (statusFilter === 'OUT_OF_STOCK') matchesStatus = inv.availableStock === 0;

    return matchesSearch && matchesStatus;
  });

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/inventory/adjust`, adjustData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowAdjustModal(false);
      fetchInventory(); // Refresh data
    } catch (error) {
      console.error('Failed to adjust stock', error);
      alert('Failed to adjust stock');
    }
  };

  // KPIs
  const totalProducts = inventory.length;
  const totalStock = inventory.reduce((acc, curr) => acc + curr.availableStock, 0);
  const lowStockCount = inventory.filter(inv => inv.availableStock > 0 && inv.availableStock <= inv.reorderLevel).length;
  const outOfStockCount = inventory.filter(inv => inv.availableStock === 0).length;

  return (
    <div className="space-y-6 pb-12">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card variant="dark" className="flex items-center justify-between">
          <div>
            <p className="text-neutral-400 text-sm font-medium">Total Products</p>
            <h3 className="text-3xl font-bold text-white mt-1">{totalProducts}</h3>
          </div>
          <div className="w-12 h-12 bg-navy-500/10 rounded-full flex items-center justify-center text-navy-400">
            <Package className="w-6 h-6" />
          </div>
        </Card>

        <Card variant="dark" className="flex items-center justify-between">
          <div>
            <p className="text-neutral-400 text-sm font-medium">Available Stock</p>
            <h3 className="text-3xl font-bold text-white mt-1">{totalStock}</h3>
          </div>
          <div className="w-12 h-12 bg-success-500/10 rounded-full flex items-center justify-center text-success-400">
            <CheckCircle className="w-6 h-6" />
          </div>
        </Card>

        <Card variant="dark" className="flex items-center justify-between">
          <div>
            <p className="text-neutral-400 text-sm font-medium">Low Stock</p>
            <h3 className="text-3xl font-bold text-warning-500 mt-1">{lowStockCount}</h3>
          </div>
          <div className="w-12 h-12 bg-warning-500/10 rounded-full flex items-center justify-center text-warning-400">
            <ArrowDownCircle className="w-6 h-6" />
          </div>
        </Card>

        <Card variant="dark" className="flex items-center justify-between">
          <div>
            <p className="text-neutral-400 text-sm font-medium">Out of Stock</p>
            <h3 className="text-3xl font-bold text-danger-500 mt-1">{outOfStockCount}</h3>
          </div>
          <div className="w-12 h-12 bg-danger-500/10 rounded-full flex items-center justify-center text-danger-400">
            <AlertCircle className="w-6 h-6" />
          </div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center bg-brand-panel p-4 rounded-xl border border-brand-border">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-brand-muted w-5 h-5" />
          <input
            type="text"
            placeholder="Search by SKU or Product Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-brand-dark border border-brand-border rounded-lg pl-10 pr-4 py-2 text-brand-light focus:outline-none focus:border-brand-primary"
          />
        </div>
        <div className="flex space-x-3 relative">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="bg-brand-dark border border-brand-border text-brand-text px-4 py-2 rounded-lg hover:text-brand-primary transition-colors"
          >
            Filters
          </button>
          
          {showFilters && (
            <div className="absolute right-36 top-12 w-48 bg-brand-panel border border-brand-border rounded-lg shadow-xl z-20 overflow-hidden">
              <div className="p-3">
                <label className="block text-xs font-semibold text-brand-muted mb-2">Stock Status</label>
                <select 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full bg-brand-dark border border-brand-border rounded-md px-2 py-1 text-sm text-brand-light focus:outline-none focus:border-brand-primary"
                >
                  <option value="ALL">All Status</option>
                  <option value="IN_STOCK">In Stock</option>
                  <option value="LOW_STOCK">Low Stock</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </select>
              </div>
            </div>
          )}

          <Button
            onClick={() => {
              if (inventory.length > 0) {
                setAdjustData({ ...adjustData, inventoryId: inventory[0].id, newQuantity: inventory[0].availableStock });
              }
              setShowAdjustModal(true);
            }}
          >
            + Adjust Stock
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-brand-panel rounded-xl border border-brand-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-dark/50 border-b border-brand-border text-brand-muted text-sm">
                <th className="p-4 font-medium">Product / SKU</th>
                <th className="p-4 font-medium">Warehouse</th>
                <th className="p-4 font-medium">Available</th>
                <th className="p-4 font-medium">Reserved</th>
                <th className="p-4 font-medium">Damaged</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-brand-muted">
                    Loading stock ledger...
                  </td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-brand-muted">
                    No inventory records found.
                  </td>
                </tr>
              ) : (
                filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-brand-dark/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center">
                        {item.product?.images?.[0] ? (
                          <img src={item.product.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover mr-3 bg-brand-dark" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-brand-dark flex items-center justify-center mr-3">
                            <Package className="w-5 h-5 text-brand-muted" />
                          </div>
                        )}
                        <div>
                          <p className="text-brand-light font-medium">{item.product?.name || 'Unknown Product'}</p>
                          <p className="text-xs text-brand-muted mt-0.5">SKU: {item.product?.sku || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-brand-text">{item.warehouse?.name}</td>
                    <td className="p-4 text-brand-light font-bold">{item.availableStock}</td>
                    <td className="p-4 text-brand-muted">{item.reservedStock}</td>
                    <td className="p-4 text-red-400">{item.damagedStock}</td>
                    <td className="p-4">
                      {item.availableStock === 0 ? (
                        <Badge variant="danger" className="!rounded-full">Out of Stock</Badge>
                      ) : item.availableStock <= item.reorderLevel ? (
                        <Badge variant="warning" className="!rounded-full">Low Stock</Badge>
                      ) : (
                        <Badge variant="success" className="!rounded-full">In Stock</Badge>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => {
                          setAdjustData({
                            ...adjustData,
                            inventoryId: item.id,
                            newQuantity: item.availableStock
                          });
                          setShowAdjustModal(true);
                        }}
                        className="text-brand-primary hover:text-brand-secondary text-sm font-medium transition-colors"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Adjust Stock Modal */}
      <Dialog isOpen={showAdjustModal} onClose={() => setShowAdjustModal(false)} title="Adjust Stock">
            <form onSubmit={handleAdjustStock} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-neutral-400 mb-2">Product & Warehouse</label>
                <select
                  required
                  value={adjustData.inventoryId}
                  onChange={(e) => {
                    const inv = inventory.find(i => i.id === e.target.value);
                    setAdjustData({
                      ...adjustData,
                      inventoryId: e.target.value,
                      newQuantity: inv ? inv.availableStock : 0
                    });
                  }}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                >
                  <option value="" disabled>Select product to adjust...</option>
                  {inventory.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.product?.name} ({inv.warehouse?.name}) - Current: {inv.availableStock}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="New Quantity"
                  type="number"
                  required
                  min="0"
                  value={adjustData.newQuantity}
                  onChange={(e) => setAdjustData({...adjustData, newQuantity: parseInt(e.target.value) || 0})}
                />
                <div>
                  <label className="block text-sm font-semibold text-neutral-400 mb-2">Action Type</label>
                  <select
                    value={adjustData.actionType}
                    onChange={(e) => setAdjustData({...adjustData, actionType: e.target.value})}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                  >
                    <option value="ADJUSTMENT">Manual Adjustment</option>
                    <option value="DAMAGE">Damaged/Lost</option>
                    <option value="RETURN">Customer Return</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-400 mb-2">Reason / Note</label>
                <textarea
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({...adjustData, reason: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary-500"
                  placeholder="Why is this stock being adjusted?"
                  rows={3}
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAdjustModal(false)} className="px-5 py-2.5 rounded-lg font-semibold text-neutral-300 hover:bg-neutral-800 border border-neutral-800">Cancel</button>
                <Button type="submit">Update Stock</Button>
              </div>
            </form>
      </Dialog>
    </div>
  );
}
