import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, NavigationProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { fetchCategories, fetchBanners, fetchHomeExtras, getTrendingProducts, HomeExtras } from '../../../services/product.service';
import { fetchMyWishlist, addToWishlist, removeFromWishlist } from '../../../services/wishlist.service';
import { fetchTopVendors, TopVendor } from '../../../services/vendor.service';
import { Category, Product, VehicleType } from '../../../types/product';
import { spacing } from '../../../theme/tokens';
import { useThemeColors } from '../../../theme/useThemeColors';
import { setDesktopFullPageScreenActive } from '../../../navigation/desktopFullPageScreenStore';
import Container from '../shared/Container';
import CategoryNavStrip from './CategoryNavStrip';
import HeroCarousel from './HeroCarousel';
import QuickActions from './QuickActions';
import CategoryGridDesktop from './CategoryGridDesktop';
import VehicleFinderSection from './VehicleFinderSection';
import ProductRail from './ProductRail';
import PromoCategoryCards from './PromoCategoryCards';
import BrandsRow from './BrandsRow';
import { MechanicServicesSection, GarageServicesSection } from './ServiceHighlights';
import TopVendorsRow from './TopVendorsRow';
import NewsletterSection from './NewsletterSection';
import FinalVehicleCta from './FinalVehicleCta';
import TrustBadges from './TrustBadges';
import BenefitsStrip from './BenefitsStrip';
import Testimonials from './Testimonials';
import DownloadAppSection from './DownloadAppSection';
import DesktopFooter from '../footer/DesktopFooter';
import { HeroSkeleton, CategoryGridSkeleton, ProductGridSkeleton, SectionTitleSkeleton, SkeletonSection } from '../states/Skeletons';
import ErrorState, { ErrorKind, classifyError } from '../states/ErrorState';
import EmptyState from '../states/EmptyState';

const FETCH_TIMEOUT_MS = 15000;
const EMPTY_EXTRAS: HomeExtras = { deals: [], featured: [], bestSellers: [], brands: [] };

function SectionHeading({
  children, actionLabel, onAction,
}: { children: React.ReactNode; actionLabel?: string; onAction?: () => void }) {
  const colors = useThemeColors();
  return (
    <View style={styles.sectionHeadingRow}>
      <Text style={[styles.sectionTitle, { color: colors.textDark }]}>{children}</Text>
      {!!actionLabel && !!onAction && (
        <Pressable onPress={onAction}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// The desktop-only Home screen (rendered by HomeScreen.web.tsx at desktop
// widths). Fetches the same data via the same services the mobile Home
// screen uses, plus fetchHomeExtras (GET /api/home -- deals/featured/
// bestSellers/brands, previously unused by any frontend) and two explicit
// getTrendingProducts('BIKE'|'CAR', 8) calls so the Popular Bike Parts /
// Car Parts & Accessories rails can both show up regardless of the app's
// single global vehicle filter (there's no car/bike toggle in the desktop
// header to conflict with). Stays fully decoupled from HomeScreenMobile.tsx
// -- editing one can't break the other. No new backend endpoints.
export default function HomeScreenDesktop() {
  const colors = useThemeColors();
  const navigation = useNavigation<NavigationProp<any>>();
  const token = useSelector((state: RootState) => state.auth.token);
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);

  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [homeExtras, setHomeExtras] = useState<HomeExtras>(EMPTY_EXTRAS);
  const [bikeParts, setBikeParts] = useState<Product[]>([]);
  const [carParts, setCarParts] = useState<Product[]>([]);
  const [topVendors, setTopVendors] = useState<TopVendor[]>([]);
  // Defaults true so the heading doesn't flash in then disappear on the
  // common case where reviews DO exist -- Testimonials reports back once its
  // own fetch settles (UX-03 fix, see Testimonials.tsx).
  const [hasTestimonials, setHasTestimonials] = useState(true);
  const [wishlist, setWishlist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // Tells DesktopAppShell.web.tsx to render without its own boxed content
  // area/footer while Home is focused -- see desktopFullPageScreenStore.ts.
  useFocusEffect(
    useCallback(() => {
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, []),
  );

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    setLoading(true);
    setError(null);

    Promise.all([
      fetchCategories(vehicleType, { rethrow: true, signal: controller.signal }),
      fetchBanners(vehicleType, { rethrow: true, signal: controller.signal }),
      fetchHomeExtras(vehicleType, { rethrow: true, signal: controller.signal }),
      getTrendingProducts(VehicleType.BIKE, 8, { rethrow: true, signal: controller.signal }),
      getTrendingProducts(VehicleType.CAR, 8, { rethrow: true, signal: controller.signal }),
    ])
      .then(([cats, banns, extras, bikes, cars]) => {
        setCategories(cats);
        setBanners(banns);
        setHomeExtras(extras);
        setBikeParts(bikes);
        setCarParts(cars);
      })
      .catch((err) => setError(classifyError(err)))
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });

    return () => { clearTimeout(timeoutId); controller.abort(); };
  }, [vehicleType, retryToken]);

  useEffect(() => {
    fetchTopVendors().then(setTopVendors);
  }, []);

  useEffect(() => {
    if (!token) { setWishlist({}); return; }
    fetchMyWishlist(token).then(items => setWishlist(Object.fromEntries(items.map(i => [i.id, true]))));
  }, [token]);

  const handleWishlistToggle = async (id: string) => {
    if (!token) {
      Alert.alert('Sign in required', 'Please log in to save items to your wishlist.');
      return;
    }
    const was = !!wishlist[id];
    setWishlist(prev => ({ ...prev, [id]: !was }));
    const result = was ? await removeFromWishlist(token, id) : await addToWishlist(token, id);
    if (!result.ok) setWishlist(prev => ({ ...prev, [id]: was }));
  };

  // Promo cards (brief section 6) reuse whatever real categories already
  // have an uploaded image, favoring the ones with the most products --
  // no invented categories or copy.
  const promoCategories = useMemo(
    () => [...categories]
      .filter(c => !!c.image)
      .sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0))
      .slice(0, 3),
    [categories],
  );

  const hasAnyProducts = bikeParts.length > 0 || carParts.length > 0
    || homeExtras.deals.length > 0 || homeExtras.featured.length > 0 || homeExtras.bestSellers.length > 0;
  const isEmpty = !loading && !error && categories.length === 0 && banners.length === 0 && !hasAnyProducts;

  if (loading) {
    return (
      <ScrollView style={[styles.page, { backgroundColor: colors.pageBg }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} role="main">
        <Container style={styles.section}>
          <SkeletonSection label="Loading homepage content">
            <HeroSkeleton />
          </SkeletonSection>
        </Container>
        <Container style={styles.section}>
          <SectionTitleSkeleton />
          <CategoryGridSkeleton />
        </Container>
        <Container style={styles.section}>
          <SectionTitleSkeleton />
          <ProductGridSkeleton />
        </Container>
      </ScrollView>
    );
  }

  if (error) {
    return (
      <ScrollView style={[styles.page, { backgroundColor: colors.pageBg }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} role="main">
        <Container>
          <ErrorState kind={error} onRetry={() => setRetryToken(t => t + 1)} />
        </Container>
        <DesktopFooter />
      </ScrollView>
    );
  }

  if (isEmpty) {
    return (
      <ScrollView style={[styles.page, { backgroundColor: colors.pageBg }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} role="main">
        <Container>
          <EmptyState
            icon="storefront-outline"
            title="Nothing to show yet"
            message="We couldn't find any homepage content right now. Please check back shortly."
            actionLabel="Refresh"
            onAction={() => setRetryToken(t => t + 1)}
          />
        </Container>
        <DesktopFooter />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.page, { backgroundColor: colors.pageBg }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} role="main">
      {/* Reference-matched top block: Header (DesktopAppShell) -> Quick
          Actions -> Shop by Category -> Trust Banner -> Benefits strip,
          in that exact order. Everything below this block is the app's
          existing homepage content, restyled to the same design language
          rather than removed (2026-08-14 redesign). */}
      <Container style={styles.section}>
        <QuickActions />
      </Container>

      <Container style={styles.section}>
        <SectionHeading actionLabel="View All Categories →" onAction={() => navigation.navigate('MainTabs', { screen: 'Categories' })}>Shop by Category</SectionHeading>
        <CategoryGridDesktop categories={categories} />
      </Container>

      <Container style={styles.section}>
        <TrustBadges />
      </Container>

      <Container style={styles.section}>
        <BenefitsStrip />
      </Container>

      <CategoryNavStrip categories={categories} />

      <Container style={styles.section}>
        <HeroCarousel banners={banners} />
      </Container>

      <Container style={styles.section}>
        <VehicleFinderSection />
      </Container>

      {homeExtras.deals.length > 0 && (
        <Container style={styles.section}>
          <ProductRail
            title="Today's Deals"
            products={homeExtras.deals}
            wishlist={wishlist}
            onWishlistToggle={handleWishlistToggle}
            viewAllSortBy="discount"
          />
        </Container>
      )}

      {bikeParts.length > 0 && (
        <Container style={styles.section}>
          <ProductRail
            title="Popular Bike Parts"
            products={bikeParts}
            wishlist={wishlist}
            onWishlistToggle={handleWishlistToggle}
            viewAllSortBy="popular"
            viewAllVehicleType={VehicleType.BIKE}
          />
        </Container>
      )}

      {carParts.length > 0 && (
        <Container style={styles.section}>
          <ProductRail
            title="Car Parts & Accessories"
            products={carParts}
            wishlist={wishlist}
            onWishlistToggle={handleWishlistToggle}
            viewAllSortBy="popular"
            viewAllVehicleType={VehicleType.CAR}
          />
        </Container>
      )}

      <Container style={styles.section}>
        <SectionHeading>Mechanic Services</SectionHeading>
        <MechanicServicesSection />
      </Container>

      <Container style={styles.section}>
        <SectionHeading>Garage Services</SectionHeading>
        <GarageServicesSection />
      </Container>

      {promoCategories.length > 0 && (
        <Container style={styles.section}>
          <PromoCategoryCards categories={promoCategories} />
        </Container>
      )}

      {homeExtras.brands.length > 0 && (
        <Container style={styles.section}>
          <SectionHeading>Shop by Brand</SectionHeading>
          <BrandsRow brands={homeExtras.brands} />
        </Container>
      )}

      {homeExtras.featured.length > 0 && (
        <Container style={styles.section}>
          <ProductRail
            title={`Trending ${vehicleType === 'BIKE' ? 'Bike' : 'Car'} Parts`}
            products={homeExtras.featured}
            wishlist={wishlist}
            onWishlistToggle={handleWishlistToggle}
            viewAllSortBy="newest"
          />
        </Container>
      )}

      {homeExtras.bestSellers.length > 0 && (
        <Container style={styles.section}>
          <ProductRail
            title="Best Sellers"
            products={homeExtras.bestSellers}
            wishlist={wishlist}
            onWishlistToggle={handleWishlistToggle}
            viewAllSortBy="best_selling"
          />
        </Container>
      )}

      {topVendors.length > 0 && (
        <Container style={styles.section}>
          <SectionHeading>Top Vendors</SectionHeading>
          <TopVendorsRow vendors={topVendors} />
        </Container>
      )}

      {hasTestimonials && (
        <Container style={styles.section}>
          <SectionHeading>What Our Customers Say</SectionHeading>
          <Testimonials onHasData={setHasTestimonials} />
        </Container>
      )}

      <Container style={styles.section}>
        <DownloadAppSection />
      </Container>

      <Container style={styles.section}>
        <FinalVehicleCta />
      </Container>

      <Container style={styles.section}>
        <NewsletterSection />
      </Container>

      <DesktopFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingTop: spacing.xl },
  section: { marginBottom: spacing.xxl },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: 22, fontWeight: '700' },
  sectionAction: { fontSize: 14, fontWeight: '700' },
});
