import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Eye, EyeOff } from 'lucide-react';
import { loginSuccess } from '../store';
import { Button, Card, Alert, Input, Logo } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';
import { auth } from '../config/firebase';
import { mapFirebaseAuthError } from '../utils/firebaseErrors';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

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
    <div className="flex min-h-screen w-full items-center justify-center bg-neutral-950 px-4">
      <Card variant="dark" className="w-full max-w-md !p-8 shadow-2xl">
        <div className="text-center mb-8">
          {/* Dark tone: the login card sits on bg-neutral-950. */}
          <Logo tone="dark" width={320} className="mx-auto mb-3" />
          <p className="text-neutral-400">Sign in to manage your empire</p>
        </div>

        {error && (
          <Alert type="error" message={error} className="mb-6" />
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
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-semibold text-neutral-300">Password</label>
              <Link to="/forgot-password" className="text-primary-500 hover:text-primary-400 transition-colors text-sm">
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
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
    </div>
  );
}
