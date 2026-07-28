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
      'so phone-OTP login cannot work. Download it from the Firebase console into apps/rider/.'
  );
}

// Cleartext HTTP is needed only for local development against a LAN backend
// (App.tsx falls back to http://<dev-host>:5000/api); preview and production
// talk to https://mechbazar.com/api and must refuse plaintext so a hostile
// network can't downgrade API traffic carrying Bearer tokens.
//
// This used to be expressed as `android.usesCleartextTraffic`, which is NOT a
// key the Expo config schema accepts -- `expo-doctor` rejects it and prebuild
// dropped it on the floor, so the generated release manifest carried no
// android:usesCleartextTraffic attribute at all. The intended behaviour held
// anyway, but by accident rather than by this config:
//
//   - debug builds get android:usesCleartextTraffic="true" from the debug
//     variant manifest Expo generates (android/app/src/debug/AndroidManifest.xml)
//   - release builds get Android's own default, which refuses cleartext for
//     anything targeting API 28+
//
// Stating it here was therefore misleading: it read as an enforced policy while
// enforcing nothing. If this ever needs to be explicit rather than inherited,
// add expo-build-properties and set android.usesCleartextTraffic inside that
// plugin -- which is how apps/mobile does it.

module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    ...(hasIosFirebase ? { googleServicesFile: './GoogleService-Info.plist' } : {}),
  },
});
