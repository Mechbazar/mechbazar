import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { applyActionCode } from 'firebase/auth';
import { Button, Card, Alert } from '@mechbazar/shared/web';
import { auth } from '../config/firebase';
import { mapFirebaseAuthError } from '../utils/firebaseErrors';

// The verification link points here (via actionCodeSettings in VerifyEmail.tsx)
// instead of Firebase's default hosted action page, which applies the oobCode
// as soon as it loads. Mailbox link-scanners (Titan's click-time protection,
// Outlook Safe Links, etc.) fetch every link in an incoming email to check for
// phishing, which silently burns a single-use code before the recipient ever
// opens it. Requiring an explicit button click here means applyActionCode only
// fires on a real user interaction, which scanners don't perform.
export default function VerifyEmailConfirm() {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode') || '';
  const mode = searchParams.get('mode');

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

  if (!oobCode || mode !== 'verifyEmail') {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4 text-neutral-100">
        <Card variant="dark" className="w-full max-w-md !rounded-2xl !p-8 shadow-2xl text-center">
          <Alert type="error" message="This verification link is invalid." className="mb-6" />
          <Link to="/login" className="text-primary-500 font-bold hover:underline">Back to Sign In</Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-neutral-950 px-4 text-neutral-100">
      <Card variant="dark" className="w-full max-w-md !rounded-2xl !p-8 shadow-2xl text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Confirm your email</h1>

        {status === 'success' ? (
          <>
            <Alert type="success" message="Your email has been verified." className="mb-6 mt-6" />
            <Link to="/verify-email" className="text-primary-500 font-bold hover:underline">Continue</Link>
          </>
        ) : (
          <>
            <p className="text-neutral-400 text-sm mb-6">
              Click below to finish verifying your email address.
            </p>
            {status === 'error' && <Alert type="error" message={error} className="mb-6" />}
            <Button onClick={handleConfirm} isLoading={status === 'loading'} disabled={status === 'loading'} className="w-full">
              Confirm email address
            </Button>
          </>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="text-sm text-neutral-400 hover:text-primary-500 transition-colors">
            Back to Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
}
