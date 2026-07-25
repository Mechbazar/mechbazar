// Converted from app.json to a config file so the native Google Maps SDK
// keys (Android/iOS) can be injected from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY at
// config-eval time -- app.json couldn't reference an env var. Everything
// else is an unchanged copy of the previous app.json.
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

module.exports = {
  expo: {
    name: 'mobile',
    slug: 'mobile',
    owner: 'mechbazar',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.mechbazar.mobile',
      // Empty string is treated by Expo as "not set" -- fine locally where
      // maps are simply disabled (see src/config/maps.ts's MAPS_ENABLED).
      config: {
        googleMapsApiKey: GOOGLE_MAPS_API_KEY || undefined,
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'MechBazar uses your location to find nearby vendors, mechanics, and to set your delivery address accurately.',
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
      googleServicesFile: './google-services.json',
      config: {
        googleMaps: {
          apiKey: GOOGLE_MAPS_API_KEY || undefined,
        },
      },
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
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
      '@react-native-firebase/app',
      '@react-native-firebase/auth',
      'expo-status-bar',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'MechBazar uses your location to find nearby vendors, mechanics, and to set your delivery address accurately.',
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
