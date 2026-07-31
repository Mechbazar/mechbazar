// Converted from app.json so the native Google Maps SDK keys (Android/iOS)
// can be injected from an env var at config-eval time -- app.json couldn't
// reference one. Mirrors apps/mobile/app.config.js.
//
// Deliberately EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_NATIVE, NOT the plain
// EXPO_PUBLIC_GOOGLE_MAPS_API_KEY that the web build uses -- that one is
// HTTP-referrer restricted, which an on-device app can never satisfy (no HTTP
// referrer header), so Google would refuse it here regardless of validity.
// See src/config/maps.ts for the full rationale; that file gates the JS-side
// map components on the same var.
//
// Shape-checked ("AIza" + 35 chars) so a credential from a different Google
// product (e.g. an AI Studio "AQ." key) can't slip through and bake into the
// native Maps SDK config, where it would yield a blank grey map on device
// with no error surfaced -- same failure mode this exact var name hit in
// apps/mobile before that check was added there.
const RAW_GOOGLE_MAPS_API_KEY_NATIVE = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_NATIVE || '';
const GOOGLE_MAPS_API_KEY_NATIVE = /^AIza[0-9A-Za-z_-]{35}$/.test(RAW_GOOGLE_MAPS_API_KEY_NATIVE)
  ? RAW_GOOGLE_MAPS_API_KEY_NATIVE
  : '';

if (RAW_GOOGLE_MAPS_API_KEY_NATIVE && !GOOGLE_MAPS_API_KEY_NATIVE) {
  console.warn(
    '[app.config] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_NATIVE is not a Google Maps Platform key ("AIza..."); ' +
      'native Maps SDK config omitted.'
  );
}
if (!RAW_GOOGLE_MAPS_API_KEY_NATIVE) {
  console.warn(
    '[app.config] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_NATIVE is unset -- this build will render ' +
      '"Map view coming soon" everywhere a map would go. It is NOT read from apps/seller-mobile/.env for ' +
      'EAS builds (EAS Build packages the repo respecting .gitignore, and .env is gitignored) -- set it via ' +
      '`eas env:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_NATIVE --value "<key>"` instead.'
  );
}

module.exports = {
  expo: {
    name: 'MechBazar Seller',
    slug: 'mechbazar-seller',
    owner: 'mechbazar',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    // Every screen in this app is built light (colors.background/colors.card
    // in packages/shared, all the auth screens' hardcoded #ffffff) -- 'dark'
    // here was a copy/paste leftover that only affects OS chrome (keyboard,
    // Alert.alert, system pickers), forcing dark dialogs over a light app.
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.mechbazar.seller',
      // Empty string is treated by Expo as "not set" -- fine locally where
      // maps are simply disabled (see src/config/maps.ts's MAPS_ENABLED_NATIVE).
      config: {
        googleMapsApiKey: GOOGLE_MAPS_API_KEY_NATIVE || undefined,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'MechBazar Seller uses your location to set your store location accurately.',
      },
    },
    android: {
      package: 'com.mechbazar.seller',
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        // Vendor orange, matching the box+gear icon (2026-07-29 icon redesign).
        // See the note in apps/mobile/app.config.js: one shared family, one
        // unique mark + colour per app.
        backgroundColor: '#2C1404',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY_NATIVE || undefined,
        },
      },
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-secure-store',
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'MechBazar Seller uses your location to set your store location accurately.',
        },
      ],
      // Without this, iOS has no NSCameraUsageDescription/
      // NSPhotoLibraryUsageDescription and terminates the app on first camera/
      // gallery use in Products or the onboarding wizard's document upload.
      [
        'expo-image-picker',
        {
          photosPermission: 'MechBazar Seller accesses your photo library so you can attach product photos and business documents.',
          cameraPermission: 'MechBazar Seller uses your camera so you can photograph product images and business documents.',
        },
      ],
      // Android renders the notification small-icon as a silhouette: any
      // non-transparent pixel becomes solid white. The monochrome adaptive
      // asset is the only one of the three icon layers already drawn as a
      // transparent-background mask, so it is the correct source here -- the
      // full-colour icon.png would flatten to an illegible white blob.
      [
        'expo-notifications',
        {
          icon: './assets/android-icon-monochrome.png',
          color: '#FF7A1A',
          defaultChannel: 'default',
          enableBackgroundRemoteNotifications: false,
        },
      ],

      // SDK 57 removed the legacy top-level `expo.splash` key -- the splash
      // screen only exists if this plugin is configured. Without it the app
      // opens on a blank white frame and assets/splash-icon.png is dead weight.
      [
        'expo-splash-screen',
        {
          // splash-icon-dark.png is the LIGHT-ink wordmark ("-dark" means "for
          // dark backgrounds"). The background below is the brand orange/near-black, on
          // which the ink-coloured variant would be close to invisible.
          image: './assets/splash-icon-dark.png',
          // The splash art is the MechBazar wordmark (~9:1), not a square mark,
          // so this is a width the wordmark reads at. 176, not the naive-looking
          // 240: Android 12+ clips windowSplashScreenAnimatedIcon to a 192dp
          // circle with no opt-out, and at 240 the wordmark overflowed it by
          // 24dp/side (see apps/mobile/app.config.js and the 2026-07-30 fix).
          imageWidth: 176,
          resizeMode: 'contain',
          // Brand icon background, matching this app's launcher icon, so the
          // splash continues the icon the user just tapped instead of flashing
          // a generic white frame.
          backgroundColor: '#2C1404',
          dark: {
            // Same art and colour in dark mode: the splash should read as the
            // brand, not flip appearance halfway through launch.
            image: './assets/splash-icon-dark.png',
            backgroundColor: '#2C1404',
          },
        },
      ],
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      './plugins/withAndroidReleaseSigning',
    ],
    extra: {
      eas: {
        projectId: 'a10f3278-fe1d-4992-8b9a-f424028408ec',
      },
    },
  },
};
