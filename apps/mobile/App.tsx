import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { Provider, useDispatch, useSelector } from 'react-redux';

import { store, RootState } from './src/store';
import { loginSuccess } from './src/store/authSlice';
import { hydrateCart } from './src/store/cartSlice';
import { hydrateGarage, setVehicleTypeHydrated, loadVehicleType } from './src/store/appSlice';
import { registerForPushNotificationsAsync } from './src/services/notifications';
import { API_BASE_URL } from './src/services/api';
import { fetchMyVehicles } from './src/services/garage.service';
import { OfflineBanner } from './src/components/OfflineBanner';
import DesktopAppShell from './src/navigation/DesktopAppShell';
import { useBreakpoint } from './src/hooks/useBreakpoint';

import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import WholesaleRegistrationScreen from './src/screens/auth/WholesaleRegistrationScreen';
import HomeScreen from './src/screens/HomeScreen';
import CategoriesScreen from './src/screens/CategoriesScreen';
import CartScreen from './src/screens/CartScreen';
import OrderHistoryScreen from './src/screens/OrderHistoryScreen';
import OrderInvoiceScreen from './src/screens/OrderInvoiceScreen';
import AccountScreen from './src/screens/AccountScreen';
import AccountDashboardScreen from './src/screens/AccountDashboardScreen';
import ProductDetailsScreen from './src/screens/ProductDetailsScreen';
import CategoryProductsScreen from './src/screens/CategoryProductsScreen';
import GarageScreen from './src/screens/GarageScreen';
import VehicleSelectionScreen from './src/screens/VehicleSelectionScreen';
import DeliveryTrackingScreen from './src/screens/DeliveryTrackingScreen';
import ServicesHomeScreen from './src/screens/services/ServicesHomeScreen';
import ServiceCategoryScreen from './src/screens/services/ServiceCategoryScreen';
import ServiceBookingScreen from './src/screens/services/ServiceBookingScreen';
import ServiceTrackingScreen from './src/screens/services/ServiceTrackingScreen';
import ServiceChatScreen from './src/screens/services/ServiceChatScreen';
import ServiceBookingHistoryScreen from './src/screens/services/ServiceBookingHistoryScreen';
import ServiceInvoiceScreen from './src/screens/services/ServiceInvoiceScreen';
import ServiceReviewScreen from './src/screens/services/ServiceReviewScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import WishlistScreen from './src/screens/WishlistScreen';
import AddressManagementScreen from './src/screens/AddressManagementScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import HelpCenterScreen from './src/screens/HelpCenterScreen';
import MechanicDetailScreen from './src/screens/MechanicDetailScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';

// Same key App.js already used for its session cache -- reusing it means an
// already-logged-in user isn't logged out by this rewrite. Cart and garage get
// new keys because their stored shape changed (flat CartItem[] instead of
// App.js's {product, qty}[]; myGarage[] + activeVehicleId instead of a single
// garageVehicle object) -- reusing the old keys there would parse into garbage.
const USER_STORAGE_KEY = 'mb-user';
const CART_STORAGE_KEY = 'mb-cart-v2';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Home: 'home-outline',
  Categories: 'grid-outline',
  Services: 'construct-outline',
  Orders: 'cube-outline',
  Account: 'person-outline',
};

const MOBILE_TAB_BAR_STYLE = {
  position: 'absolute' as const,
  bottom: 20,
  left: 16,
  right: 16,
  backgroundColor: '#1C1C1E',
  borderRadius: 24,
  height: 64,
  paddingBottom: Platform.OS === 'ios' ? 0 : 8,
  paddingTop: 8,
  borderTopWidth: 0,
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.35,
  shadowRadius: 10,
  elevation: 8,
};

function MainTabs() {
  // DesktopAppShell already provides desktop navigation (header + mega menu),
  // so the floating mobile tab bar would just be redundant chrome at desktop
  // widths -- hide it there. Native ignores this: isDesktopUp is always false
  // off-web, so MOBILE_TAB_BAR_STYLE is untouched on iOS/Android.
  const { isDesktopUp } = useBreakpoint();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#E53935',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: Platform.OS === 'web' && isDesktopUp ? { display: 'none' } : MOBILE_TAB_BAR_STYLE,
        tabBarIcon: ({ focused, color, size }) => (
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons 
              name={TAB_ICONS[route.name]} 
              size={focused ? 24 : 22} 
              color={focused ? '#E53935' : '#8E8E93'} 
            />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="Services" component={ServicesHomeScreen} />
      <Tab.Screen name="Orders" component={OrderHistoryScreen} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const dispatch = useDispatch();
  const token = useSelector((state: RootState) => state.auth.token);
  const user = useSelector((state: RootState) => state.auth.user);
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const myGarage = useSelector((state: RootState) => state.app.myGarage);
  const activeVehicleId = useSelector((state: RootState) => state.app.activeVehicleId);

  const [isReady, setIsReady] = useState(false);
  // Guards the persistence effects below so the empty pre-hydration state
  // (before the AsyncStorage reads in the boot effect resolve) never overwrites
  // what was just read from storage. Same pattern App.js used for cart persistence.
  const hydratedRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS !== 'web') {
          // Native: unchanged from today's behavior.
          try {
            await Font.loadAsync(Ionicons.font);
          } catch (fontErr) {
            console.error('Failed to preload Ionicons font, retrying once', fontErr);
            try { await Font.loadAsync(Ionicons.font); } catch (e2) { console.error('Icon font retry failed', e2); }
          }
        } else {
          // Web: Font.loadAsync registers the icon font, but its promise isn't a
          // reliable signal that the browser has actually finished loading it --
          // gate first paint on document.fonts.ready too, the browser's own
          // authoritative signal, so icon glyphs never race a still-loading
          // custom font (which shows as a blank/tofu box until it swaps in).
          try {
            await Font.loadAsync(Ionicons.font);
          } catch (fontErr) {
            console.error('Failed to preload Ionicons font on web', fontErr);
          }
          const webDocument = (globalThis as any).document;
          if (webDocument?.fonts?.ready) {
            try {
              await webDocument.fonts.ready;
            } catch (e) {
              console.error('document.fonts.ready failed', e);
            }
          }
        }

        const storedUser = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (parsed?.token && parsed?.user) {
              dispatch(loginSuccess({ user: parsed.user, token: parsed.token }));
            }
          } catch (e) { /* ignore corrupt session cache */ }
        }

        const storedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (storedCart) {
          try { dispatch(hydrateCart(JSON.parse(storedCart))); } catch (e) { /* ignore corrupt cart cache */ }
        }

        dispatch(setVehicleTypeHydrated(await loadVehicleType()));
      } catch (e) {
        console.error('Failed to hydrate app state from storage', e);
      } finally {
        hydratedRef.current = true;
        setIsReady(true);
      }
    })();
  }, [dispatch]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (token && user) {
      AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify({ user, token })).catch(e => console.error('Failed to persist session:', e));
    } else {
      AsyncStorage.removeItem(USER_STORAGE_KEY).catch(e => console.error('Failed to clear session:', e));
    }
  }, [token, user]);

  // Register for order-status push notifications once logged in. No-ops
  // quietly inside Expo Go (SDK 53+ removed push there) or without a
  // configured EAS projectId -- see services/notifications.ts.
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const pushToken = await registerForPushNotificationsAsync();
        if (!pushToken) return;
        await fetch(`${API_BASE_URL}/auth/push-token`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ token: pushToken }),
        });
      } catch (e) {
        console.error('Failed to register push token:', e);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems)).catch(e => console.error('Failed to persist cart:', e));
  }, [cartItems]);

  // Garage now lives on the server (previously AsyncStorage-only, so it never
  // survived a reinstall or a second device) -- fetch it fresh whenever the
  // logged-in user changes, and clear it on logout. Mutations from
  // GarageScreen/VehicleSelectionScreen call the API directly and dispatch the
  // existing appSlice actions to keep this read model in sync afterward.
  useEffect(() => {
    if (!token) {
      dispatch(hydrateGarage({ myGarage: [], activeVehicleId: null }));
      return;
    }
    fetchMyVehicles(token).then(vehicles => {
      const active = vehicles.find(v => v.isDefault) || vehicles[0] || null;
      dispatch(hydrateGarage({ myGarage: vehicles, activeVehicleId: active?.id ?? null }));
    });
  }, [token]);

  if (!isReady) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#E23B22" />
      </View>
    );
  }

  return (
    <>
      <OfflineBanner />
      <NavigationContainer>
      <DesktopAppShell>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
            <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
            <Stack.Screen name="Garage" component={GarageScreen} />
            <Stack.Screen name="VehicleSelection" component={VehicleSelectionScreen} />
            <Stack.Screen name="DeliveryTracking" component={DeliveryTrackingScreen} />
            <Stack.Screen name="OrderInvoice" component={OrderInvoiceScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="AccountDashboard" component={AccountDashboardScreen} />
            <Stack.Screen name="Wishlist" component={WishlistScreen} />
            <Stack.Screen name="AddressManagement" component={AddressManagementScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
            <Stack.Screen name="MechanicDetail" component={MechanicDetailScreen} />
            <Stack.Screen name="VideoCall" component={VideoCallScreen} />
            {/* Cart is reached via the header cart icon (HeaderCartButton) rather
                than a persistent bottom tab -- see the Services module plan for why
                Cart moved out of MainTabs' Tab.Navigator. */}
            <Stack.Screen name="Cart" component={CartScreen} />
            <Stack.Screen name="ServiceCategory" component={ServiceCategoryScreen} />
            <Stack.Screen name="ServiceBooking" component={ServiceBookingScreen} />
            <Stack.Screen name="ServiceTracking" component={ServiceTrackingScreen} />
            <Stack.Screen name="ServiceChat" component={ServiceChatScreen} />
            <Stack.Screen name="ServiceBookingHistory" component={ServiceBookingHistoryScreen} />
            <Stack.Screen name="ServiceInvoice" component={ServiceInvoiceScreen} />
            <Stack.Screen name="ServiceReview" component={ServiceReviewScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="WholesaleRegistration" component={WholesaleRegistrationScreen} />
          </>
        )}
      </Stack.Navigator>
      </DesktopAppShell>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <RootNavigator />
    </Provider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
});
