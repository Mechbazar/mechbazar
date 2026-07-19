import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@mechbazar/shared';
import { TabNavigator } from './TabNavigator';
import { OrderDetailScreen } from '../screens/OrderDetailScreen';
import { CategoriesScreen } from '../screens/CategoriesScreen';
import { VendorsScreen } from '../screens/VendorsScreen';
import { VendorDetailScreen } from '../screens/VendorDetailScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { CustomerDetailScreen } from '../screens/CustomerDetailScreen';
import { RidersScreen } from '../screens/RidersScreen';
import { RiderDetailScreen } from '../screens/RiderDetailScreen';
import { ServiceCategoriesScreen } from '../screens/ServiceCategoriesScreen';
import { ServiceBookingsScreen } from '../screens/ServiceBookingsScreen';
import { TechniciansScreen } from '../screens/TechniciansScreen';
import { TechnicianDetailScreen } from '../screens/TechnicianDetailScreen';
import { VehicleMasterScreen } from '../screens/VehicleMasterScreen';
import { CouponsScreen } from '../screens/CouponsScreen';
import { BannersScreen } from '../screens/BannersScreen';
import { PayoutsScreen } from '../screens/PayoutsScreen';
import { PayoutDetailScreen } from '../screens/PayoutDetailScreen';
import { RiderPayoutsScreen } from '../screens/RiderPayoutsScreen';
import { RiderPayoutDetailScreen } from '../screens/RiderPayoutDetailScreen';
import { TechnicianPayoutsScreen } from '../screens/TechnicianPayoutsScreen';
import { TechnicianPayoutDetailScreen } from '../screens/TechnicianPayoutDetailScreen';
import { ServicePackagesScreen } from '../screens/ServicePackagesScreen';
import { ServiceTimeSlotsScreen } from '../screens/ServiceTimeSlotsScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { InventoryScreen } from '../screens/inventory/InventoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
};

// Nested inside RootNavigator's "Main" screen: the bottom tabs live at the
// root of this stack, and every secondary screen (reached from a tab list
// row or the More menu) pushes on top of them for native back-button
// navigation — mirrors apps/rider's MainStack pattern.
export const MainStack = () => {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order Details' }} />
      <Stack.Screen name="Categories" component={CategoriesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Vendors" component={VendorsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="VendorDetail" component={VendorDetailScreen} options={{ title: 'Vendor Details' }} />
      <Stack.Screen name="Customers" component={CustomersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Customer Details' }} />
      <Stack.Screen name="Riders" component={RidersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RiderDetail" component={RiderDetailScreen} options={{ title: 'Rider Details' }} />
      <Stack.Screen name="ServiceCategories" component={ServiceCategoriesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ServiceBookings" component={ServiceBookingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Technicians" component={TechniciansScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TechnicianDetail" component={TechnicianDetailScreen} options={{ title: 'Technician Details' }} />
      <Stack.Screen name="VehicleMaster" component={VehicleMasterScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Coupons" component={CouponsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Banners" component={BannersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Payouts" component={PayoutsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="PayoutDetail" component={PayoutDetailScreen} options={{ title: 'Payout Details' }} />
      <Stack.Screen name="RiderPayouts" component={RiderPayoutsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="RiderPayoutDetail" component={RiderPayoutDetailScreen} options={{ title: 'Rider Payout Details' }} />
      <Stack.Screen name="TechnicianPayouts" component={TechnicianPayoutsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="TechnicianPayoutDetail" component={TechnicianPayoutDetailScreen} options={{ title: 'Technician Payout Details' }} />
      <Stack.Screen name="ServicePackages" component={ServicePackagesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ServiceTimeSlots" component={ServiceTimeSlotsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
};
