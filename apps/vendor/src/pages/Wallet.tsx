import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { 
  Wallet as WalletIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Building,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import { Badge, Dialog, Loader, Button } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function Wallet() {
  const { token } = useSelector((state: RootState) => state.auth);
  
  const [balance, setBalance] = useState<number>(0);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchWalletDetails = async () => {
    try {
      const res = await axios.get(`${API_URL}/vendors/wallet`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBalance(res.data.walletBalance);
      setBankAccounts(res.data.bankAccounts);
      setSettlements(res.data.settlements);
    } catch (err) {
      console.error('Error fetching wallet details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletDetails();
  }, [token]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const amt = parseFloat(withdrawAmount);
    
    if (!amt || amt <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    
    if (amt > balance) {
      setError('Amount exceeds available balance.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/vendors/wallet/withdraw`, 
        { amount: amt }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setBalance(res.data.walletBalance);
      setSettlements([res.data.settlement, ...settlements]);
      setIsModalOpen(false);
      setWithdrawAmount('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to process withdrawal.');
    } finally {
      setSubmitting(false);
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

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-content-primary flex items-center">
          <WalletIcon className="w-8 h-8 mr-3 text-brand-secondary" />
          Wallet & Payouts
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-brand-secondary/20 to-brand-primary border border-brand-secondary/30 rounded-2xl p-8 relative overflow-hidden md:col-span-1 shadow-[0_0_30px_rgba(35,178,82,0.1)]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-secondary/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          
          <h3 className="text-gray-400 font-medium mb-1 relative z-10">Available Balance</h3>
          <p className="text-5xl font-extrabold text-white mb-6 relative z-10">
            <span className="text-3xl text-gray-400 mr-1">₹</span>
            {balance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-brand-secondary hover:bg-green-500 text-black font-bold py-3 rounded-xl transition-colors relative z-10 flex items-center justify-center gap-2"
          >
            <ArrowUpRight className="w-5 h-5" />
            Request Payout
          </button>
        </div>

        {/* Bank Accounts */}
        <div className="bg-surface-card border border-border-default rounded-2xl p-6 md:col-span-2">
          <h3 className="text-xl font-bold text-content-primary mb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-content-secondary" />
            Connected Bank Accounts
          </h3>

          {bankAccounts.length === 0 ? (
            <div className="text-content-secondary py-4 text-sm">No bank accounts linked. Update your profile to add one.</div>
          ) : (
            <div className="space-y-3">
              {bankAccounts.map((acc: any) => (
                <div key={acc.id} className="bg-surface-sunken border border-border-default rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="bg-surface-card p-3 rounded-lg">
                      <Building className="w-6 h-6 text-brand-secondary" />
                    </div>
                    <div>
                      <p className="text-content-primary font-bold">{acc.bankName}</p>
                      <p className="text-content-secondary text-sm">{acc.accountHolderName} • •••• {acc.accountNumber.slice(-4)}</p>
                    </div>
                  </div>
                  <div>
                    {acc.isVerified ? (
                      <Badge variant="success" className="!rounded-full flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="!rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Pending Verification
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-surface-card border border-border-default rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-border-default bg-surface-sunken/50">
          <h3 className="text-xl font-bold text-content-primary">Payout History</h3>
        </div>

        <div className="overflow-x-auto min-h-[300px]">
          {settlements.length === 0 ? (
            <div className="text-center py-12">
              <WalletIcon className="w-12 h-12 text-content-muted mx-auto mb-3" />
              <p className="text-content-secondary font-medium">No past payouts found.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-sunken text-content-secondary text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold">Date</th>
                  <th className="p-4 font-semibold">Transaction ID</th>
                  <th className="p-4 font-semibold">Amount</th>
                  <th className="p-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {settlements.map((s: any) => (
                  <tr key={s.id} className="hover:bg-surface-hover transition-colors">
                    <td className="p-4">
                      <div className="text-content-primary font-medium">{new Date(s.date).toLocaleDateString()}</div>
                      <div className="text-xs text-content-muted">{new Date(s.date).toLocaleTimeString()}</div>
                    </td>
                    <td className="p-4">
                      <span className="text-content-secondary text-sm font-mono">{s.transactionId || '—'}</span>
                    </td>
                    <td className="p-4">
                      <span className="text-content-primary font-bold flex items-center gap-1">
                        <ArrowDownLeft className="w-4 h-4 text-brand-secondary" />
                        ₹{s.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(s.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Withdrawal Modal */}
      <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Request Payout">
        <form onSubmit={handleWithdraw}>
          <p className="text-content-secondary mb-6">Enter the amount you wish to withdraw to your primary bank account.</p>

          <div className="mb-4">
            <label className="block text-content-secondary text-sm font-semibold mb-2">Available Balance: ₹{balance}</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-content-muted text-xl font-bold">₹</span>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-surface-sunken border border-border-default rounded-xl pl-10 pr-4 py-3 text-content-primary text-xl font-bold focus:border-brand-secondary outline-none transition-colors"
              />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm mb-4 bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}

          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-4 py-3 bg-surface-sunken text-content-primary border border-border-default rounded-xl font-bold hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <Button type="submit" isLoading={submitting} className="flex-1">
              {submitting ? 'Processing...' : 'Withdraw'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
