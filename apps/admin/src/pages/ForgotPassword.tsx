import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button, Card, Input } from '../components/ui';
import { API_URL } from '../config/api';
import { fadeInUp } from '../utils/motion';

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
    <div className="relative flex min-h-screen w-full items-center justify-center bg-surface-page px-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_var(--brand-primary)_0%,_transparent_35%)] opacity-[0.06]" />
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="relative w-full max-w-md">
        <Card className="!p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-content-primary mb-2">Reset Password</h1>
            <p className="text-content-secondary text-sm">Enter your email to receive a reset link</p>
          </div>

          {submitted ? (
            <div className="text-center">
              <div className="flex items-start gap-2 rounded-xl border border-info-500/30 bg-info-500/10 px-4 py-3 text-sm text-info-600 dark:text-info-300">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>If an account exists for this email, a reset link has been sent. Check your inbox.</span>
              </div>
              <div className="mt-5">
                <Link to="/login" className="text-brand-primary font-semibold hover:text-brand-accent transition-colors text-sm">
                  Return to Login
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-600 dark:text-danger-300">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

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
                <Link to="/login" className="text-sm text-content-muted hover:text-brand-primary transition-colors">
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
