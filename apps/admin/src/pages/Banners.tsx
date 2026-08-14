import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import { Plus, Edit, Trash2, CheckCircle, XCircle, ImagePlus } from 'lucide-react';
import { Button, Card, Badge, Modal, Input, Select, Checkbox, Loader, EmptyState, Icon3D } from '../components/ui';
import { API_URL, resolveUploadUrl } from '../config/api';
import { fadeInUp } from '../utils/motion';
import { useConfirm } from '../hooks/useConfirm';

function BannerImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <div className="flex items-center justify-center h-full text-content-muted">No Image</div>;
  }
  return (
    <img
      src={resolveUploadUrl(src)}
      alt={alt}
      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      onError={() => setFailed(true)}
    />
  );
}

export default function Banners() {
  const { token } = useSelector((state: RootState) => state.auth);
  const confirm = useConfirm();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState('');

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
    setImageError('');
    setShowModal(true);
  };

  // POST /upload stores the file (Firebase Storage when a bucket is
  // configured, otherwise the backend's own uploads/ dir) and returns the
  // URL to persist on the banner -- same endpoint Products.tsx already
  // uses. Added because admins were pasting page URLs (e.g. a Canva share
  // link, which points at Canva's viewer page, not a raw image file) into
  // the old plain-text "Image URL" field; an <img> can't render a webpage,
  // so the banner silently showed "No Image". A real upload sidesteps
  // needing a pre-hosted direct image URL at all.
  const handleImageUpload = async (file: File) => {
    setImageError('');
    setUploadingImage(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await axios.post(`${API_URL}/upload`, body, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.data?.url) throw new Error('Upload returned no URL');
      setFormData((prev) => ({ ...prev, image: res.data.url }));
    } catch (err: any) {
      setImageError(err?.response?.data?.error || 'Image upload failed. Please try again.');
    } finally {
      setUploadingImage(false);
    }
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
    if (!(await confirm({ title: 'Delete banner', message: 'Are you sure you want to delete this banner? This cannot be undone.' }))) return;
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
                <BannerImage src={banner.image} alt={banner.title} />
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
                <div className="text-sm text-content-muted mt-1 truncate">
                  {banner.link ? (
                    <span>Links to: <span className="text-content-primary">{banner.link}</span></span>
                  ) : (
                    <span className="italic">No click link set</span>
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

          <div>
            <label className="block text-sm font-semibold text-content-secondary mb-2">Banner Image</label>

            {formData.image && (
              <div className="relative w-fit mb-3">
                <img
                  src={resolveUploadUrl(formData.image)}
                  alt="Banner preview"
                  className="h-24 w-40 rounded-xl object-cover border border-border-default"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            )}

            <input
              id="banner-image-input"
              type="file"
              accept="image/*"
              disabled={uploadingImage}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
                // Reset so picking the same file twice still fires onChange.
                e.target.value = '';
              }}
            />
            <label
              htmlFor="banner-image-input"
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border-default px-4 py-2 text-sm font-medium text-content-secondary hover:border-brand-primary hover:text-brand-primary transition-colors ${
                uploadingImage ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              <ImagePlus className="h-4 w-4" />
              {uploadingImage ? 'Uploading…' : formData.image ? 'Replace image' : 'Upload image'}
            </label>

            {imageError && <p className="mt-2 text-sm text-danger-500">{imageError}</p>}

            {/* Fallback for an image already hosted elsewhere -- but NOT a
                page URL (e.g. a Canva share link, a Google Drive share
                link): those point at a viewer page, not raw image bytes,
                so an <img> can't render them. Uploading above avoids this
                trap entirely for anyone unsure what "direct image URL"
                means. */}
            <div className="mt-3">
              <Input
                label="Or paste a direct image URL"
                type="text"
                required
                placeholder="https://example.com/banner.jpg"
                helperText="Must be a link to the image file itself, not a page that displays it (a Canva/Drive share link won't work here)."
                value={formData.image}
                onChange={(e) => setFormData({...formData, image: e.target.value})}
              />
            </div>
          </div>

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
              placeholder="https://example.com or a category name"
              helperText="A full https:// link opens externally. Anything else (e.g. Filters) opens that category in the app."
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
