import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from './firebase';

// Web build only (Metro picks this file over phoneAuth.native.ts for the
// `web` platform) -- the native @react-native-firebase/auth module has no
// web implementation, and the JS SDK's phone auth needs a real DOM node for
// its invisible reCAPTCHA widget, which only exists on this platform.
const RECAPTCHA_CONTAINER_ID = 'firebase-recaptcha-container';

const ensureRecaptchaContainer = (): string => {
  if (typeof document !== 'undefined' && !document.getElementById(RECAPTCHA_CONTAINER_ID)) {
    const div = document.createElement('div');
    div.id = RECAPTCHA_CONTAINER_ID;
    div.style.display = 'none';
    document.body.appendChild(div);
  }
  return RECAPTCHA_CONTAINER_ID;
};

let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

export const sendPhoneOtp = async (phone10Digit: string): Promise<void> => {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, ensureRecaptchaContainer(), { size: 'invisible' });
  }
  confirmationResult = await signInWithPhoneNumber(auth, `+91${phone10Digit}`, recaptchaVerifier);
};

// Resolves to a Firebase ID token -- sent as the `otp` field to the existing
// /auth/login and /auth/register endpoints, which already verify it via
// firebase-admin when OTP_PROVIDER=PRODUCTION (see apps/backend/src/utils/otp.ts).
export const confirmPhoneOtp = async (code: string): Promise<string> => {
  if (!confirmationResult) {
    throw new Error('No OTP request in progress. Send an OTP first.');
  }
  const credential = await confirmationResult.confirm(code);
  const idToken = await credential.user.getIdToken();
  confirmationResult = null;
  return idToken;
};
