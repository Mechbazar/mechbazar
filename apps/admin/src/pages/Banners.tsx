import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import { Plus, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { Button, Card, Badge, Modal, Input, Select, Checkbox, Loader, EmptyState, Icon3D } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';

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
      toast.error(error.response?.data?.error || 'Failed to save banner.');
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
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6 pb-12">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
          <Icon3D name="banners" size={30} eager /> Banners & CMS
        </h1>
        <Button icon={<Plus size={16} />} onClick={() => handleOpenModal()}>Add Banner</Button>
      </div>

      {loading ? (
        <Loader fullScreen />
      ) : banners.length === 0 ? (
        <Card>
          <EmptyState
            icon="banners"
            title="No Banners Found"
            description="Create promotional banners to display on the customer app."
            action={<Button onClick={() => handleOpenModal()}>Add Your First Banner</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {banners.map((banner) => (
            <Card key={banner.id} padding="none" className="overflow-hidden group">
              <div className="h-48 relative overflow-hidden bg-surface-sunken">
                {banner.image ? (
                  <img src={banner.image} alt={banner.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="flex items-center justify-center h-full text-content-muted">No Image</div>
                )}
                <div className="absolute top-2 right-2 flex gap-2">
                  <button onClick={() => handleOpenModal(banner)} className="p-2 bg-surface-overlay/90 rounded-lg text-brand-primary hover:bg-surface-hover backdrop-blur-sm transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(banner.id)} className="p-2 bg-surface-overlay/90 rounded-lg text-danger-500 hover:bg-surface-hover backdrop-blur-sm transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="absolute top-2 left-2">
                  <Badge variant="neutral" className="backdrop-blur-sm uppercase">
                    {banner.type}
                  </Badge>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-content-primary">{banner.title}</h3>
                  {banner.isActive ? (
                    <Badge variant="success" className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3"/> Active
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="flex items-center gap-1">
                      <XCircle className="w-3 h-3"/> Inactive
                    </Badge>
                  )}
                </div>
                <div className="text-sm text-content-muted">
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

      <Modal
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
            <Select
              label="Placement Type"
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
            >
              <option value="HOMEPAGE">Homepage</option>
              <option value="CATEGORY">Category</option>
              <option value="PROMO">Promo</option>
            </Select>
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

          <Checkbox
            label="Banner is Active"
            checked={formData.isActive}
            onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
          />

          <div className="flex gap-4 mt-6 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              {isEditing ? 'Save Changes' : 'Create Banner'}
            </Button>
          </div>
        </form>
      </Modal>
    </motion.div>
  );
}
