import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import type { RootState } from '../store';
import {
  Store,
  Bike,
  Wrench,
  Building,
  CheckCircle,
  Clock,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Badge, Button, Card, DataTable, EmptyState, Icon3D, Input, Modal, Tabs } from '../components/ui';
import type { Column, TabItem } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';

type PayoutType = 'VENDOR' | 'RIDER' | 'MECHANIC';
type Settlement = { type: PayoutType; data: any };

// One config per recipient type -- everything that differs between the three
// settlement APIs (list endpoint, status endpoint, and how to pull a
// name/entity out of an otherwise-identical settlement row) lives here so the
// rest of the page never branches on type by hand. This replaced three
// separate near-identical pages (Payouts/RiderPayouts/TechnicianPayouts)
// that only differed in these fields.
const TYPE_CONFIG: Record<PayoutType, {
  label: string;
  icon: typeof Store;
  listPath: string;
  statusPath: (id: string) => string;
  getEntity: (s: any) => any;
  getName: (s: any) => string;
}> = {
  VENDOR: {
    label: 'Vendors',
    icon: Store,
    listPath: '/vendors/settlements',
    statusPath: (id) => `/vendors/settlements/${id}/status`,
    getEntity: (s) => s.vendor,
    getName: (s) => s.vendor?.storeName || 'Unknown Vendor',
  },
  RIDER: {
    label: 'Riders',
    icon: Bike,
    listPath: '/riders/settlements',
    statusPath: (id) => `/riders/settlements/${id}/status`,
    getEntity: (s) => s.deliveryPartner,
    getName: (s) => s.deliveryPartner?.user?.name || 'Unknown Rider',
  },
  MECHANIC: {
    label: 'Mechanics',
    icon: Wrench,
    listPath: '/technicians/settlements',
    statusPath: (id) => `/technicians/settlements/${id}/status`,
    getEntity: (s) => s.technician,
    getName: (s) => s.technician?.user?.name || 'Unknown Technician',
  },
};

const TYPE_ORDER: PayoutType[] = ['VENDOR', 'RIDER', 'MECHANIC'];

export default function Payouts() {
  const { token } = useSelector((state: RootState) => state.auth);

  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeType, setActiveType] = useState<'ALL' | PayoutType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [selected, setSelected] = useState<Settlement | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const fetchAll = async () => {
    try {
      setLoadError('');
      const results = await Promise.allSettled(
        TYPE_ORDER.map((type) =>
          axios.get(`${API_URL}${TYPE_CONFIG[type].listPath}`, { headers: { Authorization: `Bearer ${token}` } })
        )
      );
      const combined: Settlement[] = [];
      let anyFailed = false;
      results.forEach((res, i) => {
        const type = TYPE_ORDER[i];
        if (res.status === 'fulfilled') {
          res.value.data.forEach((s: any) => combined.push({ type, data: s }));
        } else {
          anyFailed = true;
          console.error(`Error fetching ${type} settlements:`, res.reason);
        }
      });
      combined.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());
      setSettlements(combined);
      if (anyFailed) setLoadError('Some payout types failed to load -- the list below may be incomplete.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleUpdateStatus = async (status: string) => {
    if (!selected) return;

    if (status === 'COMPLETED' && !transactionId.trim()) {
      setError('Transaction ID is required to mark as completed.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      await axios.patch(
        `${API_URL}${TYPE_CONFIG[selected.type].statusPath(selected.data.id)}`,
        { status, transactionId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await fetchAll();
      setSelected(null);
      setTransactionId('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update status.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'PROCESSING':
        return <Badge variant="warning" className="flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> Pending</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" className="flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Completed</Badge>;
      case 'FAILED':
        return <Badge variant="danger" className="flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3" /> Failed</Badge>;
      default:
        return <Badge variant="neutral" className="w-fit">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: PayoutType) => {
    const cfg = TYPE_CONFIG[type];
    const variant: 'neutral' | 'warning' | 'success' = type === 'VENDOR' ? 'neutral' : type === 'RIDER' ? 'warning' : 'success';
    return (
      <Badge variant={variant} className="flex items-center gap-1 w-fit">
        <cfg.icon className="w-3 h-3" /> {cfg.label.replace(/s$/, '')}
      </Badge>
    );
  };

  // Pending count per type, shown on each tab -- the number an admin
  // actually cares about when deciding where to triage first.
  const pendingCounts = useMemo(() => {
    const counts: Record<PayoutType, number> = { VENDOR: 0, RIDER: 0, MECHANIC: 0 };
    settlements.forEach(({ type, data }) => {
      if (data.status === 'PENDING' || data.status === 'PROCESSING') counts[type]++;
    });
    return counts;
  }, [settlements]);

  const filtered = useMemo(() => {
    return settlements.filter(({ type, data }) => {
      if (activeType !== 'ALL' && type !== activeType) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const name = TYPE_CONFIG[type].getName(data).toLowerCase();
        const phone = TYPE_CONFIG[type].getEntity(data)?.user?.phone || '';
        if (!name.includes(term) && !phone.includes(term)) return false;
      }
      return true;
    });
  }, [settlements, activeType, searchTerm]);

  const TABS: TabItem[] = [
    { id: 'ALL', label: `All Payouts (${settlements.length})` },
    ...TYPE_ORDER.map((type) => ({
      id: type,
      label: pendingCounts[type] > 0 ? `${TYPE_CONFIG[type].label} · ${pendingCounts[type]} pending` : TYPE_CONFIG[type].label,
    })),
  ];

  const columns: Column<Settlement>[] = [
    {
      key: 'date',
      header: 'Date & Time',
      render: (s) => (
        <div>
          <div className="font-medium text-content-primary">{new Date(s.data.date).toLocaleDateString()}</div>
          <div className="text-xs text-content-muted">{new Date(s.data.date).toLocaleTimeString()}</div>
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (s) => getTypeBadge(s.type) },
    {
      key: 'recipient',
      header: 'Recipient',
      render: (s) => (
        <div>
          <div className="font-semibold text-content-primary">{TYPE_CONFIG[s.type].getName(s.data)}</div>
          <div className="text-xs text-content-muted">{TYPE_CONFIG[s.type].getEntity(s.data)?.user?.phone}</div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (s) => <span className="font-bold text-content-primary text-base">₹{s.data.amount.toLocaleString()}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <div className="space-y-1">
          {getStatusBadge(s.data.status)}
          {s.data.transactionId && <div className="text-xs text-content-muted font-mono">Ref: {s.data.transactionId}</div>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (s) => (
        <button
          onClick={() => setSelected(s)}
          className="text-brand-primary hover:bg-brand-primary/10 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1.5 ml-auto"
        >
          View Details <ExternalLink className="w-4 h-4" />
        </button>
      ),
    },
  ];

  const selectedEntity = selected ? TYPE_CONFIG[selected.type].getEntity(selected.data) : null;
  const selectedTypeLabel = selected ? TYPE_CONFIG[selected.type].label.replace(/s$/, '').toLowerCase() : '';

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-content-primary tracking-tight flex items-center gap-3">
            <Icon3D name="payouts" size={30} eager /> Payouts
          </h1>
          <p className="text-content-secondary mt-1 text-sm">Review recent settlements across vendors, riders, and mechanics and update payout status.</p>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-warning-500/30 bg-warning-500/10 px-4 py-3 text-sm text-warning-600 dark:text-warning-400">
          {loadError}
        </div>
      )}

      <Card padding="none" className="overflow-visible">
        <div className="p-4 border-b border-border-default flex flex-wrap gap-3 justify-between items-center">
          <Tabs tabs={TABS} value={activeType} onChange={(id) => setActiveType(id as 'ALL' | PayoutType)} layoutId="payouts-tab" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or phone…"
            className="bg-surface-sunken border border-border-default rounded-xl pl-4 pr-4 py-2 text-sm text-content-primary outline-none focus:border-brand-primary w-64"
          />
        </div>

        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(s) => `${s.type}-${s.data.id}`}
          loading={loading}
          pageSize={10}
          emptyState={<EmptyState icon="payouts" title="No payout requests found" description="Try a different tab or search term." />}
          className="rounded-none border-none shadow-none"
        />
      </Card>

      <Modal
        isOpen={!!selected}
        onClose={() => { setSelected(null); setError(''); setTransactionId(''); }}
        title="Process Payout"
        footer={selected && (
          <>
            <Button variant="secondary" onClick={() => { setSelected(null); setError(''); setTransactionId(''); }}>Close</Button>
            {selected.data.status === 'PENDING' && (
              <>
                <Button variant="danger" onClick={() => handleUpdateStatus('FAILED')} disabled={isProcessing}>
                  Fail & Refund
                </Button>
                <Button onClick={() => handleUpdateStatus('COMPLETED')} isLoading={isProcessing}>
                  Mark Completed
                </Button>
              </>
            )}
          </>
        )}
      >
        {selected && (
          <>
            <div className="flex justify-between items-start gap-4 mb-2">
              {getTypeBadge(selected.type)}
            </div>
            <div className="flex justify-between items-start gap-4 mb-6">
              <p className="text-content-secondary text-sm">Transfer funds and record the transaction reference.</p>
              <div className="bg-brand-primary/10 text-brand-primary px-4 py-2 rounded-xl font-bold text-lg whitespace-nowrap">
                ₹{selected.data.amount.toLocaleString()}
              </div>
            </div>

            <div className="mb-6 bg-surface-sunken p-4 rounded-xl border border-border-default">
              <h3 className="text-sm font-bold text-content-muted uppercase tracking-wider mb-3 flex items-center gap-2">
                <Building className="w-4 h-4" /> Bank Details
              </h3>

              {selectedEntity?.bankAccounts && selectedEntity.bankAccounts.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex justify-between text-content-secondary">
                    <span>Bank Name</span>
                    <span className="font-bold text-content-primary">{selectedEntity.bankAccounts[0].bankName}</span>
                  </div>
                  <div className="flex justify-between text-content-secondary">
                    <span>Account Holder</span>
                    <span className="font-bold text-content-primary">{selectedEntity.bankAccounts[0].accountHolderName}</span>
                  </div>
                  <div className="flex justify-between text-content-secondary">
                    <span>Account No.</span>
                    <span className="font-bold text-content-primary font-mono">{selectedEntity.bankAccounts[0].accountNumber}</span>
                  </div>
                  <div className="flex justify-between text-content-secondary">
                    <span>IFSC Code</span>
                    <span className="font-bold text-content-primary font-mono">{selectedEntity.bankAccounts[0].ifscCode}</span>
                  </div>
                </div>
              ) : (
                <p className="text-danger-600 dark:text-danger-400 font-medium">No verified bank account found for this {selectedTypeLabel}.</p>
              )}
            </div>

            {selected.data.status === 'PENDING' && (
              <Input
                label="Bank Transaction Reference ID"
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. UTR123456789"
                helperText="Enter this after you have successfully transferred the funds via your bank portal."
              />
            )}

            {error && <p className="text-danger-600 dark:text-danger-400 text-sm mt-4 bg-danger-500/10 p-3 rounded-xl border border-danger-500/20">{error}</p>}
          </>
        )}
      </Modal>
    </motion.div>
  );
}
