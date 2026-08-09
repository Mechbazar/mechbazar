import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform, Appearance, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as SplashScreen from 'expo-splash-screen';
import { NavigationContainer, LinkingOptions, createNavigationContainerRef, CommonActions } from '@react-navigation/native';
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

// Module-level so the notification-tap listener (which fires outside the
// component tree) can navigate without threading a ref through props.
const navigationRef = createNavigationContainerRef();

// Same key App.js already used for its session cache -- reusing it means an
// already-logged-in user isn't logged out by this rewrite. Cart and garage get
// new keys because their stored shape changed (flat CartItem[] instead of
// App.js's {product, qty}[]; myGarage[] + activeVehicleId instead of a single
// garageVehicle object) -- reusing the old keys there would parse into garbage.
const USER_STORAGE_KEY = 'mb-user';
const CART_STORAGE_KEY = 'mb-cart-v2';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Public policy URLs required by Google Play / Apple App Store review --
// reviewers open these logged out, from a desktop browser, so a login wall or
// 404 here is a rejection. Slugs match docs/legal/app-store-submission-checklist.md's
// Part 1 table exactly. StaticPageScreen already falls back to the "about" page
// for any unrecognised key, so an unmapped path degrades safely rather than
// crashing -- same defensive behaviour already relied on for the native
// mechbazar:// deep-link scheme.
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

// Path shapes intentionally mirror the ad hoc "Check out X on MechBazar!"
// share text in HomeScreen/HomeScreenMobile's Share.share calls -- neither
// currently appends a URL, so wiring one in (a share-link follow-up) would
// slot straight into these paths with no renaming needed.
//
// Screens left unmapped on purpose:
// - OrderInvoice: route.params expects a full `order` object, not an id, so
//   it can't be reached from a bare URL without first adding a fetch-by-id
//   path to that screen -- out of scope for this pass.
// - PaymentCancelled: only reached by actively dismissing the in-app Razorpay
//   sheet (see that screen's own comment); it needs razorpayOrderId/
//   razorpayKeyId that only exist mid-checkout, not from a bare URL --
//   PaymentSuccess/Failure/Pending are the real gateway-redirect targets and
//   only need orderId, so those are mapped.
// - VehicleSelection, EditProfile: not meaningful entry points from outside
//   the app (no shareable state).
// - Any screen requiring auth still requires it after a deep link resolves --
//   the linking config only affects which route the navigator lands on, not
//   RootNavigator's own logged-in/logged-out stack split above.
// The Stack/Tab navigators below are untyped (createNativeStackNavigator()
// with no ParamList generic, same as the rest of this file's useNavigation<any>()
// calls) -- LinkingOptions<any> matches that existing convention rather than
// introducing a first typed param list just for this config.
const linking: LinkingOptions<any> = {
  prefixes: ['https://mechbazar.com', 'https://www.mechbazar.com', 'mechbazar://'],
  config: {
    screens: {
      Welcome: '',
      WholesaleRegistration: 'wholesale',
      MainTabs: {
        screens: {
          Home: 'home',
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
  // Translucent charcoal rather than a flat fill -- the closest a floating
  // RN tab bar gets to glassmorphism without pulling in expo-blur (a new
  // native module every existing build would need to be rebuilt to include).
  backgroundColor: 'rgba(28,28,30,0.88)',
  borderRadius: 24,
  height: 64,
  paddingBottom: Platform.OS === 'ios' ? 0 : 8,
  paddingTop: 8,
  borderTopWidth: 0,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.08)',
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.35,
  shadowRadius: 10,
  elevation: 8,
};

// Selected tab gets a red circular backdrop, a glow, and a spring "pop" --
// the rest just tint the glyph, same as before.
function AnimatedTabIcon({ focused, name }: { focused: boolean; name: keyof typeof Ionicons.glyphMap }) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: focused ? 1 : 0, useNativeDriver: true, bounciness: 10, speed: 16 }).start();
  }, [focused]);

  return (
    <View style={tabIconStyles.wrap}>
      <Animated.View
        style={[
          tabIconStyles.glowBubble,
          {
            opacity: scale,
            transform: [{ scale }],
          },
        ]}
      >
        {/* Same top-left glass highlight / bottom-right shade Icon3D uses
            everywhere else (Services/Categories/Feature Cards/header
            buttons) -- so the selected tab reads as the same chip material
            as the rest of the app's icon system instead of a flat dot. */}
        <View style={tabIconStyles.glowInner}>
          <View pointerEvents="none" style={tabIconStyles.glowHighlight} />
          <View pointerEvents="none" style={tabIconStyles.glowShade} />
        </View>
      </Animated.View>
      <Ionicons name={name} size={focused ? 21 : 22} color={focused ? '#FFFFFF' : '#8E8E93'} />
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
  glowBubble: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    shadowColor: '#E53935',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  glowInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E53935',
  },
  glowHighlight: {
    position: 'absolute',
    top: 3,
    left: 5,
    width: 16,
    height: 9,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    opacity: 0.4,
  },
  glowShade: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#0B1220',
    opacity: 0.1,
  },
});

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
        tabBarIcon: ({ focused }) => <AnimatedTabIcon focused={focused} name={TAB_ICONS[route.name]} />,
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
  // Mirrors `token` for the refresh effect below, which intentionally does NOT
  // depend on `token` itself (see that effect's comment for why).
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  useEffect(() => {
    (async () => {
      try {
        // Fire-and-forget, ahead of the first API call below (session/cart
        // hydration doesn't call the backend, but garage.service's fetch
        // further down in this same boot sequence does). Web's App Check
        // activates as a side effect of importing services/appCheckToken.web.ts
        // instead -- see api.ts, which imports it unconditionally -- so this
        // call only does anything on native; it no-ops immediately on web.
        initAppCheck().catch((err) => console.warn('[appCheck] init failed:', err));

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
        dispatch(setThemePreferenceHydrated(await loadThemePreference()));
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
    // packages/shared's axios client (jobService, etc. -- used by the Services/
    // Emergency screens) reads its bearer token from SecureStore rather than
    // this app's Redux/AsyncStorage session, same as apps/mechanic, apps/rider,
    // apps/seller-mobile and apps/admin-mobile already do at login. Without this,
    // every request made through that shared client goes out with no
    // Authorization header at all and the backend 401s with "No token provided".
    if (token) {
      SecureStore.setItemAsync('token', token).catch(e => console.error('Failed to sync token to SecureStore:', e));
    } else {
      SecureStore.deleteItemAsync('token').catch(e => console.error('Failed to clear token from SecureStore:', e));
    }
  }, [token, user]);

  // Sessions are a flat 7-day JWT with no rotation -- silently slide the
  // expiry forward for anyone actively using the app (on launch, then every
  // 12h) so a real customer mid-session doesn't get hard-logged-out. If the
  // token has already expired/is invalid, the backend 401s and sessionGuard's
  // global-fetch patch (imported above) logs them out cleanly instead.
  // Deliberately keyed on login/logout transitions (boolean), not the token
  // value itself -- a successful refresh replaces the token, which would
  // otherwise re-trigger this effect and refresh again in an infinite loop.
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

  // Deep-link a tapped push notification straight to its order/booking
  // screen (system tray, not just the in-app Notifications list, which
  // already navigates on tap in NotificationsScreen.tsx). Registered once,
  // independent of login state -- a tap can arrive before `token` is set.
  useEffect(() => {
    const unsubscribe = addNotificationTapListener((data) => {
      const target = resolveNotificationRoute({ data });
      if (target && navigationRef.isReady()) {
        navigationRef.dispatch(CommonActions.navigate({ name: target.screen, params: target.params }));
      }
    });
    return unsubscribe;
  }, []);

  // Browser push (web build only -- see services/webPush.ts). Separate from
  // the Expo push token above: writes to User.fcmToken instead of
  // expoPushToken, so both channels can be registered for the same account
  // without overwriting each other.
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

  // Only matters while the user's theme preference is 'system' (see
  // systemSchemeChanged) -- an explicit light/dark choice stays put if the
  // OS theme changes underneath the app.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      dispatch(systemSchemeChanged(colorScheme === 'dark' ? 'dark' : 'light'));
    });
    return () => sub.remove();
  }, [dispatch]);

  // Hold the native splash until fonts, session, cart and garage have all
  // resolved. Without this, expo-splash-screen auto-hides as soon as the JS
  // bundle mounts -- well before `isReady` flips -- so the spinner below was
  // what the user actually saw for 2-3 seconds, reading as a default loading
  // screen between the splash and the first real screen.
  useEffect(() => {
    if (isReady) {
      // Failure here is not worth surfacing: the only case that throws is the
      // splash already having been hidden by something else.
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

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
      <NavigationContainer ref={navigationRef} linking={linking}>
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
            <Stack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} />
            <Stack.Screen name="PaymentFailure" component={PaymentFailureScreen} />
            <Stack.Screen name="PaymentPending" component={PaymentPendingScreen} />
            <Stack.Screen name="PaymentCancelled" component={PaymentCancelledScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="AccountDashboard" component={AccountDashboardScreen} />
            <Stack.Screen name="Wishlist" component={WishlistScreen} />
            <Stack.Screen name="AddressManagement" component={AddressManagementScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="NotificationPreferences" component={NotificationPreferencesScreen} />
            <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
            <Stack.Screen name="StaticPage" component={StaticPageScreen} />
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
            <Stack.Screen name="EmergencyRequest" component={EmergencyRequestScreen} />
            <Stack.Screen name="EmergencyTracking" component={EmergencyTrackingScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="WholesaleRegistration" component={WholesaleRegistrationScreen} />
            {/* Legal pages must be reachable logged out, from a desktop browser --
                a login wall here is an App Store / Play Store review rejection.
                StaticPageScreen has no auth-dependent state, so it's safe to
                register in this pre-login stack too. */}
            <Stack.Screen name="StaticPage" component={StaticPageScreen} />
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
    // Outside the Provider so that a failure in store hydration itself is still
    // caught and shown, rather than taking the tree down before any UI exists.
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
