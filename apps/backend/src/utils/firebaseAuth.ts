import admin from '../config/firebase';
import prisma from '../config/prisma';
import { Role, User } from '@prisma/client';

// Admin/Vendor auth is Firebase Email/Password-based (mirrors otp.ts's
// phone-auth pattern). The client runs signInWithEmailAndPassword, then
// passes us the resulting Firebase ID token instead of a raw password --
// this is the only place that token gets verified, once, at login. Every
// request after that is authorized by the app's own JWT (middlewares/auth.ts),
// unchanged.
export type FirebaseAuthErrorCode =
  | 'INVALID_TOKEN'
  | 'EMAIL_NOT_VERIFIED'
  | 'NO_LINKED_ACCOUNT'
  | 'FORBIDDEN';

export class FirebaseAuthError extends Error {
  code: FirebaseAuthErrorCode;
  constructor(code: FirebaseAuthErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Verifies a Firebase Email/Password ID token and resolves it to the linked
 * Prisma User row. The user is looked up by `firebaseUid` -- the server-
 * trusted claim from the verified token -- never by an email taken from the
 * request body, so a caller can't claim a different account's identity while
 * presenting a token that only proves control of their own.
 */
export const verifyFirebaseIdTokenAndResolveUser = async (
  idToken: string,
  allowedRoles: Role[]
): Promise<User> => {
  if (!idToken || typeof idToken !== 'string') {
    throw new FirebaseAuthError('INVALID_TOKEN', 'Missing verification token');
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (err) {
    console.error('Firebase ID token verification failed:', err);
    throw new FirebaseAuthError('INVALID_TOKEN', 'Invalid or expired session. Please sign in again.');
  }

  if (!decoded.email_verified) {
    throw new FirebaseAuthError('EMAIL_NOT_VERIFIED', 'Please verify your email before signing in.');
  }

  const user = await prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
  if (!user) {
    throw new FirebaseAuthError('NO_LINKED_ACCOUNT', 'Invalid credentials or unauthorized');
  }

  // Checked against the full multi-role set, not the single legacy `role`
  // column -- a vendor who is also a customer (or vice versa) must still be
  // able to sign in through this path as long as VENDOR is one of their roles.
  if (!allowedRoles.some((r) => user.roles.includes(r))) {
    throw new FirebaseAuthError('FORBIDDEN', 'Invalid credentials or unauthorized');
  }

  return user;
};

/**
 * Verifies a Firebase ID token without requiring the email to already be
 * verified, and without resolving to a linked Prisma row. Used only by
 * resend-verification-email, where an unverified email is the expected,
 * normal case rather than a rejection condition -- the whole point of the
 * call is to prove "this token really does belong to this address" so
 * another verification mail can be sent to it.
 */
export const verifyFirebaseIdTokenAllowUnverified = async (
  idToken: string
): Promise<{ uid: string; email: string | null }> => {
  if (!idToken || typeof idToken !== 'string') {
    throw new FirebaseAuthError('INVALID_TOKEN', 'Missing verification token');
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email ?? null };
  } catch (err) {
    console.error('Firebase ID token verification failed:', err);
    throw new FirebaseAuthError('INVALID_TOKEN', 'Invalid or expired session. Please sign in again.');
  }
};
