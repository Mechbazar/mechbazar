import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Sun, Moon, AlertCircle } from 'lucide-react';
import { Logo } from '@mechbazar/shared/web';
import { loginSuccess } from '../store';
import { Button, Card, Input } from '../components/ui';
import { API_URL } from '../config/api';
import { auth } from '../config/firebase';
import { mapFirebaseAuthError } from '../utils/firebaseErrors';
import { useTheme } from '../hooks/useTheme';
import { fadeInUp } from '../utils/motion';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);

      if (!credential.user.emailVerified) {
        navigate('/verify-email', { state: { email: credential.user.email } });
        return;
      }

      const idToken = await credential.user.getIdToken();
      const response = await axios.post(`${API_URL}/auth/admin/login`, { idToken });

      if (response.data && response.data.token) {
        dispatch(loginSuccess({
          token: response.data.token,
          user: response.data.user,
        }));
        navigate('/');
      }
    } catch (err: any) {
      if (err?.code?.startsWith?.('auth/')) {
        setError(mapFirebaseAuthError(err.code));
      } else if (err?.response?.data?.error === 'EMAIL_NOT_VERIFIED') {
        navigate('/verify-email', { state: { email } });
      } else {
        setError(err.response?.data?.error || 'Invalid credentials or server error.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-surface-page px-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_var(--brand-primary)_0%,_transparent_35%)] opacity-[0.06]" />
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Toggle theme"
        className="absolute top-5 right-5 w-10 h-10 rounded-xl border border-border-default bg-surface-card flex items-center justify-center text-content-secondary hover:text-content-primary transition-colors"
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="relative w-full max-w-md">
        <Card className="!p-8 shadow-xl">
          <div className="text-center mb-8">
            <Logo tone={theme === 'dark' ? 'dark' : 'light'} width={280} className="mx-auto mb-3" />
            <p className="text-content-secondary text-sm">Sign in to manage your empire</p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-600 dark:text-danger-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="block text-sm font-medium text-content-secondary">Password</label>
                <Link to="/forgot-password" className="text-brand-primary hover:text-brand-accent transition-colors text-sm font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  disabled={loading}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" isLoading={loading} disabled={loading} className="w-full">
              {loading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
