import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Store } from 'lucide-react';
import { Button, Card, Alert, Input, Logo } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';
import { useTheme } from '../hooks/useTheme';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();

  // Was a direct client-side sendPasswordResetEmail. Firebase refuses to send
  // for an address it has never seen, and this page swallowed that as success
  // -- so a vendor registered through POST /auth/register, which creates no
  // Firebase account, was shown "a reset link has been sent" for a mail that
  // was never going to arrive.
  //
  // The backend endpoint creates the missing Firebase account before asking
  // Firebase to send (ensureFirebaseAccount), answers identically for unknown
  // addresses so enumeration protection is enforced server-side rather than by
  // each page remembering to catch auth/user-not-found, and is the same call
  // the seller and admin phone apps make. Firebase still does the delivery.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post(`${API_URL}/auth/forgot-password`, {
        email,
        continueUrl: `${window.location.origin}/login`,
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not send the reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-surface-page px-4 text-content-primary">
      <Card variant="dark" className="w-full max-w-md !rounded-2xl !p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <Logo tone={theme === 'dark' ? 'dark' : 'light'} width={280} className="mb-5" />
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/15 text-primary-500 border border-primary-500/30 mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-content-primary">Reset Password</h1>
          <p className="text-content-secondary mt-2 text-center text-sm">Enter your email to receive a reset link</p>
        </div>

        {submitted ? (
          <Alert type="info" message="If an account exists for this email, a reset link has been sent. Check your inbox." className="mb-6 text-center">
            <div className="mt-4">
              <Link to="/login" className="text-primary-500 font-bold hover:underline">
                Return to Login
              </Link>
            </div>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <Alert type="error" message={error} />}

            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
            />

            <Button type="submit" isLoading={loading} disabled={loading} className="w-full">
              Send Reset Link
            </Button>

            <div className="text-center mt-4">
              <Link to="/login" className="text-sm text-content-secondary hover:text-primary-500 transition-colors">
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
