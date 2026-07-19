import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Detect if running in Expo Go (push notifications removed in SDK 53+)
const isExpoGo = Constants.appOwnership === 'expo';

export async function registerForPushNotificationsAsync() {
  if (isExpoGo) {
    console.log('Push notifications are unavailable in Expo Go (SDK 53+) — skipping. Use a dev build instead.');
    return;
  }

  let token;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');

    // Set up how notifications are handled when the app is in foreground
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
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#034C8C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Failed to get push token for push notification!');
        return;
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.log('⚠️ No EAS projectId configured in app.json -- cannot get a push token');
        return;
      }

      // Get the token that uniquely identifies this device
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('📱 Expo Push Token:', token);
    } else {
      console.log('⚠️ Must use physical device for Push Notifications');
    }
  } catch (error) {
    console.log('Push notification registration failed:', error);
  }

  return token;
}

// Helper to simulate a local notification for testing on emulators
export async function sendLocalNotification(title: string, body: string) {
  if (isExpoGo) {
    console.log('Local notifications unavailable in Expo Go');
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.log('Failed to send local notification:', error);
  }
}
