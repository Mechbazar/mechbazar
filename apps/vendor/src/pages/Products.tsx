import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import {
  Package, Search, Plus, Edit, Trash2, CheckCircle,
  AlertCircle, Upload, Save
} from 'lucide-react';
import { Button, Badge, Dialog, Input, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

const emptyForm = { name: '', description: '', mrp: '', price: '', stock: '', categoryId: '', brandId: '', oemNumber: '', partNumber: '' };

export default function Products() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [csvProducts, setCsvProducts] = useState<any[]>([]);
  const [uploadingBulk, setUploadingBulk] = useState(false);

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API_URL}/vendors/products`, { headers: { Authorization: `Bearer ${token}` } });
      setProducts(res.data);
    } catch (err) { console.error('Failed to fetch products', err); }
    finally { setLoading(false); }
  };

  const fetchMeta = async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        axios.get(`${API_URL}/categories`),
        axios.get(`${API_URL}/products/brands`).catch(() => ({ data: [] }))
      ]);
      setCategories(catRes.data || []);
      setBrands(brandRes.data || []);
    } catch (e) { console.error('Failed to fetch categories/brands', e); }
  };

  useEffect(() => { fetchProducts(); fetchMeta(); }, [token]);

  const selectedCategory = categories.find((c: any) => c.id === formData.categoryId);

  const openAdd = () => { setEditingProduct(null); setFormData({ ...emptyForm }); setShowAddModal(true); };
  const openEdit = (p: any) => {
    setEditingProduct(p);
    setFormData({ name: p.name, description: p.description || '', mrp: p.mrp, price: p.price, stock: p.stock, categoryId: p.categoryId || '', brandId: p.brandId || '', oemNumber: p.oemNumber || '', partNumber: p.partNumber || '' });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingProduct) {
        await axios.put(`${API_URL}/vendors/products/${editingProduct.id}`, formData, { headers: { Authorization: `Bearer ${token}` } });
      } else {
        await axios.post(`${API_URL}/vendors/products`, formData, { headers: { Authorization: `Bearer ${token}` } });
      }
      setShowAddModal(false);
      setFormData({ ...emptyForm });
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save product');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/vendors/products/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete product');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const csvText = evt.target?.result as string;
      const lines = csvText.split('\n');
      if (lines.length < 2) return;
      const headers = lines[0].split(',').map(h => h.trim());
      const parsed: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim(); if (!line) continue;
        const vals = line.split(',');
        const obj: any = {};
        headers.forEach((h, idx) => { obj[h] = vals[idx]?.trim() || ''; });
        parsed.push(obj);
      }
      setCsvProducts(parsed);
    };
    reader.readAsText(file);
  };

  const handleBulkSubmit = async () => {
    if (!csvProducts.length) return;
    setUploadingBulk(true);
    try {
      await axios.post(`${API_URL}/products/bulk`, csvProducts, { headers: { Authorization: `Bearer ${token}` } });
      setShowBulkModal(false); setCsvProducts([]); fetchProducts();
    } catch (err: any) { alert(err.response?.data?.error || 'Bulk upload failed'); }
    finally { setUploadingBulk(false); }
  };

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.partNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.oemNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const map: any = {
      APPROVED: { label: 'Live', variant: 'success', icon: CheckCircle },
      PENDING: { label: 'Pending Review', variant: 'warning', icon: AlertCircle },
      REJECTED: { label: 'Rejected', variant: 'danger', icon: AlertCircle },
    };
    const s = map[status] || { label: status, variant: 'neutral', icon: AlertCircle };
    const Icon = s.icon;
    return <Badge variant={s.variant} className="!rounded-lg flex items-center gap-1 w-fit"><Icon className="w-3 h-3" />{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Package className="w-8 h-8 text-brand-secondary" /> My Products
        </h1>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowBulkModal(true)}>
            <Upload className="w-4 h-4" /> Bulk Upload
          </Button>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-brand-primary border border-brand-muted rounded-xl p-4 flex items-center gap-3">
        <Search className="w-5 h-5 text-gray-400" />
        <input type="text" placeholder="Search by product name, OEM, or part number..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent border-none focus:outline-none text-white w-full placeholder-gray-500" />
      </div>

      {/* Table */}
      {loading ? (
        <Loader fullScreen />
      ) : filtered.length === 0 ? (
        <div className="bg-brand-primary border border-brand-muted rounded-xl p-12 text-center">
          <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">{searchQuery ? 'No results found' : 'No Products Yet'}</h3>
          <p className="text-gray-400 mb-6">{searchQuery ? 'Try a different search term.' : "You haven't listed any products. Add your first product to start selling!"}</p>
          {!searchQuery && <Button onClick={openAdd}>Add Product</Button>}
        </div>
      ) : (
        <div className="bg-brand-primary border border-brand-muted rounded-xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-brand-dark border-b border-brand-muted text-xs text-gray-400 font-semibold uppercase">
                <th className="p-4">Product Details</th>
                <th className="p-4">Pricing</th>
                <th className="p-4">Stock</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-muted">
              {filtered.map(product => (
                <tr key={product.id} className="hover:bg-brand-dark/50 transition-colors">
                  <td className="p-4">
                    <div className="text-sm font-bold text-white">{product.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {product.oemNumber && <span className="mr-3">OEM: {product.oemNumber}</span>}
                      {product.partNumber && <span>Part: {product.partNumber}</span>}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                      <span>{product.category?.name}</span>
                      <span>{product.vehicleType === 'BIKE' ? '🏍️' : '🚗'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-bold text-white">₹{Number(product.price).toLocaleString('en-IN')}</div>
                    <div className="text-xs text-gray-400 line-through">MRP: ₹{Number(product.mrp).toLocaleString('en-IN')}</div>
                  </td>
                  <td className="p-4">
                    <span className={`font-bold text-sm ${product.stock > 10 ? 'text-green-400' : product.stock > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {product.stock} units
                    </span>
                  </td>
                  <td className="p-4">{getStatusBadge(product.status)}</td>
                  <td className="p-4 text-right">
                    <button onClick={() => openEdit(product)} className="text-brand-secondary hover:text-brand-accent p-2 transition-colors" title="Edit">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(product.id, product.name)} className="text-red-400 hover:text-red-300 p-2 transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Dialog isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={editingProduct ? 'Edit Product' : 'Add New Product'} size="lg">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Product Name" type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. Bosch Spark Plug" />
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea required value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} className="w-full bg-brand-dark border border-brand-muted rounded-lg px-4 py-2.5 text-white focus:border-brand-secondary focus:outline-none h-20 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="MRP (₹)" type="number" min="0" required value={formData.mrp} onChange={(e) => setFormData({...formData, mrp: e.target.value})} />
                <Input label="Selling Price (₹)" type="number" min="0" required value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Stock Qty" type="number" min="0" required value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})} />
                <Input label="OEM Number" type="text" value={formData.oemNumber} onChange={(e) => setFormData({...formData, oemNumber: e.target.value})} />
                <Input label="Part Number" type="text" value={formData.partNumber} onChange={(e) => setFormData({...formData, partNumber: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
                  <select required value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} className="w-full bg-brand-dark border border-brand-muted rounded-lg px-4 py-2.5 text-white focus:border-brand-secondary focus:outline-none text-sm">
                    <option value="">Select Category...</option>
                    {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.vehicleType === 'BIKE' ? 'Bike' : 'Car'})</option>)}
                  </select>
                  {/* vehicleType is derived server-side from the selected category, not
                      a separately-editable field -- shown here read-only so the vendor
                      can confirm they picked the right one before submitting. */}
                  {selectedCategory && (
                    <p className="text-xs text-gray-400 mt-1">
                      Vehicle Type: <span className="font-semibold text-brand-secondary">{selectedCategory.vehicleType === 'BIKE' ? '🏍️ Bike' : '🚗 Car'}</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Brand</label>
                  <select required value={formData.brandId} onChange={e => setFormData({...formData, brandId: e.target.value})} className="w-full bg-brand-dark border border-brand-muted rounded-lg px-4 py-2.5 text-white focus:border-brand-secondary focus:outline-none text-sm">
                    <option value="">Select Brand...</option>
                    {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-brand-muted">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-brand-dark text-white border border-brand-muted px-4 py-2.5 rounded-lg font-bold hover:bg-gray-800 transition-colors">Cancel</button>
                <Button type="submit" isLoading={submitting} className="flex-1">
                  <Save className="w-4 h-4" /> {submitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Submit Product'}
                </Button>
              </div>
            </form>
      </Dialog>

      {/* Bulk Upload Modal */}
      <Dialog isOpen={showBulkModal} onClose={() => { setShowBulkModal(false); setCsvProducts([]); }} title="Bulk Upload Products" size="xl">
            <div className="border-2 border-dashed border-brand-muted rounded-xl p-8 text-center hover:border-brand-secondary transition-colors cursor-pointer relative mb-4">
              <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              <Upload className="w-12 h-12 text-brand-secondary mx-auto mb-3" />
              <h4 className="text-lg font-bold text-white mb-1">Upload CSV File</h4>
              <p className="text-gray-400 text-sm">Required columns: <code className="bg-brand-dark px-1 rounded">name</code>, <code className="bg-brand-dark px-1 rounded">price</code>, <code className="bg-brand-dark px-1 rounded">stock</code></p>
            </div>
            {csvProducts.length > 0 && (
              <div className="max-h-64 overflow-auto border border-brand-muted rounded-lg mb-4">
                <table className="w-full text-left text-sm">
                  <thead className="bg-brand-dark sticky top-0">
                    <tr><th className="p-3 text-gray-400">Name</th><th className="p-3 text-gray-400">Price</th><th className="p-3 text-gray-400">Stock</th></tr>
                  </thead>
                  <tbody className="divide-y divide-brand-muted">
                    {csvProducts.slice(0, 50).map((p, i) => (
                      <tr key={i} className="hover:bg-brand-dark/50">
                        <td className="p-3 text-white">{p.name}</td>
                        <td className="p-3 text-green-400">₹{p.price || p.basePrice || 0}</td>
                        <td className="p-3 text-gray-300">{p.stock || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex gap-4">
              <button onClick={() => { setShowBulkModal(false); setCsvProducts([]); }} className="flex-1 bg-brand-dark text-white border border-brand-muted px-4 py-2.5 rounded-lg font-bold">Cancel</button>
              <Button onClick={handleBulkSubmit} disabled={!csvProducts.length} isLoading={uploadingBulk} className="flex-1">
                {uploadingBulk ? 'Uploading...' : `Upload ${csvProducts.length} Products`}
              </Button>
            </div>
      </Dialog>
    </div>
  );
}
