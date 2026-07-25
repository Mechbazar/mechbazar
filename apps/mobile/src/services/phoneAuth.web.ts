import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from './firebase';

// Web build only (Metro picks this file over phoneAuth.ts for the `web`
// platform) -- the native @react-native-firebase/auth module has no web
// implementation, and the JS SDK's phone auth needs a real DOM node for its
// invisible reCAPTCHA widget, which only exists on this platform.
const RECAPTCHA_CONTAINER_ID = 'firebase-recaptcha-container';

const log = (msg: string, extra?: unknown) => {
  const line = `[otp:web] ${new Date().toISOString()} ${msg}`;
  if (extra !== undefined) {
    console.log(line, extra);
  } else {
    console.log(line);
  }
};

const ensureRecaptchaContainer = (): string => {
  if (typeof document !== 'undefined' && !document.getElementById(RECAPTCHA_CONTAINER_ID)) {
    const div = document.createElement('div');
    div.id = RECAPTCHA_CONTAINER_ID;
    div.style.display = 'none';
    document.body.appendChild(div);
    log('recaptcha container created');
  }
  return RECAPTCHA_CONTAINER_ID;
};

let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

// A reCAPTCHA token is single-use: once signInWithPhoneNumber consumes it (or
// the attempt errors out) the verifier is spent. Reusing the same instance on
// the next Send/Resend makes Firebase throw auth/internal-error, so we discard
// it and let the next call build a fresh one.
const resetRecaptcha = () => {
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
    } catch {
      /* clear() throws if it was never rendered -- safe to ignore */
    }
    recaptchaVerifier = null;
  }
};

export const sendPhoneOtp = async (phone10Digit: string): Promise<void> => {
  const e164 = `+91${phone10Digit}`;
  log(`sendPhoneOtp called for ${e164}`);
  log('firebase auth config', {
    projectId: auth.app.options.projectId,
    authDomain: auth.app.options.authDomain,
    apiKeyPresent: !!auth.app.options.apiKey,
    origin: typeof window !== 'undefined' ? window.location.origin : 'n/a',
  });

  try {
    if (!recaptchaVerifier) {
      log('creating RecaptchaVerifier (invisible)');
      recaptchaVerifier = new RecaptchaVerifier(auth, ensureRecaptchaContainer(), { size: 'invisible' });
      log('rendering reCAPTCHA');
      await recaptchaVerifier.render();
      log('reCAPTCHA rendered');
    }

    log('calling signInWithPhoneNumber');
    confirmationResult = await signInWithPhoneNumber(auth, e164, recaptchaVerifier);
    log('signInWithPhoneNumber resolved -- SMS dispatched by Firebase');
  } catch (err: any) {
    // Surface the exact Firebase error code -- this is what identifies a
    // Console-side blocker (auth/unauthorized-domain, auth/billing-not-enabled,
    // auth/invalid-app-credential, auth/too-many-requests, etc.).
    log(`signInWithPhoneNumber FAILED code=${err?.code ?? 'unknown'}`, err?.message ?? err);
    resetRecaptcha();
    // Re-throw with the code attached so the UI can show it.
    if (err?.code) {
      throw new Error(`${err.message} (${err.code})`);
    }
    throw err;
  }
};

// Resolves to a Firebase ID token -- sent as the `otp` field to the
// /auth/login and /auth/register endpoints, which verify it via firebase-admin
// (see apps/backend/src/utils/otp.ts).
export const confirmPhoneOtp = async (code: string): Promise<string> => {
  if (!confirmationResult) {
    throw new Error('No OTP request in progress. Send an OTP first.');
  }
  log('confirming OTP code');
  const credential = await confirmationResult.confirm(code);
  const idToken = await credential.user.getIdToken();
  log('OTP confirmed, ID token obtained');
  confirmationResult = null;
  resetRecaptcha();
  return idToken;
};
