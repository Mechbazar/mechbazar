import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Ban, CheckCircle2, Plus, ShieldAlert } from 'lucide-react';
import type { RootState } from '../store';
import { Badge, Button, Card, DataTable, EmptyState, Icon3D, Input, Modal, Select } from '../components/ui';
import type { Column } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';

const STAFF_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATIONS_MANAGER',
  'INVENTORY_MANAGER',
  'VENDOR_MANAGER',
  'FINANCE_MANAGER',
  'CUSTOMER_SUPPORT',
] as const;

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  OPERATIONS_MANAGER: 'Operations Manager',
  INVENTORY_MANAGER: 'Inventory Manager',
  VENDOR_MANAGER: 'Vendor Manager',
  FINANCE_MANAGER: 'Finance Manager',
  CUSTOMER_SUPPORT: 'Customer Support',
};

type StaffUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export default function AdminManagement() {
  const { token, user: currentUser } = useSelector((state: RootState) => state.auth);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [roleEditTarget, setRoleEditTarget] = useState<StaffUser | null>(null);

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const headers = { Authorization: `Bearer ${token}` };

  const fetchStaff = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/staff`, { headers });
      setStaff(res.data);
    } catch (err) {
      console.error('Failed to fetch administrators', err);
      toast.error('Failed to load administrators.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleActive = async (member: StaffUser) => {
    try {
      const res = await axios.patch(
        `${API_URL}/admin/staff/${member.id}/active`,
        { isActive: !member.isActive },
        { headers }
      );
      setStaff((prev) => prev.map((s) => (s.id === member.id ? { ...s, isActive: res.data.isActive } : s)));
      toast.success(res.data.isActive ? 'Administrator reactivated.' : 'Administrator deactivated.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to update administrator.');
    }
  };

  const columns: Column<StaffUser>[] = [
    {
      key: 'name',
      header: 'Administrator',
      render: (s) => (
        <div>
          <div className="font-semibold text-content-primary">{s.name || 'Unnamed'}</div>
          <div className="text-xs text-content-muted">{s.email}</div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (s) => (
        <button
          onClick={() => isSuperAdmin && setRoleEditTarget(s)}
          disabled={!isSuperAdmin}
          className={isSuperAdmin ? 'cursor-pointer' : 'cursor-default'}
          title={isSuperAdmin ? 'Change role' : undefined}
        >
          <Badge variant="primary" size="sm">{ROLE_LABEL[s.role] || s.role}</Badge>
        </button>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <Badge variant={s.isActive ? 'success' : 'danger'} size="sm">
          {s.isActive ? 'Active' : 'Deactivated'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'Added',
      render: (s) => <span className="text-sm text-content-muted">{new Date(s.createdAt).toLocaleDateString()}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (s) =>
        isSuperAdmin && s.id !== currentUser?.id ? (
          <Button
            size="xs"
            variant={s.isActive ? 'danger' : 'success'}
            icon={s.isActive ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            onClick={() => handleToggleActive(s)}
          >
            {s.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        ) : (
          <span className="text-xs text-content-muted">{s.id === currentUser?.id ? 'This is you' : '-'}</span>
        ),
    },
  ];

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="max-w-6xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
            <Icon3D name="shield" size={30} eager /> Administrators
          </h1>
          <p className="text-content-secondary mt-1 text-sm">Manage who can sign into the admin panel and what they can do.</p>
        </div>
        {isSuperAdmin && (
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
            Add Administrator
          </Button>
        )}
      </div>

      {!isSuperAdmin && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning-500/30 bg-warning-500/10 px-4 py-3 text-sm text-warning-700 dark:text-warning-400">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Only Super Admins can add, re-role, or deactivate administrators. You can view the list below.</span>
        </div>
      )}

      <Card padding="none">
        <DataTable
          columns={columns}
          data={staff}
          rowKey={(s) => s.id}
          loading={loading}
          pageSize={10}
          emptyState={<EmptyState icon="shield" title="No administrators found" description="Add your first administrator to get started." />}
          className="rounded-none border-none shadow-none"
        />
      </Card>

      <CreateAdminModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        token={token}
        onCreated={(created) => {
          setStaff((prev) => [created, ...prev]);
          setShowCreate(false);
        }}
      />

      <RoleEditModal
        target={roleEditTarget}
        onClose={() => setRoleEditTarget(null)}
        token={token}
        currentUserId={currentUser?.id}
        onUpdated={(updated) => {
          setStaff((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
          setRoleEditTarget(null);
        }}
      />
    </motion.div>
  );
}

function CreateAdminModal({
  isOpen,
  onClose,
  token,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  onCreated: (staff: StaffUser) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('CUSTOMER_SUPPORT');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setEmail('');
    setRole('CUSTOMER_SUPPORT');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await axios.post(
        `${API_URL}/admin/staff`,
        { name: name.trim(), email: email.trim(), role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message || 'Administrator created.');
      onCreated({ id: res.data.id, name: res.data.name, email: res.data.email, role: res.data.role, isActive: true, createdAt: res.data.createdAt });
      reset();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to create administrator.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Administrator">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-600 dark:text-danger-400">
            {error}
          </div>
        )}
        <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jane Doe" />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="jane@mechbazar.com" />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </Select>
        <p className="text-content-muted text-xs">
          They'll receive an email to set their own password -- no password is created or transmitted here.
        </p>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={handleClose} disabled={saving} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" isLoading={saving} disabled={saving} className="flex-1">
            Add Administrator
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RoleEditModal({
  target,
  onClose,
  token,
  currentUserId,
  onUpdated,
}: {
  target: StaffUser | null;
  onClose: () => void;
  token: string | null;
  currentUserId?: string;
  onUpdated: (staff: StaffUser) => void;
}) {
  const [role, setRole] = useState(target?.role || 'CUSTOMER_SUPPORT');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setRole(target?.role || 'CUSTOMER_SUPPORT');
    setError('');
  }, [target]);

  if (!target) return null;
  const isSelf = target.id === currentUserId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await axios.patch(
        `${API_URL}/admin/staff/${target.id}/role`,
        { role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Role updated.');
      onUpdated({ ...target, role: res.data.role, isActive: res.data.isActive });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to update role.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={!!target} onClose={onClose} title={`Change Role -- ${target.name || target.email}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-600 dark:text-danger-400">
            {error}
          </div>
        )}
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </Select>
        {isSelf && <p className="text-content-muted text-xs">You cannot change your own role away from Super Admin.</p>}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" isLoading={saving} disabled={saving || isSelf} className="flex-1">
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
