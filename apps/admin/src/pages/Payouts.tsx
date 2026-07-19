import { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { 
  CreditCard,
  Building,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  ExternalLink
} from 'lucide-react';
import { Badge, Dialog, Input, Loader, Button } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function Payouts() {
  const { token } = useSelector((state: RootState) => state.auth);
  
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedSettlement, setSelectedSettlement] = useState<any | null>(null);
  const [transactionId, setTransactionId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');

  const fetchSettlements = async () => {
    try {
      const res = await axios.get(`${API_URL}/vendors/settlements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSettlements(res.data);
    } catch (err) {
      console.error('Error fetching settlements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettlements();
  }, [token]);

  const handleUpdateStatus = async (status: string) => {
    if (!selectedSettlement) return;
    
    if (status === 'COMPLETED' && !transactionId.trim()) {
      setError('Transaction ID is required to mark as completed.');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      await axios.patch(`${API_URL}/vendors/settlements/${selectedSettlement.id}/status`, 
        { status, transactionId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      await fetchSettlements();
      setSelectedSettlement(null);
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
        return <Badge variant="warning" className="!rounded-full flex items-center gap-1 w-fit"><Clock className="w-3 h-3"/> Pending</Badge>;
      case 'COMPLETED':
        return <Badge variant="success" className="!rounded-full flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3"/> Completed</Badge>;
      case 'FAILED':
        return <Badge variant="danger" className="!rounded-full flex items-center gap-1 w-fit"><AlertCircle className="w-3 h-3"/> Failed</Badge>;
      default:
        return <Badge variant="neutral" className="!rounded-full">{status}</Badge>;
    }
  };

  const filteredSettlements = settlements.filter(s => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (s.vendor?.storeName && s.vendor.storeName.toLowerCase().includes(term)) ||
             (s.vendor?.user?.phone && s.vendor.user.phone.includes(term));
    }
    return true;
  });

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <CreditCard className="w-8 h-8 text-primary" />
          Vendor Payouts
        </h1>
      </div>

      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-neutral-800 flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-neutral-950">
          <div>
            <h2 className="text-lg font-bold text-white">Settlement Requests</h2>
            <p className="text-neutral-400 text-sm mt-1">Review recent vendor settlements and update payout status.</p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vendors..." 
              className="w-full pl-9 pr-4 py-3 border border-neutral-800 rounded-2xl bg-neutral-950 text-neutral-100 placeholder:text-neutral-500 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-colors"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-950 text-neutral-400 text-xs uppercase tracking-wider border-b border-neutral-800">
                <th className="p-4 font-semibold">Date & Time</th>
                <th className="p-4 font-semibold">Vendor</th>
                <th className="p-4 font-semibold">Amount</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filteredSettlements.map((s: any) => (
                <tr key={s.id} className="hover:bg-neutral-900 transition-all duration-200 cursor-pointer group">
                  <td className="p-4">
                    <div className="text-white font-medium">{new Date(s.date).toLocaleDateString()}</div>
                    <div className="text-xs text-neutral-500">{new Date(s.date).toLocaleTimeString()}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-white font-bold">{s.vendor?.storeName || 'Unknown Vendor'}</div>
                    <div className="text-xs text-neutral-500">{s.vendor?.user?.phone}</div>
                  </td>
                  <td className="p-4">
                    <span className="text-white font-bold text-lg">
                      ₹{s.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="p-4 space-y-2">
                    {getStatusBadge(s.status)}
                    {s.transactionId && (
                      <div className="text-xs text-neutral-500 mt-1 font-mono">Ref: {s.transactionId}</div>
                    )}
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => setSelectedSettlement(s)}
                      className="text-primary hover:bg-primary/10 px-4 py-2 rounded-2xl text-sm font-bold transition-all duration-200 border border-transparent hover:border-primary/20 flex items-center gap-2 opacity-90 group-hover:opacity-100"
                    >
                      View Details <ExternalLink className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {settlements.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-neutral-500">
                    No payout requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSettlement && (
        <Dialog
          isOpen={!!selectedSettlement}
          onClose={() => { setSelectedSettlement(null); setError(''); setTransactionId(''); }}
          title="Process Payout"
          footer={
            <>
              <button
                onClick={() => { setSelectedSettlement(null); setError(''); setTransactionId(''); }}
                className="w-full md:w-auto px-4 py-3 bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-2xl font-bold hover:bg-neutral-800 transition-colors"
              >
                Close
              </button>
              {selectedSettlement.status === 'PENDING' && (
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
              <div className="flex justify-between items-start gap-4 mb-6">
                <p className="text-neutral-400 text-sm">Transfer funds and record the transaction reference.</p>
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-2xl font-bold text-lg whitespace-nowrap">
                  ₹{selectedSettlement.amount.toLocaleString()}
                </div>
              </div>

              <div className="mb-6 bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Building className="w-4 h-4" /> Bank Details
                </h3>

                {selectedSettlement.vendor?.bankAccounts && selectedSettlement.vendor.bankAccounts.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-neutral-400">
                      <span>Bank Name</span>
                      <span className="font-bold text-white">{selectedSettlement.vendor.bankAccounts[0].bankName}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Account Holder</span>
                      <span className="font-bold text-white">{selectedSettlement.vendor.bankAccounts[0].accountHolderName}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Account No.</span>
                      <span className="font-bold text-white font-mono">{selectedSettlement.vendor.bankAccounts[0].accountNumber}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>IFSC Code</span>
                      <span className="font-bold text-white font-mono">{selectedSettlement.vendor.bankAccounts[0].ifscCode}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-danger-300 font-medium">No verified bank account found for this vendor.</p>
                )}
              </div>

              {selectedSettlement.status === 'PENDING' && (
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
