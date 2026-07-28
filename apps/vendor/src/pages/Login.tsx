import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { loginSuccess } from '../store/slices/authSlice';
import { Store, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button, Card, Alert, Input, Logo } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';
import { auth } from '../config/firebase';
import { mapFirebaseAuthError } from '../utils/firebaseErrors';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);

      if (!credential.user.emailVerified) {
        navigate('/verify-email', { state: { email: credential.user.email } });
        return;
      }

      const idToken = await credential.user.getIdToken();
      const response = await axios.post(`${API_URL}/vendors/login`, { idToken });

      dispatch(loginSuccess(response.data));

      const vendor = response.data.vendor;

      if (vendor?.status === 'PENDING') {
        navigate('/register?step=business');
      } else if (vendor?.status === 'UNDER_VERIFICATION') {
        navigate('/pending-approval');
      } else if (vendor?.status === 'APPROVED') {
        navigate('/dashboard');
      } else {
        navigate('/pending-approval');
      }
    } catch (err: any) {
      if (err?.code?.startsWith?.('auth/')) {
        setError(mapFirebaseAuthError(err.code));
      } else if (err?.response?.data?.error === 'EMAIL_NOT_VERIFIED') {
        navigate('/verify-email', { state: { email } });
      } else {
        setError(err.response?.data?.error || 'Failed to login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4 text-neutral-100">
      <Card variant="dark" className="w-full max-w-md !rounded-2xl !p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          {/* Dark tone: the login card sits on bg-neutral-950. */}
          <Logo tone="dark" width={280} className="mb-5" />
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/15 text-primary-500 border border-primary-500/30 mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white">Seller Central</h1>
          <p className="text-neutral-400 mt-2 text-center text-sm">
            Manage your store, products, and inventory in one place.
          </p>
        </div>

        {error && (
          <Alert type="error" message={error} className="mb-6" />
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <Input
            label="Email Address"
            type="email"
            required
            icon={<Mail className="h-4 w-4" />}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-semibold text-neutral-300">Password</label>
              <Link to="/forgot-password" className="text-xs text-primary-500 hover:text-primary-400 transition-colors">Forgot password?</Link>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                required
                icon={<Lock className="h-4 w-4" />}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" isLoading={loading} disabled={loading} className="w-full mt-2">
            <span>Sign In to Dashboard</span>
            <ArrowRight className="w-5 h-5" />
          </Button>
        </form>

        <div className="mt-8 border-t border-neutral-800 pt-6 text-center">
          <p className="text-sm text-neutral-400">
            Don't have a seller account?{' '}
            <Link to="/register" className="text-primary-500 font-medium hover:text-primary-400 transition-colors">
              Register now
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
