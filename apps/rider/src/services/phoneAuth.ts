// Type-only imports are erased at compile time, so they never emit a
// `require` -- the native module is pulled in lazily by loadRnfbAuth() below.
import type { ConfirmationResult } from '@react-native-firebase/auth';
import * as SecureStore from 'expo-secure-store';
import { friendlyAuthErrorMessage } from '../utils/authErrors';

// Firebase Phone Auth for the rider app (native-only -- this app ships as an
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
  getAuthInstance: () => any;
  signInWithPhoneNumber: (auth: unknown, phone: string) => Promise<ConfirmationResult>;
  phoneCredential: (verificationId: string, code: string) => PhoneCredential;
  signInWithCredential: (auth: unknown, credential: PhoneCredential) => Promise<any>;
  onAuthStateChanged: (auth: unknown, cb: (user: any) => void) => () => void;
  signOut: (auth: unknown) => Promise<void>;
};

const log = (msg: string, extra?: unknown) => {
  const line = `[otp:rider] ${new Date().toISOString()} ${msg}`;
  if (extra !== undefined) {
    console.log(line, extra);
  } else {
    console.log(line);
  }
};

// Failure paths use console.warn, not log()/console.log: babel.config.js
// strips console.log from production bundles (console.error/warn survive),
// so a FAILED breadcrumb logged via log() would never reach release-build
// logcat -- the one place a real OTP failure actually needs to be visible.
//
// warn, not error: every call site here is a failure ALREADY caught and
// already shown to the user via Alert.alert (see LoginScreen.tsx) -- there is
// nothing left for the app to do about it. console.error is reserved for
// exactly that "nothing handled this" case in React Native: by default it
// pops LogBox's full-screen red error overlay in every dev/dev-client build,
// on top of the Alert the user already dismissed, making an ordinary wrong or
// expired code look like a crash. console.warn survives production stripping
// identically (see above) but only surfaces as LogBox's small inline notice.
const logError = (msg: string, extra?: unknown) => {
  const line = `[otp:rider] ${new Date().toISOString()} ${msg}`;
  if (extra !== undefined) {
    console.warn(line, extra);
  } else {
    console.warn(line);
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
      onAuthStateChanged,
      signOut,
      PhoneAuthProvider,
    } = require('@react-native-firebase/auth');
    return {
      getAuthInstance: () => getAuth(getApp()),
      signInWithPhoneNumber,
      phoneCredential: (verificationId: string, code: string) =>
        PhoneAuthProvider.credential(verificationId, code),
      signInWithCredential,
      onAuthStateChanged,
      signOut,
    };
  } catch (err) {
    throw new Error(`${EXPO_GO_HINT} (${(err as Error)?.message ?? String(err)})`);
  }
};

const e164For = (phone10Digit: string) => `+91${phone10Digit}`;

// --- Android auto-verification ------------------------------------------------
//
// This is the failure behind "[auth/session-expired] The sms code has expired"
// appearing seconds after a code was requested, on a code the user can plainly
// see in their notification shade.
//
// Android completes phone verification WITHOUT the user typing anything in two
// situations: instant verification (this device+number pair was verified before,
// so no SMS is even sent) and SMS auto-retrieval (Google Play services reads the
// incoming Firebase SMS itself). Either fires the native SDK's
// onVerificationCompleted callback, and @react-native-firebase responds to that
// by calling signInWithCredential immediately -- see
// ReactNativeFirebaseAuthModule.java's signInWithPhoneNumber, whose own comment
// on the resolve path reads "calling ConfirmationResult.confirm(code) is invalid
// in this case anyway".
//
// It resolves the JS promise anyway, with a verificationId scraped out of the
// already-consumed credential. So the app happily shows an OTP box, the user
// types the code, confirm() calls signInWithCredential against a session
// Firebase already spent, and the server answers ERROR_SESSION_EXPIRED. The
// code was never wrong and never expired -- it had already been used, by the
// phone, on the user's behalf.
//
// Nothing in this app was watching for that, which is why the manual path was
// the only path and it failed every time instant verification kicked in (i.e.
// on every device that had logged in once already). The three hooks below cover
// it: sendPhoneOtp reports an auto-completed sign-in straight away,
// watchForAutoVerification catches the case where auto-retrieval lands a few
// seconds later while the OTP screen is up, and confirmPhoneOtp treats a
// session-expired error with a signed-in matching user as success rather than
// failure.

/**
 * Armed by sendPhoneOtp only once it has confirmed the auth instance holds NO
 * signed-in user, and disarmed again the moment a token is handed out.
 *
 * Every shortcut below reads "there is a signed-in user, so verification must
 * have completed on its own" -- which is only sound if we know there was nobody
 * signed in when the verification started. Firebase persists sign-ins across
 * app launches, and logging out of MechBazar does not clear the Firebase
 * session, so without this gate anyone holding a previously-used device could
 * reach the OTP screen and be let straight back in with no SMS at all.
 */
let autoVerificationArmed = false;

/**
 * The Firebase user that auto-verification just signed in, or null. Requires
 * both that the shortcut is armed and that the user's number is the one being
 * verified -- an ID token for a different number would log the wrong rider in.
 */
const autoVerifiedUser = (rnfb: RnfbAuth, e164: string): any | null => {
  try {
    const user = rnfb.getAuthInstance()?.currentUser;
    if (!user) return null;
    if (!autoVerificationArmed) {
      log('signed-in Firebase user predates this verification -- ignoring');
      return null;
    }
    if (user.phoneNumber !== e164) {
      log('signed-in Firebase user is for a different number -- ignoring');
      return null;
    }
    return user;
  } catch (err) {
    log('failed to read current Firebase user', (err as Error)?.message ?? err);
    return null;
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
  // Mirrors the in-memory autoVerificationArmed flag at the moment this record
  // was written. That flag is what stops a LEFTOVER Firebase session from being
  // mistaken for a fresh auto-verification -- but a bare `let` does not survive
  // the exact runtime restart this whole persistence block exists to survive
  // (the user backgrounding the app to read the SMS). Without persisting it too,
  // a restart during that window would reset the gate to false and refuse to
  // recognise a GENUINE auto-verification that completed while the app was
  // gone, right back into the "session expired" dead end this file exists to
  // close. readPending() restores it below.
  armed: boolean;
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
    // Restore the arming gate every time a still-valid record is read, not
    // just after a restart -- readPending() runs on the normal path too, and
    // this keeps the two copies from ever silently diverging.
    autoVerificationArmed = !!parsed.armed;
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

export type SendOtpResult = {
  /**
   * True when Android verified the number on its own and there is no code for
   * the user to enter -- the caller should log straight in with `idToken`
   * instead of showing an OTP field.
   */
  autoVerified: boolean;
  /** Firebase ID token, ready for the backend. Set only when autoVerified. */
  idToken?: string;
};

export const sendPhoneOtp = async (phone10Digit: string): Promise<SendOtpResult> => {
  const e164 = e164For(phone10Digit);
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
  autoVerificationArmed = false;
  void clearPending();

  try {
    const rnfb = loadRnfbAuth();
    log('RNFB auth module loaded');
    const authInstance = rnfb.getAuthInstance();
    log('auth instance resolved');

    // Firebase persists sign-ins, so a user from an earlier login is very
    // likely still attached to this auth instance. Clearing it is what makes
    // "currentUser is set once signInWithPhoneNumber resolves" an unambiguous
    // signal that THIS verification auto-completed, rather than a leftover.
    if (authInstance?.currentUser) {
      try {
        await rnfb.signOut(authInstance);
        log('signed out the previously cached Firebase user');
      } catch (err: any) {
        // Leaves the shortcut disarmed rather than acting on a session we could
        // not prove is fresh. The manual code path still works, and a genuine
        // auto-verification still gets recovered in confirmPhoneOtp -- there,
        // Firebase itself reports the session as spent, which is proof enough.
        logError('sign-out before send failed -- auto-verification shortcut stays off', err?.message ?? err);
      }
    }
    autoVerificationArmed = !authInstance?.currentUser;

    // Every await below is bracketed by a log so a hang is attributable to one
    // specific call rather than to "somewhere in sendPhoneOtp".
    log('calling signInWithPhoneNumber');
    const result = await rnfb.signInWithPhoneNumber(authInstance, e164);
    confirmationResult = result;
    log('signInWithPhoneNumber resolved', {
      hasConfirmFn: typeof result?.confirm === 'function',
      // Truncated: the full id is a bearer-ish handle, no reason to spill it
      // into logcat, but the prefix is enough to correlate send with confirm.
      verificationId: result?.verificationId ? `${String(result.verificationId).slice(0, 10)}...` : null,
    });

    // Instant verification: no SMS was ever sent and the sign-in is already
    // done. Asking for a code here is what produced auth/session-expired.
    //
    // Best-effort by design. signInWithPhoneNumber resolves with a
    // ConfirmationResult, so the JS-side currentUser is updated by the native
    // auth_state_changed event rather than by this promise, and the two are not
    // ordered against each other. When the event has not landed yet this reads
    // null and the OTP step is shown for a moment -- watchForAutoVerification
    // is what closes that window, and is why it is not optional.
    const autoUser = autoVerifiedUser(rnfb, e164);
    if (autoUser) {
      log('Android auto-verified this number -- skipping the OTP step');
      const idToken = await autoUser.getIdToken();
      confirmationResult = null;
      autoVerificationArmed = false;
      await clearPending();
      return { autoVerified: true, idToken };
    }

    log('SMS dispatched by Firebase');
    if (result?.verificationId) {
      await savePending({
        verificationId: String(result.verificationId),
        phone: e164,
        createdAt: Date.now(),
        armed: autoVerificationArmed,
      });
    } else {
      log('WARNING: no verificationId on the ConfirmationResult -- confirm cannot survive a restart');
    }
    return { autoVerified: false };
  } catch (err: any) {
    logError(`signInWithPhoneNumber FAILED code=${err?.code ?? 'unknown'}`, err?.message ?? err);
    throw new Error(friendlyAuthErrorMessage(err?.code, err?.message || 'Failed to send OTP.'));
  }
};

/**
 * Watches for a sign-in that this app never asked for -- i.e. Google Play
 * services auto-retrieving the SMS a few seconds after it lands, while the user
 * is still staring at the OTP box. Without this the session is consumed behind
 * the user's back and whatever they type next fails with
 * auth/session-expired.
 *
 * Call this only after a successful sendPhoneOtp for `phone10Digit` (which
 * signs out any earlier session first), and unsubscribe when the OTP step is
 * left. Returns a no-op unsubscribe if the native module is unavailable, so
 * Expo Go keeps working.
 */
export const watchForAutoVerification = (
  phone10Digit: string,
  onVerified: (idToken: string) => void
): (() => void) => {
  const e164 = e164For(phone10Digit);
  let cancelled = false;
  let unsubscribe: (() => void) | undefined;

  try {
    const rnfb = loadRnfbAuth();
    unsubscribe = rnfb.onAuthStateChanged(rnfb.getAuthInstance(), () => {
      // Deliberately re-reads currentUser through autoVerifiedUser rather than
      // trusting the callback's argument: onAuthStateChanged also fires once on
      // subscribe with whatever is already there, and only the gated read can
      // tell a genuine auto-verification from a persisted earlier session.
      const user = cancelled ? null : autoVerifiedUser(rnfb, e164);
      if (!user) return;
      log('auth state went signed-in without a confirm() call -- Android auto-verified');
      user
        .getIdToken()
        .then((idToken: string) => {
          if (cancelled) return;
          confirmationResult = null;
          autoVerificationArmed = false;
          void clearPending();
          onVerified(idToken);
        })
        .catch((err: any) =>
          logError('failed to read ID token after auto-verification', err?.message ?? err)
        );
    });
  } catch (err) {
    // Expo Go, or a build without the native module: there is nothing to watch
    // and the manual code path is unaffected.
    log('auto-verification watch unavailable', (err as Error)?.message ?? err);
  }

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
};

// Resolves to a Firebase ID token, sent as the `otp` field to /auth/login and
// /riders/register, which verify it via firebase-admin.
export const confirmPhoneOtp = async (code: string, phone10Digit: string): Promise<string> => {
  // Logged before any await, so pressing Verify always leaves a trace even if
  // something downstream never settles.
  log('confirmPhoneOtp called', { hasInMemoryConfirmation: !!confirmationResult });

  const e164 = e164For(phone10Digit);
  const rnfb = loadRnfbAuth();

  // Read (and, if the runtime restarted since sendPhoneOtp, RESTORE) pending
  // state before the first auto-verification check below -- autoVerified is
  // gated on autoVerificationArmed, and that flag is a bare `let` that resets
  // to false across exactly the kind of restart this persistence layer exists
  // to survive. Checking it first, unrestored, would silently refuse to
  // recognise a real auto-verification that completed while the app was
  // backgrounded. See the PendingVerification.armed comment above.
  const pending = await readPending();
  log('pending verification lookup done', { hasPersistedVerification: !!pending });

  // Auto-verification may have completed between the user tapping Login and
  // this call. If it did, the sign-in already exists and there is nothing left
  // to confirm -- going through confirm() would only spend a consumed session
  // and surface it as "the sms code has expired".
  const alreadyVerified = autoVerifiedUser(rnfb, e164);
  if (alreadyVerified) {
    log('already signed in for this number -- returning that token instead of confirming');
    confirmationResult = null;
    autoVerificationArmed = false;
    await clearPending();
    return alreadyVerified.getIdToken();
  }

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
    logError(`confirm FAILED code=${err?.code ?? 'unknown'}`, err?.message ?? err);

    // A wrong code is retryable and must NOT drop the pending verification; an
    // expired/consumed session is not, so clear it and make the user resend.
    if (err?.code === 'auth/session-expired' || err?.code === 'auth/code-expired') {
      confirmationResult = null;
      await clearPending();

      // ...unless the session was consumed by auto-verification signing this
      // very number in, in which case the "expired" session did its job and the
      // user is logged in. Checked after the catch rather than before because
      // the race is only observable once confirm() has round-tripped.
      const raced = autoVerifiedUser(rnfb, e164);
      if (raced) {
        log('session was consumed by Android auto-verification -- treating as success');
        autoVerificationArmed = false;
        return raced.getIdToken();
      }
    }

    throw new Error(friendlyAuthErrorMessage(err?.code, err?.message || 'Failed to verify OTP.'));
  }

  if (!userCredential) {
    throw new Error('Failed to confirm OTP.');
  }

  const idToken = await userCredential.user.getIdToken();
  log('OTP confirmed, ID token obtained');
  confirmationResult = null;
  // confirm() itself just signed a user in, so leaving the shortcut armed would
  // let the watcher fire a second, redundant login for the same token.
  autoVerificationArmed = false;
  await clearPending();
  return idToken;
};
