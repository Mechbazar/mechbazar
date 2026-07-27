// Type-only imports are erased at compile time, so they never emit a
// `require` -- the native module is pulled in lazily by loadRnfbAuth() below.
import type { ConfirmationResult } from '@react-native-firebase/auth';
import * as SecureStore from 'expo-secure-store';

// Firebase Phone Auth for the mechanic app (native-only -- this app ships as an
// Android build, not web). signInWithPhoneNumber sends the real SMS via Play
// Integrity; confirming the code yields a Firebase ID token that the backend
// verifies (see apps/backend/src/utils/otp.ts). Mirrors the customer app's
// apps/mobile/src/services/phoneAuth.ts.
//
// @react-native-firebase is a native module that Expo Go does not ship. It used
// to be imported at the top level, so requiring this file -- which App.tsx does
// transitively via LoginScreen -- threw "Native module RNFBAppModule not found"
// before the first screen could render, red-screening the whole app in Expo Go.
// The require is now deferred into the two functions that actually need it, so
// the app boots under Expo Go and only the OTP calls fail, with the explanation
// below instead of a crash. Real builds are unaffected: the native module is
// present and Play Integrity phone auth works as before. Do NOT hoist these
// back to top-level imports.
const EXPO_GO_HINT =
  'Phone sign-in needs the native Firebase module, which Expo Go does not include. ' +
  'Run this app in a development build to log in.';

type PhoneCredential = { providerId: string; token: string; secret: string };

type RnfbAuth = {
  getAuthInstance: () => unknown;
  signInWithPhoneNumber: (auth: unknown, phone: string) => Promise<ConfirmationResult>;
  phoneCredential: (verificationId: string, code: string) => PhoneCredential;
  signInWithCredential: (auth: unknown, credential: PhoneCredential) => Promise<any>;
};

const log = (msg: string, extra?: unknown) => {
  const line = `[otp:mechanic] ${new Date().toISOString()} ${msg}`;
  if (extra !== undefined) {
    console.log(line, extra);
  } else {
    console.log(line);
  }
};

const loadRnfbAuth = (): RnfbAuth => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getApp } = require('@react-native-firebase/app');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {
      getAuth,
      signInWithPhoneNumber,
      signInWithCredential,
      PhoneAuthProvider,
    } = require('@react-native-firebase/auth');
    return {
      getAuthInstance: () => getAuth(getApp()),
      signInWithPhoneNumber,
      phoneCredential: (verificationId: string, code: string) =>
        PhoneAuthProvider.credential(verificationId, code),
      signInWithCredential,
    };
  } catch (err) {
    throw new Error(`${EXPO_GO_HINT} (${(err as Error)?.message ?? String(err)})`);
  }
};

// --- Pending-verification durability -----------------------------------------
//
// The in-memory ConfirmationResult below lives for exactly as long as the JS
// runtime does, and phone OTP is the one flow where that is not long enough:
// the user has to LEAVE the app to read the SMS. Android is free to destroy and
// recreate the RN activity while they are gone (low memory, "don't keep
// activities", or the Chrome Custom Tab that Firebase falls back to when Play
// Integrity/SHA certificates are not configured). When it does, every
// module-level variable in the bundle is reinitialised, `confirmationResult`
// goes back to null, and confirmPhoneOtp reports "No OTP request in progress"
// even though Firebase has a perfectly valid pending verification and the SMS
// is sitting on the user's phone. That is the failure this block exists to fix.
//
// Firebase's own answer to this is the verificationId: a plain string handle to
// the pending verification that can be persisted and later turned back into a
// credential via PhoneAuthProvider.credential(verificationId, code). Persisting
// it is not a workaround for a lost object -- it is the documented way to carry
// a phone-auth session across a process boundary, and it is what the confirm
// path falls back to whenever the in-memory object did not survive.
const PENDING_KEY = 'phoneAuth.pendingVerification';
// Firebase invalidates the code long before this; the window only has to cover
// "user switches to Messages, reads the code, switches back". Anything older is
// treated as absent so a stale id can never silently shadow a fresh send.
const PENDING_TTL_MS = 10 * 60 * 1000;

type PendingVerification = {
  verificationId: string;
  phone: string;
  createdAt: number;
};

const savePending = async (pending: PendingVerification): Promise<void> => {
  try {
    await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(pending));
    log('pending verification persisted');
  } catch (err) {
    // Persistence is a durability upgrade, not a precondition -- if the store
    // is unavailable the in-memory path still works for the common case.
    log('failed to persist pending verification', (err as Error)?.message ?? err);
  }
};

const readPending = async (): Promise<PendingVerification | null> => {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingVerification;
    if (!parsed?.verificationId) return null;
    const age = Date.now() - (parsed.createdAt ?? 0);
    if (age > PENDING_TTL_MS) {
      log(`persisted verification discarded -- ${Math.round(age / 1000)}s old`);
      await clearPending();
      return null;
    }
    return parsed;
  } catch (err) {
    log('failed to read pending verification', (err as Error)?.message ?? err);
    return null;
  }
};

const clearPending = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(PENDING_KEY);
  } catch {
    /* nothing pending to delete -- safe to ignore */
  }
};

let confirmationResult: ConfirmationResult | null = null;

export const sendPhoneOtp = async (phone10Digit: string): Promise<void> => {
  const e164 = `+91${phone10Digit}`;
  log(`sendPhoneOtp called for ${e164}`);

  // A fresh send supersedes anything still pending, so drop the old handle
  // before asking Firebase for a new one -- otherwise a failed send would leave
  // the previous verificationId in place for confirm() to pick up.
  //
  // Deliberately NOT awaited. Persistence is a durability upgrade and must
  // never sit between the user tapping Send and Firebase being asked for the
  // SMS: a storage call that is slow, or backed by a native module the
  // installed build does not contain, would otherwise stall the whole flow
  // with no error and no log line to show for it.
  confirmationResult = null;
  void clearPending();

  try {
    const rnfb = loadRnfbAuth();
    log('RNFB auth module loaded');
    const authInstance = rnfb.getAuthInstance();
    log('auth instance resolved');

    // Every await below is bracketed by a log so a hang is attributable to one
    // specific call rather than to "somewhere in sendPhoneOtp".
    log('calling signInWithPhoneNumber');
    const result = await rnfb.signInWithPhoneNumber(authInstance, e164);
    confirmationResult = result;
    log('signInWithPhoneNumber resolved -- SMS dispatched by Firebase', {
      hasConfirmFn: typeof result?.confirm === 'function',
      // Truncated: the full id is a bearer-ish handle, no reason to spill it
      // into logcat, but the prefix is enough to correlate send with confirm.
      verificationId: result?.verificationId ? `${String(result.verificationId).slice(0, 10)}...` : null,
    });

    if (result?.verificationId) {
      await savePending({
        verificationId: String(result.verificationId),
        phone: e164,
        createdAt: Date.now(),
      });
    } else {
      log('WARNING: no verificationId on the ConfirmationResult -- confirm cannot survive a restart');
    }
  } catch (err: any) {
    log(`signInWithPhoneNumber FAILED code=${err?.code ?? 'unknown'}`, err?.message ?? err);
    throw err;
  }
};

// Resolves to a Firebase ID token, sent as the `otp` field to /auth/login and
// /technicians/register, which verify it via firebase-admin.
export const confirmPhoneOtp = async (code: string): Promise<string> => {
  // Logged before any await, so pressing Verify always leaves a trace even if
  // something downstream never settles.
  log('confirmPhoneOtp called', { hasInMemoryConfirmation: !!confirmationResult });

  const rnfb = loadRnfbAuth();
  const pending = await readPending();
  log('pending verification lookup done', { hasPersistedVerification: !!pending });

  if (!confirmationResult && !pending) {
    throw new Error('No OTP request in progress. Send an OTP first.');
  }

  let userCredential: any;
  try {
    if (confirmationResult) {
      log('confirming via in-memory ConfirmationResult');
      userCredential = await confirmationResult.confirm(code);
    } else {
      // The runtime was torn down while the user was reading the SMS. Rebuild
      // the credential from the persisted verificationId -- same pending
      // verification, same Firebase session, just re-entered through the
      // credential API instead of the ConfirmationResult object.
      log('in-memory ConfirmationResult gone (runtime restart) -- rebuilding from persisted verificationId');
      const credential = rnfb.phoneCredential(pending!.verificationId, code);
      userCredential = await rnfb.signInWithCredential(rnfb.getAuthInstance(), credential);
    }
  } catch (err: any) {
    log(`confirm FAILED code=${err?.code ?? 'unknown'}`, err?.message ?? err);
    // A wrong code is retryable and must NOT drop the pending verification; an
    // expired/consumed session is not, so clear it and make the user resend.
    if (err?.code === 'auth/session-expired' || err?.code === 'auth/code-expired') {
      confirmationResult = null;
      await clearPending();
    }
    throw err;
  }

  if (!userCredential) {
    throw new Error('Failed to confirm OTP.');
  }

  const idToken = await userCredential.user.getIdToken();
  log('OTP confirmed, ID token obtained');
  confirmationResult = null;
  await clearPending();
  return idToken;
};
