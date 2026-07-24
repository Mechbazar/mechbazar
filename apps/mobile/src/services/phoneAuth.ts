import { getApp } from '@react-native-firebase/app';
import { getAuth, signInWithPhoneNumber, ConfirmationResult } from '@react-native-firebase/auth';

// Android/iOS build only (Metro picks this file over phoneAuth.web.ts for
// native platforms) -- uses @react-native-firebase/auth's native SDK, which
// verifies via Play Integrity instead of a reCAPTCHA widget, so no
// ApplicationVerifier/container element is needed here (unlike phoneAuth.web.ts).
let confirmationResult: ConfirmationResult | null = null;

export const sendPhoneOtp = async (phone10Digit: string): Promise<void> => {
  confirmationResult = await signInWithPhoneNumber(getAuth(getApp()), `+91${phone10Digit}`);
};

// Resolves to a Firebase ID token -- sent as the `otp` field to the existing
// /auth/login and /auth/register endpoints, which already verify it via
// firebase-admin when OTP_PROVIDER=PRODUCTION (see apps/backend/src/utils/otp.ts).
export const confirmPhoneOtp = async (code: string): Promise<string> => {
  if (!confirmationResult) {
    throw new Error('No OTP request in progress. Send an OTP first.');
  }
  const userCredential = await confirmationResult.confirm(code);
  if (!userCredential) {
    throw new Error('Failed to confirm OTP.');
  }
  const idToken = await userCredential.user.getIdToken();
  confirmationResult = null;
  return idToken;
};
