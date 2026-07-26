// Type-only imports are erased at compile time, so they never emit a
// `require` -- the native module is pulled in lazily by loadRnfbAuth() below.
import type { ConfirmationResult } from '@react-native-firebase/auth';

// Android/iOS build only (Metro picks this file over phoneAuth.web.ts for
// native platforms) -- uses @react-native-firebase/auth's native SDK, which
// verifies via Play Integrity instead of a reCAPTCHA widget, so no
// ApplicationVerifier/container element is needed here (unlike phoneAuth.web.ts).
//
// @react-native-firebase is a native module that Expo Go does not ship. It used
// to be imported at the top level, so requiring this file -- which App.tsx does
// transitively via WelcomeScreen -- threw "Native module RNFBAppModule not
// found" before the first screen could render, red-screening the whole app in
// Expo Go. The require is now deferred into the two functions that actually
// need it, so the app boots and every screen is browsable under Expo Go; only
// the OTP calls themselves fail, with the explanation below instead of a crash.
//
// This changes nothing for real builds (dev client, preview, production): the
// native module is present, the require succeeds, and Play Integrity phone auth
// works exactly as before. Do NOT hoist these back to top-level imports.
const EXPO_GO_HINT =
  'Phone sign-in needs the native Firebase module, which Expo Go does not include. ' +
  'Run this app in a development build to log in.';

type RnfbAuth = {
  getAuthInstance: () => unknown;
  signInWithPhoneNumber: (auth: unknown, phone: string) => Promise<ConfirmationResult>;
};

const loadRnfbAuth = (): RnfbAuth => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getApp } = require('@react-native-firebase/app');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAuth, signInWithPhoneNumber } = require('@react-native-firebase/auth');
    return {
      getAuthInstance: () => getAuth(getApp()),
      signInWithPhoneNumber,
    };
  } catch (err) {
    // Thrown while the RNFB module initialises against a missing native
    // counterpart -- the Expo Go case. Anything else is a genuine bug, so keep
    // the original message attached rather than swallowing it.
    throw new Error(`${EXPO_GO_HINT} (${(err as Error)?.message ?? String(err)})`);
  }
};

let confirmationResult: ConfirmationResult | null = null;

export const sendPhoneOtp = async (phone10Digit: string): Promise<void> => {
  const rnfb = loadRnfbAuth();
  confirmationResult = await rnfb.signInWithPhoneNumber(rnfb.getAuthInstance(), `+91${phone10Digit}`);
};

// Resolves to a Firebase ID token -- sent as the `otp` field to the
// /auth/login and /auth/register endpoints, which verify it via firebase-admin
// (see apps/backend/src/utils/otp.ts).
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
