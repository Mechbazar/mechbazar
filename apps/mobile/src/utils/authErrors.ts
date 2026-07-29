// Firebase phone-auth throws error objects whose `.message` is written for a
// developer reading logcat ("Play Integrity checks... check the logcat for
// more details"), not for a customer trying to log in. WelcomeScreen shows
// `err.message` directly, so an unmapped code used to put that raw text on
// screen. This maps the handful of codes real users can actually hit to
// something they can act on; anything unmapped falls back to a generic retry
// message instead of the raw Firebase string.
const FRIENDLY_AUTH_ERRORS: Record<string, string> = {
  'auth/missing-client-identifier':
    'Could not verify this device for OTP login. Please check your internet connection and try again in a moment.',
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
