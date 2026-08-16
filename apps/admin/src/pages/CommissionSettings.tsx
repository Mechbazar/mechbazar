import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import { Save, Trash2, Play, Search, ShieldAlert } from 'lucide-react';
import { Badge, Button, Card, DataTable, EmptyState, Icon3D, Input, Select, Tabs } from '../components/ui';
import type { Column, TabItem } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';

type SectionId = 'SETTINGS' | 'VENDOR' | 'CATEGORY' | 'ITEM';

const SECTIONS: TabItem[] = [
  { id: 'SETTINGS', label: 'Global & Rider Settings' },
  { id: 'VENDOR', label: 'Vendor Overrides' },
  { id: 'CATEGORY', label: 'Category Overrides' },
  { id: 'ITEM', label: 'Product & Service Overrides' },
];

type Settings = {
  defaultProductCommissionPct: number;
  defaultServiceCommissionPct: number;
  gatewayFeePercent: number;
  riderBasePickupFee: number;
  riderPerKmRate: number;
  riderWaitingChargePerMin: number;
  riderNightBonus: number;
  riderRainBonus: number;
  rainModeActive: boolean;
  riderWeeklyIncentive: number;
  riderMonthlyIncentive: number;
  riderWeeklyIncentiveJobs: number;
  riderMonthlyIncentiveJobs: number;
  defaultSettlementCycle: 'DAILY' | 'WEEKLY' | 'MONTHLY';
};

type OverrideRow = {
  id: string;
  entityName: string;
  commissionPercent: number;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  vendorId?: string;
  categoryId?: string;
  productId?: string;
  packageId?: string;
};

export default function CommissionSettings() {
  const { token, user } = useSelector((state: RootState) => state.auth);
  const [section, setSection] = useState<SectionId>('SETTINGS');

  // Reads are open to the broader admin set server-side, but every mutation
  // here (settings save, override set/delete/toggle, incentive runs) is
  // SUPER_ADMIN-only (commission.routes.ts). Without this check, a non-super
  // admin saw every control rendered as if it worked, and only found out via
  // a silent inline 403 after clicking Save -- mirrors AdminManagement.tsx's
  // existing isSuperAdmin gate for the same class of problem.
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
          <Icon3D name="gear" size={30} eager /> Commission &amp; Payout Settings
        </h1>
        <p className="text-content-secondary mt-1 text-sm">
          Everything here is applied to new orders and bookings immediately -- no redeploy required. Only Super Admins can make changes.
        </p>
      </div>

      {!isSuperAdmin && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning-500/30 bg-warning-500/10 px-4 py-3 text-sm text-warning-700 dark:text-warning-400">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Only Super Admins can change commission and payout settings. You can view everything below, but saving is disabled.</span>
        </div>
      )}

      <Card padding="none" className="overflow-visible">
        <div className="p-4 border-b border-border-default">
          <Tabs tabs={SECTIONS} value={section} onChange={(id) => setSection(id as SectionId)} layoutId="commission-settings-tab" />
        </div>
        <div className="p-5 sm:p-6">
          {section === 'SETTINGS' && <SettingsPanel token={token} readOnly={!isSuperAdmin} />}
          {section === 'VENDOR' && <VendorOverridesPanel token={token} readOnly={!isSuperAdmin} />}
          {section === 'CATEGORY' && <CategoryOverridesPanel token={token} readOnly={!isSuperAdmin} />}
          {section === 'ITEM' && <ItemOverridesPanel token={token} readOnly={!isSuperAdmin} />}
        </div>
      </Card>
    </motion.div>
  );
}

// ============ Global & Rider Settings ============

function SettingsPanel({ token, readOnly }: { token: string | null; readOnly: boolean }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [incentiveBusy, setIncentiveBusy] = useState<'WEEKLY' | 'MONTHLY' | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios.get(`${API_URL}/admin/commission/settings`, { headers })
      .then((res) => setSettings(res.data))
      .catch((e) => setError(e.response?.data?.error || 'Failed to load settings'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const update = (field: keyof Settings, value: any) => setSettings((s) => (s ? { ...s, [field]: value } : s));

  const handleSave = async () => {
    if (!settings || readOnly) return;
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await axios.put(`${API_URL}/admin/commission/settings`, settings, { headers });
      setSettings(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const runIncentives = async (period: 'WEEKLY' | 'MONTHLY') => {
    if (readOnly) return;
    setIncentiveBusy(period);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/admin/commission/rider-incentives/run`, { period }, { headers });
      alert(`Paid ${res.data.ridersPaid} rider(s) a ₹${res.data.incentiveAmount} ${period.toLowerCase()} incentive.`);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to run incentives');
    } finally {
      setIncentiveBusy(null);
    }
  };

  if (loading) return <div className="text-content-muted text-sm py-8 text-center">Loading settings…</div>;
  if (!settings) return <div className="text-danger-500 text-sm py-8 text-center">{error || 'Could not load settings'}</div>;

  return (
    <div className="space-y-8">
      {error && <div className="rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-600 dark:text-danger-400">{error}</div>}

      <section>
        <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider mb-3">Default Commission</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label="Default Product Commission (%)" type="number" min={0} max={100} step={0.1}
            value={settings.defaultProductCommissionPct}
            onChange={(e) => update('defaultProductCommissionPct', Number(e.target.value))} />
          <Input label="Default Service Commission (%)" type="number" min={0} max={100} step={0.1}
            value={settings.defaultServiceCommissionPct}
            onChange={(e) => update('defaultServiceCommissionPct', Number(e.target.value))} />
          <Input label="Payment Gateway Fee (%)" type="number" min={0} max={100} step={0.1}
            value={settings.gatewayFeePercent}
            onChange={(e) => update('gatewayFeePercent', Number(e.target.value))}
            helperText="Applied only to Razorpay-paid amounts at settlement." />
          <Select label="Default Settlement Cycle" value={settings.defaultSettlementCycle}
            onChange={(e) => update('defaultSettlementCycle', e.target.value)}>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </Select>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider mb-3">Rider Payout Formula</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label="Base Pickup Fee (₹)" type="number" min={0} step={0.5}
            value={settings.riderBasePickupFee}
            onChange={(e) => update('riderBasePickupFee', Number(e.target.value))} />
          <Input label="Per Kilometer Rate (₹)" type="number" min={0} step={0.5}
            value={settings.riderPerKmRate}
            onChange={(e) => update('riderPerKmRate', Number(e.target.value))} />
          <Input label="Waiting Charge / min (₹)" type="number" min={0} step={0.5}
            value={settings.riderWaitingChargePerMin}
            onChange={(e) => update('riderWaitingChargePerMin', Number(e.target.value))}
            helperText="Rate configured for a future tracked-waiting-time flow." />
          <Input label="Night Bonus (₹)" type="number" min={0} step={0.5}
            value={settings.riderNightBonus}
            onChange={(e) => update('riderNightBonus', Number(e.target.value))}
            helperText="Applied for deliveries completed 10pm-6am." />
          <Input label="Rain Bonus (₹)" type="number" min={0} step={0.5}
            value={settings.riderRainBonus}
            onChange={(e) => update('riderRainBonus', Number(e.target.value))} />
          <label className="flex items-center gap-2.5 mt-1.5 self-end pb-2.5">
            <input type="checkbox" checked={settings.rainModeActive}
              onChange={(e) => update('rainModeActive', e.target.checked)}
              className="h-4 w-4 rounded border-border-default accent-brand-primary" />
            <span className="text-sm text-content-primary">Rain mode active (applies rain bonus now)</span>
          </label>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider mb-3">Rider Incentives</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Weekly Incentive (₹)" type="number" min={0} step={0.5}
                value={settings.riderWeeklyIncentive}
                onChange={(e) => update('riderWeeklyIncentive', Number(e.target.value))} />
              <Input label="Jobs needed (7d)" type="number" min={0} step={1}
                value={settings.riderWeeklyIncentiveJobs}
                onChange={(e) => update('riderWeeklyIncentiveJobs', Number(e.target.value))} />
            </div>
            <Button variant="secondary" size="sm" icon={<Play size={14} />} isLoading={incentiveBusy === 'WEEKLY'} disabled={readOnly} onClick={() => runIncentives('WEEKLY')}>
              Run weekly incentive payout
            </Button>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Monthly Incentive (₹)" type="number" min={0} step={0.5}
                value={settings.riderMonthlyIncentive}
                onChange={(e) => update('riderMonthlyIncentive', Number(e.target.value))} />
              <Input label="Jobs needed (30d)" type="number" min={0} step={1}
                value={settings.riderMonthlyIncentiveJobs}
                onChange={(e) => update('riderMonthlyIncentiveJobs', Number(e.target.value))} />
            </div>
            <Button variant="secondary" size="sm" icon={<Play size={14} />} isLoading={incentiveBusy === 'MONTHLY'} disabled={readOnly} onClick={() => runIncentives('MONTHLY')}>
              Run monthly incentive payout
            </Button>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-border-default">
        <Button icon={<Save size={16} />} isLoading={saving} disabled={readOnly} onClick={handleSave}>Save Settings</Button>
        {saved && <span className="text-sm text-success-600 dark:text-success-400 font-medium">Saved</span>}
      </div>
    </div>
  );
}

// ============ Shared override list + inline edit row ============

function OverrideTable({
  rows, onDelete, onToggleActive, readOnly,
}: {
  rows: OverrideRow[];
  onDelete: (row: OverrideRow) => void;
  onToggleActive: (row: OverrideRow) => void;
  readOnly: boolean;
}) {
  const columns: Column<OverrideRow>[] = [
    { key: 'name', header: 'Name', render: (r) => <span className="font-medium text-content-primary">{r.entityName}</span> },
    { key: 'pct', header: 'Commission %', render: (r) => <span className="font-bold">{r.commissionPercent}%</span> },
    {
      key: 'active',
      header: 'Status',
      render: (r) => (
        <button onClick={() => !readOnly && onToggleActive(r)} disabled={readOnly} className={readOnly ? 'cursor-default' : 'cursor-pointer'}>
          <Badge variant={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
        </button>
      ),
    },
    {
      key: 'window',
      header: 'Effective Window',
      render: (r) => (
        <span className="text-xs text-content-muted">
          {r.validFrom ? new Date(r.validFrom).toLocaleDateString() : 'Always'} — {r.validTo ? new Date(r.validTo).toLocaleDateString() : 'Ongoing'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (r) => (
        <button
          onClick={() => !readOnly && onDelete(r)}
          disabled={readOnly}
          className="text-danger-500 hover:bg-danger-500/10 p-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          aria-label="Remove override"
        >
          <Trash2 size={15} />
        </button>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      rowKey={(r) => r.id}
      pageSize={8}
      emptyState={<EmptyState icon="gear" title="No overrides set" description="Any entity without an override falls back to the category or global default." />}
      className="rounded-xl"
    />
  );
}

// ============ Vendor Overrides ============

function VendorOverridesPanel({ token, readOnly }: { token: string | null; readOnly: boolean }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [pct, setPct] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    axios.get(`${API_URL}/admin/commission/overrides/vendor`, { headers }).then((res) => setOverrides(res.data));
    axios.get(`${API_URL}/vendors`, { headers }).then((res) => {
      const list = (res.data || [])
        .filter((u: any) => u.vendorProfile)
        .map((u: any) => ({ id: u.vendorProfile.id, name: u.vendorProfile.storeName as string }));
      setVendors(list);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const matches = useMemo(() => {
    if (!search.trim()) return [];
    const term = search.toLowerCase();
    return vendors.filter((v) => v.name.toLowerCase().includes(term)).slice(0, 8);
  }, [search, vendors]);

  const handleSet = async () => {
    if (readOnly) return;
    const value = Number(pct);
    if (!selectedVendorId || !Number.isFinite(value) || value < 0 || value > 100) {
      setError('Pick a vendor and enter a commission % between 0 and 100.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await axios.put(`${API_URL}/admin/commission/overrides/vendor/${selectedVendorId}`, { commissionPercent: value, isActive: true }, { headers });
      setSelectedVendorId('');
      setSearch('');
      setPct('');
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save override');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row: OverrideRow) => {
    if (readOnly) return;
    await axios.delete(`${API_URL}/admin/commission/overrides/vendor/${row.vendorId}`, { headers });
    load();
  };
  const handleToggle = async (row: OverrideRow) => {
    if (readOnly) return;
    await axios.put(`${API_URL}/admin/commission/overrides/vendor/${row.vendorId}`, { commissionPercent: row.commissionPercent, isActive: !row.isActive }, { headers });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end bg-surface-sunken border border-border-default rounded-xl p-4">
        <div className="relative flex-1 w-full">
          <Input
            label="Vendor"
            placeholder="Search vendor by name…"
            icon={<Search size={15} />}
            value={selectedVendorId ? vendors.find((v) => v.id === selectedVendorId)?.name || '' : search}
            onChange={(e) => { setSearch(e.target.value); setSelectedVendorId(''); }}
          />
          {matches.length > 0 && !selectedVendorId && (
            <div className="absolute z-10 mt-1 w-full bg-surface-overlay border border-border-default rounded-xl shadow-popover overflow-hidden">
              {matches.map((v) => (
                <button key={v.id} onClick={() => { setSelectedVendorId(v.id); setSearch(v.name); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-surface-hover text-content-primary">
                  {v.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <Input label="Commission %" type="number" min={0} max={100} step={0.1} value={pct} onChange={(e) => setPct(e.target.value)} className="w-32" />
        <Button icon={<Save size={16} />} isLoading={busy} disabled={readOnly} onClick={handleSet}>Set Override</Button>
      </div>
      {error && <div className="text-sm text-danger-500">{error}</div>}
      <OverrideTable rows={overrides} onDelete={handleDelete} onToggleActive={handleToggle} readOnly={readOnly} />
    </div>
  );
}

// ============ Category Overrides (product + service) ============

function CategoryOverridesPanel({ token, readOnly }: { token: string | null; readOnly: boolean }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [kind, setKind] = useState<'category' | 'service-category'>('category');
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [pct, setPct] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    axios.get(`${API_URL}/admin/commission/overrides/${kind}`, { headers }).then((res) => setOverrides(res.data));
    const catUrl = kind === 'category' ? `${API_URL}/categories` : `${API_URL}/services/categories`;
    axios.get(catUrl, { headers }).then((res) => setCategories((res.data || []).map((c: any) => ({ id: c.id, name: c.name }))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, token]);

  useEffect(() => { setSelectedId(''); setPct(''); load(); }, [load]);

  const handleSet = async () => {
    if (readOnly) return;
    const value = Number(pct);
    if (!selectedId || !Number.isFinite(value) || value < 0 || value > 100) {
      setError('Pick a category and enter a commission % between 0 and 100.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await axios.put(`${API_URL}/admin/commission/overrides/${kind}/${selectedId}`, { commissionPercent: value, isActive: true }, { headers });
      setSelectedId('');
      setPct('');
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save override');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row: OverrideRow) => {
    if (readOnly) return;
    await axios.delete(`${API_URL}/admin/commission/overrides/${kind}/${row.categoryId}`, { headers });
    load();
  };
  const handleToggle = async (row: OverrideRow) => {
    if (readOnly) return;
    await axios.put(`${API_URL}/admin/commission/overrides/${kind}/${row.categoryId}`, { commissionPercent: row.commissionPercent, isActive: !row.isActive }, { headers });
    load();
  };

  return (
    <div className="space-y-6">
      <Tabs
        tabs={[{ id: 'category', label: 'Product Categories' }, { id: 'service-category', label: 'Service Categories' }]}
        value={kind}
        onChange={(id) => setKind(id as 'category' | 'service-category')}
        layoutId="category-override-kind"
      />
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end bg-surface-sunken border border-border-default rounded-xl p-4">
        <Select label="Category" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="flex-1 w-full">
          <option value="">Select a category…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input label="Commission %" type="number" min={0} max={100} step={0.1} value={pct} onChange={(e) => setPct(e.target.value)} className="w-32" />
        <Button icon={<Save size={16} />} isLoading={busy} disabled={readOnly} onClick={handleSet}>Set Override</Button>
      </div>
      {error && <div className="text-sm text-danger-500">{error}</div>}
      <OverrideTable rows={overrides} onDelete={handleDelete} onToggleActive={handleToggle} readOnly={readOnly} />
    </div>
  );
}

// ============ Product / Service Package Overrides ============

function ItemOverridesPanel({ token, readOnly }: { token: string | null; readOnly: boolean }) {
  const headers = { Authorization: `Bearer ${token}` };
  const [kind, setKind] = useState<'product' | 'service-package'>('product');
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<{ id: string; name: string }[]>([]);
  const [allPackages, setAllPackages] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [pct, setPct] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    axios.get(`${API_URL}/admin/commission/overrides/${kind}`, { headers }).then((res) => setOverrides(res.data));
    if (kind === 'service-package') {
      axios.get(`${API_URL}/services/packages`, { headers }).then((res) =>
        setAllPackages((res.data || []).map((p: any) => ({ id: p.id, name: p.name })))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, token]);

  useEffect(() => { setSelected(null); setSearch(''); setPct(''); setCandidates([]); load(); }, [load]);

  // Products: server-side search-as-you-type (catalog can run to thousands).
  useEffect(() => {
    if (kind !== 'product' || search.trim().length < 2) { setCandidates([]); return; }
    const handle = setTimeout(() => {
      axios.get(`${API_URL}/products`, { headers, params: { search, limit: 8 } })
        .then((res) => setCandidates((res.data || []).map((p: any) => ({ id: p.id, name: p.name }))));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, kind]);

  // Service packages: small bounded list, filter client-side.
  const packageMatches = useMemo(() => {
    if (kind !== 'service-package' || !search.trim()) return [];
    const term = search.toLowerCase();
    return allPackages.filter((p) => p.name.toLowerCase().includes(term)).slice(0, 8);
  }, [kind, search, allPackages]);

  const matches = kind === 'product' ? candidates : packageMatches;
  const idField = kind === 'product' ? 'productId' : 'packageId';

  const handleSet = async () => {
    if (readOnly) return;
    const value = Number(pct);
    if (!selected || !Number.isFinite(value) || value < 0 || value > 100) {
      setError(`Pick a ${kind === 'product' ? 'product' : 'service'} and enter a commission % between 0 and 100.`);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await axios.put(`${API_URL}/admin/commission/overrides/${kind}/${selected.id}`, { commissionPercent: value, isActive: true }, { headers });
      setSelected(null);
      setSearch('');
      setPct('');
      load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save override');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (row: OverrideRow) => {
    if (readOnly) return;
    await axios.delete(`${API_URL}/admin/commission/overrides/${kind}/${(row as any)[idField]}`, { headers });
    load();
  };
  const handleToggle = async (row: OverrideRow) => {
    if (readOnly) return;
    await axios.put(`${API_URL}/admin/commission/overrides/${kind}/${(row as any)[idField]}`, { commissionPercent: row.commissionPercent, isActive: !row.isActive }, { headers });
    load();
  };

  return (
    <div className="space-y-6">
      <Tabs
        tabs={[{ id: 'product', label: 'Products' }, { id: 'service-package', label: 'Services' }]}
        value={kind}
        onChange={(id) => setKind(id as 'product' | 'service-package')}
        layoutId="item-override-kind"
      />
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end bg-surface-sunken border border-border-default rounded-xl p-4">
        <div className="relative flex-1 w-full">
          <Input
            label={kind === 'product' ? 'Product' : 'Service'}
            placeholder={`Search ${kind === 'product' ? 'product' : 'service'} by name…`}
            icon={<Search size={15} />}
            value={selected ? selected.name : search}
            onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
          />
          {matches.length > 0 && !selected && (
            <div className="absolute z-10 mt-1 w-full bg-surface-overlay border border-border-default rounded-xl shadow-popover overflow-hidden max-h-64 overflow-y-auto">
              {matches.map((m) => (
                <button key={m.id} onClick={() => { setSelected(m); setSearch(m.name); }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-surface-hover text-content-primary">
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <Input label="Commission %" type="number" min={0} max={100} step={0.1} value={pct} onChange={(e) => setPct(e.target.value)} className="w-32" />
        <Button icon={<Save size={16} />} isLoading={busy} disabled={readOnly} onClick={handleSet}>Set Override</Button>
      </div>
      {error && <div className="text-sm text-danger-500">{error}</div>}
      <OverrideTable rows={overrides} onDelete={handleDelete} onToggleActive={handleToggle} readOnly={readOnly} />
    </div>
  );
}
