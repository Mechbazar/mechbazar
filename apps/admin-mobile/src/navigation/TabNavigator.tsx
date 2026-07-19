import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/DashboardScreen';
import { OrdersListScreen } from '../screens/OrdersListScreen';
import { ProductsScreen } from '../screens/ProductsScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { colors } from '@mechbazar/shared';
import { Home, Package, ShoppingBag, Menu } from 'lucide-react-native';

const Tab = createBottomTabNavigator();

// Mirrors apps/admin's sidebar top items condensed to 4 tabs (Dashboard,
// Orders, Products, More) — everything else lives behind "More", matching
// the mobile menu-tab pattern already used by apps/rider/apps/seller-mobile.
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
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersListScreen}
        options={{ tabBarIcon: ({ color, size }) => <Package color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Products"
        component={ProductsScreen}
        options={{ tabBarIcon: ({ color, size }) => <ShoppingBag color={color} size={size} /> }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{ tabBarIcon: ({ color, size }) => <Menu color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
};
