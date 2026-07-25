// Converted from app.json so the native Google Maps SDK keys (Android/iOS)
// can be injected from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY at config-eval time --
// app.json couldn't reference an env var. Mirrors apps/mobile/app.config.js.
// Everything else is an unchanged copy of the previous app.json.
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

module.exports = {
  expo: {
    name: 'MechBazar Seller',
    slug: 'mechbazar-seller',
    owner: 'mechbazar',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.mechbazar.seller',
      // Empty string is treated by Expo as "not set" -- fine locally where
      // maps are simply disabled (see src/config/maps.ts's MAPS_ENABLED).
      config: {
        googleMapsApiKey: GOOGLE_MAPS_API_KEY || undefined,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'MechBazar Seller uses your location to set your store location accurately.',
      },
    },
    android: {
      package: 'com.mechbazar.seller',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY || undefined,
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
    ],
    extra: {
      eas: {
        projectId: 'efe1c4a0-a9da-4fca-b0e5-7a38d52b5d87',
      },
    },
  },
};
