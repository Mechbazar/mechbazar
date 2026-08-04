import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { loginSuccess } from '../store';
import { Button, Card } from '../components/ui';
import { API_URL } from '../config/api';
import { auth } from '../config/firebase';
import { fadeInUp } from '../utils/motion';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmail() {
  const location = useLocation() as { state?: { email?: string } };
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const email = location.state?.email || auth.currentUser?.email || '';
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Reaching this page with no active Firebase session (e.g. a direct link,
  // or a refresh after Firebase's own session expired) means there's no
  // `currentUser` to resend/re-check against -- send them back to sign in.
  if (!auth.currentUser) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center bg-surface-page px-4 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_var(--brand-primary)_0%,_transparent_35%)] opacity-[0.06]" />
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="relative w-full max-w-md">
          <Card className="!p-8 shadow-xl text-center">
            <div className="flex items-start gap-2 rounded-xl border border-info-500/30 bg-info-500/10 px-4 py-3 text-sm text-info-600 dark:text-info-300 mb-6 text-left">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Your session has expired. Please sign in again.</span>
            </div>
            <Link to="/login" className="text-brand-primary font-semibold hover:text-brand-accent transition-colors text-sm">Return to Login</Link>
          </Card>
        </motion.div>
      </div>
    );
  }

  const handleResend = async () => {
    setError('');
    setInfo('');
    setResending(true);
    try {
      // The backend generates the oobCode itself and emails it through its
      // own mailer rather than Firebase's automatic send, so the link can
      // point at the project's shared AuthAction page
      // (apps/vendor/src/pages/AuthAction.tsx -- one Auth action URL for
      // every app, not one per app) instead of Firebase's auto-consuming
      // hosted one -- see apps/backend/src/utils/firebasePassword.ts's
      // sendFirebaseVerificationEmail for why Firebase's own send can't be
      // redirected there anymore.
      const idToken = await auth.currentUser!.getIdToken();
      await axios.post(`${API_URL}/auth/resend-verification-email`, {
        idToken,
        continueUrl: `${window.location.origin}/verify-email`,
      });
      setInfo(`Verification email sent to ${email}.`);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to resend verification email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleContinue = async () => {
    setError('');
    setInfo('');
    setChecking(true);
    try {
      await auth.currentUser!.reload();
      if (!auth.currentUser!.emailVerified) {
        setError('Still not verified. Click the link in the email, then try again.');
        return;
      }

      const idToken = await auth.currentUser!.getIdToken(true);
      const response = await axios.post(`${API_URL}/auth/admin/login`, { idToken });

      if (response.data && response.data.token) {
        dispatch(loginSuccess({ token: response.data.token, user: response.data.user }));
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to continue. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-surface-page px-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,_var(--brand-primary)_0%,_transparent_35%)] opacity-[0.06]" />
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="relative w-full max-w-md">
        <Card className="!p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-content-primary mb-2">Verify your email</h1>
            <p className="text-content-secondary text-sm">
              We sent a verification link to <span className="text-content-primary font-medium">{email}</span>. Please verify your email to continue.
            </p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-xl border border-danger-500/30 bg-danger-500/10 px-4 py-3 text-sm text-danger-600 dark:text-danger-300">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="mb-6 flex items-start gap-2 rounded-xl border border-success-500/30 bg-success-500/10 px-4 py-3 text-sm text-success-600 dark:text-success-300">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{info}</span>
            </div>
          )}

          <div className="space-y-3">
            <Button onClick={handleContinue} isLoading={checking} disabled={checking} className="w-full">
              I've verified, continue
            </Button>
            <Button
              onClick={handleResend}
              isLoading={resending}
              disabled={resending || cooldown > 0}
              variant="secondary"
              className="w-full"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
            </Button>
          </div>

          <div className="text-center mt-6">
            <Link to="/login" className="text-sm text-content-muted hover:text-brand-primary transition-colors">
              Back to Sign In
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
