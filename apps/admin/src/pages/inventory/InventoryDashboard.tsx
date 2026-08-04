import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import type { RootState } from '../../store';
import { Package, Search, Filter } from 'lucide-react';
import { Button, Badge, Modal, Input, Select, DataTable, EmptyState, StatCard, Icon3D } from '../../components/ui';
import type { Column } from '../../components/ui';
import { API_URL, resolveUploadUrl } from '../../config/api';
import { fadeInUp } from '../../utils/motion';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      toast.error('Failed to adjust stock');
    }
  };

  // KPIs
  const totalProducts = inventory.length;
  const totalStock = inventory.reduce((acc, curr) => acc + curr.availableStock, 0);
  const lowStockCount = inventory.filter(inv => inv.availableStock > 0 && inv.availableStock <= inv.reorderLevel).length;
  const outOfStockCount = inventory.filter(inv => inv.availableStock === 0).length;

  const openAdjustModal = (item?: any) => {
    if (item) {
      setAdjustData({ ...adjustData, inventoryId: item.id, newQuantity: item.availableStock });
    } else if (inventory.length > 0) {
      setAdjustData({ ...adjustData, inventoryId: inventory[0].id, newQuantity: inventory[0].availableStock });
    }
    setShowAdjustModal(true);
  };

  const columns: Column<any>[] = [
    {
      key: 'product',
      header: 'Product / SKU',
      render: (item) => (
        <div className="flex items-center gap-3">
          {item.product?.images?.[0] ? (
            <img src={resolveUploadUrl(item.product.images[0])} alt="" className="w-10 h-10 rounded-lg object-cover bg-surface-sunken shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-surface-sunken flex items-center justify-center shrink-0">
              <Package className="w-5 h-5 text-content-muted" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-content-primary truncate">{item.product?.name || 'Unknown Product'}</p>
            <p className="text-xs text-content-muted mt-0.5">SKU: {item.product?.sku || 'N/A'}</p>
          </div>
        </div>
      ),
    },
    { key: 'warehouse', header: 'Warehouse', render: (item) => <span className="text-content-secondary">{item.warehouse?.name}</span> },
    { key: 'available', header: 'Available', render: (item) => <span className="font-bold text-content-primary">{item.availableStock}</span> },
    { key: 'reserved', header: 'Reserved', render: (item) => <span className="text-content-muted">{item.reservedStock}</span> },
    { key: 'damaged', header: 'Damaged', render: (item) => <span className="text-danger-500">{item.damagedStock}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (item) =>
        item.availableStock === 0 ? (
          <Badge variant="danger" className="w-fit">Out of Stock</Badge>
        ) : item.availableStock <= item.reorderLevel ? (
          <Badge variant="warning" className="w-fit">Low Stock</Badge>
        ) : (
          <Badge variant="success" className="w-fit">In Stock</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (item) => (
        <button
          onClick={() => openAdjustModal(item)}
          className="text-brand-primary hover:text-brand-accent text-sm font-semibold transition-colors"
        >
          Manage
        </button>
      ),
    },
  ];

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6 pb-12">
      <h2 className="text-xl font-bold text-content-primary tracking-tight flex items-center gap-2">
        <Icon3D name="warehouses" size={26} eager /> Stock Ledger
      </h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard loading={loading} title="Total Products" value={totalProducts} icon="categories" gradient="indigo" />
        <StatCard loading={loading} title="Available Stock" value={totalStock} icon="check" gradient="green" />
        <StatCard loading={loading} title="Low Stock" value={lowStockCount} icon="bell" gradient="amber" />
        <StatCard loading={loading} title="Out of Stock" value={outOfStockCount} icon="audit" gradient="red" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap justify-between items-center gap-3 bg-surface-card border border-border-default p-4 rounded-2xl shadow-card">
        <div className="w-full sm:w-96">
          <Input
            type="text"
            placeholder="Search by SKU or Product Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            icon={<Search size={16} />}
          />
        </div>
        <div className="flex gap-3 relative">
          <Button variant="outline" icon={<Filter size={15} />} onClick={() => setShowFilters(!showFilters)}>
            Filters
          </Button>

          {showFilters && (
            <div className="absolute right-36 top-12 w-52 bg-surface-overlay border border-border-default rounded-xl shadow-popover z-20 overflow-hidden">
              <div className="p-3">
                <Select
                  label="Stock Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  size="sm"
                >
                  <option value="ALL">All Status</option>
                  <option value="IN_STOCK">In Stock</option>
                  <option value="LOW_STOCK">Low Stock</option>
                  <option value="OUT_OF_STOCK">Out of Stock</option>
                </Select>
              </div>
            </div>
          )}

          <Button onClick={() => openAdjustModal()}>+ Adjust Stock</Button>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={filteredInventory}
        rowKey={(item) => item.id}
        loading={loading}
        pageSize={10}
        emptyState={<EmptyState icon="warehouses" title="No inventory records found" description="Stock records will appear here once products are added to a warehouse." />}
      />

      {/* Adjust Stock Modal */}
      <Modal isOpen={showAdjustModal} onClose={() => setShowAdjustModal(false)} title="Adjust Stock">
        <form onSubmit={handleAdjustStock} className="space-y-4">
          <Select
            label="Product & Warehouse"
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
          >
            <option value="" disabled>Select product to adjust...</option>
            {inventory.map(inv => (
              <option key={inv.id} value={inv.id}>
                {inv.product?.name} ({inv.warehouse?.name}) - Current: {inv.availableStock}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="New Quantity"
              type="number"
              required
              min="0"
              value={adjustData.newQuantity}
              onChange={(e) => setAdjustData({...adjustData, newQuantity: parseInt(e.target.value) || 0})}
            />
            <Select
              label="Action Type"
              value={adjustData.actionType}
              onChange={(e) => setAdjustData({...adjustData, actionType: e.target.value})}
            >
              <option value="ADJUSTMENT">Manual Adjustment</option>
              <option value="DAMAGE">Damaged/Lost</option>
              <option value="RETURN">Customer Return</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-content-secondary mb-1.5">Reason / Note</label>
            <textarea
              value={adjustData.reason}
              onChange={(e) => setAdjustData({...adjustData, reason: e.target.value})}
              className="w-full bg-surface-card border border-border-default rounded-xl px-3.5 py-2.5 text-sm text-content-primary transition-colors duration-150 focus:outline-none focus:ring-4 focus:ring-brand-primary/30 focus:border-brand-primary resize-none"
              placeholder="Why is this stock being adjusted?"
              rows={3}
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowAdjustModal(false)}>Cancel</Button>
            <Button type="submit">Update Stock</Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
