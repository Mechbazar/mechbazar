import { useState } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { KeyRound } from 'lucide-react';
import type { RootState } from '../store';
import { updateUser } from '../store';
import { Badge, Button, Card, Icon3D, Input } from '../components/ui';
import { API_URL } from '../config/api';
import ChangePasswordDialog from '../components/ChangePasswordDialog';
import { fadeInUp } from '../utils/motion';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  OPERATIONS_MANAGER: 'Operations Manager',
  INVENTORY_MANAGER: 'Inventory Manager',
  VENDOR_MANAGER: 'Vendor Manager',
  FINANCE_MANAGER: 'Finance Manager',
  CUSTOMER_SUPPORT: 'Customer Support',
};

export default function Profile() {
  const dispatch = useDispatch();
  const { token, user } = useSelector((state: RootState) => state.auth);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const initials = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();
  const dirty = name.trim() !== (user?.name || '') || email.trim() !== (user?.email || '');

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.patch(
        `${API_URL}/customers/me/profile`,
        { name: name.trim(), email: email.trim() || null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      dispatch(updateUser({ name: res.data.name, email: res.data.email }));
      toast.success('Profile updated.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
          <Icon3D name="gear" size={30} eager /> My Profile
        </h1>
        <p className="text-content-secondary mt-1 text-sm">Update your personal information and manage your password.</p>
      </div>

      <Card className="space-y-5">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full icon-tile text-white text-xl font-semibold">
            {initials}
          </span>
          <div>
            <div className="font-bold text-content-primary">{user?.name || 'Admin'}</div>
            {user?.role && (
              <Badge variant="primary" size="sm" className="mt-1">
                {ROLE_LABEL[user.role] || user.role}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mechbazar.com" />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} isLoading={saving} disabled={saving || !dirty}>
            Save Changes
          </Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-bold text-content-primary">Security</h2>
          <p className="text-content-secondary text-sm mt-0.5">Change the password used to sign in to the admin panel.</p>
        </div>
        <Button variant="secondary" icon={<KeyRound className="w-4 h-4" />} onClick={() => setShowChangePassword(true)}>
          Change Password
        </Button>
      </Card>

      <ChangePasswordDialog isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />
    </motion.div>
  );
}
