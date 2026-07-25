import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Store } from 'lucide-react';
import { Button, Card, Alert, Input } from '@mechbazar/shared/web';
import { auth } from '../config/firebase';
import { mapFirebaseAuthError } from '../utils/firebaseErrors';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSubmitted(true);
    } catch (err: any) {
      // auth/user-not-found is treated as success below -- surfacing it
      // would let a caller enumerate which emails have accounts.
      if (err?.code === 'auth/user-not-found') {
        setSubmitted(true);
      } else {
        setError(mapFirebaseAuthError(err?.code));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4 text-neutral-100">
      <Card variant="dark" className="w-full max-w-md !rounded-2xl !p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-black text-white tracking-wide mb-4">MECH<span className="text-primary-500">BAZAR</span></h1>
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-500/15 text-primary-500 border border-primary-500/30 mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">Reset Password</h1>
          <p className="text-neutral-400 mt-2 text-center text-sm">Enter your email to receive a reset link</p>
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
              placeholder="vendor@example.com"
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
