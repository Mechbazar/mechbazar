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
    const decodedToken = await admin.auth().verifyIdToken(otp);
    const verifiedPhone = decodedToken.phone_number;
    if (!verifiedPhone || !verifiedPhone.includes(phone.replace(/\D/g, ''))) {
      throw new OtpVerificationError('Phone number mismatch with verification token');
    }
    return verifiedPhone;
  } catch (err) {
    if (err instanceof OtpVerificationError) throw err;
    console.error('Firebase token verification failed:', err);
    throw new OtpVerificationError('Invalid or expired verification token');
  }
};
