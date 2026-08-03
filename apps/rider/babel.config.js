// This file did not exist previously -- Expo works without one, defaulting to
// babel-preset-expo. It is added here solely to strip debug logging out of
// release bundles.
//
// src/services/phoneAuth.ts logs full E.164 phone numbers, Firebase error
// codes, and OTP flow state via console.log. React Native does NOT strip
// console calls automatically: everything logged in a release build stays
// readable over `adb logcat` to anyone with physical/USB access to the
// device. Mirrors apps/mobile/babel.config.js.
//
// console.error and console.warn are deliberately KEPT -- they are the signal
// a crash reporter needs, and they are the only production-diagnostics
// channel this app has.
module.exports = function (api) {
  api.cache(true);

  const isProduction = process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production';

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(isProduction
        ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
        : []),
    ],
  };
};
