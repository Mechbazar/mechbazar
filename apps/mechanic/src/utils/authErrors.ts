// Firebase phone-auth throws error objects whose `.message` is written for a
// developer reading logcat ("[auth/session-expired] The sms code has expired.
// Please re-send the verification code to try again.") rather than for a
// mechanic trying to get to work. LoginScreen shows `err.message` directly, so
// an unmapped code puts that raw bracketed string straight on screen. This maps
// the handful of codes real users can actually hit; anything unmapped falls
// back to a generic retry message instead of the raw Firebase text.
//
// Mirrors apps/mobile/src/utils/authErrors.ts.
const FRIENDLY_AUTH_ERRORS: Record<string, string> = {
  // NOT a connectivity failure. Firebase reached the Identity Toolkit backend
  // fine and the backend refused because the app could not attest itself: Play
  // Integrity failed (normal for a sideloaded APK -- Play only attests copies
  // it installed) AND the reCAPTCHA fallback produced no token either. Telling
  // the user to check their internet sends them to fix the one thing that is
  // provably working.
  'auth/missing-client-identifier':
    "We couldn't complete the security check for this device. Please try again — " +
    'if a browser window opens, finish the check there. If it keeps failing, ' +
    'contact support.',
  'auth/too-many-requests':
    'Too many attempts for this number. Please wait a while before requesting another OTP.',
  'auth/invalid-phone-number': 'That does not look like a valid phone number.',
  'auth/quota-exceeded': 'OTP service is temporarily busy. Please try again shortly.',
  // Both of these mean the verification session behind the code is gone, so the
  // only way forward is a fresh send -- which is what "Resend OTP" does.
  'auth/code-expired': 'This OTP has expired. Tap "Resend OTP" to get a new one.',
  'auth/session-expired': 'This OTP session has expired. Tap "Resend OTP" to get a new one.',
  'auth/invalid-verification-code': 'That OTP is incorrect. Please check and try again.',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
};

export const friendlyAuthErrorMessage = (code: string | undefined, fallback: string): string => {
  if (code && FRIENDLY_AUTH_ERRORS[code]) return FRIENDLY_AUTH_ERRORS[code];
  return fallback;
};
