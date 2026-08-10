// Used for native builds only -- HomeScreen.web.tsx shadows this file on web
// (desktop width renders HomeScreenDesktop.tsx, narrower widths render
// HomeScreenMobile.tsx, a deliberate duplicate kept in sync by hand).
// Everything below line 6 is identical in both files -- verify with
// `diff <(tail -n +7 HomeScreen.tsx) <(tail -n +7 HomeScreenMobile.tsx)`.
// They drifted once already (the reviewsCount branch); mirror every change.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  LayoutChangeEvent,
  Animated,
  Easing,
  ImageBackground,
  Alert,
  Modal,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Loader } from '@mechbazar/shared';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { addToCart, updateQuantity } from '../store/cartSlice';
import { setVehicleType } from '../store/appSlice';
import { fetchCategories, getTrendingProducts, fetchBanners, fetchOffers, HomeOffer, NO_IMAGE_PLACEHOLDER } from '../services/product.service';
import { fetchMyWishlist, addToWishlist, removeFromWishlist } from '../services/wishlist.service';
import { VehicleType, Category, Product } from '../types/product';
import { ServiceAddress } from '../types/service';
import { fetchMyAddresses } from '../services/address.service';
import { locationService } from '../services/location.service';
import { reverseGeocode } from '../services/geocode.service';
import { API_BASE_URL } from '../services/api';
import { Icon3D } from '../components/shared/Icon3D';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

// Premium Design System Colors. `primary` is a shade darker than the brand
// spec's #E53935 -- that hex only clears ~4.2:1 contrast on white text
// (buttons/badges use it as a solid fill), under WCAG AA's 4.5:1 minimum.
// This shade clears it (~4.6:1) while reading as the same red at a glance.
// `primaryBrand` is the exact spec hex, used only for decorative surfaces
// (gradients, icon accents) where contrast isn't load-bearing.
const LIGHT_COLORS = {
  bg: '#F7F8FC',
  card: '#FFFFFF',
  ink: '#111111',
  textMuted: '#6B7480',
  border: '#EDEFF5',
  primary: '#DA3830',
  primaryBrand: '#E53935',
  success: '#1E9E5A',
  warning: '#F59F00',
  white: '#FFFFFF'
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  bg: '#121212',
  card: '#1E1E1E',
  ink: '#F1F2F4',
  textMuted: '#A6ACB5',
  border: '#2E2E2E',
  primary: '#FF5A4E',
  primaryBrand: '#FF6B5E',
  success: '#4FE092',
  warning: '#F5B94D',
  white: '#FFFFFF'
};

// Shared by the main screen and every module-scope subcomponent below it
// (VehiclePill, PaginationDot, CategoryOrb, etc.) -- they're rendered only
// from within HomeScreen but are real function components, so pulling theme
// state via this hook is legal and avoids prop-drilling colors/styles
// through every one of them individually.
const useScreenColors = () => {
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);
  return { colors, styles };
};

const CARD_RADIUS = 24;

const SERVICES = [
  { id: 's1', type: 'wash', nameKey: 'home.services.wash', price: 199 },
  { id: 's2', type: 'ac', nameKey: 'home.services.ac', price: 499 },
  { id: 's3', type: 'oil', nameKey: 'home.services.oil', price: 399 },
  { id: 's4', type: 'battery', nameKey: 'home.services.battery', price: 999 },
  { id: 's5', type: 'tyre', nameKey: 'home.services.tyre', price: 149 },
  { id: 's6', type: 'brake', nameKey: 'home.services.brake', price: 299 },
  { id: 's7', type: 'spa', nameKey: 'home.services.spa', price: 799 },
  { id: 's8', type: 'emergency', nameKey: 'home.services.emergency', price: 499 }
];

// One icon per service type, in the same Icon3D chip language used for
// Quick Actions / Categories / the tab bar / header buttons -- replaces the
// old bespoke dark-panel SVG illustrations (8 separate hand-drawn scenes),
// which were their own visual language distinct from the rest of the app.
const SERVICE_ICONS: Record<string, { set: 'ionicons' | 'mci'; name: string; tint: string; iconColor: string }> = {
  wash: { set: 'mci', name: 'car-wash', tint: '#E8F7FF', iconColor: '#1C7ED6' },
  ac: { set: 'mci', name: 'air-conditioner', tint: '#E8F7FF', iconColor: '#1C7ED6' },
  oil: { set: 'mci', name: 'oil', tint: '#FFF9DB', iconColor: '#F59F00' },
  battery: { set: 'mci', name: 'car-battery', tint: '#EBFBEE', iconColor: '#2B8A3E' },
  tyre: { set: 'mci', name: 'tire', tint: '#F1F3F5', iconColor: '#495057' },
  brake: { set: 'mci', name: 'car-brake-alert', tint: '#FFECEB', iconColor: LIGHT_COLORS.primary },
  spa: { set: 'ionicons', name: 'sparkles-outline', tint: '#F8F0FC', iconColor: '#9C36B5' },
  emergency: { set: 'mci', name: 'car-emergency', tint: '#FFF0F6', iconColor: '#D6336C' },
};

const ServiceIllustration = ({ type }: { type: string }) => {
  const { styles } = useScreenColors();
  const cfg = SERVICE_ICONS[type];
  if (!cfg) return null;
  return (
    <View style={styles.serviceIconBand}>
      <Icon3D set={cfg.set} name={cfg.name} size={64} tint={cfg.tint} iconColor={cfg.iconColor} elevated />
    </View>
  );
};

// Rotating card palette for real offers fetched from the backend (Offer
// model has no color fields of its own -- purely a display concern).
const OFFER_PALETTE = [
  { color: '#FFF5F5', borderColor: '#FFA8A8' },
  { color: '#F8F0FC', borderColor: '#E599F7' },
  { color: '#EBFBEE', borderColor: '#8CE99A' },
  { color: '#E8F7FF', borderColor: '#74C0FC' },
];

// Two-option pill for the Cars/Bikes selector. Flat red fill (no gradient)
// when selected, matching the rest of the flatter icon/surface language.
function VehiclePill({ label, icon, iconSet, active, onPress }: { label: string; icon: string; iconSet: 'ionicons' | 'mci'; active: boolean; onPress: () => void }) {
  const { colors, styles } = useScreenColors();
  const scale = useRef(new Animated.Value(active ? 1.03 : 1)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: active ? 1.03 : 1, useNativeDriver: true, bounciness: 8 }).start();
  }, [active]);
  const IconComp = iconSet === 'mci' ? MaterialCommunityIcons : Ionicons;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ flex: 1 }}>
      <Animated.View style={[styles.pill, active && [styles.pillActive, styles.pillActiveShadow], { transform: [{ scale }] }]}>
        <IconComp name={icon as any} size={16} color={active ? colors.white : colors.textMuted} />
        <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// Animated banner pagination dot -- widens into a pill when active instead
// of just swapping color, so the carousel position reads as a smooth
// transition rather than a jump cut.
function PaginationDot({ active }: { active: boolean }) {
  const { colors, styles } = useScreenColors();
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: active ? 1 : 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [active]);
  const dotWidth = anim.interpolate({ inputRange: [0, 1], outputRange: [7, 22] });
  const bg = anim.interpolate({ inputRange: [0, 1], outputRange: ['#D8DCE3', colors.primary] });
  return <Animated.View style={[styles.paginationDot, { width: dotWidth, backgroundColor: bg as any }]} />;
}

// Quick-action card: icon + title + subtitle, white card with a soft border/
// shadow -- no idle float, so the "what do you need today?" grid reads as
// calm and scannable rather than six simultaneously animating tiles.
function QuickActionCard({ icon, label, subtitle, tint, iconColor, onPress }: { icon: any; label: string; subtitle: string; tint: string; iconColor: string; onPress: () => void }) {
  const { styles } = useScreenColors();
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  return (
    <TouchableOpacity onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} activeOpacity={0.9} style={styles.quickCardTouchable}>
      <Animated.View style={[styles.quickCard, { transform: [{ scale }] }]}>
        <Icon3D name={icon} size={44} tint={tint} iconColor={iconColor} style={{ marginBottom: 10 }} />
        <Text style={styles.quickLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.quickSubtitle} numberOfLines={2}>{subtitle}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// Circular category icon: a plain white disc (border + soft shadow) holding
// the real category image, or an emoji fallback when the category has none.
function CategoryOrb({ cat, onPress }: { cat: Category; onPress: () => void }) {
  const { styles } = useScreenColors();
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.92, useNativeDriver: true, speed: 50 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  return (
    <TouchableOpacity onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} activeOpacity={0.9} style={styles.categoryItem}>
      <Animated.View style={[styles.categoryRing, { transform: [{ scale }] }]}>
        <View style={styles.categoryOrb}>
          {cat.image ? (
            <Image source={{ uri: cat.image }} style={styles.categoryIconImg} />
          ) : (
            <Text style={styles.categoryEmoji}>{cat.icon || '📦'}</Text>
          )}
        </View>
      </Animated.View>
      <Text style={styles.categoryLabelText} numberOfLines={2}>{cat.name}</Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { colors, styles } = useScreenColors();
  const { token } = useSelector((state: RootState) => state.auth);
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);
  const myGarage = useSelector((state: RootState) => state.app.myGarage);
  const activeVehicleId = useSelector((state: RootState) => state.app.activeVehicleId);
  const activeVehicle = myGarage.find(v => v.id === activeVehicleId);

  const cartItemCount = cartItems.reduce((sum, item) => sum + item.qty, 0);

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [locationName, setLocationName] = useState('Fetching location...');
  const [defaultAddress, setDefaultAddress] = useState<ServiceAddress | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [activeBannerIndex, setActiveBannerIndex] = useState(0);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>({});
  const [offers, setOffers] = useState<HomeOffer[]>([]);
  const [wishlist, setWishlist] = useState<Record<string, boolean>>({});
  const [isHomeContentLoading, setIsHomeContentLoading] = useState(true);

  // Scroll View Ref for anchor jumps
  const mainScrollRef = useRef<ScrollView>(null);
  const bannerScrollRef = useRef<ScrollView>(null);

  // Measured y of each anchorable section. The quick-action tiles used to jump
  // to hardcoded offsets (380 / 880 / 1120), which silently drifted off target
  // whenever any section above them changed height -- including the header and
  // spacing changes on this screen. Measuring is the only version that stays
  // correct.
  const sectionOffsets = useRef<Record<string, number>>({});
  const registerSection = (key: string) => (e: LayoutChangeEvent) => {
    sectionOffsets.current[key] = e.nativeEvent.layout.y;
  };
  // Takes fallbacks because "Today's Deals" points at the offers section, which
  // is not rendered at all when there are no live offers.
  const scrollToSection = (...keys: string[]) => {
    for (const key of keys) {
      const y = sectionOffsets.current[key];
      if (y !== undefined) {
        mainScrollRef.current?.scrollTo({ y: Math.max(y - 8, 0), animated: true });
        return;
      }
    }
  };

  const suggestions = ['Engine Oils', 'Brake Pads', 'Helmets', 'Car Wash Kit', 'Mechanics'];

  // Banner slide loop
  useEffect(() => {
    if (banners.length === 0) return;
    const bannerTimer = setInterval(() => {
      const nextIdx = (activeBannerIndex + 1) % banners.length;
      bannerScrollRef.current?.scrollTo({ x: nextIdx * width, animated: true });
      setActiveBannerIndex(nextIdx);
    }, 4500);
    return () => clearInterval(bannerTimer);
  }, [activeBannerIndex, banners]);

  // Load backend content
  useEffect(() => {
    setIsHomeContentLoading(true);
    Promise.all([
      fetchCategories(vehicleType).then(setCategories),
      getTrendingProducts(vehicleType).then(setTrendingProducts),
      fetchBanners(vehicleType).then(setBanners),
      fetchOffers(vehicleType).then(setOffers),
    ]).finally(() => setIsHomeContentLoading(false));
  }, [vehicleType]);

  useEffect(() => {
    if (!token) {
      setWishlist({});
      return;
    }
    fetchMyWishlist(token).then(items => {
      setWishlist(Object.fromEntries(items.map(i => [i.id, true])));
    });
  }, [token]);

  // Header state that the user can change from other screens -- the delivery
  // address (Addresses) and the unread badge (Notifications) -- so it is
  // refreshed on focus rather than only on mount, which would leave the header
  // showing the address they just replaced.
  useEffect(() => {
    if (!token) {
      setDefaultAddress(null);
      setUnreadCount(0);
      return;
    }
    const loadHeaderData = () => {
      fetchMyAddresses(token).then(list => {
        setDefaultAddress(list.find(a => a.isDefault) || list[0] || null);
      });
      fetch(`${API_BASE_URL}/customers/notifications`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => (res.ok ? res.json() : []))
        .then((items: any[]) => setUnreadCount(items.filter(n => !n.isRead).length))
        .catch(() => setUnreadCount(0));
    };
    loadHeaderData();
    return navigation.addListener('focus', loadHeaderData);
  }, [token, navigation]);

  // Request location -- device GPS read via locationService, reverse
  // geocoded through the backend (services/geocode.service.ts) rather than
  // on-device, so there's exactly one geocoding implementation in this app.
  useEffect(() => {
    (async () => {
      const coords = await locationService.getCurrentLocation();
      if (!coords) {
        setLocationName('New Delhi');
        return;
      }
      const result = await reverseGeocode(token, coords.latitude, coords.longitude);
      setLocationName(result.ok ? result.components.city || 'Delhi' : 'New Delhi');
    })();
  }, []);

  const toggleVehicleType = (type: VehicleType) => {
    dispatch(setVehicleType(type));
  };

  const handleSearch = () => {
    if (searchQuery.trim().length > 0) {
      if (!recentSearches.includes(searchQuery.trim())) {
        setRecentSearches(prev => [searchQuery.trim(), ...prev.slice(0, 4)]);
      }
      setIsSearchFocused(false);
      navigation.navigate('CategoryProducts', {
        categoryName: 'Search Results',
        initialSearchQuery: searchQuery,
        brandId: activeVehicle?.brand || undefined,
        modelId: activeVehicle?.model || undefined,
        year: activeVehicle?.year || undefined
      });
    }
  };

  const handleSuggestionPress = (term: string) => {
    setSearchQuery(term);
    setIsSearchFocused(false);
    navigation.navigate('CategoryProducts', {
      categoryName: 'Search Results',
      initialSearchQuery: term,
      brandId: activeVehicle?.brand || undefined,
      modelId: activeVehicle?.model || undefined,
      year: activeVehicle?.year || undefined
    });
  };

  // Real product-listing screen (with its own working filter sheet) instead
  // of a fake filter UI on this screen -- see CategoryProductsScreen.
  const handleOpenFilters = () => {
    navigation.navigate('CategoryProducts', {
      categoryName: 'All Products',
      brandId: activeVehicle?.brand || undefined,
      modelId: activeVehicle?.model || undefined,
      year: activeVehicle?.year || undefined
    });
  };

  const handleWishlistToggle = async (id: string) => {
    if (!token) {
      Alert.alert('Sign in required', 'Please log in to save items to your wishlist.');
      return;
    }
    const wasWishlisted = !!wishlist[id];
    setWishlist(prev => ({ ...prev, [id]: !wasWishlisted }));
    const result = wasWishlisted ? await removeFromWishlist(token, id) : await addToWishlist(token, id);
    if (!result.ok) {
      setWishlist(prev => ({ ...prev, [id]: wasWishlisted }));
      Alert.alert('Error', result.error || 'Failed to update wishlist');
      return;
    }
    Alert.alert('Wishlist', !wasWishlisted ? 'Product added to wishlist.' : 'Product removed from wishlist.');
  };

  const handleShareProduct = (name: string) => {
    // Real native share sheet -- this used to just claim "copied to your
    // clipboard" without ever touching the clipboard or sharing anything.
    Share.share({ message: `Check out ${name} on MechBazar!` }).catch(() => {});
  };

  // Real emergency booking flow lives in ServicesHomeScreen (isEmergency
  // categories/packages, admin-managed) -- this used to show a fake "a
  // verification agent is calling you back in 60 seconds" alert with no
  // dispatcher, no backend call, and no way to actually get help.
  const handleEmergencyBreakdown = () => {
    navigation.navigate('Services');
  };

  const getProductQtyInCart = (prodId: string) => {
    const item = cartItems.find(i => i.id === prodId);
    return item ? item.qty : 0;
  };

  const handleProductCardQtyChange = (prod: Product, change: number) => {
    const currentQty = getProductQtyInCart(prod.id);
    const newQty = currentQty + change;
    dispatch(updateQuantity({ id: prod.id, qty: newQty }));
  };

  // "Deliver to" names the saved default address when there is one -- that is
  // where orders actually ship -- and falls back to the GPS-derived city while
  // the customer has no address on file yet.
  const deliveryLabel = defaultAddress
    ? [defaultAddress.title, defaultAddress.city].filter(Boolean).join(' · ')
    : locationName;

  const QUICK_ACTIONS = [
    { key: 'parts', label: t('home.quickActions.spareParts'), subtitle: t('home.quickActions.sparePartsSubtitle'), icon: 'car' as const, tint: '#FFECEB', iconColor: colors.primary, onPress: () => scrollToSection('categories') },
    { key: 'mechanic', label: t('home.quickActions.homeMechanic'), subtitle: t('home.quickActions.homeMechanicSubtitle'), icon: 'build' as const, tint: '#EBFBEE', iconColor: '#2B8A3E', onPress: () => scrollToSection('services') },
    { key: 'orders', label: t('home.quickActions.trackOrder'), subtitle: t('home.quickActions.trackOrderSubtitle'), icon: 'cube-outline' as const, tint: '#E8F7FF', iconColor: '#1C7ED6', onPress: () => navigation.navigate('MainTabs', { screen: 'Orders' }) },
    { key: 'breakdown', label: t('home.quickActions.breakdown'), subtitle: t('home.quickActions.breakdownSubtitle'), icon: 'flash' as const, tint: '#FFF9DB', iconColor: '#F59F00', onPress: handleEmergencyBreakdown },
    // Repointed at the existing "My Garage" route -- it used to just scroll
    // to Shop by Category, silently duplicating the Spare Parts card above.
    { key: 'tools', label: t('home.quickActions.garageTools'), subtitle: t('home.quickActions.garageToolsSubtitle'), icon: 'construct' as const, tint: '#F8F0FC', iconColor: '#9C36B5', onPress: () => navigation.navigate('Garage') },
    { key: 'deals', label: t('home.quickActions.todaysDeals'), subtitle: t('home.quickActions.todaysDealsSubtitle'), icon: 'gift' as const, tint: '#FFF0F6', iconColor: '#D6336C', onPress: () => scrollToSection('offers', 'trending') },
  ];

  const renderHeader = () => (
    <View style={styles.headerWrap}>
      <View style={styles.headerCard}>
        {/* The delivery address leads the header. The wordmark used to occupy
            this row and pushed the address down onto one of its own -- an extra
            band of vertical space spent telling customers the name of the app
            they already opened, above the one line they came to check. */}
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.deliverToBlock}
            onPress={() => navigation.navigate('AddressManagement')}
            activeOpacity={0.7}
          >
            <View style={styles.deliverToLabelRow}>
              <Ionicons name="location" size={12} color={colors.primary} />
              <Text style={styles.deliverToLabel}>{t('home.deliverTo')}</Text>
            </View>
            <View style={styles.deliverToValueRow}>
              <Text style={styles.deliverToValue} numberOfLines={1}>{deliveryLabel}</Text>
              <Ionicons name="chevron-down" size={13} color={colors.ink} style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>

          {/* Right side icons row */}
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.navigate('Wishlist')}
              activeOpacity={0.8}
            >
              <Icon3D name="heart-outline" size={36} tint={colors.bg} iconColor={colors.ink} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.navigate('Cart')}
              activeOpacity={0.8}
            >
              {cartItemCount > 0 && (
                <View style={styles.badgeBubble}>
                  <Text style={styles.badgeText}>{cartItemCount}</Text>
                </View>
              )}
              <Icon3D name="cart-outline" size={36} tint={colors.bg} iconColor={colors.ink} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerIconBtn}
              onPress={() => navigation.navigate('Notifications')}
              activeOpacity={0.8}
            >
              {/* Was rendered unconditionally, so the bell claimed unread
                  notifications permanently -- including for accounts that had
                  never received one. */}
              {unreadCount > 0 && <View style={styles.notificationDot} />}
              <Icon3D name="notifications-outline" size={36} tint={colors.bg} iconColor={colors.ink} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Input bar */}
        <View style={styles.searchBarRow}>
          <Ionicons name="search" size={19} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchFocused(true)}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={handleOpenFilters} accessibilityLabel="Filter products" activeOpacity={0.85}>
            <Icon3D name="options-outline" size={38} shape="squircle" tint={colors.primary} iconColor={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Cars/Bikes selector */}
        <View style={styles.pillRow}>
          <VehiclePill label={t('home.cars')} icon="car-outline" iconSet="ionicons" active={vehicleType === VehicleType.CAR} onPress={() => toggleVehicleType(VehicleType.CAR)} />
          <VehiclePill label={t('home.bikes')} icon="motorbike" iconSet="mci" active={vehicleType === VehicleType.BIKE} onPress={() => toggleVehicleType(VehicleType.BIKE)} />
        </View>
      </View>
    </View>
  );

  const renderBanners = () => {
    return (
      <View>
        <ScrollView
          ref={bannerScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) => {
            const scrollPos = e.nativeEvent.contentOffset.x;
            const index = Math.round(scrollPos / width);
            setActiveBannerIndex(index);
          }}
          scrollEventThrottle={16}
        >
          {banners.map((banner, index) => (
            <View key={banner.id} style={{ width, paddingHorizontal: 16 }}>
              <ImageBackground
                source={banner.image}
                style={styles.fullBanner}
                imageStyle={{ borderRadius: CARD_RADIUS }}
              >
                <View style={styles.bannerGlass}>
                  <Text style={styles.bannerTitleText}>{banner.title}</Text>
                  <Text style={styles.bannerSubtitleText}>{banner.subtitle}</Text>
                  <Text style={styles.bannerOfferText}>{banner.offer}</Text>

                  <TouchableOpacity style={styles.shopNowBtn} onPress={handleSearch} activeOpacity={0.85}>
                    <Text style={styles.shopNowText}>{t('home.shopNow')}</Text>
                    <Ionicons name="arrow-forward" size={14} color={colors.white} />
                  </TouchableOpacity>
                </View>
              </ImageBackground>
            </View>
          ))}
        </ScrollView>
        <View style={styles.paginationContainer}>
          {banners.map((_, index) => (
            <PaginationDot key={index} active={activeBannerIndex === index} />
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}

      <ScrollView ref={mainScrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>

        {/* Banner Section */}
        <View style={styles.bannerSection}>
          {renderBanners()}
        </View>

        {/* QUICK ACTIONS SECTION -- "What do you need today?" */}
        <View style={styles.quickActionsContainer}>
          <Text style={styles.quickActionsTitle}>{t('home.whatDoYouNeed')}</Text>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((qa) => (
              <QuickActionCard
                key={qa.key}
                icon={qa.icon}
                label={qa.label}
                subtitle={qa.subtitle}
                tint={qa.tint}
                iconColor={qa.iconColor}
                onPress={qa.onPress}
              />
            ))}
          </View>
        </View>

        {/* SHOP BY CATEGORY SECTION */}
        <View style={styles.section} onLayout={registerSection('categories')}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.shopByCategory')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MainTabs', { screen: 'Categories' })}>
              <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
            </TouchableOpacity>
          </View>
          {isHomeContentLoading ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <Loader size="small" />
            </View>
          ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
            {categories.map((cat) => (
              <CategoryOrb
                key={cat.id}
                cat={cat}
                onPress={() => navigation.navigate('CategoryProducts', {
                  categoryName: cat.name,
                  brandId: activeVehicle?.brand || undefined,
                  modelId: activeVehicle?.model || undefined,
                  year: activeVehicle?.year || undefined
                })}
              />
            ))}
          </ScrollView>
          )}
        </View>

        {/* TRUST SECTION */}
        <View style={styles.section}>
          <View style={styles.trustRow}>
            <View style={styles.trustItem}>
              <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
              <Text style={styles.trustItemText}>{t('home.trust.genuineProducts')}</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="pricetags-outline" size={22} color={colors.primary} />
              <Text style={styles.trustItemText}>{t('home.trust.bestPrices')}</Text>
            </View>
            <View style={styles.trustItem}>
              <Ionicons name="headset-outline" size={22} color={colors.primary} />
              <Text style={styles.trustItemText}>{t('home.trust.expertSupport')}</Text>
            </View>
          </View>
        </View>

        {/* SERVICES SECTION */}
        <View style={styles.section} onLayout={registerSection('services')}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('home.doorstepServices')}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Services')}>
              <Text style={styles.seeAllText}>{t('home.seeAll')}</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {SERVICES.map((serv) => (
              <View key={serv.id} style={styles.serviceCard}>
                <ServiceIllustration type={serv.type} />
                <View style={styles.serviceInfo}>
                  <Text style={styles.serviceName}>{t(serv.nameKey)}</Text>
                  <Text style={styles.servicePrice}>{t('home.startsAt', { price: serv.price })}</Text>
                  <TouchableOpacity
                    style={styles.serviceBookBtn}
                    onPress={() => navigation.navigate('Services')}
                  >
                    <Text style={styles.serviceBookBtnText}>{t('home.bookNow')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* FEATURED / TRENDING PRODUCTS SECTION */}
        <View style={styles.section} onLayout={registerSection('trending')}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{vehicleType === VehicleType.CAR ? t('home.trendingCarParts') : t('home.trendingBikeParts')}</Text>
          </View>

          {isHomeContentLoading ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <Loader size="small" />
            </View>
          ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
            {trendingProducts.map((prod) => {
              const qtyInCart = getProductQtyInCart(prod.id);
              return (
                <View key={prod.id} style={styles.productCard}>
                  {/* Share & Wishlist overlay */}
                  <View style={styles.cardHeaderOverlay}>
                    <TouchableOpacity onPress={() => handleWishlistToggle(prod.id)} style={styles.badgeRoundBtn}>
                      <Ionicons
                        name={wishlist[prod.id] ? "heart" : "heart-outline"}
                        size={16}
                        color={wishlist[prod.id] ? colors.primary : colors.textMuted}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleShareProduct(prod.name)} style={[styles.badgeRoundBtn, { marginTop: 6 }]}>
                      <Ionicons name="share-social-outline" size={15} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={() => navigation.navigate('ProductDetails', { productId: prod.id })}
                    style={styles.imageContainer}
                  >
                    <Image
                      source={{ uri: failedImageIds[prod.id] ? NO_IMAGE_PLACEHOLDER : prod.image }}
                      style={styles.productImage}
                      onError={() => setFailedImageIds(prev => ({ ...prev, [prod.id]: true }))}
                    />
                    <View style={styles.timerBadge}>
                      <Text style={styles.timerText}>⏱ {prod.time}</Text>
                    </View>
                    {(prod.discountPercentage ?? 0) > 0 && (
                      <View style={styles.discountTag}>
                        <Text style={styles.discountTagText}>{t('home.percentOff', { percent: prod.discountPercentage })}</Text>
                      </View>
                    )}
                  </TouchableOpacity>

                  <View style={styles.productInfo}>
                    <Text style={styles.productBrand}>{prod.brand}</Text>
                    <Text style={styles.productName} numberOfLines={2}>{prod.name}</Text>

                    {/* Ratings */}
                    <View style={styles.ratingRow}>
                      {prod.reviewsCount ? (
                        <>
                          <Ionicons name="star" size={12} color="#F5A300" />
                          <Text style={styles.ratingText}>{t('home.ratingReviews', { rating: prod.rating, count: prod.reviewsCount })}</Text>
                        </>
                      ) : (
                        <Text style={styles.ratingText}>{t('home.new')}</Text>
                      )}
                    </View>

                    {/* Stock status */}
                    <Text style={[styles.stockLabel, { color: prod.stockStatus === 'In Stock' ? colors.success : colors.warning }]}>
                      ● {prod.stockStatus}
                    </Text>

                    <View style={styles.priceRow}>
                      <View>
                        <Text style={styles.originalPrice}>{t('home.mrp', { price: prod.originalPrice })}</Text>
                        <Text style={styles.price}>₹{prod.price}</Text>
                      </View>

                      {qtyInCart > 0 ? (
                        <View style={styles.qtyContainer}>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => handleProductCardQtyChange(prod, -1)}
                          >
                            <Text style={styles.qtyBtnText}>-</Text>
                          </TouchableOpacity>
                          <Text style={styles.qtyTextVal}>{qtyInCart}</Text>
                          <TouchableOpacity
                            style={styles.qtyBtn}
                            onPress={() => handleProductCardQtyChange(prod, 1)}
                          >
                            <Text style={styles.qtyBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.addButton}
                          onPress={() => dispatch(addToCart({
                            id: prod.id,
                            name: prod.name,
                            price: prod.price,
                            originalPrice: prod.originalPrice,
                            image: prod.image,
                            isB2B: prod.isB2B,
                            moq: prod.moq,
                            vehicleType: prod.vehicleType
                          }))}
                        >
                          <Text style={styles.addButtonText}>{t('home.add')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={styles.buyNowBtn}
                      onPress={() => {
                        if (qtyInCart === 0) {
                          dispatch(addToCart({
                            id: prod.id,
                            name: prod.name,
                            price: prod.price,
                            originalPrice: prod.originalPrice,
                            image: prod.image,
                            isB2B: prod.isB2B,
                            moq: prod.moq,
                            vehicleType: prod.vehicleType
                          }));
                        }
                        navigation.navigate('Cart');
                      }}
                    >
                      <Text style={styles.buyNowBtnText}>{t('home.buyNow')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          )}
        </View>


        {/* TODAY'S OFFERS SECTION -- real Offer rows (admin-managed) instead
            of the 4 hardcoded "Flash Sale / Combo Deals / Battery Exchange /
            Free Delivery" cards with invented codes this used to always show. */}
        {(isHomeContentLoading || offers.length > 0) && (
          <View style={styles.section} onLayout={registerSection('offers')}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('home.todaysOffers')}</Text>
            </View>
            {isHomeContentLoading ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Loader size="small" />
              </View>
            ) : (
              <View style={styles.offersGrid}>
                {offers.map((offer, idx) => {
                  const palette = OFFER_PALETTE[idx % OFFER_PALETTE.length];
                  return (
                    <View
                      key={offer.id}
                      style={[styles.offerCard, { backgroundColor: palette.color, borderColor: palette.borderColor }]}
                    >
                      <Text style={styles.offerTitle}>{offer.title}</Text>
                      {!!offer.description && <Text style={styles.offerDesc}>{offer.description}</Text>}
                      {!!offer.code && (
                        <View style={styles.offerBadge}>
                          <Text style={styles.offerBadgeText}>{offer.code}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* SEARCH SUGGESTIONS OVERLAY */}
      <Modal
        visible={isSearchFocused}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setIsSearchFocused(false)}
      >
        <SafeAreaView style={styles.overlaySafe}>
          <View style={styles.overlayContainer}>
            {/* Search inputs bar */}
            <View style={styles.overlayInputRow}>
              <Ionicons name="search" size={20} color={colors.textMuted} />
              <TextInput
                style={styles.overlayInput}
                placeholder={t('home.searchPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                autoFocus={true}
                returnKeyType="search"
              />
              <TouchableOpacity onPress={() => setIsSearchFocused(false)} style={styles.overlayCloseBtn}>
                <Ionicons name="close-circle" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Recents list */}
            {recentSearches.length > 0 && (
              <View style={styles.overlayBlock}>
                <View style={styles.overlayBlockHeader}>
                  <Text style={styles.overlayBlockTitle}>{t('home.recentSearches')}</Text>
                  <TouchableOpacity onPress={() => setRecentSearches([])}>
                    <Text style={styles.clearText}>{t('home.clearAll')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.recentRow}>
                  {recentSearches.map((term, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.recentItem}
                      onPress={() => handleSuggestionPress(term)}
                    >
                      <Ionicons name="time-outline" size={14} color={colors.textMuted} style={{ marginRight: 4 }} />
                      <Text style={styles.recentText}>{term}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Popular tags */}
            <View style={styles.overlayBlock}>
              <Text style={styles.overlayBlockTitle}>{t('home.popularSuggestions')}</Text>
              <View style={styles.suggestionsGrid}>
                {suggestions.map((term, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestionTag}
                    onPress={() => handleSuggestionPress(term)}
                  >
                    <Ionicons name="trending-up" size={14} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.suggestionTagText}>{term}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Voice search and barcode/QR scanner modals removed -- both used to
          simulate their result (a canned "brake pads" / "Castrol oil" search
          after a timed animation) with no real speech-to-text or camera/
          barcode SDK behind them, the same class of fabricated feature the
          video-call section was already removed for. */}

    </SafeAreaView>
  );
}

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg
  },
  headerWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    zIndex: 10,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  deliverToBlock: { flex: 1, marginRight: 8 },
  deliverToLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deliverToLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  deliverToValueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 1 },
  deliverToValue: { fontSize: 14, fontWeight: '700', color: colors.ink, maxWidth: width * 0.5 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIconBtn: {
    marginLeft: 6,
    position: 'relative'
  },
  badgeBubble: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.primary,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold'
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    zIndex: 4,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    height: 50,
    paddingLeft: 14,
    paddingRight: 5,
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    height: '100%',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  pill: {
    height: 40,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillActiveShadow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  pillTextActive: {
    color: colors.white,
  },
  bannerSection: {
    marginTop: 16,
  },
  fullBanner: {
    height: 190,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bannerGlass: {
    margin: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(17,17,17,0.42)',
  },
  bannerTitleText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  bannerSubtitleText: {
    color: '#F1F2F4',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  bannerOfferText: {
    color: colors.primaryBrand,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  shopNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
  },
  shopNowText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  paginationDot: {
    height: 7,
    borderRadius: 4,
  },
  quickActionsContainer: {
    paddingHorizontal: 10,
    marginTop: 22,
  },
  quickActionsTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 12,
    paddingHorizontal: 6,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quickCardTouchable: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
  },
  quickCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  quickLabel: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.ink,
  },
  quickSubtitle: {
    fontSize: 11.5,
    fontWeight: '500',
    color: colors.textMuted,
    marginTop: 2,
  },
  section: {
    marginTop: 26,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  categoriesContainer: {
    paddingHorizontal: 16,
  },
  categoryItem: {
    alignItems: 'center',
    marginRight: 18,
    width: 72,
  },
  categoryRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 8,
  },
  categoryOrb: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  categoryIconImg: {
    width: '100%',
    height: '100%',
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryLabelText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
  },
  serviceIconBand: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
  },
  serviceCard: {
    width: 190,
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  serviceInfo: {
    padding: 14,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  servicePrice: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 10,
  },
  serviceBookBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  serviceBookBtnText: {
    color: colors.white,
    fontSize: 12.5,
    fontWeight: '700',
  },
  productCard: {
    width: 168,
    backgroundColor: colors.card,
    borderRadius: CARD_RADIUS,
    marginRight: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardHeaderOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 5,
  },
  badgeRoundBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    height: 130,
    backgroundColor: colors.bg,
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  timerBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(17,17,17,0.72)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
  discountTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  discountTagText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  productInfo: {
    padding: 12,
  },
  productBrand: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  productName: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 2,
    minHeight: 32,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 10.5,
    color: colors.textMuted,
    fontWeight: '600',
  },
  stockLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  originalPrice: {
    fontSize: 10,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    overflow: 'hidden',
  },
  qtyBtn: {
    width: 24,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  qtyTextVal: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 11.5,
    fontWeight: '800',
  },
  buyNowBtn: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  buyNowBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  offersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
  },
  offerCard: {
    width: (width - 32 - 10) / 2,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
  },
  // offerCard's background is a fixed light pastel from OFFER_PALETTE
  // (decorative, doesn't invert with the theme) -- its text must stay pinned
  // to the light-mode ink/muted tones too, not the dynamic `colors` that
  // turn near-white in dark mode and disappear against it.
  offerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: LIGHT_COLORS.ink,
  },
  offerDesc: {
    fontSize: 11,
    color: LIGHT_COLORS.textMuted,
    marginTop: 3,
  },
  offerBadge: {
    alignSelf: 'flex-start',
    backgroundColor: LIGHT_COLORS.white,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 8,
  },
  offerBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: LIGHT_COLORS.ink,
    letterSpacing: 0.5,
  },
  trustRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  trustItemText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
    marginTop: 6,
  },
  overlaySafe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  overlayContainer: {
    flex: 1,
    padding: 16,
  },
  overlayInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    height: 48,
    paddingHorizontal: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  overlayInput: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    height: '100%',
  },
  overlayCloseBtn: {
    padding: 4,
  },
  overlayBlock: {
    marginTop: 22,
  },
  overlayBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  overlayBlockTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
  clearText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  recentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentText: {
    fontSize: 12,
    color: colors.ink,
    fontWeight: '600',
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F0',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  suggestionTagText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },
});
