import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { loginSuccess } from '../store';
import { Button, Card, Alert, Input } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/admin/login`, {
        email,
        password,
      });

      if (response.data && response.data.token) {
        dispatch(loginSuccess({
          token: response.data.token,
          user: response.data.user,
        }));
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid credentials or server error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-neutral-950 px-4">
      <Card variant="dark" className="w-full max-w-md !p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-white tracking-wide mb-2">MECH<span className="text-primary-500">BAZAR</span></h1>
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
            placeholder="admin@mechbazar.com"
          />

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-semibold text-neutral-300">Password</label>
              <Link to="/forgot-password" className="text-primary-500 hover:text-primary-400 transition-colors text-sm">
                Forgot password?
              </Link>
            </div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          <Button type="submit" isLoading={loading} className="w-full">
            {loading ? 'Authenticating...' : 'Sign In'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
