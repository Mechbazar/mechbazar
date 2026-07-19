import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { riderService } from '@mechbazar/shared';

// expo-notifications throws merely by being imported when running inside
// Expo Go on SDK 53+ (remote push was removed from Expo Go entirely — see
// https://docs.expo.dev/develop/development-builds/introduction/). A
// try/catch around our own calls can't prevent that, since the crash
// happens at module-load time, before any of our code runs. So we use a
// deferred require() (never a static import) and only reach it outside
// Expo Go, where this becomes fully functional once an EAS project exists
// for this app — see the final gaps report.
const isExpoGo = Constants.appOwnership === 'expo';

export async function registerForPushNotificationsAsync(): Promise<void> {
  if (isExpoGo) {
    console.log('Push notifications are unavailable in Expo Go (SDK 53+) — skipping. Needs a dev build.');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.log('No EAS projectId configured yet — skipping push token registration');
      return;
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await riderService.registerPushToken(token);
  } catch (error) {
    console.log('Push notification registration skipped:', error);
  }
}
