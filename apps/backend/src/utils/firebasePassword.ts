import bcrypt from 'bcryptjs';
import admin from '../config/firebase';
import prisma from '../config/prisma';
import { isEmailConfigured } from '../config/env';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service';

/**
 * Password operations that need Firebase Auth rather than the local bcrypt
 * hash on User.password.
 *
 * WHY BOTH STORES EXIST
 * ---------------------
 * Staff and vendor accounts have credentials in two places, and both are live:
 *
 *   User.password (bcrypt)  POST /auth/login, /auth/admin/login and
 *                           /vendors/login accept email+password and
 *                           bcrypt-compare against it. This is what
 *                           apps/admin-mobile and apps/seller-mobile sign in
 *                           with.
 *   Firebase Auth           apps/admin and apps/vendor (web) sign in with the
 *                           Firebase client SDK and forward an ID token.
 *                           vendor.controller.ts's registerPersonal mirrors the
 *                           password into Firebase at signup, which is how the
 *                           two came to hold the same secret.
 *
 * Nothing kept them in step afterwards. A reset performed through Firebase (the
 * only channel that could actually deliver a mail) left the bcrypt hash on the
 * old password, so the mobile apps kept rejecting the new one and the reset
 * looked broken; a change made through PATCH /auth/change-password left
 * Firebase on the old password, so the web panels did. Every helper here exists
 * to close one direction of that gap.
 *
 * THE API KEY, AND WHY THERE IS NO DEFAULT
 * ----------------------------------------
 * Firebase's REST endpoints take a project API key. The obvious candidate is
 * the one apps/admin/src/config/firebase.ts already ships
 * (AIzaSyDGfDIni8X8FQyroo-KonEfbJQuHBV0nKk) -- it is a public client
 * identifier, not a secret, so embedding it here would be no leak. It also does
 * not work: that key is the project's *Browser* key and carries an HTTP
 * referrer restriction, so a call from a server, which sends no Referer,
 * comes back "Requests from referer <empty> are blocked."
 *
 * Defaulting to it would therefore have produced exactly the failure this whole
 * change exists to remove: a reset endpoint that answers "link sent" while
 * Firebase rejects every request and nobody receives anything. So there is no
 * default. When FIREBASE_WEB_API_KEY is unset the helpers below report that
 * they are unconfigured and the caller says so out loud.
 *
 * To configure, create a key with no application restriction, scoped to
 * Identity Toolkit alone:
 *
 *   gcloud services api-keys create \
 *     --project=mech-bazar-8fd86 \
 *     --display-name="Identity Toolkit (backend)" \
 *     --api-target=service=identitytoolkit.googleapis.com
 *   gcloud services api-keys get-key-string <UID> --project=mech-bazar-8fd86
 *
 * then set FIREBASE_WEB_API_KEY on the backend. Do not reuse the Android or
 * iOS keys: they are unrestricted enough to work, but they ship inside the
 * mobile apps, and a server key should be revocable without shipping a release.
 */
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';

/**
 * Whether password reset and Firebase-side password checks can work at all.
 * Callers must branch on this rather than letting the request fail silently.
 */
export const isFirebasePasswordApiConfigured = (): boolean => Boolean(FIREBASE_WEB_API_KEY);

const IDENTITY_TOOLKIT = 'https://identitytoolkit.googleapis.com/v1/accounts';

// Firebase is a third party on the far side of the internet, and both callers
// sit in a request path a user is waiting on. Without a deadline a hung
// connection would hold the request open until the platform's own timeout.
const REQUEST_TIMEOUT_MS = Number(process.env.FIREBASE_REST_TIMEOUT_MS || 8000);

async function identityToolkit(
  method: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${IDENTITY_TOOLKIT}:${method}?key=${FIREBASE_WEB_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

// Where the project's shared AuthAction page lives
// (apps/vendor/src/pages/AuthAction.tsx). Every verify-email/reset-password
// link built by the two functions below points here.
const AUTH_ACTION_URL = process.env.AUTH_ACTION_URL || 'https://vendor.mechbazar.com/auth-action';

function buildAuthActionLink(mode: 'verifyEmail' | 'resetPassword', oobCode: string, continueUrl?: string): string {
  const url = new URL(AUTH_ACTION_URL);
  url.searchParams.set('mode', mode);
  url.searchParams.set('oobCode', oobCode);
  if (continueUrl) url.searchParams.set('continueUrl', continueUrl);
  return url.toString();
}

// Admin SDK's generate*Link calls never trigger Firebase's own send -- they
// only ever return a link for the caller to deliver however it likes. That
// link still points at Firebase's own hosted domain; only the oobCode inside
// it is what we actually need, to rebuild the link against our own page.
function extractOobCode(firebaseGeneratedLink: string): string | null {
  return new URL(firebaseGeneratedLink).searchParams.get('oobCode');
}

/**
 * Sends a password-reset email. Prefers generating the oobCode via the Admin
 * SDK and delivering it through this backend's own mailer (Resend, see
 * services/email.service.ts) to our own AuthAction page -- Firebase's
 * *automatic* send always links to its own hosted action page
 * ({project}.firebaseapp.com/__/auth/action), and the one project setting
 * that could redirect that automatic send elsewhere (`callbackUri` /
 * Console's "Customize action URL") rejects writes from both the Admin API
 * and the Console UI as of 2026-08 (likely tied to Firebase Dynamic Links
 * being retired) -- so taking over delivery ourselves is the only way left
 * to control the destination.
 *
 * Falls back to Firebase's own REST-triggered send (the pre-2026-08-01
 * behavior, gated on FIREBASE_WEB_API_KEY) when RESEND_API_KEY isn't set yet,
 * so this doesn't disable password reset while Resend is still being set up.
 *
 * `continueUrl`, if given, is where the AuthAction page sends the user back
 * to afterward -- the caller (forgotPassword below) is expected to validate
 * it against a known-app allowlist before it ever reaches here.
 *
 * Returns false on any failure so the caller can decide what to tell the user
 * without leaking whether the address has an account.
 */
export const sendFirebasePasswordResetEmail = async (email: string, continueUrl?: string): Promise<boolean> => {
  if (isEmailConfigured()) {
    try {
      const firebaseLink = await admin.auth().generatePasswordResetLink(email);
      const oobCode = extractOobCode(firebaseLink);
      if (!oobCode) {
        console.error('generatePasswordResetLink returned a link with no oobCode:', firebaseLink);
        return false;
      }
      return await sendPasswordResetEmail(email, buildAuthActionLink('resetPassword', oobCode, continueUrl));
    } catch (err) {
      console.error('Failed to generate/send password reset email via Resend:', err);
      return false;
    }
  }

  if (!isFirebasePasswordApiConfigured()) {
    console.error('Password reset requested but neither RESEND_API_KEY nor FIREBASE_WEB_API_KEY is set -- no email can be sent.');
    return false;
  }
  try {
    const { ok, data } = await identityToolkit('sendOobCode', {
      requestType: 'PASSWORD_RESET',
      email,
      ...(continueUrl ? { continueUrl } : {}),
    });
    if (!ok) {
      console.error('Firebase sendOobCode failed:', data?.error?.message || data);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Firebase sendOobCode threw:', err);
    return false;
  }
};

/**
 * Sends a verify-email email. Same Resend-first, Firebase-REST-fallback
 * design as sendFirebasePasswordResetEmail above -- see its doc comment for
 * why. The REST fallback needs `idToken` because VERIFY_EMAIL (unlike
 * PASSWORD_RESET) operates on "the currently authenticated user," not an
 * arbitrary address; the caller (resendVerificationEmail below) already has
 * one, since proving control of the account is exactly what that endpoint
 * requires before sending anything.
 */
export const sendFirebaseVerificationEmail = async (
  email: string,
  idToken: string,
  continueUrl?: string
): Promise<boolean> => {
  if (isEmailConfigured()) {
    try {
      const firebaseLink = await admin.auth().generateEmailVerificationLink(email);
      const oobCode = extractOobCode(firebaseLink);
      if (!oobCode) {
        console.error('generateEmailVerificationLink returned a link with no oobCode:', firebaseLink);
        return false;
      }
      return await sendVerificationEmail(email, buildAuthActionLink('verifyEmail', oobCode, continueUrl));
    } catch (err) {
      console.error('Failed to generate/send verification email via Resend:', err);
      return false;
    }
  }

  if (!isFirebasePasswordApiConfigured()) {
    console.error('Verification email requested but neither RESEND_API_KEY nor FIREBASE_WEB_API_KEY is set -- no email can be sent.');
    return false;
  }
  try {
    const { ok, data } = await identityToolkit('sendOobCode', {
      requestType: 'VERIFY_EMAIL',
      idToken,
      ...(continueUrl ? { continueUrl } : {}),
    });
    if (!ok) {
      console.error('Firebase sendOobCode failed:', data?.error?.message || data);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Firebase sendOobCode threw:', err);
    return false;
  }
};

/**
 * Checks an email+password pair against Firebase Auth.
 *
 * Used only after the local bcrypt comparison has already failed, to answer
 * "is this the password they just set through Firebase's reset page?" -- see
 * reconcilePasswordAfterFirebaseReset below. It is never a substitute for the
 * bcrypt check, only a second opinion when that check says no.
 */
export const verifyFirebasePassword = async (email: string, password: string): Promise<boolean> => {
  // Unconfigured means "cannot confirm", which must read as "not valid" -- and
  // it costs nothing, since the local bcrypt check has already failed.
  if (!isFirebasePasswordApiConfigured()) return false;
  try {
    const { ok } = await identityToolkit('signInWithPassword', {
      email,
      password,
      returnSecureToken: false,
    });
    return ok;
  } catch (err) {
    // A network failure must read as "could not confirm", never as "correct".
    console.error('Firebase signInWithPassword threw:', err);
    return false;
  }
};

/**
 * Writes a password into Firebase Auth for an existing linked account, so a
 * change made against the local store does not strand the web panels on the
 * old one.
 *
 * Deliberately non-throwing: the local password has already been updated by the
 * time this runs, and failing the whole request would report "change failed" for
 * a change that did happen. A drift in this direction self-corrects the next
 * time the user signs in on the web and resets, whereas a false failure just
 * makes them try again.
 */
export const setFirebasePassword = async (firebaseUid: string, password: string): Promise<boolean> => {
  try {
    await admin.auth().updateUser(firebaseUid, { password });
    return true;
  } catch (err) {
    console.error('Failed to mirror password change into Firebase:', err);
    return false;
  }
};

/**
 * Second-chance password check for accounts whose local hash has fallen behind
 * Firebase.
 *
 * Firebase's reset mail leads to Firebase's own hosted page, which updates
 * Firebase Auth and tells this backend nothing. Before this existed, a user who
 * completed that reset was left worse off than before: the web panels accepted
 * the new password, the mobile apps still demanded the old one, and no screen
 * anywhere explained why. This closes the loop -- when the local bcrypt compare
 * fails, ask Firebase whether the password is right *there*, and if it is,
 * re-hash it locally so the two agree from then on.
 *
 * Only ever called after bcrypt has already said no, so it cannot weaken the
 * local check; the cost is one outbound call on a failed login by a user who
 * has a linked Firebase account. Returns true when the caller should be
 * treated as authenticated.
 *
 * Shared by all three email+password login paths -- /auth/login,
 * /auth/admin/login and /vendors/login -- because a reset that only unlocked
 * one of them would be the same half-finished flow in a new place.
 */
export const reconcilePasswordAfterFirebaseReset = async (
  user: { id: string; email: string | null; firebaseUid: string | null },
  password: string
): Promise<boolean> => {
  if (!user.email || !user.firebaseUid || !password) return false;
  const validInFirebase = await verifyFirebasePassword(user.email, password);
  if (!validInFirebase) return false;
  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
  console.log(`Reconciled local password hash from Firebase for user ${user.id}`);
  return true;
};

/**
 * Ensures a Firebase account exists for a local user, so a reset mail has
 * somewhere to land.
 *
 * Accounts created before vendor signup started mirroring into Firebase, and
 * admin/staff rows seeded straight into the database, have firebaseUid = null.
 * Firebase will not send a reset for an address it has never seen, so those
 * users could never receive one. The account is created without a password:
 * that is a valid Firebase state, and the reset link is precisely the mechanism
 * for setting the first one.
 *
 * Returns the uid, or null if it could not be established.
 */
export const ensureFirebaseAccount = async (
  userId: string,
  email: string,
  existingUid: string | null
): Promise<string | null> => {
  if (existingUid) return existingUid;
  try {
    // The address may already exist in Firebase without being linked here --
    // e.g. the account was created by an earlier signup path and the local
    // firebaseUid write failed. Adopt it rather than colliding with it.
    const existing = await admin.auth().getUserByEmail(email).catch(() => null);
    if (existing) return existing.uid;

    // uid mirrors the local user id, the same convention registerPersonal uses.
    const created = await admin.auth().createUser({ uid: userId, email, emailVerified: false });
    return created.uid;
  } catch (err) {
    console.error('Failed to ensure Firebase account for password reset:', err);
    return null;
  }
};
