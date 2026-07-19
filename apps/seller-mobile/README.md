# MechBazar Seller Mobile App

This is the Expo / React Native mobile app for MechBazar vendors.

## 🚀 Local Development (Expo Go)

1. Make sure you have the monorepo dependencies installed from the root directory:
   ```bash
   cd ../../
   npm install
   ```
2. Navigate to this app's directory:
   ```bash
   cd apps/seller-mobile
   ```
3. Create a `.env` file and set the API URL:
   ```env
   EXPO_PUBLIC_API_URL=http://your-local-ip:5005/api
   ```
4. Start the Expo server:
   ```bash
   npx expo start
   ```
5. Scan the QR code with the **Expo Go** app on Android or iOS.

## 📦 Store Publishing (EAS Build)

We use Expo Application Services (EAS) to build and publish the app.

### Prerequisites
1. Install EAS CLI: `npm install -g eas-cli`
2. Log in to your Expo account: `eas login`
3. Initialize the project with EAS (already done via `eas.json`).

### 1. Build for Android (Play Store)
To generate an `.aab` file for the Google Play Store:
```bash
eas build --platform android --profile production
```
*Note: You will be prompted to generate or provide a keystore. Let Expo handle it unless you have an existing one.*

### 2. Build for iOS (App Store)
To generate an `.ipa` file for the Apple App Store:
```bash
eas build --platform ios --profile production
```
*Note: You must have an Apple Developer account. EAS will prompt you to log in and manage your provisioning profiles and certificates.*

### 3. Submitting to Stores
You can submit the generated builds directly from the CLI using EAS Submit:
```bash
eas submit --platform android
eas submit --platform ios
```

## 🛠️ Monorepo Shared Code
This app shares the theme, UI components, and API client from `packages/shared`. Any changes there will be immediately reflected here.
