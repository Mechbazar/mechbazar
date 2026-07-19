import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { Image as ImageIcon, Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Button, Card, Badge, Dialog, Input, Loader } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function Banners() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    id: '',
    title: '',
    image: '',
    type: 'HOMEPAGE',
    link: '',
    isActive: true,
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const res = await axios.get(`${API_URL}/banners`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBanners(res.data);
    } catch (error) {
      console.error('Failed to fetch banners', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (banner?: any) => {
    if (banner) {
      setIsEditing(true);
      setFormData({
        id: banner.id,
        title: banner.title || '',
        image: banner.image || '',
        type: banner.type || 'HOMEPAGE',
        link: banner.link || '',
        isActive: banner.isActive ?? true,
        startDate: banner.startDate ? new Date(banner.startDate).toISOString().split('T')[0] : '',
        endDate: banner.endDate ? new Date(banner.endDate).toISOString().split('T')[0] : ''
      });
    } else {
      setIsEditing(false);
      setFormData({
        id: '', title: '', image: '', type: 'HOMEPAGE', link: '', isActive: true, startDate: '', endDate: ''
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      };

      if (isEditing) {
        await axios.put(`${API_URL}/banners/${formData.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`${API_URL}/banners`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      setShowModal(false);
      fetchBanners();
    } catch (error: any) {
      console.error('Failed to save banner', error);
      alert(error.response?.data?.error || 'Failed to save banner.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return;
    try {
      await axios.delete(`${API_URL}/banners/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchBanners();
    } catch (error) {
      console.error('Failed to delete banner', error);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-neutral-100 flex items-center">
          <ImageIcon className="w-8 h-8 mr-3 text-primary-500" />
          Banners & CMS
        </h1>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="w-5 h-5 mr-1" /> Add Banner
        </Button>
      </div>

      {loading ? (
        <Loader fullScreen />
      ) : banners.length === 0 ? (
        <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-12 text-center">
          <ImageIcon className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-neutral-100 mb-2">No Banners Found</h3>
          <p className="text-neutral-400 mb-6">Create promotional banners to display on the customer app.</p>
          <Button onClick={() => handleOpenModal()}>
            Add Your First Banner
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((banner) => (
            <Card key={banner.id} variant="dark" className="!p-0 overflow-hidden group">
              <div className="h-48 relative overflow-hidden bg-neutral-900">
                {banner.image ? (
                  <img src={banner.image} alt={banner.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="flex items-center justify-center h-full text-neutral-400">No Image</div>
                )}
                <div className="absolute top-2 right-2 flex space-x-2">
                  <button onClick={() => handleOpenModal(banner)} className="p-2 bg-neutral-900/80 rounded-lg text-primary-500 hover:bg-neutral-800 backdrop-blur-sm">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(banner.id)} className="p-2 bg-neutral-900/80 rounded-lg text-red-400 hover:bg-neutral-800 backdrop-blur-sm">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute top-2 left-2">
                  <Badge variant="neutral" className="!rounded-md backdrop-blur-sm uppercase">
                    {banner.type}
                  </Badge>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-neutral-100">{banner.title}</h3>
                  {banner.isActive ? (
                    <Badge variant="success" className="!rounded-full flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1"/> Active
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="!rounded-full flex items-center">
                      <XCircle className="w-3 h-3 mr-1"/> Inactive
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-neutral-400">
                  {banner.startDate && banner.endDate ? (
                    <span>Runs: {new Date(banner.startDate).toLocaleDateString()} - {new Date(banner.endDate).toLocaleDateString()}</span>
                  ) : (
                    <span>Runs: Always Active</span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={isEditing ? 'Edit Banner' : 'Add New Banner'}
      >
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Banner Title"
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />

              <Input
                label="Image URL"
                type="url"
                required
                value={formData.image}
                onChange={(e) => setFormData({...formData, image: e.target.value})}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-brand-muted mb-1">Placement Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full bg-brand-dark border border-brand-border rounded-lg px-4 py-2 text-brand-light focus:outline-none focus:border-brand-primary"
                  >
                    <option value="HOMEPAGE">Homepage</option>
                    <option value="CATEGORY">Category</option>
                    <option value="PROMO">Promo</option>
                  </select>
                </div>
                <Input
                  label="Click Link (Optional)"
                  type="text"
                  value={formData.link}
                  onChange={(e) => setFormData({...formData, link: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Start Date (Optional)"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                />
                <Input
                  label="End Date (Optional)"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  className="w-4 h-4 text-primary-500 bg-neutral-900 border border-neutral-800 rounded focus:ring-primary-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-neutral-100">
                  Banner is Active
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
                  {isEditing ? 'Save Changes' : 'Create Banner'}
                </Button>
              </div>
            </form>
      </Dialog>
    </div>
  );
}
