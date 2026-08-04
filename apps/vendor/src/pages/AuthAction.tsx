import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Card, Alert, Input } from '@mechbazar/shared/web';
import { auth } from '../config/firebase';
import { mapFirebaseAuthError } from '../utils/firebaseErrors';

// Firebase Auth's own floor -- anything shorter is rejected as auth/weak-password.
const MIN_PASSWORD_LENGTH = 6;

// Every Firebase Auth action email (verify-email, password reset, email
// change) across every app on this project now links here, because the
// project's Auth "action URL" (notification.sendEmail.callbackUri) points at
// this one page -- there is exactly one such setting per Firebase project, it
// isn't per-app or per-template. This page has no dependency on the vendor
// app's own state (it never reads auth.currentUser), so it works identically
// no matter which app's user clicked the link; `continueUrl` (carried through
// as a query param from whichever app's actionCodeSettings.url sent the
// email) is where the user is sent back afterward.
//
// This replaced Firebase's own hosted action page
// (`{project}.firebaseapp.com/__/auth/action`), which applied verify-email
// codes the instant the page loaded -- no click required -- so a mailbox's
// click-time link scanner (e.g. Titan webmail's) visited the link and burned
// the single-use code before the recipient ever opened the email. Every mode
// below only calls into Firebase Auth from an explicit button click.
export default function AuthAction() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const oobCode = searchParams.get('oobCode') || '';
  const continueUrl = searchParams.get('continueUrl') || '/login';

  if (!oobCode || (mode !== 'verifyEmail' && mode !== 'resetPassword')) {
    return (
      <Shell>
        <Alert type="error" message="This link is invalid." className="mb-6" />
        <BackToSignIn />
      </Shell>
    );
  }

  return mode === 'verifyEmail'
    ? <VerifyEmailAction oobCode={oobCode} continueUrl={continueUrl} />
    : <ResetPasswordAction oobCode={oobCode} continueUrl={continueUrl} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-surface-page px-4 text-content-primary">
      <Card variant="dark" className="w-full max-w-md !rounded-2xl !p-8 shadow-2xl text-center">
        {children}
      </Card>
    </div>
  );
}

function BackToSignIn() {
  return (
    <div className="text-center mt-6">
      <Link to="/login" className="text-sm text-content-secondary hover:text-primary-500 transition-colors">
        Back to Sign In
      </Link>
    </div>
  );
}

function VerifyEmailAction({ oobCode, continueUrl }: { oobCode: string; continueUrl: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    setStatus('loading');
    setError('');
    try {
      await applyActionCode(auth, oobCode);
      setStatus('success');
    } catch (err: any) {
      setError(mapFirebaseAuthError(err?.code));
      setStatus('error');
    }
  };

  return (
    <Shell>
      <h1 className="text-2xl font-bold text-content-primary mb-2">Confirm your email</h1>

      {status === 'success' ? (
        <>
          <Alert type="success" message="Your email has been verified." className="mb-6 mt-6" />
          <a href={continueUrl} className="text-primary-500 font-bold hover:underline">Continue</a>
        </>
      ) : (
        <>
          <p className="text-content-secondary text-sm mb-6">Click below to finish verifying your email address.</p>
          {status === 'error' && <Alert type="error" message={error} className="mb-6" />}
          <Button onClick={handleConfirm} isLoading={status === 'loading'} disabled={status === 'loading'} className="w-full">
            Confirm email address
          </Button>
          <BackToSignIn />
        </>
      )}
    </Shell>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <div className="text-left">
      <label className="mb-2 block text-sm font-semibold text-content-secondary">{label}</label>
      <div className="relative">
        <Input
          type={reveal ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          disabled={disabled}
          autoComplete="new-password"
          placeholder="••••••••"
          className="pr-11"
        />
        <button
          type="button"
          onClick={() => setReveal((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-content-muted hover:text-content-secondary"
          aria-label={reveal ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          tabIndex={-1}
        >
          {reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function ResetPasswordAction({ oobCode, continueUrl }: { oobCode: string; continueUrl: string }) {
  // 'checking' first: verifyPasswordResetCode only reads the code (Firebase
  // never consumes an oobCode from this call), so it's safe to run on load --
  // it just confirms the link is still good before showing the form, and
  // surfaces "expired/already used" immediately rather than after the user
  // has typed a new password.
  const [status, setStatus] = useState<'checking' | 'ready' | 'submitting' | 'success' | 'error'>('checking');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    verifyPasswordResetCode(auth, oobCode)
      .then((verifiedEmail) => {
        setEmail(verifiedEmail);
        setStatus('ready');
      })
      .catch((err) => {
        setError(mapFirebaseAuthError(err?.code));
        setStatus('error');
      });
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setStatus('submitting');
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setStatus('success');
    } catch (err: any) {
      setError(mapFirebaseAuthError(err?.code));
      setStatus('ready');
    }
  };

  if (status === 'checking') {
    return (
      <Shell>
        <h1 className="text-2xl font-bold text-content-primary mb-2">Reset your password</h1>
        <p className="text-content-secondary text-sm">Checking your link…</p>
      </Shell>
    );
  }

  if (status === 'error') {
    return (
      <Shell>
        <Alert type="error" message={error} className="mb-6" />
        <BackToSignIn />
      </Shell>
    );
  }

  if (status === 'success') {
    return (
      <Shell>
        <Alert type="success" message="Your password has been reset." className="mb-6" />
        <a href={continueUrl} className="text-primary-500 font-bold hover:underline">Continue to Sign In</a>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="text-2xl font-bold text-content-primary mb-2">Reset your password</h1>
      <p className="text-content-secondary text-sm mb-6">Choose a new password for {email}.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert type="error" message={error} />}

        <PasswordField label="New Password" value={newPassword} onChange={setNewPassword} disabled={status === 'submitting'} />
        <PasswordField label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} disabled={status === 'submitting'} />

        <p className="text-sm text-content-muted">Must be at least {MIN_PASSWORD_LENGTH} characters.</p>

        <Button type="submit" isLoading={status === 'submitting'} disabled={status === 'submitting'} className="w-full">
          Reset Password
        </Button>
      </form>
      <BackToSignIn />
    </Shell>
  );
}
