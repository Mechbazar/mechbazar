// Firebase phone-auth throws error objects whose `.message` is written for a
// developer reading logcat ("Play Integrity checks... check the logcat for
// more details"), not for a customer trying to log in. WelcomeScreen shows
// `err.message` directly, so an unmapped code used to put that raw text on
// screen. This maps the handful of codes real users can actually hit to
// something they can act on; anything unmapped falls back to a generic retry
// message instead of the raw Firebase string.
const FRIENDLY_AUTH_ERRORS: Record<string, string> = {
  // NOT a connectivity failure, and the copy must never say it is. This code
  // means Firebase reached the Identity Toolkit backend perfectly well and the
  // backend refused the request because the app could not attest itself: the
  // Play Integrity check failed (normal for a sideloaded APK -- Play only
  // attests copies it installed) AND the reCAPTCHA fallback did not produce a
  // token either. Telling the user to check their internet connection sends
  // them to fix the one thing that is provably working, so the previous
  // wording here was actively misleading. Ask them to retry -- the reCAPTCHA
  // fallback opens a browser tab and genuinely does succeed on a second
  // attempt -- and point the real diagnosis at logcat, where phoneAuth.ts
  // logs the underlying native exception.
  'auth/missing-client-identifier':
    "We couldn't complete the security check for this device. Please try again — " +
    'if a browser window opens, finish the check there. If it keeps failing, ' +
    'contact support.',
  'auth/too-many-requests':
    'Too many attempts for this number. Please wait a while before requesting another OTP.',
  'auth/invalid-phone-number': 'That does not look like a valid phone number.',
  'auth/quota-exceeded': 'OTP service is temporarily busy. Please try again shortly.',
  'auth/code-expired': 'This OTP has expired. Please request a new one.',
  'auth/session-expired': 'This OTP session has expired. Please request a new one.',
  'auth/invalid-verification-code': 'That OTP is incorrect. Please check and try again.',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
};

export const friendlyAuthErrorMessage = (code: string | undefined, fallback: string): string => {
  if (code && FRIENDLY_AUTH_ERRORS[code]) return FRIENDLY_AUTH_ERRORS[code];
  return fallback;
};
