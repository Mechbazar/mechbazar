// Metro resolves this file over App.tsx for every web bundle (same
// platform-extension mechanism already used by DesktopAppShell.web.tsx /
// HomeScreen.web.tsx / CategoryProductsScreen.web.tsx -- see index.js's
// `import App from './App'`). Native never sees this file.
//
// This is a guest-first variant of App.tsx: instead of gating the entire
// navigator on state.auth.token (App.tsx's `token ? loggedIn : loggedOut`
// split), every screen is registered unconditionally and individually
// protected screens redirect a logged-out guest to Welcome via the
// RequireAuth wrapper below (see postLoginRedirect.ts for how the guest gets
// sent back to what they were doing after logging in).
//
// Everything outside the navigator JSX and `linking` config (boot-sequence
// hydration effects, token refresh, push registration, splash hold, etc.) is
// deliberately identical to App.tsx -- mirror any change made there here too,
// same convention as HomeScreen.tsx/HomeScreenMobile.tsx's "keep in sync by
// hand" comment.
import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, Appearance, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, LinkingOptions, CommonActions, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { Provider, useDispatch, useSelector } from 'react-redux';

import { store, RootState } from './src/store';
import { loginSuccess } from './src/store/authSlice';
import { hydrateCart } from './src/store/cartSlice';
import { hydrateGarage, setVehicleTypeHydrated, loadVehicleType } from './src/store/appSlice';
import { setThemePreferenceHydrated, loadThemePreference, systemSchemeChanged } from './src/store/themeSlice';
import { setLanguageHydrated, loadLanguagePreference } from './src/store/languageSlice';
import { useIsDarkMode } from './src/theme/useThemeColors';
import './src/i18n';
import './src/services/sessionGuard';
import ErrorBoundary from './src/components/shared/ErrorBoundary';
import { registerForPushNotificationsAsync, addNotificationTapListener } from './src/services/notifications';
import { resolveNotificationRoute } from './src/utils/notificationDeepLink';
import { registerForWebPushAsync } from './src/services/webPush';
import { API_BASE_URL } from './src/services/api';
import { initAppCheck } from './src/services/appCheck';
import { fetchMyVehicles } from './src/services/garage.service';
import { OfflineBanner } from './src/components/OfflineBanner';
import DesktopAppShell from './src/navigation/DesktopAppShell';
import { useBreakpoint } from './src/hooks/useBreakpoint';
import { setPendingRedirect } from './src/navigation/postLoginRedirect';
import { navigationRef } from './src/navigation/webNavigationRef';

import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import WholesaleRegistrationScreen from './src/screens/auth/WholesaleRegistrationScreen';
import HomeScreen from './src/screens/HomeScreen';
import CategoriesScreen from './src/screens/CategoriesScreen';
import CartScreen from './src/screens/CartScreen';
import OrderHistoryScreen from './src/screens/OrderHistoryScreen';
import OrderInvoiceScreen from './src/screens/OrderInvoiceScreen';
import PaymentSuccessScreen from './src/screens/PaymentSuccessScreen';
import PaymentFailureScreen from './src/screens/PaymentFailureScreen';
import PaymentPendingScreen from './src/screens/PaymentPendingScreen';
import PaymentCancelledScreen from './src/screens/PaymentCancelledScreen';
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
import EmergencyRequestScreen from './src/screens/services/EmergencyRequestScreen';
import EmergencyTrackingScreen from './src/screens/services/EmergencyTrackingScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import WishlistScreen from './src/screens/WishlistScreen';
import AddressManagementScreen from './src/screens/AddressManagementScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import NotificationPreferencesScreen from './src/screens/NotificationPreferencesScreen';
import HelpCenterScreen from './src/screens/HelpCenterScreen';
import StaticPageScreen from './src/screens/StaticPageScreen';

// Must run in global scope rather than inside a component or hook: by the time
// a hook body executes, expo-splash-screen may already have auto-hidden. Not
// awaited, per Expo's docs -- awaiting it here would reintroduce the race.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Same key App.tsx already uses for its session cache -- reusing it means an
// already-logged-in user isn't logged out by loading the web bundle instead
// of native. Cart and garage share App.tsx's keys for the same reason (a
// user switching between the native app and the web build should see the
// same cart/garage, not a second copy under a web-only key).
const USER_STORAGE_KEY = 'mb-user';
const CART_STORAGE_KEY = 'mb-cart-v2';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Public policy URLs required by Google Play / Apple App Store review --
// reviewers open these logged out, from a desktop browser, so a login wall or
// 404 here is a rejection. Slugs match docs/legal/app-store-submission-checklist.md's
// Part 1 table exactly. StaticPageScreen already falls back to the "about" page
// for any unrecognised key, so an unmapped path degrades safely rather than
// crashing.
const STATIC_PAGE_SLUG_TO_KEY: Record<string, string> = {
  'privacy-policy': 'privacy',
  terms: 'terms',
  'refund-policy': 'refund',
  'shipping-policy': 'shipping',
  'cancellation-policy': 'cancellation',
  'return-policy': 'returns',
  contact: 'contact',
  about: 'about',
  'account-deletion': 'account-deletion',
};

// Same route -> path map as App.tsx's `linking`, with two guest-first
// changes: the root path now resolves to Home instead of Welcome (so
// mechbazar.com/ shows the homepage, not the login screen), and Welcome gets
// its own explicit path ('login') since it's no longer the implicit root.
// Every screen below is reachable by URL regardless of login state -- the
// RequireAuth guard (not the linking config) is what turns a protected URL
// into a login redirect for a logged-out guest, so a bookmarked/shared link
// to e.g. /dashboard still resolves correctly once the guest logs in instead
// of 404ing.
const linking: LinkingOptions<any> = {
  prefixes: ['https://mechbazar.com', 'https://www.mechbazar.com'],
  config: {
    screens: {
      Welcome: 'login',
      WholesaleRegistration: 'wholesale',
      MainTabs: {
        screens: {
          Home: '',
          Categories: 'categories',
          Services: 'services',
          Orders: 'orders',
          Account: 'account',
        },
      },
      ProductDetails: 'product/:productId',
      CategoryProducts: 'category',
      Garage: 'garage',
      DeliveryTracking: 'order/:orderId/track',
      PaymentSuccess: 'payment/success/:orderId',
      PaymentFailure: 'payment/failure/:orderId',
      PaymentPending: 'payment/pending/:orderId',
      AccountDashboard: 'dashboard',
      Wishlist: 'wishlist',
      AddressManagement: 'addresses',
      Notifications: 'notifications',
      HelpCenter: 'help',
      Cart: 'cart',
      ServiceCategory: 'service/:categoryId',
      ServiceBooking: 'service-booking/:packageId',
      ServiceTracking: 'service-tracking/:bookingId',
      ServiceBookingHistory: 'service-bookings',
      ServiceInvoice: 'service-invoice/:bookingId',
      ServiceReview: 'service-review/:bookingId',
      EmergencyRequest: 'emergency/:packageId',
      EmergencyTracking: 'emergency-tracking/:bookingId',
      StaticPage: {
        path: ':page',
        parse: {
          page: (page: string) => STATIC_PAGE_SLUG_TO_KEY[page] ?? 'about',
        },
      },
    },
  },
};

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
  backgroundColor: '#FFFFFF',
  borderRadius: 24,
  height: 64,
  paddingBottom: Platform.OS === 'ios' ? 0 : 8,
  paddingTop: 8,
  borderTopWidth: 0,
  borderWidth: 1,
  borderColor: '#EDEFF5',
  shadowColor: '#0B1220',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 14,
  elevation: 8,
};

function AnimatedTabIcon({ focused, name }: { focused: boolean; name: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={tabIconStyles.wrap}>
      <Ionicons name={name} size={focused ? 23 : 22} color={focused ? '#E53935' : '#8E8E93'} />
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Guards a protected screen so it never mounts (and never fires its data
// fetches) for a logged-out guest -- redirects to Welcome instead, stashing
// where the guest was trying to go via setPendingRedirect so WelcomeScreen
// can send them back there after a successful login.
//
// `redirectTarget` is only needed for screens that aren't directly
// navigable by their own route name from the Stack root -- the Orders/
// Account tabs nested inside MainTabs below, which need
// navigation.navigate('MainTabs', { screen: 'Orders' }) rather than
// navigation.navigate('Orders').
function RequireAuth<P extends object>(
  Component: React.ComponentType<P>,
  redirectTarget?: (routeParams: any) => { screen: string; params?: object },
) {
  return function AuthGated(props: P & { route?: { name: string; params?: object } }) {
    const token = useSelector((state: RootState) => state.auth.token);
    const navigation = useNavigation<any>();

    useEffect(() => {
      if (token) return;
      const target = redirectTarget
        ? redirectTarget((props as any).route?.params)
        : { screen: (props as any).route?.name, params: (props as any).route?.params };
      setPendingRedirect(target);
      navigation.navigate('Welcome');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    if (!token) return null;
    return <Component {...(props as P)} />;
  };
}

const GuardedOrders = RequireAuth(OrderHistoryScreen, () => ({ screen: 'MainTabs', params: { screen: 'Orders' } }));
const GuardedAccount = RequireAuth(AccountScreen, () => ({ screen: 'MainTabs', params: { screen: 'Account' } }));
const GuardedGarage = RequireAuth(GarageScreen);
const GuardedVehicleSelection = RequireAuth(VehicleSelectionScreen);
const GuardedDeliveryTracking = RequireAuth(DeliveryTrackingScreen);
const GuardedOrderInvoice = RequireAuth(OrderInvoiceScreen);
const GuardedPaymentSuccess = RequireAuth(PaymentSuccessScreen);
const GuardedPaymentFailure = RequireAuth(PaymentFailureScreen);
const GuardedPaymentPending = RequireAuth(PaymentPendingScreen);
const GuardedPaymentCancelled = RequireAuth(PaymentCancelledScreen);
const GuardedEditProfile = RequireAuth(EditProfileScreen);
const GuardedAccountDashboard = RequireAuth(AccountDashboardScreen);
const GuardedWishlist = RequireAuth(WishlistScreen);
const GuardedAddressManagement = RequireAuth(AddressManagementScreen);
const GuardedNotifications = RequireAuth(NotificationsScreen);
const GuardedNotificationPreferences = RequireAuth(NotificationPreferencesScreen);
const GuardedServiceBooking = RequireAuth(ServiceBookingScreen);
const GuardedServiceTracking = RequireAuth(ServiceTrackingScreen);
const GuardedServiceChat = RequireAuth(ServiceChatScreen);
const GuardedServiceBookingHistory = RequireAuth(ServiceBookingHistoryScreen);
const GuardedServiceInvoice = RequireAuth(ServiceInvoiceScreen);
const GuardedServiceReview = RequireAuth(ServiceReviewScreen);
const GuardedEmergencyRequest = RequireAuth(EmergencyRequestScreen);
const GuardedEmergencyTracking = RequireAuth(EmergencyTrackingScreen);

function MainTabs() {
  // DesktopAppShell already provides desktop navigation (header + mega menu),
  // so the floating mobile tab bar would just be redundant chrome at desktop
  // widths -- hide it there.
  const { isDesktopUp } = useBreakpoint();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#E53935',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: isDesktopUp ? { display: 'none' } : MOBILE_TAB_BAR_STYLE,
        tabBarIcon: ({ focused }) => <AnimatedTabIcon focused={focused} name={TAB_ICONS[route.name]} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="Services" component={ServicesHomeScreen} />
      {/* Guest tapping Orders/Account gets bounced to Welcome and back
          (RequireAuth above) -- both routes/labels are unchanged so the tab
          bar itself looks identical to a guest and a logged-in user. */}
      <Tab.Screen name="Orders" component={GuardedOrders} />
      <Tab.Screen name="Account" component={GuardedAccount} options={{ tabBarLabel: 'Profile' }} />
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
  const isDark = useIsDarkMode();

  const [isReady, setIsReady] = useState(false);
  const hydratedRef = useRef(false);
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => {
    (async () => {
      try {
        initAppCheck().catch((err) => console.warn('[appCheck] init failed:', err));

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
        dispatch(setThemePreferenceHydrated(await loadThemePreference()));
        dispatch(setLanguageHydrated(await loadLanguagePreference()));
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
    if (token) {
      SecureStore.setItemAsync('token', token).catch(e => console.error('Failed to sync token to SecureStore:', e));
    } else {
      SecureStore.deleteItemAsync('token').catch(e => console.error('Failed to clear token from SecureStore:', e));
    }
  }, [token, user]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const doRefresh = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenRef.current}` },
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          dispatch(loginSuccess({ user: data.user, token: data.token }));
        }
      } catch (e) {
        console.error('Failed to refresh session token:', e);
      }
    };
    doRefresh();
    const interval = setInterval(doRefresh, 12 * 60 * 60 * 1000);
    return () => { cancelled = true; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!token]);

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
    const unsubscribe = addNotificationTapListener((data) => {
      const target = resolveNotificationRoute({ data });
      if (target && navigationRef.isReady()) {
        navigationRef.dispatch(CommonActions.navigate({ name: target.screen, params: target.params }));
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const fcmToken = await registerForWebPushAsync();
        if (!fcmToken) return;
        await fetch(`${API_BASE_URL}/auth/push-token`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ token: fcmToken, type: 'fcm' }),
        });
      } catch (e) {
        console.error('Failed to register web push token:', e);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems)).catch(e => console.error('Failed to persist cart:', e));
  }, [cartItems]);

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

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      dispatch(systemSchemeChanged(colorScheme === 'dark' ? 'dark' : 'light'));
    });
    return () => sub.remove();
  }, [dispatch]);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

  if (!isReady) {
    return (
      <>
        <StatusBar style="dark" />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#E23B22" />
        </View>
      </>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <OfflineBanner />
      <NavigationContainer ref={navigationRef} linking={linking}>
      <DesktopAppShell>
      {/* Guest-first: every screen is registered unconditionally (no
          token ? loggedIn : loggedOut split like App.tsx). Protected screens
          use the Guarded* components defined above, which redirect a
          logged-out guest to Welcome instead of ever mounting. */}
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="MainTabs">
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} />
        <Stack.Screen name="CategoryProducts" component={CategoryProductsScreen} />
        <Stack.Screen name="Garage" component={GuardedGarage} />
        <Stack.Screen name="VehicleSelection" component={GuardedVehicleSelection} />
        <Stack.Screen name="DeliveryTracking" component={GuardedDeliveryTracking} />
        <Stack.Screen name="OrderInvoice" component={GuardedOrderInvoice} />
        <Stack.Screen name="PaymentSuccess" component={GuardedPaymentSuccess} />
        <Stack.Screen name="PaymentFailure" component={GuardedPaymentFailure} />
        <Stack.Screen name="PaymentPending" component={GuardedPaymentPending} />
        <Stack.Screen name="PaymentCancelled" component={GuardedPaymentCancelled} />
        <Stack.Screen name="EditProfile" component={GuardedEditProfile} />
        <Stack.Screen name="AccountDashboard" component={GuardedAccountDashboard} />
        <Stack.Screen name="Wishlist" component={GuardedWishlist} />
        <Stack.Screen name="AddressManagement" component={GuardedAddressManagement} />
        <Stack.Screen name="Notifications" component={GuardedNotifications} />
        <Stack.Screen name="NotificationPreferences" component={GuardedNotificationPreferences} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
        <Stack.Screen name="StaticPage" component={StaticPageScreen} />
        {/* Cart is guest-accessible (browsing + adding items never required an
            account) -- only placing the order requires login, handled inline
            in CartScreen via a Platform.OS === 'web' guard rather than gating
            the whole screen here. */}
        <Stack.Screen name="Cart" component={CartScreen} />
        <Stack.Screen name="ServiceCategory" component={ServiceCategoryScreen} />
        <Stack.Screen name="ServiceBooking" component={GuardedServiceBooking} />
        <Stack.Screen name="ServiceTracking" component={GuardedServiceTracking} />
        <Stack.Screen name="ServiceChat" component={GuardedServiceChat} />
        <Stack.Screen name="ServiceBookingHistory" component={GuardedServiceBookingHistory} />
        <Stack.Screen name="ServiceInvoice" component={GuardedServiceInvoice} />
        <Stack.Screen name="ServiceReview" component={GuardedServiceReview} />
        <Stack.Screen name="EmergencyRequest" component={GuardedEmergencyRequest} />
        <Stack.Screen name="EmergencyTracking" component={GuardedEmergencyTracking} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="WholesaleRegistration" component={WholesaleRegistrationScreen} />
      </Stack.Navigator>
      </DesktopAppShell>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <RootNavigator />
      </Provider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' },
});
