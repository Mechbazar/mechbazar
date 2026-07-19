import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@mechbazar/shared';
import { TabNavigator } from './TabNavigator';
import { DeliveryDetailScreen } from '../screens/DeliveryDetailScreen';
import { registerForPushNotificationsAsync } from '../services/notifications';

export type MainStackParamList = {
  Tabs: undefined;
  DeliveryDetail: { orderId: string };
};

const Stack = createNativeStackNavigator<MainStackParamList>();

// Nested inside RootNavigator's "Main" screen: the bottom tabs live at the
// root of this stack, and DeliveryDetail pushes on top of them so it gets a
// native back button/header without needing its own tab.
export const MainStack = () => {
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="DeliveryDetail"
        component={DeliveryDetailScreen}
        options={{
          title: 'Delivery Details',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
        }}
      />
    </Stack.Navigator>
  );
};
