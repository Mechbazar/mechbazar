import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { Clock3, Edit2, Trash2 } from 'lucide-react';
import { Button, Badge, Dialog, Input } from '@mechbazar/shared/web';
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
      alert('Label, start time and end time are required');
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
        alert(data.error || 'Failed to save time slot');
        return;
      }
      loadSlots();
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      alert('Failed to save time slot');
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
        alert(data.error || 'Failed to delete time slot');
        return;
      }
      loadSlots();
    } catch (error) {
      console.error(error);
      alert('Failed to delete time slot');
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

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Clock3 className="text-brand-primary w-8 h-8" />
            Time Slots
          </h2>
          <p className="text-neutral-400 mt-1">Booking windows customers can choose from, with a per-slot daily capacity</p>
        </div>
        <Button onClick={openAddModal}>
          <span>+</span> Add Time Slot
        </Button>
      </div>

      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-neutral-950 text-neutral-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold">Label</th>
              <th className="p-4 font-semibold">Window</th>
              <th className="p-4 font-semibold">Max / Day</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {slots.map((slot) => (
              <tr key={slot.id} className="hover:bg-neutral-800/50 transition-colors">
                <td className="p-4 text-white font-medium">{slot.label}</td>
                <td className="p-4 text-neutral-300">{slot.startTime} – {slot.endTime}</td>
                <td className="p-4 text-neutral-300">{slot.maxBookingsPerSlot}</td>
                <td className="p-4">
                  <button onClick={() => toggleActive(slot)}>
                    <Badge variant={slot.isActive ? 'success' : 'neutral'} className="!rounded-full cursor-pointer">
                      {slot.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                  </button>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => openEditModal(slot)} className="text-brand-primary hover:text-brand-secondary p-1 mr-2">
                    <Edit2 className="w-4 h-4 inline" />
                  </button>
                  <button onClick={() => handleDelete(slot.id)} className="text-danger-400 hover:text-danger-300 p-1">
                    <Trash2 className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
            {slots.length === 0 && (
              <tr><td colSpan={5} className="text-center py-12 text-neutral-500">No time slots configured yet.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSlot ? 'Edit Time Slot' : 'Add Time Slot'}
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-semibold text-neutral-300 hover:bg-neutral-800">Cancel</button>
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
      </Dialog>
    </div>
  );
}
