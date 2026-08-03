// Type-only imports are erased at compile time, so they never emit a
// `require` -- the native module is pulled in lazily by loadRnfbAuth() below.
import type { ConfirmationResult } from '@react-native-firebase/auth';
// AsyncStorage rather than expo-secure-store: the verificationId is a
// short-lived opaque handle, not a secret, and AsyncStorage has been a
// dependency of this app (and therefore present in every dev client and
// production build) far longer than expo-secure-store, which was only added in
// 20d60f3. Nothing on the OTP critical path should depend on a native module
// that a already-installed build might not contain.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { friendlyAuthErrorMessage } from '../utils/authErrors';

// Android/iOS build only (Metro picks this file over phoneAuth.web.ts for
// native platforms) -- uses @react-native-firebase/auth's native SDK, which
// verifies via Play Integrity instead of a reCAPTCHA widget, so no
// ApplicationVerifier/container element is needed here (unlike phoneAuth.web.ts).
//
// @react-native-firebase is a native module that Expo Go does not ship. It used
// to be imported at the top level, so requiring this file -- which App.tsx does
// transitively via WelcomeScreen -- threw "Native module RNFBAppModule not
// found" before the first screen could render, red-screening the whole app in
// Expo Go. The require is now deferred into the two functions that actually
// need it, so the app boots and every screen is browsable under Expo Go; only
// the OTP calls themselves fail, with the explanation below instead of a crash.
//
// This changes nothing for real builds (dev client, preview, production): the
// native module is present, the require succeeds, and Play Integrity phone auth
// works exactly as before. Do NOT hoist these back to top-level imports.
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

const e164For = (phone10Digit: string) => `+91${phone10Digit}`;

// WARNING: these are console.log, and babel.config.js applies
// `transform-remove-console` with `exclude: ['error','warn']` for production
// builds -- so every line below is COMPILED OUT of a release APK. That is
// deliberate (they print the phone number and a verificationId prefix), but it
// also means a release build used to leave no trace of an OTP failure in
// logcat whatsoever, which is exactly why "check logcat for the real Firebase
// exception" was not actionable on a production build. Anything that must
// survive a release build has to go through console.error/console.warn --
// see logAuthErrorDetail and breadcrumb below.
const log = (msg: string, extra?: unknown) => {
  const line = `[otp:native] ${new Date().toISOString()} ${msg}`;
  if (extra !== undefined) {
    console.log(line, extra);
  } else {
    console.log(line);
  }
};

// Release-visible, PII-free progress marker. Without it a release-build failure
// report cannot distinguish "the native module never loaded" from "Firebase was
// called and rejected us" -- the two have completely different fixes. Carries
// no phone number, no verificationId: only which step was reached.
const breadcrumb = (stage: string) => {
  console.warn(`[otp:native] stage=${stage}`);
};

// The friendly text from authErrors.ts is what the user sees, which means the
// only place the ACTUAL cause can still be recovered from is logcat. A bare
// `err.code` is not enough to act on: every device-attestation failure arrives
// as the single code `auth/missing-client-identifier`, and what distinguishes
// "Play Integrity said this APK wasn't installed by Play" from "the reCAPTCHA
// tab was dismissed" from "SHA-1 not registered" lives only in the native
// exception that @react-native-firebase wraps -- `nativeErrorCode` /
// `nativeErrorMessage`, plus whatever `userInfo` carries up from the Android
// SDK. Emitted via console.error so it lands at logcat priority E and can be
// pulled without wading through the whole JS log:
//
//   adb logcat -s ReactNativeJS:E | grep otp:native
//
// Guard rails: this runs inside a catch on the login critical path, so it must
// not be able to throw itself (hence the try/catch and the JSON.stringify
// replacer for circular native error objects).
const logAuthErrorDetail = (stage: string, err: any) => {
  try {
    const detail: Record<string, unknown> = {
      stage,
      code: err?.code ?? null,
      message: err?.message ?? null,
      nativeErrorCode: err?.nativeErrorCode ?? null,
      nativeErrorMessage: err?.nativeErrorMessage ?? null,
      userInfo: err?.userInfo ?? null,
    };
    const seen = new WeakSet();
    console.error(
      `[otp:native] FIREBASE ERROR DETAIL ${new Date().toISOString()}`,
      JSON.stringify(detail, (_k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[circular]';
          seen.add(v);
        }
        return v;
      })
    );
    if (err?.stack) console.error(`[otp:native] stack: ${String(err.stack).slice(0, 2000)}`);
  } catch (loggingErr) {
    console.error('[otp:native] failed to serialise Firebase error', String(loggingErr));
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
    // Thrown while the RNFB module initialises against a missing native
    // counterpart -- the Expo Go case. Anything else is a genuine bug, so keep
    // the original message attached rather than swallowing it.
    throw new Error(`${EXPO_GO_HINT} (${(err as Error)?.message ?? String(err)})`);
  }
};

// --- Android auto-verification ------------------------------------------------
//
// Android completes phone verification WITHOUT the user typing anything in two
// situations: instant verification (this device+number pair was verified before,
// so no SMS is even sent) and SMS auto-retrieval (Google Play services reads the
// incoming Firebase SMS itself). Either fires the native SDK's
// onVerificationCompleted callback, and @react-native-firebase responds to that
// by calling signInWithCredential immediately, resolving the JS promise anyway
// with a verificationId scraped out of the already-consumed credential. So the
// app happily shows an OTP box, the user types the code, confirm() calls
// signInWithCredential against a session Firebase already spent, and the server
// answers auth/session-expired. The code was never wrong and never expired -- it
// had already been used, by the phone, on the user's behalf.
//
// Armed by sendPhoneOtp only once it has confirmed the auth instance holds NO
// signed-in user, and disarmed again the moment a token is handed out -- this is
// what stops a LEFTOVER Firebase session (persisted across app launches, and not
// cleared by logging out of MechBazar) from being mistaken for a fresh
// auto-verification.
let autoVerificationArmed = false;

/**
 * The Firebase user that auto-verification just signed in, or null. Requires
 * both that the shortcut is armed and that the user's number is the one being
 * verified -- an ID token for a different number would log the wrong user in.
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
  // was written -- a bare `let` does not survive the exact runtime restart this
  // persistence block exists to survive (the user backgrounding the app to read
  // the SMS). readPending() restores it below.
  armed: boolean;
};

const savePending = async (pending: PendingVerification): Promise<void> => {
  try {
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    log('pending verification persisted');
  } catch (err) {
    // Persistence is a durability upgrade, not a precondition -- if the store
    // is unavailable the in-memory path still works for the common case.
    log('failed to persist pending verification', (err as Error)?.message ?? err);
  }
};

const readPending = async (): Promise<PendingVerification | null> => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingVerification;
    if (!parsed?.verificationId) return null;
    const age = Date.now() - (parsed.createdAt ?? 0);
    if (age > PENDING_TTL_MS) {
      log(`persisted verification discarded -- ${Math.round(age / 1000)}s old`);
      await clearPending();
      return null;
    }
    // Restore the arming gate every time a still-valid record is read, not just
    // after a restart -- readPending() runs on the normal path too, and this
    // keeps the two copies from ever silently diverging.
    autoVerificationArmed = !!parsed.armed;
    return parsed;
  } catch (err) {
    log('failed to read pending verification', (err as Error)?.message ?? err);
    return null;
  }
};

const clearPending = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PENDING_KEY);
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
    breadcrumb('send:begin');
    const rnfb = loadRnfbAuth();
    log('RNFB auth module loaded');
    const authInstance = rnfb.getAuthInstance();
    log('auth instance resolved');
    breadcrumb('send:firebase-ready');

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
        log('sign-out before send failed -- auto-verification shortcut stays off', err?.message ?? err);
      }
    }
    autoVerificationArmed = !authInstance?.currentUser;

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
    breadcrumb('send:sms-dispatched');

    // Instant verification: no SMS was ever sent and the sign-in is already
    // done. Asking for a code here is what produced auth/session-expired. Best
    // effort by design -- the native auth_state_changed event that updates
    // currentUser is not ordered against this promise, so if it hasn't landed
    // yet this reads null and the OTP step shows for a moment;
    // watchForAutoVerification (wired up by the caller) closes that window.
    const autoUser = autoVerifiedUser(rnfb, e164);
    if (autoUser) {
      log('Android auto-verified this number -- skipping the OTP step');
      const idToken = await autoUser.getIdToken();
      confirmationResult = null;
      autoVerificationArmed = false;
      await clearPending();
      breadcrumb('send:auto-verified');
      return { autoVerified: true, idToken };
    }

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
    log(`signInWithPhoneNumber FAILED code=${err?.code ?? 'unknown'}`, err?.message ?? err);
    logAuthErrorDetail('sendPhoneOtp/signInWithPhoneNumber', err);
    throw new Error(friendlyAuthErrorMessage(err?.code, err?.message || 'Failed to send OTP.'));
  }
};

/**
 * Watches for a sign-in that this app never asked for -- i.e. Google Play
 * services auto-retrieving the SMS a few seconds after it lands, while the user
 * is still staring at the OTP box. Without this the session is consumed behind
 * the user's back and whatever they type next fails with auth/session-expired.
 *
 * Call this only after a successful sendPhoneOtp for `phone10Digit`, and
 * unsubscribe when the OTP step is left. Returns a no-op unsubscribe if the
 * native module is unavailable, so Expo Go keeps working.
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
          log('failed to read ID token after auto-verification', err?.message ?? err)
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

// Resolves to a Firebase ID token -- sent as the `otp` field to the
// /auth/login and /auth/register endpoints, which verify it via firebase-admin
// (see apps/backend/src/utils/otp.ts).
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
  // backgrounded.
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
    log(`confirm FAILED code=${err?.code ?? 'unknown'}`, err?.message ?? err);
    logAuthErrorDetail('confirmPhoneOtp/confirm', err);

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
