import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithCredential,
  PhoneAuthProvider,
  ConfirmationResult,
} from 'firebase/auth';
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

// --- Pending-verification durability -----------------------------------------
//
// `confirmationResult` above lives only as long as this JS module instance
// does, and phone OTP is the one flow where that is not long enough: the user
// leaves the page to read the SMS. A reload, a restored tab, or a mobile
// browser evicting a backgrounded tab all reinitialise the bundle, reset
// `confirmationResult` to null, and make confirmPhoneOtp report "No OTP request
// in progress" while Firebase still holds a perfectly valid pending
// verification.
//
// The verificationId is Firebase's serializable handle to that pending
// verification -- PhoneAuthProvider.credential(verificationId, code) turns it
// straight back into a usable credential. sessionStorage is the right home for
// it: per-tab, cleared when the tab closes, so a verification can never leak
// into someone else's later session on a shared browser.
const PENDING_KEY = 'phoneAuth.pendingVerification';
// Firebase invalidates the code well before this; the window only has to cover
// "user switches to their SMS app and comes back". Anything older is treated as
// absent so a stale id can never silently shadow a fresh send.
const PENDING_TTL_MS = 10 * 60 * 1000;

type PendingVerification = {
  verificationId: string;
  phone: string;
  createdAt: number;
};

const store = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    // Access itself throws when storage is blocked (private mode / cookies off).
    return null;
  }
};

const savePending = (pending: PendingVerification): void => {
  try {
    store()?.setItem(PENDING_KEY, JSON.stringify(pending));
    log('pending verification persisted');
  } catch (err) {
    // Persistence is a durability upgrade, not a precondition -- if storage is
    // unavailable the in-memory path still works for the common case.
    log('failed to persist pending verification', (err as Error)?.message ?? err);
  }
};

const readPending = (): PendingVerification | null => {
  try {
    const raw = store()?.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingVerification;
    if (!parsed?.verificationId) return null;
    const age = Date.now() - (parsed.createdAt ?? 0);
    if (age > PENDING_TTL_MS) {
      log(`persisted verification discarded -- ${Math.round(age / 1000)}s old`);
      clearPending();
      return null;
    }
    return parsed;
  } catch (err) {
    log('failed to read pending verification', (err as Error)?.message ?? err);
    return null;
  }
};

const clearPending = (): void => {
  try {
    store()?.removeItem(PENDING_KEY);
  } catch {
    /* nothing pending to remove -- safe to ignore */
  }
};

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

  // A fresh send supersedes anything still pending, so drop the old handle
  // before asking Firebase for a new one -- otherwise a failed send would leave
  // the previous verificationId in place for confirm() to pick up.
  confirmationResult = null;
  clearPending();

  try {
    if (!recaptchaVerifier) {
      log('creating RecaptchaVerifier (invisible)');
      recaptchaVerifier = new RecaptchaVerifier(auth, ensureRecaptchaContainer(), { size: 'invisible' });
      log('rendering reCAPTCHA');
      await recaptchaVerifier.render();
      log('reCAPTCHA rendered');
    }

    log('calling signInWithPhoneNumber');
    const result = await signInWithPhoneNumber(auth, e164, recaptchaVerifier);
    confirmationResult = result;
    log('signInWithPhoneNumber resolved -- SMS dispatched by Firebase', {
      hasConfirmFn: typeof result?.confirm === 'function',
      // Truncated: the prefix is enough to correlate send with confirm without
      // printing the whole handle into the browser console.
      verificationId: result?.verificationId ? `${result.verificationId.slice(0, 10)}...` : null,
    });

    if (result?.verificationId) {
      savePending({ verificationId: result.verificationId, phone: e164, createdAt: Date.now() });
    } else {
      log('WARNING: no verificationId on the ConfirmationResult -- confirm cannot survive a reload');
    }
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
  // Logged before anything else, so pressing Verify always leaves a trace even
  // if something downstream never settles.
  log('confirmPhoneOtp called', { hasInMemoryConfirmation: !!confirmationResult });

  const pending = readPending();
  log('pending verification lookup done', { hasPersistedVerification: !!pending });

  if (!confirmationResult && !pending) {
    throw new Error('No OTP request in progress. Send an OTP first.');
  }

  let credentialResult;
  try {
    if (confirmationResult) {
      log('confirming via in-memory ConfirmationResult');
      credentialResult = await confirmationResult.confirm(code);
    } else {
      // The page was reloaded while the user was reading the SMS. Rebuild the
      // credential from the persisted verificationId -- same pending
      // verification, same Firebase session, just re-entered through the
      // credential API instead of the ConfirmationResult object.
      log('in-memory ConfirmationResult gone (page reload) -- rebuilding from persisted verificationId');
      credentialResult = await signInWithCredential(
        auth,
        PhoneAuthProvider.credential(pending!.verificationId, code),
      );
    }
  } catch (err: any) {
    log(`confirm FAILED code=${err?.code ?? 'unknown'}`, err?.message ?? err);
    // A wrong code is retryable and must NOT drop the pending verification; an
    // expired/consumed session is not, so clear it and make the user resend.
    if (err?.code === 'auth/code-expired' || err?.code === 'auth/session-expired') {
      confirmationResult = null;
      clearPending();
      resetRecaptcha();
    }
    throw err;
  }

  const idToken = await credentialResult.user.getIdToken();
  log('OTP confirmed, ID token obtained');
  confirmationResult = null;
  clearPending();
  resetRecaptcha();
  return idToken;
};
