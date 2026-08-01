// Firebase Auth throws FirebaseError with a `code` like "auth/wrong-password".
// This maps the ones users can actually hit during login/reset/verification
// to inline, user-friendly copy -- anything unlisted falls back to a generic
// message rather than surfacing Firebase's raw (developer-oriented) text.
export function mapFirebaseAuthError(code: string | undefined): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact support.';
    case 'auth/weak-password':
      return 'That password is too weak. Use at least 6 characters.';
    case 'auth/requires-recent-login':
      return 'For security, please sign out and sign in again before changing your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'This link has expired or already been used. Request a new verification email and use the latest one.';
    case 'auth/invalid-phone-number':
    case 'auth/missing-phone-number':
      return 'Please enter a valid 10-digit phone number.';
    case 'auth/invalid-verification-code':
      return 'Incorrect OTP. Please check the code and try again.';
    case 'auth/code-expired':
      return 'This OTP has expired. Please request a new one.';
    case 'auth/quota-exceeded':
      return 'SMS limit reached for now. Please try again later.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
