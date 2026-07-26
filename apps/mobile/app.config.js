// Dynamic Expo config (was app.json) so the native Google Maps SDK keys and
// build-profile-dependent settings can be injected from the environment at
// config-eval time -- app.json couldn't reference an env var.
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// EAS sets EAS_BUILD_PROFILE to the profile being built. Cleartext HTTP is
// needed only for local development against a LAN backend (services/api.ts
// falls back to http://<dev-host>:5001); production and preview builds talk to
// https://mechbazar.com/api and must refuse plaintext so a hostile network
// can't downgrade API traffic carrying Bearer tokens.
const BUILD_PROFILE = process.env.EAS_BUILD_PROFILE || 'development';
const ALLOW_CLEARTEXT = BUILD_PROFILE === 'development';

// @react-native-firebase/app needs a GoogleService-Info.plist to initialise on
// iOS -- without it Firebase never comes up and Phone Auth (the only way to log
// in) fails outright. The file is NOT in this repo yet: an iOS app has to be
// registered under the mech-bazar-8fd86 Firebase project and the plist
// downloaded into apps/mobile/GoogleService-Info.plist.
//
// Referenced conditionally so that (a) the config still evaluates today, and
// (b) the moment the file is dropped in, it is picked up with no code change.
// Android's equivalent (google-services.json) is already committed.
const fs = require('fs');
const path = require('path');
const IOS_FIREBASE_PLIST = path.join(__dirname, 'GoogleService-Info.plist');
const hasIosFirebase = fs.existsSync(IOS_FIREBASE_PLIST);
if (!hasIosFirebase) {
  console.warn(
    '[app.config] GoogleService-Info.plist missing -- iOS builds will have no Firebase, ' +
      'so phone-OTP login cannot work. Download it from the Firebase console into apps/mobile/.'
  );
}

module.exports = {
  expo: {
    // Display name on the home screen and in both stores. This was previously
    // 'mobile' -- the workspace folder name -- which would have shipped an app
    // literally called "mobile".
    name: 'MechBazar',
    // NOTE: `slug` is the identity EAS uses to resolve the project together
    // with extra.eas.projectId. Do not rename it -- it is intentionally left
    // as 'mobile' to keep the existing EAS project link intact.
    slug: 'mobile',
    owner: 'mechbazar',
    version: '1.0.0',
    // Deep-link / custom URL scheme. Required for expo-dev-client, for
    // returning to the app from external flows, and for Android App Links.
    scheme: 'mechbazar',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    primaryColor: '#E23B22',
    // Only meaningful once expo-updates is added; harmless and correct now, and
    // means OTA updates cannot be delivered to an incompatible native binary
    // the day updates are switched on.
    runtimeVersion: { policy: 'appVersion' },
    assetBundlePatterns: ['**/*'],

    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.mechbazar.mobile',
      ...(hasIosFirebase ? { googleServicesFile: './GoogleService-Info.plist' } : {}),
      // Build number is managed remotely by EAS (eas.json ->
      // cli.appVersionSource: "remote" + production.autoIncrement), which is
      // the only mode that works with a dynamic app.config.js -- EAS cannot
      // write an incremented value back into a .js config. Do not hard-code
      // `buildNumber` here; it would be ignored and drift from the real value.
      config: {
        googleMapsApiKey: GOOGLE_MAPS_API_KEY || undefined,
      },
      infoPlist: {
        // Export compliance. The app uses only standard HTTPS/TLS, which is
        // exempt. Without this key App Store Connect blocks every upload on an
        // unanswered encryption question.
        ITSAppUsesNonExemptEncryption: false,
        // Apple rejects generic purpose strings -- each must name the concrete
        // user-facing feature that needs the permission.
        NSLocationWhenInUseUsageDescription:
          'MechBazar uses your location to check whether we deliver to your area, fill in your delivery address accurately, and show the live location of your delivery partner or mechanic.',
        NSCameraUsageDescription:
          'MechBazar uses your camera so you can photograph a part, a damaged item, or your vehicle when you raise a return, warranty, or support request.',
        NSPhotoLibraryUsageDescription:
          'MechBazar accesses your photo library so you can attach existing photos to returns, reviews, and support requests, and set a profile picture.',
        NSPhotoLibraryAddUsageDescription:
          'MechBazar saves order invoices and service reports to your photo library when you choose to download them.',
        // The app talks only to https://mechbazar.com/api in release builds.
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: ALLOW_CLEARTEXT,
        },
      },
    },

    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      package: 'com.mechbazar.mobile',
      // versionCode is managed remotely by EAS -- see the ios note above.
      googleServicesFile: './google-services.json',
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY || undefined,
        },
      },
      // Explicit allowlist. Play's Data Safety declaration must match the
      // merged manifest exactly, so every permission here has to map to a
      // feature that actually ships.
      permissions: [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.CAMERA',
        'android.permission.READ_MEDIA_IMAGES',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.VIBRATE',
        'android.permission.RECEIVE_BOOT_COMPLETED',
      ],
      // Stripped from the merged manifest even if a transitive library asks
      // for them. Background location in particular triggers Play's most
      // onerous review track and this app has no background-location feature;
      // audio/video recording and contacts are not used at all.
      blockedPermissions: [
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.RECORD_AUDIO',
        'android.permission.READ_MEDIA_VIDEO',
        'android.permission.READ_MEDIA_AUDIO',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.READ_CONTACTS',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
    },

    web: {
      favicon: './assets/favicon.png',
      name: 'MechBazar - Genuine Auto Parts & Mechanic Services',
      shortName: 'MechBazar',
      description:
        'Shop genuine car and bike parts online and book trusted mechanic services, delivered to your doorstep.',
      lang: 'en',
      themeColor: '#E23B22',
      backgroundColor: '#F3F4F6',
    },

    plugins: [
      'expo-asset',
      'expo-sharing',
      'expo-status-bar',
      'expo-secure-store',
      '@react-native-firebase/app',
      '@react-native-firebase/auth',

      // SDK 57 removed the legacy top-level `expo.splash` key -- the splash
      // screen only exists if this plugin is configured. Without it the app
      // opens on a blank white frame.
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#FFFFFF',
          dark: {
            image: './assets/splash-icon.png',
            backgroundColor: '#111111',
          },
        },
      ],

      // expo-image-picker was a dependency with no plugin entry, so neither
      // NSCameraUsageDescription nor NSPhotoLibraryUsageDescription was
      // generated: iOS crashed on first camera/gallery use and Apple rejects
      // the binary under Guideline 5.1.1.
      [
        'expo-image-picker',
        {
          photosPermission:
            'MechBazar accesses your photo library so you can attach existing photos to returns, reviews, and support requests, and set a profile picture.',
          cameraPermission:
            'MechBazar uses your camera so you can photograph a part, a damaged item, or your vehicle when you raise a return, warranty, or support request.',
        },
      ],

      // expo-notifications was likewise a dependency with no plugin entry, so
      // the Android notification icon/colour and POST_NOTIFICATIONS handling
      // were never configured.
      [
        'expo-notifications',
        {
          icon: './assets/android-icon-monochrome.png',
          color: '#E23B22',
          defaultChannel: 'default',
          enableBackgroundRemoteNotifications: false,
        },
      ],

      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'MechBazar uses your location to check whether we deliver to your area, fill in your delivery address accurately, and show the live location of your delivery partner or mechanic.',
          // This app has no background-location feature. Declaring these false
          // keeps ACCESS_BACKGROUND_LOCATION out of the manifest and keeps the
          // Play Data Safety declaration honest.
          isIosBackgroundLocationEnabled: false,
          isAndroidBackgroundLocationEnabled: false,
          isAndroidForegroundServiceEnabled: false,
        },
      ],

      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 24,
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            // Refuse plaintext HTTP in preview/production builds.
            usesCleartextTraffic: ALLOW_CLEARTEXT,
          },
          ios: {
            // SDK 57's minimum supported iOS deployment target.
            deploymentTarget: '16.4',
          },
        },
      ],
    ],

    extra: {
      eas: {
        projectId: 'b2a858ee-509a-41a2-97f3-4c079c3ddebc',
      },
    },
  },
};
