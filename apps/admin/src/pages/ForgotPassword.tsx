import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Button, Card, Alert, Input } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Was a direct client-side sendPasswordResetEmail, which Firebase refuses for
  // an address it has never seen -- and this page swallowed that refusal as
  // success, so a staff account created straight in the database was shown "a
  // reset link has been sent" for a mail that could not be sent.
  //
  // The backend endpoint creates the missing Firebase account first
  // (ensureFirebaseAccount), enforces the enumeration-safe response server-side
  // instead of relying on this page to catch auth/user-not-found, and is the
  // same call apps/admin-mobile makes -- so one reset now serves both. Firebase
  // still performs the delivery.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not send the reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-neutral-950 px-4">
      <Card variant="dark" className="w-full max-w-md !p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-500 mb-2">Reset Password</h1>
          <p className="text-neutral-400">Enter your email to receive a reset link</p>
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
              <Link to="/login" className="text-sm text-neutral-400 hover:text-primary-500 transition-colors">
                Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
