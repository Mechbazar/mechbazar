import { getApp } from '@react-native-firebase/app';
import { getAuth, signInWithPhoneNumber, ConfirmationResult } from '@react-native-firebase/auth';

// Firebase Phone Auth for the rider app (native-only -- this app ships as an
// Android build, not web). signInWithPhoneNumber sends the real SMS via Play
// Integrity; confirming the code yields a Firebase ID token that the backend
// verifies (see apps/backend/src/utils/otp.ts). Mirrors the customer app's
// apps/mobile/src/services/phoneAuth.ts.
let confirmationResult: ConfirmationResult | null = null;

export const sendPhoneOtp = async (phone10Digit: string): Promise<void> => {
  confirmationResult = await signInWithPhoneNumber(getAuth(getApp()), `+91${phone10Digit}`);
};

// Resolves to a Firebase ID token, sent as the `otp` field to /auth/login and
// /riders/register, which verify it via firebase-admin.
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
