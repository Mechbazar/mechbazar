import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Image, Animated, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { RootState } from '../../store';
import { setVehicleType } from '../../store/appSlice';
import { VehicleType } from '../../types/product';
import { ServiceCategory, ServicePackage, ServiceBooking } from '../../types/service';
import { fetchServiceCategories, fetchMyBookings } from '../../services/service.service';
import { jobService, Job } from '@mechbazar/shared';
import { HeaderCartButton } from '../../components/HeaderCartButton';
import { Icon3D } from '../../components/shared/Icon3D';
import { useIsDarkMode } from '../../theme/useThemeColors';
import { useStableIsDesktopUp } from '../../hooks/useStableIsDesktopUp';
import { setDesktopFullPageScreenActive } from '../../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../../components/desktop/shared/MinimalFooter';

type PkgWithCategory = ServicePackage & { category?: ServiceCategory };

// File-local copy of screens/services/theme.ts's shared `colors` export,
// trimmed to the keys this screen actually uses -- theme.ts itself stays
// untouched (it's a static, light-only palette consumed by several other
// screens/components that haven't been converted yet).
// `white` stays pure white in both themes -- used only for text/icons on
// permanently-colored surfaces (primary/success banners, badges, buttons).
// `surface` is the actual floating-card background (header card, package
// cards, recent-booking rows) and is the one that inverts in dark mode.
const LIGHT_COLORS = {
  primary: '#DA3830',
  darkInk: '#1B1B1B',
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  borderLight: '#E3E6EA',
  textMuted: '#6B7480',
  success: '#1E9E5A',
  surface: '#FFFFFF',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  darkInk: '#F1F2F4',
  pageBg: '#121212',
  white: '#FFFFFF',
  borderLight: '#2E2E2E',
  textMuted: '#A6ACB5',
  success: '#4FE092',
  surface: '#1E1E1E',
};

// Same "gradient fill on select" pill Home's Cars/Bikes selector uses --
// kept as a local copy (not exported from HomeScreen) so this screen's
// vehicle toggle reads as the same premium control instead of the old flat
// dark pill it replaced.
function ServiceVehiclePill({ label, emoji, active, onPress }: { label: string; emoji: string; active: boolean; onPress: () => void }) {
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scale = useRef(new Animated.Value(active ? 1.03 : 1)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: active ? 1.03 : 1, useNativeDriver: true, bounciness: 8 }).start();
  }, [active]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={{ flex: 1 }}>
      <Animated.View style={[styles.togglePill, active && styles.togglePillActiveShadow, { transform: [{ scale }] }]}>
        {active && (
          <View style={StyleSheet.absoluteFill}>
            <Svg height="100%" width="100%">
              <Defs>
                {/* id must be url()-safe -- a raw label like "Car Services"
                    breaks the fragment reference on web SVG (silently falls
                    back to a black fill), so strip whitespace. */}
                <LinearGradient id={`svcPillGrad-${label.replace(/\s+/g, '')}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#FF6B5D" />
                  <Stop offset="100%" stopColor={colors.primary} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#svcPillGrad-${label.replace(/\s+/g, '')})`} rx={16} ry={16} />
            </Svg>
          </View>
        )}
        <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{emoji}  {label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function ServicesHomeScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);
  const { token } = useSelector((state: RootState) => state.auth);
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<ServiceCategory[] | null>(null);
  const [allBookings, setAllBookings] = useState<ServiceBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadCategories = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setLoadError(false);
    const cats = await fetchServiceCategories(vehicleType);
    if (cats === null) {
      setLoadError(true);
    } else {
      setCategories(cats);
    }
    setLoading(false);
    setRefreshing(false);
  }, [vehicleType]);

  const loadBookings = useCallback(async () => {
    if (!token) {
      setAllBookings([]);
      return;
    }
    setAllBookings(await fetchMyBookings(token));
  }, [token]);

  // A live emergency job survives an app restart/kill on the server side (it
  // keeps dispatching, tracking, everything) but the customer has no way back
  // into it without this: reopening the app must resume straight into
  // tracking rather than presenting the catalog as if nothing were in
  // progress -- this is the platform's Uber-style "you have a ride in
  // progress" behavior.
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const loadActiveJob = useCallback(async () => {
    if (!token) { setActiveJob(null); return; }
    setActiveJob(await jobService.getMyActiveJob());
  }, [token]);

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useFocusEffect(useCallback(() => { loadCategories(); loadBookings(); loadActiveJob(); }, [loadCategories, loadBookings, loadActiveJob]));

  const isDesktopUp = useStableIsDesktopUp();
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  const onRefresh = () => loadCategories(true);

  const allPackages = useMemo<PkgWithCategory[]>(
    () => (categories || []).flatMap((c) => (c.packages || []).map((p) => ({ ...p, category: c }))),
    [categories]
  );
  const emergencyCategory = useMemo(() => (categories || []).find((c) => c.isEmergency), [categories]);
  const popularPackages = useMemo(() => allPackages.filter((p) => p.isPopular && p.isActive), [allPackages]);
  const recommendedPackages = useMemo(() => allPackages.filter((p) => p.isRecommended && p.isActive), [allPackages]);
  const emergencyPackages = useMemo(() => allPackages.filter((p) => p.isEmergency && p.isActive), [allPackages]);
  const offerPackages = useMemo(
    () => allPackages.filter((p) => p.isActive && p.discountPrice != null && p.discountPrice < p.price),
    [allPackages]
  );
  // "All Services" is the one section that also surfaces disabled packages
  // (grayed out, tap-disabled) so a service an admin turned off doesn't just
  // vanish without a trace -- every other, curated section stays active-only.
  const allServicesPackages = allPackages;
  const recentBookings = useMemo(
    () => allBookings.filter((b) => b.vehicleType === vehicleType).slice(0, 3),
    [allBookings, vehicleType]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return allPackages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category?.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
    );
  }, [searchQuery, allPackages]);

  const goToPackage = (pkg: PkgWithCategory) => {
    if (!pkg.isActive) return;
    // Emergency packages skip the scheduled wizard entirely -- no date, no
    // time slot, an instant dispatch. See EmergencyRequestScreen.
    if (pkg.isEmergency) {
      navigation.navigate('EmergencyRequest', { packageId: pkg.id, categoryId: pkg.categoryId });
      return;
    }
    navigation.navigate('ServiceBooking', { packageId: pkg.id, categoryId: pkg.categoryId });
  };

  const goToCategory = (category: ServiceCategory) => {
    // ServiceCategoryScreen itself branches emergency packages to
    // EmergencyRequest on tap -- no separate screen needed for the list view.
    navigation.navigate('ServiceCategory', { categoryId: category.id, categoryName: category.name });
  };

  const renderStars = (rating: number) => {
    const rounded = Math.round(rating);
    return (
      <View style={{ flexDirection: 'row' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Ionicons key={i} name={i <= rounded ? 'star' : 'star-outline'} size={11} color="#F5A623" />
        ))}
      </View>
    );
  };

  const renderPackageCard = (pkg: PkgWithCategory, wide = false) => {
    const hasDiscount = pkg.discountPrice != null && pkg.discountPrice < pkg.price;
    const discountPct = hasDiscount ? Math.round(((pkg.price - pkg.discountPrice!) / pkg.price) * 100) : 0;
    return (
      <TouchableOpacity
        key={pkg.id}
        style={[styles.packageCard, wide && styles.packageCardWide, !pkg.isActive && styles.packageCardDisabled]}
        onPress={() => goToPackage(pkg)}
        disabled={!pkg.isActive}
        activeOpacity={pkg.isActive ? 0.7 : 1}
      >
        <View style={styles.packageImageWrap}>
          {pkg.image ? (
            <Image source={{ uri: pkg.image }} style={styles.packageImage} />
          ) : (
            <View style={styles.packageImageFallback}>
              {/* Same glass-highlight overlay Icon3D chips use, hand-rolled
                  since the glyph here is a dynamic backend emoji, not one of
                  our vector names -- see CategoryOrb in HomeScreen.tsx for
                  the same exception. */}
              <View pointerEvents="none" style={styles.packageIconHighlight} />
              <Text style={styles.packageIcon}>{pkg.category?.icon || '🔧'}</Text>
            </View>
          )}
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>{discountPct}% OFF</Text>
            </View>
          )}
          <View style={[styles.availabilityBadge, pkg.isActive ? styles.availabilityOn : styles.availabilityOff]}>
            <Text style={styles.availabilityText}>{pkg.isActive ? 'Available' : 'Unavailable'}</Text>
          </View>
        </View>
        <Text style={styles.packageName} numberOfLines={2}>{pkg.name}</Text>
        {!!pkg.description && <Text style={styles.packageDesc} numberOfLines={2}>{pkg.description}</Text>}
        <View style={styles.packageMetaRow}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.packageMeta}>{pkg.estimatedMinutes} mins</Text>
        </View>
        {pkg.reviewCount > 0 && (
          <View style={styles.packageMetaRow}>
            {renderStars(pkg.rating)}
            <Text style={styles.packageMeta}>{pkg.rating.toFixed(1)} ({pkg.reviewCount})</Text>
          </View>
        )}
        <View style={styles.packagePriceRow}>
          {hasDiscount && <Text style={styles.packageOriginalPrice}>₹{pkg.price}</Text>}
          <Text style={styles.packagePrice}>₹{pkg.discountPrice ?? pkg.price}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ShimmerBlock = ({ style }: { style: any }) => {
    const opacity = useRef(new Animated.Value(0.4)).current;
    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, [opacity]);
    return <Animated.View style={[style, { opacity, backgroundColor: colors.borderLight }]} />;
  };

  const renderSkeleton = () => (
    <View style={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', marginBottom: 20 }}>
        {[1, 2, 3, 4].map((i) => (
          <ShimmerBlock key={i} style={{ width: 60, height: 60, borderRadius: 30, marginRight: 14 }} />
        ))}
      </View>
      {[1, 2, 3].map((i) => (
        <ShimmerBlock key={i} style={{ height: 160, borderRadius: 14, marginBottom: 14 }} />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerWrap}>
        {/* CompactBookingShell is a pure passthrough below desktop width, so
            this only aligns the header card with the 960-wide body below it
            on desktop -- it previously stretched full-bleed while the cards
            underneath stayed centered. */}
        <CompactBookingShell maxWidth={960}>
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.headerTitle}>Doorstep Services</Text>
                <Text style={styles.headerSubtitle}>Mechanic comes to you, not the other way around</Text>
              </View>
              <HeaderCartButton color={colors.darkInk} backgroundColor={colors.pageBg} />
            </View>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={19} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a service (e.g. wash, brakes)..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.toggleContainer}>
              <ServiceVehiclePill
                label="Car Services"
                emoji="🚗"
                active={vehicleType === VehicleType.CAR}
                onPress={() => dispatch(setVehicleType(VehicleType.CAR))}
              />
              <ServiceVehiclePill
                label="Bike Services"
                emoji="🏍️"
                active={vehicleType === VehicleType.BIKE}
                onPress={() => dispatch(setVehicleType(VehicleType.BIKE))}
              />
            </View>
          </View>
        </CompactBookingShell>
      </View>

      <CompactBookingShell maxWidth={960} style={styles.flexFill}>
      {loading ? (
        renderSkeleton()
      ) : loadError ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptySubtitle}>We couldn't load services right now. Please check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadCategories()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : searchResults !== null ? (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          <Text style={styles.sectionTitle}>{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</Text>
          <View style={styles.packageGrid}>
            {searchResults.map((p) => renderPackageCard(p, true))}
          </View>
          {searchResults.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>No services found</Text>
              <Text style={styles.emptySubtitle}>Try a different search term.</Text>
            </View>
          )}
        </ScrollView>
      ) : (categories || []).length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🛠️</Text>
            <Text style={styles.emptyTitle}>No services available yet</Text>
            <Text style={styles.emptySubtitle}>Check back soon — we're setting up doorstep services in your area.</Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        >
          {activeJob && (
            <TouchableOpacity
              style={[styles.emergencyBanner, { backgroundColor: colors.success, shadowColor: colors.success }]}
              onPress={() => navigation.navigate('EmergencyTracking', { bookingId: activeJob.id })}
            >
              <Icon3D name="navigate" size={44} tint="rgba(255,255,255,0.22)" iconColor={colors.white} elevated style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.emergencyTitle}>Request in progress</Text>
                <Text style={styles.emergencySubtitle}>{activeJob.statusMessage} · Tap to track</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.white} />
            </TouchableOpacity>
          )}

          {!activeJob && emergencyCategory && (
            <TouchableOpacity style={styles.emergencyBanner} onPress={() => goToCategory(emergencyCategory)}>
              <Icon3D name="alert-circle" size={44} tint="rgba(255,255,255,0.22)" iconColor={colors.white} elevated style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.emergencyTitle}>Emergency Assistance</Text>
                <Text style={styles.emergencySubtitle}>Breakdown or stuck on the road? Get help now.</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.white} />
            </TouchableOpacity>
          )}

          {emergencyPackages.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Emergency Services</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14 }}>
                {emergencyPackages.map((p) => renderPackageCard(p))}
              </ScrollView>
            </View>
          )}

          {popularPackages.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Popular Services</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14 }}>
                {popularPackages.map((p) => renderPackageCard(p))}
              </ScrollView>
            </View>
          )}

          {offerPackages.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Offers & Discounts</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14 }}>
                {offerPackages.map((p) => renderPackageCard(p))}
              </ScrollView>
            </View>
          )}

          {recentBookings.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recently Booked</Text>
                <TouchableOpacity onPress={() => navigation.navigate('ServiceBookingHistory')}>
                  <Text style={styles.seeAllText}>See all</Text>
                </TouchableOpacity>
              </View>
              {recentBookings.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.recentBookingCard}
                  onPress={() => navigation.navigate('ServiceTracking', { bookingId: b.id })}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentBookingName}>{b.package?.name || 'Service'}</Text>
                    <Text style={styles.recentBookingMeta}>#{b.bookingNumber} · {b.status.replace(/_/g, ' ')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {recommendedPackages.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recommended For Your Vehicle</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14 }}>
                {recommendedPackages.map((p) => renderPackageCard(p))}
              </ScrollView>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>All Services</Text>
            </View>
            <View style={styles.packageGrid}>
              {allServicesPackages.map((p) => renderPackageCard(p, true))}
            </View>
          </View>
          <MinimalFooter />
        </ScrollView>
      )}
      </CompactBookingShell>
    </SafeAreaView>
  );
}

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  flexFill: { flex: 1 },
  headerWrap: { backgroundColor: colors.pageBg, paddingHorizontal: 12, paddingTop: 10 },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: colors.darkInk },
  headerSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 4, maxWidth: 240 },

  searchContainer: { flexDirection: 'row', backgroundColor: colors.pageBg, borderRadius: 16, alignItems: 'center', height: 46, paddingHorizontal: 12, marginBottom: 12, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.darkInk, height: '100%' },

  toggleContainer: { flexDirection: 'row', gap: 10, height: 42 },
  togglePill: { flex: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.pageBg, overflow: 'hidden' },
  togglePillActiveShadow: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 4 },
  toggleText: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  toggleTextActive: { color: colors.white, fontWeight: '800' },

  emergencyBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, marginHorizontal: 14, marginTop: 14, borderRadius: 20, padding: 14, shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6 },
  emergencyTitle: { fontSize: 15, fontWeight: '800', color: colors.white },
  emergencySubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  section: { marginTop: 22 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.darkInk },
  seeAllText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  packageGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 14 },
  packageCard: {
    width: 170,
    backgroundColor: colors.surface,
    borderRadius: 18,
    marginRight: 10,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  packageCardWide: { width: '48%', marginRight: 0 },
  packageCardDisabled: { opacity: 0.5 },

  packageImageWrap: { height: 84, borderRadius: 14, overflow: 'hidden', marginBottom: 8, backgroundColor: colors.pageBg, position: 'relative' },
  packageImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  packageImageFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF1F0' },
  packageIconHighlight: { position: 'absolute', top: 8, left: 12, width: 36, height: 18, borderRadius: 14, backgroundColor: '#FFFFFF', opacity: 0.5 },
  packageIcon: { fontSize: 30 },

  discountBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  discountBadgeText: { color: colors.white, fontSize: 9, fontWeight: 'bold' },

  availabilityBadge: { position: 'absolute', top: 6, right: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  availabilityOn: { backgroundColor: 'rgba(30,158,90,0.9)' },
  availabilityOff: { backgroundColor: 'rgba(107,116,128,0.9)' },
  availabilityText: { color: colors.white, fontSize: 8, fontWeight: '800' },

  packageName: { fontSize: 13, fontWeight: '700', color: colors.darkInk, marginBottom: 3, height: 34, lineHeight: 17 },
  packageDesc: { fontSize: 11, color: colors.textMuted, marginBottom: 6, lineHeight: 15 },
  packageMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  packageMeta: { fontSize: 11, color: colors.textMuted },
  packagePriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  packageOriginalPrice: { fontSize: 11, color: colors.textMuted, textDecorationLine: 'line-through', marginRight: 6 },
  packagePrice: { fontSize: 15, fontWeight: '800', color: colors.darkInk },

  recentBookingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: 14, marginBottom: 10, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.borderLight },
  recentBookingName: { fontSize: 14, fontWeight: '700', color: colors.darkInk, marginBottom: 3 },
  recentBookingMeta: { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.darkInk, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  retryButton: { marginTop: 20, backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 12 },
  retryButtonText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});
