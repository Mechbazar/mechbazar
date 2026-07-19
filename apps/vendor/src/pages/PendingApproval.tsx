import { useDispatch } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useEffect } from 'react';
import axios from 'axios';
import type { RootState } from '../store';
import { updateVendorProfile } from '../store/slices/authSlice';
import { Card } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function PendingApproval() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!token) return;

    const checkStatus = async () => {
      try {
        const res = await axios.get(`${API_URL}/vendors/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        dispatch(updateVendorProfile(res.data));
        if (res.data?.status === 'APPROVED') {
          navigate('/dashboard', { replace: true });
        }
      } catch {
        // Keep user on this screen; auth/logout is handled globally in App.
      }
    };

    checkStatus();
    const timer = window.setInterval(checkStatus, 10000);
    return () => window.clearInterval(timer);
  }, [token, dispatch, navigate]);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <Card variant="dark" className="max-w-md w-full !rounded-2xl !p-8 text-center shadow-2xl">
        <div className="w-20 h-20 bg-brand-secondary/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-brand-secondary" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">Under Verification</h1>

        <p className="text-gray-400 mb-6 leading-relaxed">
          Your seller account and submitted documents are currently being verified by our team.
          This process typically takes 1-2 business days.
        </p>

        <div className="bg-brand-dark border border-brand-muted rounded-xl p-4 mb-8">
          <div className="flex items-center text-sm text-brand-secondary mb-2">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="font-medium">Verification in progress</span>
          </div>
          <p className="text-xs text-gray-500 text-left">
            This page refreshes your approval status automatically every 10 seconds.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-2 bg-brand-dark hover:bg-brand-muted border border-brand-muted text-white font-medium py-3 px-4 rounded-xl transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </Card>
    </div>
  );
}
