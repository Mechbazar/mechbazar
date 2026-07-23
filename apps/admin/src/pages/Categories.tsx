import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Layers, Search, MoreVertical, Edit2, Trash2, Smile } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { Button, Card, Badge, Dialog, Input } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function Categories() {
  const { token } = useSelector((state: RootState) => state.auth);
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
        alert(data.error || 'Failed to save category');
        return;
      }

      loadCategories();
      setIsModalOpen(false);
      setEditingCategory(null);
    } catch (error) {
      console.error(error);
      alert('Failed to save category');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this category?')) {
      try {
        const res = await fetch(`${API_URL}/categories/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || 'Failed to delete category');
          return;
        }
        loadCategories();
      } catch (error) {
        console.error(error);
        alert('Failed to delete category');
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
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Layers className="text-brand-primary w-8 h-8" />
            Product Categories
          </h2>
          <p className="text-neutral-400 mt-1">Organize your inventory taxonomy for the mobile app</p>
        </div>
        <Button onClick={openAddModal}>
          <span>+</span> Add Category
        </Button>
      </div>

      {/* Toolbar */}
      <div className="bg-neutral-900 p-4 rounded-2xl shadow-sm border border-neutral-800 flex gap-4 mb-8">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-3 text-neutral-500 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-12 pr-4 py-2.5 text-white placeholder-neutral-500 outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-white outline-none font-medium focus:border-brand-primary"
        >
          <option>All Status</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </div>

      {categories.length > 0 && filteredCategories.length === 0 && (
        <div className="text-center py-12 text-neutral-400">No categories match your search.</div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCategories.map((cat) => (
          <Card key={cat.id} variant="dark" className="group relative">
            <div className="flex justify-between items-start mb-4">
              <div className="w-14 h-14 bg-neutral-950 rounded-2xl flex items-center justify-center text-2xl border border-neutral-800 overflow-hidden">
                {cat.icon?.startsWith('http') ? (
                  <img src={cat.icon} alt={cat.name} className="w-10 h-10 object-contain" />
                ) : (
                  cat.icon
                )}
              </div>
              <button className="text-neutral-500 hover:text-white p-2">
                <MoreVertical className="w-5 h-5" />
              </button>

              {/* Dropdown Menu (Hidden by default, shown on hover for demo) */}
              <div className="absolute right-4 top-14 bg-neutral-900 border border-neutral-800 rounded-xl shadow-lg w-32 hidden group-hover:block z-10">
                <button
                  onClick={() => openEditModal(cat)}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-neutral-300 hover:bg-neutral-800 flex items-center gap-2 rounded-t-xl"
                >
                  <Edit2 className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(cat.id)}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-danger-400 hover:bg-danger-500/10 flex items-center gap-2 rounded-b-xl"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-1">{cat.name}</h3>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-neutral-800">
              <span className="text-neutral-400 text-sm font-medium">{cat.products} Products</span>
              <Badge variant={cat.status === 'Active' ? 'success' : 'neutral'} className="!rounded-full">
                {cat.status}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Category Modal */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-semibold text-neutral-300 hover:bg-neutral-800">Cancel</button>
            <Button onClick={handleSave}>{editingCategory ? 'Save Changes' : 'Create Category'}</Button>
          </>
        }
      >
        <div className="space-y-5">
              <Input
                label="Category Name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. Spark Plugs"
              />

              <div className="relative" ref={emojiPickerRef}>
                <label className="block text-sm font-semibold text-neutral-300 mb-2">Icon (Emoji or Image URL)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {formData.icon && !formData.icon.startsWith('http') && <span className="text-xl">{formData.icon}</span>}
                  </div>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({...formData, icon: e.target.value})}
                    className={`w-full bg-neutral-950 border border-neutral-800 rounded-xl ${formData.icon && !formData.icon.startsWith('http') ? 'pl-10' : 'px-4'} pr-12 py-3 text-white outline-none focus:border-brand-primary`}
                    placeholder="e.g. ⚡ or https://..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="absolute inset-y-0 right-2 flex items-center p-2 text-neutral-500 hover:text-brand-primary transition-colors"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>

                {showEmojiPicker && (
                  <div className="absolute z-50 mt-2 shadow-2xl rounded-xl overflow-hidden border border-neutral-800">
                    <EmojiPicker
                      onEmojiClick={(emojiObject) => {
                        setFormData({...formData, icon: emojiObject.emoji});
                        setShowEmojiPicker(false);
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-300 mb-2">Vehicle Type</label>
                <select
                  value={formData.vehicleType}
                  onChange={(e) => setFormData({...formData, vehicleType: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-primary"
                >
                  <option value="CAR">Car</option>
                  <option value="BIKE">Bike</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-300 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none focus:border-brand-primary"
                >
                  <option value="Active">Active (Visible in App)</option>
                  <option value="Inactive">Inactive (Hidden)</option>
                </select>
              </div>
        </div>
      </Dialog>
    </div>
  );
}
