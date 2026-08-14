import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import { Search, MoreVertical, Edit2, Trash2, Smile } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { Button, Card, Badge, Modal, Input, Select, EmptyState, Icon3D } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';
import { useConfirm } from '../hooks/useConfirm';

export default function Categories() {
  const { token } = useSelector((state: RootState) => state.auth);
  const confirm = useConfirm();
  const [categories, setCategories] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', icon: '', status: 'Active', vehicleType: 'CAR' });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  const loadCategories = () => {
    // The backend already returns a per-category productCount (a real
    // categoryId-scoped Prisma relation count) -- recomputing it client-side
    // by matching on category NAME used to collide once Car and Bike
    // categories could share a name (Category is unique on [name, vehicleType]
    // now), double-counting or misattributing products between them.
    fetch(`${API_URL}/categories`)
      .then(res => res.json())
      .then(data => {
        setCategories(data.map((cat: any) => ({ ...cat, products: cat.productCount ?? 0 })));
      })
      .catch(err => console.error(err));
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    // Close emoji picker when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openEditModal = (cat: any) => {
    setEditingCategory(cat);
    setFormData({ name: cat.name, icon: cat.icon, status: cat.status || 'Active', vehicleType: cat.vehicleType || 'CAR' });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const res = editingCategory
        ? await fetch(`${API_URL}/categories/${editingCategory.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(formData)
          })
        : await fetch(`${API_URL}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(formData)
          });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to save category');
        return;
      }

      loadCategories();
      setIsModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save category');
    }
  };

  const handleDelete = async (id: string) => {
    if (await confirm({ title: 'Delete category', message: 'Are you sure you want to delete this category? This cannot be undone.' })) {
      try {
        const res = await fetch(`${API_URL}/categories/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error || 'Failed to delete category');
          return;
        }
        loadCategories();
      } catch (error) {
        console.error(error);
        toast.error('Failed to delete category');
      }
    }
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', icon: '', status: 'Active', vehicleType: 'CAR' });
    setIsModalOpen(true);
  };

  const filteredCategories = categories.filter((cat) => {
    const matchesSearch = !searchQuery || cat.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All Status' || cat.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
            <Icon3D name="categories" size={30} eager /> Product Categories
          </h2>
          <p className="text-content-secondary mt-1 text-sm">Organize your inventory taxonomy for the mobile app</p>
        </div>
        <Button icon={<span className="text-base leading-none">+</span>} onClick={openAddModal}>Add Category</Button>
      </div>

      <Card padding="sm" className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
            className="w-full bg-surface-sunken border border-border-default rounded-xl pl-10 pr-4 py-2.5 text-content-primary placeholder-content-muted outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/20 text-sm"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
          <option>All Status</option>
          <option>Active</option>
          <option>Inactive</option>
        </Select>
      </Card>

      {categories.length > 0 && filteredCategories.length === 0 && (
        <Card><EmptyState icon="categories" title="No categories match your search" /></Card>
      )}

      {categories.length === 0 && (
        <Card><EmptyState icon="categories" title="No categories yet" description="Add your first category to organize the catalog." action={<Button onClick={openAddModal}>Add Category</Button>} /></Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCategories.map((cat) => (
          <Card key={cat.id} className="group relative">
            <div className="flex justify-between items-start mb-4">
              <div className="w-14 h-14 bg-surface-sunken rounded-2xl flex items-center justify-center text-2xl border border-border-default overflow-hidden">
                {cat.icon?.startsWith('http') ? (
                  <img src={cat.icon} alt={cat.name} className="w-10 h-10 object-contain" />
                ) : (
                  cat.icon
                )}
              </div>
              <button className="text-content-muted hover:text-content-primary p-2">
                <MoreVertical className="w-5 h-5" />
              </button>

              <div className="absolute right-4 top-14 bg-surface-overlay border border-border-default rounded-xl shadow-popover w-32 hidden group-hover:block z-10">
                <button
                  onClick={() => openEditModal(cat)}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-content-secondary hover:bg-surface-hover flex items-center gap-2 rounded-t-xl"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(cat.id)}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-danger-500 hover:bg-danger-500/10 flex items-center gap-2 rounded-b-xl"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>

            <h3 className="text-base font-bold text-content-primary mb-1">{cat.name}</h3>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-border-default">
              <span className="text-content-muted text-sm font-medium">{cat.products} Products</span>
              <Badge variant={cat.status === 'Active' ? 'success' : 'neutral'} size="sm">{cat.status}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingCategory ? 'Save Changes' : 'Create Category'}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <Input
            label="Category Name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Spark Plugs"
          />

          <div className="relative" ref={emojiPickerRef}>
            <label className="block text-sm font-medium text-content-secondary mb-1.5">Icon (Emoji or Image URL)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {formData.icon && !formData.icon.startsWith('http') && <span className="text-xl">{formData.icon}</span>}
              </div>
              <input
                type="text"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                className={`w-full bg-surface-card border border-border-default rounded-xl ${formData.icon && !formData.icon.startsWith('http') ? 'pl-10' : 'px-3.5'} pr-12 py-2.5 text-content-primary outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/20 text-sm`}
                placeholder="e.g. ⚡ or https://..."
              />
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute inset-y-0 right-2 flex items-center p-2 text-content-muted hover:text-brand-primary transition-colors"
              >
                <Smile className="w-5 h-5" />
              </button>
            </div>

            {showEmojiPicker && (
              <div className="absolute z-50 mt-2 shadow-popover rounded-xl overflow-hidden border border-border-default">
                <EmojiPicker
                  onEmojiClick={(emojiObject) => {
                    setFormData({ ...formData, icon: emojiObject.emoji });
                    setShowEmojiPicker(false);
                  }}
                />
              </div>
            )}
          </div>

          <Select label="Vehicle Type" value={formData.vehicleType} onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}>
            <option value="CAR">Car</option>
            <option value="BIKE">Bike</option>
          </Select>

          <Select label="Status" value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
            <option value="Active">Active (Visible in App)</option>
            <option value="Inactive">Inactive (Hidden)</option>
          </Select>
        </div>
      </Modal>
    </motion.div>
  );
}
