import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import {
  CreditCard,
  Store,
  Bike,
  Wrench,
  Building,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  ExternalLink
} from 'lucide-react';
import { Badge, Dialog, Input, Loader, Button } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

type PayoutType = 'VENDOR' | 'RIDER' | 'MECHANIC';

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

  const [settlements, setSettlements] = useState<Array<{ type: PayoutType; data: any }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeType, setActiveType] = useState<'ALL' | PayoutType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [selected, setSelected] = useState<{ type: PayoutType; data: any } | null>(null);
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
      const combined: Array<{ type: PayoutType; data: any }> = [];
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
        return <Badge variant="warning" className="!rounded-full flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> Pending</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" className="!rounded-full flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Completed</Badge>;
      case 'FAILED':
        return <Badge variant="danger" className="!rounded-full flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3" /> Failed</Badge>;
      default:
        return <Badge variant="neutral" className="!rounded-full">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: PayoutType) => {
    const cfg = TYPE_CONFIG[type];
    const variant: 'neutral' | 'warning' | 'success' = type === 'VENDOR' ? 'neutral' : type === 'RIDER' ? 'warning' : 'success';
    return (
      <Badge variant={variant} className="!rounded-full flex items-center gap-1 w-fit">
        <cfg.icon className="w-3 h-3" /> {cfg.label.replace(/s$/, '')}
      </Badge>
    );
  };

  // Pending count per type, shown as a badge on each tab -- the number an
  // admin actually cares about when deciding where to triage first.
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

  if (loading) {
    return <Loader fullScreen />;
  }

  const selectedEntity = selected ? TYPE_CONFIG[selected.type].getEntity(selected.data) : null;
  const selectedTypeLabel = selected ? TYPE_CONFIG[selected.type].label.replace(/s$/, '').toLowerCase() : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-primary" />
          Payouts
        </h1>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-warning-500/30 bg-warning-500/10 px-4 py-3 text-sm text-warning-300">
          {loadError}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-neutral-800">
        <button
          onClick={() => setActiveType('ALL')}
          className={`flex items-center px-4 py-3 border-b-2 transition-colors ${
            activeType === 'ALL'
              ? 'border-primary-500 text-primary-500 font-bold bg-neutral-950'
              : 'border-transparent text-neutral-300 hover:text-neutral-100 hover:bg-neutral-950/70'
          }`}
        >
          All Payouts
          <span className="ml-2 text-xs bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded-full">{settlements.length}</span>
        </button>
        {TYPE_ORDER.map((type) => {
          const cfg = TYPE_CONFIG[type];
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`flex items-center px-4 py-3 border-b-2 transition-colors ${
                activeType === type
                  ? 'border-primary-500 text-primary-500 font-bold bg-neutral-950'
                  : 'border-transparent text-neutral-300 hover:text-neutral-100 hover:bg-neutral-950/70'
              }`}
            >
              <cfg.icon className="w-4 h-4 mr-2" />
              {cfg.label}
              {pendingCounts[type] > 0 && (
                <span className="ml-2 text-xs bg-warning-500/20 text-warning-400 px-2 py-0.5 rounded-full">{pendingCounts[type]} pending</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-neutral-800 flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-neutral-950">
          <div>
            <h2 className="text-lg font-bold text-white">Settlement Requests</h2>
            <p className="text-neutral-400 text-sm mt-1">Review recent settlements across vendors, riders, and mechanics and update payout status.</p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full pl-9 pr-4 py-3 border border-neutral-800 rounded-2xl bg-neutral-950 text-neutral-100 placeholder:text-neutral-500 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wider border-b border-neutral-800">
                <th className="p-4 font-semibold">Date & Time</th>
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">Recipient</th>
                <th className="p-4 font-semibold">Amount</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filtered.map(({ type, data: s }) => (
                <tr key={`${type}-${s.id}`} className="hover:bg-neutral-900 transition-all duration-200 cursor-pointer group">
                  <td className="p-4">
                    <div className="text-white font-medium">{new Date(s.date).toLocaleDateString()}</div>
                    <div className="text-xs text-neutral-500">{new Date(s.date).toLocaleTimeString()}</div>
                  </td>
                  <td className="p-4">{getTypeBadge(type)}</td>
                  <td className="p-4">
                    <div className="text-white font-bold">{TYPE_CONFIG[type].getName(s)}</div>
                    <div className="text-xs text-neutral-500">{TYPE_CONFIG[type].getEntity(s)?.user?.phone}</div>
                  </td>
                  <td className="p-4">
                    <span className="text-white font-bold text-lg">₹{s.amount.toLocaleString()}</span>
                  </td>
                  <td className="p-4 space-y-2">
                    {getStatusBadge(s.status)}
                    {s.transactionId && (
                      <div className="text-xs text-neutral-500 mt-1 font-mono">Ref: {s.transactionId}</div>
                    )}
                  </td>
                  <td className="p-4">
                    <button
                      onClick={() => setSelected({ type, data: s })}
                      className="text-primary hover:bg-primary/10 px-4 py-2 rounded-2xl text-sm font-bold transition-all duration-200 border border-transparent hover:border-primary/20 flex items-center gap-2 opacity-90 group-hover:opacity-100"
                    >
                      View Details <ExternalLink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-500">
                    No payout requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <Dialog
          isOpen={!!selected}
          onClose={() => { setSelected(null); setError(''); setTransactionId(''); }}
          title="Process Payout"
          footer={
            <>
              <button
                onClick={() => { setSelected(null); setError(''); setTransactionId(''); }}
                className="w-full md:w-auto px-4 py-3 bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-2xl font-bold hover:bg-neutral-800 transition-colors"
              >
                Close
              </button>
              {selected.data.status === 'PENDING' && (
                <>
                  <Button variant="danger" onClick={() => handleUpdateStatus('FAILED')} disabled={isProcessing}>
                    Fail & Refund
                  </Button>
                  <Button onClick={() => handleUpdateStatus('COMPLETED')} isLoading={isProcessing}>
                    {isProcessing ? 'Saving...' : 'Mark Completed'}
                  </Button>
                </>
              )}
            </>
          }
        >
          <div className="flex justify-between items-start gap-4 mb-2">
            {getTypeBadge(selected.type)}
          </div>
          <div className="flex justify-between items-start gap-4 mb-6">
            <p className="text-neutral-400 text-sm">Transfer funds and record the transaction reference.</p>
            <div className="bg-primary/10 text-primary px-4 py-2 rounded-2xl font-bold text-lg whitespace-nowrap">
              ₹{selected.data.amount.toLocaleString()}
            </div>
          </div>

          <div className="mb-6 bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Building className="w-4 h-4" /> Bank Details
            </h3>

            {selectedEntity?.bankAccounts && selectedEntity.bankAccounts.length > 0 ? (
              <div className="space-y-3">
                <div className="flex justify-between text-neutral-400">
                  <span>Bank Name</span>
                  <span className="font-bold text-white">{selectedEntity.bankAccounts[0].bankName}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Account Holder</span>
                  <span className="font-bold text-white">{selectedEntity.bankAccounts[0].accountHolderName}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Account No.</span>
                  <span className="font-bold text-white font-mono">{selectedEntity.bankAccounts[0].accountNumber}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>IFSC Code</span>
                  <span className="font-bold text-white font-mono">{selectedEntity.bankAccounts[0].ifscCode}</span>
                </div>
              </div>
            ) : (
              <p className="text-danger-300 font-medium">No verified bank account found for this {selectedTypeLabel}.</p>
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

          {error && <p className="text-danger-300 text-sm mb-4 mt-4 bg-danger-500/10 p-3 rounded-2xl border border-danger-500/20">{error}</p>}
        </Dialog>
      )}
    </div>
  );
}
