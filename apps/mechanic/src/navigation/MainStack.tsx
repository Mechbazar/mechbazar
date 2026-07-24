import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@mechbazar/shared';
import { TabNavigator } from './TabNavigator';
import { BookingDetailScreen } from '../screens/BookingDetailScreen';
import { BookingChatScreen } from '../screens/BookingChatScreen';
import { ReviewsScreen } from '../screens/ReviewsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { registerForPushNotificationsAsync } from '../services/notifications';

export type MainStackParamList = {
  Tabs: undefined;
  BookingDetail: { bookingId: string };
  BookingChat: { bookingId: string };
  Reviews: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<MainStackParamList>();

// Nested inside RootNavigator's "Main" screen: the bottom tabs live at the
// root of this stack, and BookingDetail/BookingChat push on top of them so
// they get a native back button/header without needing their own tab.
export const MainStack = () => {
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="BookingDetail"
        component={BookingDetailScreen}
        options={{
          title: 'Booking Details',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      />
      <Stack.Screen
        name="BookingChat"
        component={BookingChatScreen}
        options={{
          title: 'Chat',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      />
      <Stack.Screen
        name="Reviews"
        component={ReviewsScreen}
        options={{
          title: 'My Reviews',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: 'Notifications',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      />
    </Stack.Navigator>
  );
};
