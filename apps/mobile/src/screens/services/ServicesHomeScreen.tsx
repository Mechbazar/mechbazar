import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Image, Animated, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSelector, useDispatch } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import { RootState } from '../../store';
import { setVehicleType } from '../../store/appSlice';
import { VehicleType } from '../../types/product';
import { ServiceCategory, ServicePackage, ServiceBooking } from '../../types/service';
import { fetchServiceCategories, fetchMyBookings } from '../../services/service.service';
import { HeaderCartButton } from '../../components/HeaderCartButton';
import { colors } from './theme';

type PkgWithCategory = ServicePackage & { category?: ServiceCategory };

export default function ServicesHomeScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);
  const { token } = useSelector((state: RootState) => state.auth);

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

  useEffect(() => { loadCategories(); }, [loadCategories]);
  useFocusEffect(useCallback(() => { loadCategories(); loadBookings(); }, [loadCategories, loadBookings]));

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
    navigation.navigate('ServiceBooking', { packageId: pkg.id, categoryId: pkg.categoryId });
  };

  const goToCategory = (category: ServiceCategory) => {
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
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Doorstep Services</Text>
            <Text style={styles.headerSubtitle}>Mechanic comes to you, not the other way around</Text>
          </View>
          <HeaderCartButton />
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textMuted} style={{ marginLeft: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for a service (e.g. wash, brakes)..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4, marginRight: 6 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, vehicleType === VehicleType.CAR && styles.toggleButtonActive]}
            onPress={() => dispatch(setVehicleType(VehicleType.CAR))}
          >
            <Text style={[styles.toggleText, vehicleType === VehicleType.CAR && styles.toggleTextActive]}>🚗 Car Services</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, vehicleType === VehicleType.BIKE && styles.toggleButtonActive]}
            onPress={() => dispatch(setVehicleType(VehicleType.BIKE))}
          >
            <Text style={[styles.toggleText, vehicleType === VehicleType.BIKE && styles.toggleTextActive]}>🏍️ Bike Services</Text>
          </TouchableOpacity>
        </View>
      </View>

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
          {emergencyCategory && (
            <TouchableOpacity style={styles.emergencyBanner} onPress={() => goToCategory(emergencyCategory)}>
              <Text style={styles.emergencyIcon}>🚨</Text>
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
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: { backgroundColor: colors.darkInk, padding: 14, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: colors.white },
  headerSubtitle: { fontSize: 12, color: '#9AA5B1', marginTop: 4, maxWidth: 240 },

  searchContainer: { flexDirection: 'row', backgroundColor: colors.white, borderRadius: 10, alignItems: 'center', height: 44, paddingHorizontal: 10, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: '#111', height: '100%', marginLeft: 8 },

  toggleContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 24, height: 44 },
  toggleButton: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 24 },
  toggleButtonActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  toggleTextActive: { color: '#FFF', fontWeight: '800' },

  emergencyBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.danger, marginHorizontal: 14, marginTop: 14, borderRadius: 14, padding: 16 },
  emergencyIcon: { fontSize: 28, marginRight: 12 },
  emergencyTitle: { fontSize: 15, fontWeight: '800', color: colors.white },
  emergencySubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },

  section: { marginTop: 22 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: colors.darkInk },
  seeAllText: { fontSize: 13, color: colors.primary, fontWeight: '600' },

  packageGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 14 },
  packageCard: { width: 170, backgroundColor: colors.white, borderRadius: 14, marginRight: 10, marginBottom: 12, padding: 12, borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden' },
  packageCardWide: { width: '48%', marginRight: 0 },
  packageCardDisabled: { opacity: 0.5 },

  packageImageWrap: { height: 84, borderRadius: 10, overflow: 'hidden', marginBottom: 8, backgroundColor: colors.pageBg, position: 'relative' },
  packageImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  packageImageFallback: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
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

  recentBookingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, marginHorizontal: 14, marginBottom: 10, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.borderLight },
  recentBookingName: { fontSize: 14, fontWeight: '700', color: colors.darkInk, marginBottom: 3 },
  recentBookingMeta: { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.darkInk, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  retryButton: { marginTop: 20, backgroundColor: colors.primary, borderRadius: 24, paddingHorizontal: 28, paddingVertical: 12 },
  retryButtonText: { color: colors.white, fontWeight: '800', fontSize: 14 },
});
