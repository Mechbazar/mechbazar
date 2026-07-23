import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Alert, Input } from '@mechbazar/shared/web';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // No password-reset endpoint exists on the backend yet (no email/SMTP
    // integration) -- this used to simulate a successful email send, which
    // told the admin to go check an inbox that would never receive anything.
    setSubmitted(true);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-neutral-950 px-4">
      <Card variant="dark" className="w-full max-w-md !p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-500 mb-2">Reset Password</h1>
          <p className="text-neutral-400">Enter your email to receive a reset link</p>
        </div>

        {submitted ? (
          <Alert type="info" message="Self-service password reset isn't available yet. Please contact your MechBazar administrator to have your password reset manually." className="mb-6 text-center">
            <div className="mt-4">
              <Link to="/login" className="text-primary-500 font-bold hover:underline">
                Return to Login
              </Link>
            </div>
          </Alert>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@mechbazar.com"
            />

            <Button type="submit" className="w-full">
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
