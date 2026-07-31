import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { sendEmailVerification } from 'firebase/auth';
import { loginSuccess } from '../store/slices/authSlice';
import { Button, Card, Alert } from '@mechbazar/shared/web';
import { API_URL } from '../config/api';
import { auth } from '../config/firebase';
import { mapFirebaseAuthError } from '../utils/firebaseErrors';

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

  if (!auth.currentUser) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4 text-neutral-100">
        <Card variant="dark" className="w-full max-w-md !rounded-2xl !p-8 shadow-2xl text-center">
          <Alert type="info" message="Your session has expired. Please sign in again." className="mb-6" />
          <Link to="/login" className="text-primary-500 font-bold hover:underline">Return to Login</Link>
        </Card>
      </div>
    );
  }

  const handleResend = async () => {
    setError('');
    setInfo('');
    setResending(true);
    try {
      // Point the emailed link at our own confirm page (handleCodeInApp: true)
      // instead of Firebase's default hosted action page, which applies the
      // code as soon as it loads -- see VerifyEmailConfirm.tsx for why.
      await sendEmailVerification(auth.currentUser!, {
        url: `${window.location.origin}/verify-email-confirm`,
        handleCodeInApp: true,
      });
      setInfo(`Verification email sent to ${email}.`);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err: any) {
      setError(mapFirebaseAuthError(err?.code));
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
      const response = await axios.post(`${API_URL}/vendors/login`, { idToken });

      dispatch(loginSuccess(response.data));

      const vendor = response.data.vendor;
      if (vendor?.status === 'PENDING') {
        navigate('/register?step=business');
      } else if (vendor?.status === 'UNDER_VERIFICATION') {
        navigate('/pending-approval');
      } else if (vendor?.status === 'APPROVED') {
        navigate('/dashboard');
      } else {
        navigate('/pending-approval');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to continue. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4 text-neutral-100">
      <Card variant="dark" className="w-full max-w-md !rounded-2xl !p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Verify your email</h1>
          <p className="text-neutral-400 text-sm">
            We sent a verification link to <span className="text-neutral-200 font-medium">{email}</span>. Please verify your email to continue.
          </p>
        </div>

        {error && <Alert type="error" message={error} className="mb-6" />}
        {info && <Alert type="success" message={info} className="mb-6" />}

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
          <Link to="/login" className="text-sm text-neutral-400 hover:text-primary-500 transition-colors">
            Back to Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
}
