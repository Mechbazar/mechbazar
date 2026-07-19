import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { Package, Search, Edit2, Trash2, Star } from 'lucide-react';
import { Button, Card, Badge, Dialog, Input } from '@mechbazar/shared/web';
import { API_URL, SERVER_ORIGIN } from '../../config/api';

const emptyForm = {
  categoryId: '', name: '', description: '', image: '', price: '', discountPrice: '',
  estimatedMinutes: '60', includedServices: '', isActive: true,
  isPopular: false, isRecommended: false, isEmergency: false,
};

const resolveImg = (img?: string) => (img && img.startsWith('/') ? `${SERVER_ORIGIN}${img}` : img);

export default function ServicePackages() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [packages, setPackages] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const loadData = async () => {
    try {
      const [pkgRes, catRes] = await Promise.all([
        fetch(`${API_URL}/services/packages`).then((r) => r.json()),
        fetch(`${API_URL}/services/categories`).then((r) => r.json()),
      ]);
      setPackages(pkgRes);
      setCategories(catRes);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadData(); }, []);

  const openAddModal = () => {
    setEditingPackage(null);
    setFormData({ ...emptyForm, categoryId: categories[0]?.id || '' });
    setIsModalOpen(true);
  };

  const openEditModal = (pkg: any) => {
    setEditingPackage(pkg);
    setFormData({
      categoryId: pkg.categoryId,
      name: pkg.name,
      description: pkg.description || '',
      image: pkg.image || '',
      price: String(pkg.price),
      discountPrice: pkg.discountPrice != null ? String(pkg.discountPrice) : '',
      estimatedMinutes: String(pkg.estimatedMinutes),
      includedServices: (pkg.includedServices || []).join(', '),
      isActive: pkg.isActive,
      isPopular: !!pkg.isPopular,
      isRecommended: !!pkg.isRecommended,
      isEmergency: !!pkg.isEmergency,
    });
    setIsModalOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to upload image');
        return;
      }
      setFormData((prev) => ({ ...prev, image: data.url }));
    } catch (err) {
      console.error(err);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.categoryId || !formData.name || !formData.price) {
      alert('Category, name and price are required');
      return;
    }
    const payload = {
      categoryId: formData.categoryId,
      name: formData.name,
      description: formData.description,
      image: formData.image || null,
      price: Number(formData.price),
      discountPrice: formData.discountPrice ? Number(formData.discountPrice) : null,
      estimatedMinutes: Number(formData.estimatedMinutes) || 60,
      includedServices: formData.includedServices.split(',').map((s) => s.trim()).filter(Boolean),
      isActive: formData.isActive,
      isPopular: formData.isPopular,
      isRecommended: formData.isRecommended,
      isEmergency: formData.isEmergency,
    };

    try {
      const res = editingPackage
        ? await fetch(`${API_URL}/services/packages/${editingPackage.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          })
        : await fetch(`${API_URL}/services/packages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to save package');
        return;
      }

      loadData();
      setIsModalOpen(false);
      setEditingPackage(null);
    } catch (error) {
      console.error(error);
      alert('Failed to save package');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    try {
      const res = await fetch(`${API_URL}/services/packages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete package');
        return;
      }
      loadData();
    } catch (error) {
      console.error(error);
      alert('Failed to delete package');
    }
  };

  const filtered = packages.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Package className="text-brand-primary w-8 h-8" />
            Service Packages
          </h2>
          <p className="text-neutral-400 mt-1">Set pricing, estimated time, and inclusions for each service</p>
        </div>
        <Button onClick={openAddModal} disabled={categories.length === 0}>
          <span>+</span> Add Package
        </Button>
      </div>

      {categories.length === 0 && (
        <div className="mb-6 rounded-xl border border-warning-500/30 bg-warning-500/10 px-4 py-3 text-sm text-warning-300">
          Create a service category first before adding packages.
        </div>
      )}

      <div className="bg-neutral-900 p-4 rounded-2xl shadow-sm border border-neutral-800 flex gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3 text-neutral-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search packages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-12 pr-4 py-2.5 text-white placeholder-neutral-500 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((pkg) => (
          <Card key={pkg.id} variant="dark">
            <div className="flex justify-between items-start mb-2 gap-2 flex-wrap">
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary" className="!rounded-full">{pkg.category?.name}</Badge>
                {pkg.isPopular && <Badge variant="warning" className="!rounded-full">Popular</Badge>}
                {pkg.isRecommended && <Badge variant="info" className="!rounded-full">Recommended</Badge>}
                {pkg.isEmergency && <Badge variant="danger" className="!rounded-full">Emergency</Badge>}
              </div>
              <Badge variant={pkg.isActive ? 'success' : 'neutral'} className="!rounded-full">{pkg.isActive ? 'Active' : 'Disabled'}</Badge>
            </div>
            {pkg.image && (
              <img src={resolveImg(pkg.image)} alt={pkg.name} className="w-full h-32 object-cover rounded-xl mb-3 border border-neutral-800" />
            )}
            <h3 className="text-lg font-bold text-white mb-1">{pkg.name}</h3>
            <p className="text-neutral-400 text-sm mb-1 line-clamp-2">{pkg.description || 'No description'}</p>
            {pkg.reviewCount > 0 && (
              <p className="text-xs text-neutral-500 mb-2 flex items-center gap-1">
                <Star className="w-3 h-3 fill-warning-400 text-warning-400" /> {pkg.rating.toFixed(1)} ({pkg.reviewCount} review{pkg.reviewCount !== 1 ? 's' : ''})
              </p>
            )}

            {pkg.includedServices?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {pkg.includedServices.slice(0, 3).map((s: string, i: number) => (
                  <span key={i} className="text-xs bg-neutral-800 text-neutral-300 px-2 py-1 rounded">{s}</span>
                ))}
              </div>
            )}

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-neutral-800">
              <div>
                {pkg.discountPrice != null && pkg.discountPrice < pkg.price && (
                  <span className="text-neutral-500 text-sm line-through mr-2">₹{pkg.price}</span>
                )}
                <span className="text-white font-bold text-lg">₹{pkg.discountPrice ?? pkg.price}</span>
                <span className="text-neutral-500 text-xs ml-2">· {pkg.estimatedMinutes} mins</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEditModal(pkg)} className="text-brand-primary hover:text-brand-secondary p-1">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(pkg.id)} className="text-danger-400 hover:text-danger-300 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-neutral-500">No service packages found.</div>
        )}
      </div>

      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPackage ? 'Edit Package' : 'Add Package'}
        size="lg"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-semibold text-neutral-300 hover:bg-neutral-800">Cancel</button>
            <Button onClick={handleSave}>{editingPackage ? 'Save Changes' : 'Create Package'}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Category</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-primary"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.vehicleType})</option>
              ))}
            </select>
          </div>

          <Input
            label="Package Name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Standard Battery Replacement"
          />

          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-primary"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input label="Price (₹)" type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
            <Input label="Discount Price (₹)" type="number" value={formData.discountPrice} onChange={(e) => setFormData({ ...formData, discountPrice: e.target.value })} helperText="Optional" />
            <Input label="Est. Minutes" type="number" value={formData.estimatedMinutes} onChange={(e) => setFormData({ ...formData, estimatedMinutes: e.target.value })} />
          </div>
          {formData.price && formData.discountPrice && Number(formData.discountPrice) < Number(formData.price) && (
            <p className="text-xs text-success-400 -mt-3">
              {Math.round(((Number(formData.price) - Number(formData.discountPrice)) / Number(formData.price)) * 100)}% off preview
            </p>
          )}

          <Input
            label="Included Services (comma separated)"
            type="text"
            value={formData.includedServices}
            onChange={(e) => setFormData({ ...formData, includedServices: e.target.value })}
            placeholder="e.g. Battery testing, Replacement, Old battery disposal"
          />

          <div>
            <label className="block text-sm font-semibold text-neutral-300 mb-2">Service Image</label>
            {formData.image && (
              <img src={resolveImg(formData.image)} alt="Preview" className="w-full h-40 object-cover rounded-xl mb-2 border border-neutral-800" />
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
              disabled={uploading}
              className="w-full text-sm text-neutral-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-brand-primary file:text-white file:font-semibold file:cursor-pointer"
            />
            {uploading && <p className="text-xs text-neutral-500 mt-1">Uploading...</p>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-300">
              <input type="checkbox" checked={formData.isPopular} onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })} className="w-4 h-4 text-brand-primary bg-neutral-950 border-neutral-800 rounded focus:ring-brand-primary" />
              Popular
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-300">
              <input type="checkbox" checked={formData.isRecommended} onChange={(e) => setFormData({ ...formData, isRecommended: e.target.checked })} className="w-4 h-4 text-brand-primary bg-neutral-950 border-neutral-800 rounded focus:ring-brand-primary" />
              Recommended
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-300">
              <input type="checkbox" checked={formData.isEmergency} onChange={(e) => setFormData({ ...formData, isEmergency: e.target.checked })} className="w-4 h-4 text-brand-primary bg-neutral-950 border-neutral-800 rounded focus:ring-brand-primary" />
              Emergency
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pkgActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-brand-primary bg-neutral-950 border-neutral-800 rounded focus:ring-brand-primary"
            />
            <label htmlFor="pkgActive" className="text-sm font-medium text-neutral-300">Package is Active</label>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
