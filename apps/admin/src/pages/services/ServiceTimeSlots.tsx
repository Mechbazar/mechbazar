import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import type { RootState } from '../../store';
import { Edit2, Trash2 } from 'lucide-react';
import { Button, Card, Badge, Modal, Input, DataTable, EmptyState, Icon3D } from '../../components/ui';
import type { Column } from '../../components/ui';
import { API_URL } from '../../config/api';

const emptyForm = { label: '', startTime: '', endTime: '', maxBookingsPerSlot: '20', isActive: true, sortOrder: 0 };

export default function ServiceTimeSlots() {
  const { token } = useSelector((state: RootState) => state.auth);
  const [slots, setSlots] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [formData, setFormData] = useState(emptyForm);

  const loadSlots = () => {
    fetch(`${API_URL}/services/time-slots`)
      .then((res) => res.json())
      .then((data) => setSlots(data.sort((a: any, b: any) => a.sortOrder - b.sortOrder)))
      .catch((err) => console.error(err));
  };

  useEffect(() => { loadSlots(); }, []);

  const openAddModal = () => {
    setEditingSlot(null);
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const openEditModal = (slot: any) => {
    setEditingSlot(slot);
    setFormData({
      label: slot.label, startTime: slot.startTime, endTime: slot.endTime,
      maxBookingsPerSlot: String(slot.maxBookingsPerSlot), isActive: slot.isActive, sortOrder: slot.sortOrder,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.label || !formData.startTime || !formData.endTime) {
      toast.error('Label, start time and end time are required');
      return;
    }
    const payload = { ...formData, maxBookingsPerSlot: Number(formData.maxBookingsPerSlot) || 20 };
    try {
      const res = editingSlot
        ? await fetch(`${API_URL}/services/time-slots/${editingSlot.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          })
        : await fetch(`${API_URL}/services/time-slots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to save time slot');
        return;
      }
      loadSlots();
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Failed to save time slot');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this time slot?')) return;
    try {
      const res = await fetch(`${API_URL}/services/time-slots/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete time slot');
        return;
      }
      loadSlots();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete time slot');
    }
  };

  const toggleActive = async (slot: any) => {
    try {
      await fetch(`${API_URL}/services/time-slots/${slot.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !slot.isActive }),
      });
      loadSlots();
    } catch (error) {
      console.error(error);
    }
  };

  const columns: Column<any>[] = [
    { key: 'label', header: 'Label', render: (slot) => <span className="text-sm font-bold text-content-primary">{slot.label}</span> },
    { key: 'window', header: 'Window', render: (slot) => <span className="text-sm text-content-secondary">{slot.startTime} – {slot.endTime}</span> },
    { key: 'max', header: 'Max / Day', render: (slot) => <span className="text-sm text-content-secondary">{slot.maxBookingsPerSlot}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (slot) => (
        <button onClick={() => toggleActive(slot)}>
          <Badge variant={slot.isActive ? 'success' : 'neutral'} size="sm" className="cursor-pointer">
            {slot.isActive ? 'Active' : 'Disabled'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (slot) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEditModal(slot)} className="text-brand-primary hover:text-brand-accent p-1.5">
            <Edit2 className="w-4 h-4" />
          </button>
          <button onClick={() => handleDelete(slot.id)} className="text-danger-500 hover:text-danger-600 p-1.5">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
            <Icon3D name="service_catalog" size={30} eager /> Time Slots
          </h2>
          <p className="text-content-secondary mt-1 text-sm">Booking windows customers can choose from, with a per-slot daily capacity</p>
        </div>
        <Button onClick={openAddModal}>+ Add Time Slot</Button>
      </div>

      <Card padding="none">
        <DataTable
          columns={columns}
          data={slots}
          rowKey={(slot) => slot.id}
          emptyState={<EmptyState icon="service_catalog" title="No time slots configured yet" action={<Button onClick={openAddModal}>Add Time Slot</Button>} />}
        />
      </Card>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSlot ? 'Edit Time Slot' : 'Add Time Slot'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingSlot ? 'Save Changes' : 'Create Slot'}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <Input label="Label" type="text" value={formData.label} onChange={(e) => setFormData({ ...formData, label: e.target.value })} placeholder="e.g. 9:00 AM - 11:00 AM" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Time (HH:MM)" type="text" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} placeholder="09:00" />
            <Input label="End Time (HH:MM)" type="text" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} placeholder="11:00" />
          </div>
          <Input
            label="Max Bookings Per Day"
            type="number"
            value={formData.maxBookingsPerSlot}
            onChange={(e) => setFormData({ ...formData, maxBookingsPerSlot: e.target.value })}
            helperText="How many bookings can share this slot on a given day before it's marked full"
          />
        </div>
      </Modal>
    </motion.div>
  );
}
