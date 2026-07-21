import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { 
  Package, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Search,
  Edit,
  Copy,
  Trash2,
  MoreVertical
} from 'lucide-react';
import { Button, Card, Badge, Dialog, Input } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function Products() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    try {
      // This page has no pagination UI -- search, the stat cards (Total/Pending/Low
      // Stock), and the table all assume `products` holds the entire catalog. The
      // backend's default limit=20 (meant for the customer-facing paginated
      // listing) was silently truncating everything here once the catalog grew
      // past 20 items, e.g. "Total Products" undercounting and newly added
      // products not being reflected in the stat cards even though they showed
      // up in the table itself. Request a high limit to get the full catalog.
      const res = await axios.get(`${API_URL}/products?limit=1000`);
      setProducts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API_URL}/categories`);
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Categories are unique per vehicleType, so the dropdown must only ever
  // offer categories matching the product's currently selected vehicle type
  // (otherwise a Car product could be filed under a Bike-only category name).
  const categoriesForVehicleType = (vehicleType: string) =>
    categories.filter((c) => c.vehicleType === vehicleType);

  const initialFormState = {
    name: '',
    category: 'Engine Oils',
    vehicleType: 'CAR',
    oem: '',
    price: '',
    mrp: '',
    b2bPrice: '',
    stock: '',
    lowStockThreshold: '10',
    status: 'APPROVED'
  };
  const [formData, setFormData] = useState(initialFormState);

  const handleOpenForm = (product: any = null) => {
    if (product) {
      setEditMode(product.id);
      setFormData({
        name: product.name || '',
        category: product.category?.name || 'Engine Oils',
        vehicleType: product.vehicleType || 'CAR',
        oem: product.oemNumber || '',
        price: product.price?.toString() || '',
        mrp: product.mrp?.toString() || '',
        b2bPrice: product.b2bPrice?.toString() || '',
        stock: product.stock?.toString() || '',
        lowStockThreshold: product.lowStockThreshold?.toString() || '10',
        status: product.status || 'APPROVED'
      });
    } else {
      setEditMode(null);
      const defaultCategory = categoriesForVehicleType('CAR')[0]?.name || initialFormState.category;
      setFormData({ ...initialFormState, category: defaultCategory });
    }
    setIsModalOpen(true);
    setActionMenuId(null);
  };

  const handleVehicleTypeChange = (vehicleType: string) => {
    const stillValid = categoriesForVehicleType(vehicleType).some((c) => c.name === formData.category);
    setFormData({
      ...formData,
      vehicleType,
      category: stillValid ? formData.category : (categoriesForVehicleType(vehicleType)[0]?.name || ''),
    });
  };

  const handleSave = async () => {
    if (!formData.name) return;
    
    try {
      if (editMode) {
        await axios.put(`${API_URL}/products/${editMode}`, { ...formData, oemNumber: formData.oem }, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/products`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      fetchProducts();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert('Failed to save product');
    }
  };

  const updateProductStatus = async (productId: string, status: string) => {
    try {
      await axios.patch(`${API_URL}/products/${productId}/status`, { status }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProducts();
      setActionMenuId(null);
    } catch (error) {
      console.error('Failed to update status', error);
      alert('Failed to update status. Check permissions.');
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await axios.delete(`${API_URL}/products/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProducts();
      setActionMenuId(null);
    } catch (error: any) {
      console.error('Failed to delete', error);
      alert(error.response?.data?.error || 'Failed to delete product');
    }
  };

  const handleDuplicate = async (product: any) => {
    try {
      const dupeData = {
        name: `${product.name} (Copy)`,
        category: product.category?.name || 'Engine Oils',
        vehicleType: product.vehicleType || 'CAR',
        oem: product.oemNumber || '',
        price: product.price?.toString() || '0',
        b2bPrice: product.b2bPrice?.toString() || '0',
        stock: product.stock?.toString() || '0'
      };
      await axios.post(`${API_URL}/products`, dupeData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchProducts();
      setActionMenuId(null);
    } catch (error) {
      console.error('Failed to duplicate', error);
      alert('Failed to duplicate product');
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.oemNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.partNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.vendor?.storeName?.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (statusFilter && statusFilter === 'PENDING') return matchesSearch && p.status === 'PENDING';
    if (statusFilter && statusFilter === 'LOW_STOCK') return matchesSearch && p.stock < (p.lowStockThreshold || 10);
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'APPROVED':
        return <Badge variant="success" className="!rounded-full flex items-center w-fit"><CheckCircle className="w-3 h-3 mr-1" /> Live</Badge>;
      case 'PENDING':
        return <Badge variant="warning" className="!rounded-full flex items-center w-fit animate-pulse"><AlertCircle className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'REJECTED':
        return <Badge variant="danger" className="!rounded-full flex items-center w-fit"><X className="w-3 h-3 mr-1" /> Rejected</Badge>;
      case 'INACTIVE':
        return <Badge variant="neutral" className="!rounded-full flex items-center w-fit"><X className="w-3 h-3 mr-1" /> Draft/Inactive</Badge>;
      default:
        return <Badge variant="neutral" className="!rounded-full">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-neutral-100 tracking-tight flex items-center">
            <Package className="w-8 h-8 mr-3 text-primary-500" />
            Product Catalog
          </h2>
          <p className="text-neutral-400 mt-1">Review vendor products, manage inventory, pricing, and B2B discounts</p>
        </div>
        <Button onClick={() => handleOpenForm()}>
          <span>+</span> Add Internal Product
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card
          variant="dark"
          className={`cursor-pointer ${statusFilter === null ? '!border-primary-500' : ''}`}
          onClick={() => setStatusFilter(null)}
        >
          <p className="text-neutral-400 text-sm font-medium">Total Products</p>
          <p className="text-3xl font-bold text-neutral-100 mt-2">{products.length}</p>
        </Card>
        <Card
          variant="dark"
          className={`cursor-pointer ${statusFilter === 'PENDING' ? '!border-warning-500' : ''}`}
          onClick={() => setStatusFilter('PENDING')}
        >
          <p className="text-neutral-400 text-sm font-medium">Pending Review</p>
          <p className="text-3xl font-bold text-warning-500 mt-2">{products.filter(p => p.status === 'PENDING').length}</p>
        </Card>
        <Card
          variant="dark"
          className={`cursor-pointer ${statusFilter === 'LOW_STOCK' ? '!border-danger-500' : ''}`}
          onClick={() => setStatusFilter('LOW_STOCK')}
        >
          <p className="text-neutral-400 text-sm font-medium">Low Stock Alerts</p>
          <p className="text-3xl font-bold text-danger-500 mt-2">{products.filter(p => p.stock < (p.lowStockThreshold || 10)).length}</p>
        </Card>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center mb-6">
        <Search className="w-5 h-5 text-neutral-400 mr-3" />
        <input
          type="text"
          placeholder="Search by product name, OEM, or vendor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none focus:outline-none text-neutral-100 w-full"
        />
      </div>

      {/* Data Table */}
      <div className="bg-neutral-900 shadow-sm rounded-2xl border border-neutral-800 overflow-visible">
        <div className="overflow-visible min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 text-sm uppercase tracking-wider">
                <th className="p-5 font-semibold">Product Name</th>
                <th className="p-5 font-semibold">Vendor / Source</th>
                <th className="p-5 font-semibold">Prices (Retail/B2B)</th>
                <th className="p-5 font-semibold">Stock</th>
                <th className="p-5 font-semibold">Status</th>
                <th className="p-5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-950/70 transition-colors">
                  <td className="p-5">
                    <p className="text-neutral-100 font-bold">{p.name}</p>
                    <p className="text-neutral-400 text-xs mt-1">
                      {p.oemNumber && <span>OEM: {p.oemNumber}</span>}
                    </p>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="bg-neutral-950 px-3 py-1 rounded-full text-xs text-neutral-100 border border-neutral-800 block w-fit">
                        {p.category?.name || 'Uncategorized'}
                      </span>
                      <Badge variant={p.vehicleType === 'BIKE' ? 'warning' : 'neutral'} className="!rounded-full !text-[10px]">
                        {p.vehicleType === 'BIKE' ? '🏍️ Bike' : '🚗 Car'}
                      </Badge>
                    </div>
                    <span className="text-xs font-bold text-primary-500">
                      {p.vendor?.storeName || 'Internal Warehouse'}
                    </span>
                  </td>
                  <td className="p-5">
                    <div className="text-neutral-100 font-bold">₹{p.price}</div>
                    <div className="text-neutral-400 text-xs line-through">₹{p.mrp}</div>
                    {p.b2bPrice != null && (
                      <div className="text-primary-500 text-xs font-semibold mt-0.5">B2B: ₹{p.b2bPrice}</div>
                    )}
                  </td>
                  <td className="p-5">
                    <Badge variant={p.stock > (p.lowStockThreshold || 10) ? 'success' : 'danger'} className="!rounded-full">
                      {p.stock} in stock
                    </Badge>
                  </td>
                  <td className="p-5">
                    {getStatusBadge(p.status || 'APPROVED')}
                  </td>
                  <td className="p-5 text-right">
                    <div className="relative inline-block text-left">
                      <button 
                        onClick={() => setActionMenuId(actionMenuId === p.id ? null : p.id)}
                        className="text-neutral-400 hover:text-primary-500 p-2 transition-colors"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {actionMenuId === p.id && (
                        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-neutral-950 border border-neutral-800 ring-1 ring-black ring-opacity-5 z-20">
                          <div className="py-1" role="menu" aria-orientation="vertical">
                            <button
                              onClick={() => handleOpenForm(p)}
                              className="w-full text-left px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-900 flex items-center gap-2"
                            >
                              <Edit className="w-4 h-4" /> Edit
                            </button>
                            <button
                              onClick={() => handleDuplicate(p)}
                              className="w-full text-left px-4 py-2 text-sm text-neutral-100 hover:bg-neutral-900 flex items-center gap-2"
                            >
                              <Copy className="w-4 h-4" /> Duplicate
                            </button>
                            {p.status !== 'INACTIVE' ? (
                              <button
                                onClick={() => updateProductStatus(p.id, 'INACTIVE')}
                                className="w-full text-left px-4 py-2 text-sm text-yellow-500 hover:bg-neutral-900 flex items-center gap-2"
                              >
                                <AlertCircle className="w-4 h-4" /> Mark Draft
                              </button>
                            ) : (
                              <button
                                onClick={() => updateProductStatus(p.id, 'APPROVED')}
                                className="w-full text-left px-4 py-2 text-sm text-green-500 hover:bg-neutral-900 flex items-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4" /> Set Live
                              </button>
                            )}
                            {p.status === 'PENDING' && (
                              <button
                                onClick={() => updateProductStatus(p.id, 'APPROVED')}
                                className="w-full text-left px-4 py-2 text-sm text-green-500 hover:bg-neutral-900 flex items-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4" /> Approve
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-neutral-900 flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" /> Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Product Modal */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editMode ? 'Edit Product' : 'Add Internal Product'}
        size="xl"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-neutral-400 hover:text-neutral-100">Cancel</button>
            <Button onClick={handleSave}>{editMode ? 'Save Changes' : 'Create Product'}</Button>
          </>
        }
      >
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <Input
                    label="Product Name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g. Castrol MAGNATEC 5W-30"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-400 mb-2">Vehicle Type</label>
                  <select
                    value={formData.vehicleType}
                    onChange={(e) => handleVehicleTypeChange(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 outline-none focus:border-primary-500"
                  >
                    <option value="CAR">Car</option>
                    <option value="BIKE">Bike</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-400 mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 outline-none focus:border-primary-500"
                  >
                    {categoriesForVehicleType(formData.vehicleType).map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <Input
                  label="OEM Part Number"
                  type="text"
                  value={formData.oem}
                  onChange={(e) => setFormData({...formData, oem: e.target.value})}
                />

                <Input
                  label="Retail Price (₹)"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: e.target.value})}
                />

                <Input
                  label="MRP (₹)"
                  type="number"
                  value={formData.mrp}
                  onChange={(e) => setFormData({...formData, mrp: e.target.value})}
                />

                <div>
                  <label className="block text-sm font-semibold text-primary-500 mb-2">B2B Wholesale Price (₹)</label>
                  <input
                    type="number"
                    value={formData.b2bPrice}
                    onChange={(e) => setFormData({...formData, b2bPrice: e.target.value})}
                    className="w-full bg-primary-500/10 border border-primary-500/20 rounded-xl px-4 py-3 text-primary-500 outline-none focus:border-primary-500"
                  />
                </div>

                <Input
                  label="Initial Stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({...formData, stock: e.target.value})}
                />

                <Input
                  label="Low Stock Threshold"
                  type="number"
                  value={formData.lowStockThreshold}
                  onChange={(e) => setFormData({...formData, lowStockThreshold: e.target.value})}
                />

                <div>
                  <label className="block text-sm font-semibold text-neutral-400 mb-2">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-neutral-100 outline-none focus:border-primary-500"
                  >
                    <option value="APPROVED">Live (Approved)</option>
                    <option value="INACTIVE">Draft (Inactive)</option>
                    <option value="PENDING">Pending Review</option>
                  </select>
                </div>
              </div>
      </Dialog>
    </div>
  );
}
