// Layered over app.json: Expo reads app.json first and hands it to this
// function as `config`, so everything static stays where it was and only the
// two build-dependent bits live here. Mirrors apps/mobile/app.config.js, which
// solved both of these problems already.
const fs = require('fs');
const path = require('path');

// @react-native-firebase/app needs a GoogleService-Info.plist to initialise on
// iOS. Without it Firebase never comes up and Phone Auth -- the ONLY way to log
// into this app -- fails outright on every iOS build. Android's equivalent
// (google-services.json) was already wired via app.json; the iOS half was not,
// even though the plist has been sitting in this directory.
//
// Referenced conditionally so the config still evaluates if the file is ever
// removed, rather than failing the whole build.
const IOS_FIREBASE_PLIST = path.join(__dirname, 'GoogleService-Info.plist');
const hasIosFirebase = fs.existsSync(IOS_FIREBASE_PLIST);
if (!hasIosFirebase) {
  console.warn(
    '[app.config] GoogleService-Info.plist missing -- iOS builds will have no Firebase, ' +
      'so phone-OTP login cannot work. Download it from the Firebase console into apps/mechanic/.'
  );
}

// EAS sets EAS_BUILD_PROFILE to the profile being built. Cleartext HTTP is
// needed only for local development against a LAN backend (App.tsx falls back
// to http://<dev-host>:5000/api); preview and production talk to
// https://mechbazar.com/api and must refuse plaintext so a hostile network
// can't downgrade API traffic carrying Bearer tokens. app.json had this pinned
// to `true` for every profile, including production.
const BUILD_PROFILE = process.env.EAS_BUILD_PROFILE || 'development';
const ALLOW_CLEARTEXT = BUILD_PROFILE === 'development';

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    ...(hasIosFirebase ? { googleServicesFile: './GoogleService-Info.plist' } : {}),
  },
  android: {
    ...config.android,
    usesCleartextTraffic: ALLOW_CLEARTEXT,
  },
});
