import admin from '../config/firebase';

// Phone auth is Firebase-only. The client (every app) runs Firebase Phone
// Auth, which sends the real SMS and, on confirmation, yields a Firebase ID
// token. That token -- not a raw numeric code -- is what every auth endpoint
// passes here as `otp`. There is no local OTP generation, no TEST provider,
// and no developer bypass: the only way to authenticate a phone is a valid
// Firebase-issued token proving control of that number.

export class OtpVerificationError extends Error {}

/**
 * Verifies a Firebase phone-auth ID token and returns the E.164 phone number
 * it proves ownership of. `otp` is the Firebase ID token produced client-side
 * by confirming the SMS code; `phone` is the number the caller claims, checked
 * against the token to prevent logging in as a different number than verified.
 */
export const verifyOtpAndResolvePhone = async (phone: string, otp: string): Promise<string> => {
  if (!otp || typeof otp !== 'string') {
    throw new OtpVerificationError('Missing verification token');
  }

  try {
    // `checkRevoked: true` makes this reject a token belonging to a Firebase
    // user that has since been disabled or deleted -- which is what account
    // deletion does -- instead of accepting it until it expires on its own.
    const decodedToken = await admin.auth().verifyIdToken(otp, true);
    const verifiedPhone = decodedToken.phone_number;
    if (!verifiedPhone) {
      throw new OtpVerificationError('Verification token does not prove ownership of a phone number');
    }
    // Exact comparison on the last 10 digits. This was previously
    // `verifiedPhone.includes(claimedDigits)`, a substring test -- so a caller
    // holding a valid token for +919998887771 could claim to be "888" and pass,
    // because "888" is a substring of their own number. The returned value has
    // always been the token's own phone number rather than the claimed one, so
    // this was not directly exploitable, but a substring check has no business
    // guarding an authentication boundary.
    const verifiedDigits = verifiedPhone.replace(/\D/g, '');
    const claimedDigits = String(phone).replace(/\D/g, '');
    if (claimedDigits.length < 10 || verifiedDigits.slice(-10) !== claimedDigits.slice(-10)) {
      throw new OtpVerificationError('Phone number mismatch with verification token');
    }
    return verifiedPhone;
  } catch (err) {
    if (err instanceof OtpVerificationError) throw err;
    console.error('Firebase token verification failed:', err);
    throw new OtpVerificationError('Invalid or expired verification token');
  }
};
