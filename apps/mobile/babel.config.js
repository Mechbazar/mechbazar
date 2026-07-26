// This file did not exist previously -- Expo works without one, defaulting to
// babel-preset-expo. It is added here solely to strip debug logging out of
// release bundles.
//
// The app has ~88 console.* call sites, several of which print operationally
// sensitive values (push tokens, Firebase project config, OTP flow state).
// React Native does NOT strip console calls automatically: everything logged
// in a release build stays readable over `adb logcat` / Console.app to anyone
// with physical access to the device, and gets swept up by any log collector.
//
// console.error and console.warn are deliberately KEPT -- they are the signal a
// crash reporter needs, and they are the only production-diagnostics channel
// this app has.
module.exports = function (api) {
  api.cache(true);

  const isProduction = process.env.NODE_ENV === 'production' || process.env.BABEL_ENV === 'production';

  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ...(isProduction
        ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
        : []),
      // react-native-reanimated's plugin must stay last if it is ever added
      // back here; it is currently applied automatically by babel-preset-expo.
    ],
  };
};
