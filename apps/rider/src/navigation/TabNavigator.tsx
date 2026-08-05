import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeScreen } from '../screens/HomeScreen';
import { DeliveriesScreen } from '../screens/DeliveriesScreen';
import { EarningsScreen } from '../screens/EarningsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { colors, Logo } from '@mechbazar/shared';
import { Home, Truck, Wallet, User, Bell } from 'lucide-react-native';

const Tab = createBottomTabNavigator();

export const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          headerTitle: () => <Logo width={140} />,
          // Notifications is a pushed screen on the parent Stack (MainStack),
          // not a tab -- getParent() reaches past this Tab.Navigator to it,
          // same as apps/seller-mobile's Dashboard header.
          headerRight: () => (
            <TouchableOpacity onPress={() => navigation.getParent()?.navigate('Notifications')} style={{ marginRight: 16 }}>
              <Bell color={colors.text} size={22} />
            </TouchableOpacity>
          ),
        })}
      />
      <Tab.Screen
        name="Deliveries"
        component={DeliveriesScreen}
        options={{ tabBarIcon: ({ color, size }) => <Truck color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Earnings"
        component={EarningsScreen}
        options={{ tabBarIcon: ({ color, size }) => <Wallet color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
};
