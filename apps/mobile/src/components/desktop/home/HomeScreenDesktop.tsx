import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { fetchCategories, getTrendingProducts, fetchBanners } from '../../../services/product.service';
import { fetchMyWishlist, addToWishlist, removeFromWishlist } from '../../../services/wishlist.service';
import { Category, Product } from '../../../types/product';
import { colors, spacing } from '../../../theme/tokens';
import { setDesktopHomeFocused } from '../../../navigation/desktopHomeFocusStore';
import Container from '../shared/Container';
import HeroCarousel from './HeroCarousel';
import CategoryGridDesktop from './CategoryGridDesktop';
import ProductRail from './ProductRail';
import BrandsRow from './BrandsRow';
import ServiceHighlights from './ServiceHighlights';
import TrustBadges from './TrustBadges';
import Testimonials from './Testimonials';
import DownloadAppSection from './DownloadAppSection';
import DesktopFooter from '../footer/DesktopFooter';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

// The desktop-only Home screen (rendered by HomeScreen.web.tsx at desktop
// widths). Fetches the same data via the same services the mobile Home
// screen uses (fetchCategories/getTrendingProducts/fetchBanners/
// fetchMyWishlist) independently, rather than being prop-driven, so it stays
// fully decoupled from HomeScreenMobile.tsx -- editing one can't break the
// other. No new backend endpoints anywhere in this tree.
export default function HomeScreenDesktop() {
  const token = useSelector((state: RootState) => state.auth.token);
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);

  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<any[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [wishlist, setWishlist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Tells DesktopAppShell.web.tsx to render without its own boxed content
  // area/footer while Home is focused -- see desktopHomeFocusStore.ts.
  useFocusEffect(
    useCallback(() => {
      setDesktopHomeFocused(true);
      return () => setDesktopHomeFocused(false);
    }, []),
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchCategories(vehicleType).then(setCategories),
      getTrendingProducts(vehicleType).then(setTrending),
      fetchBanners(vehicleType).then(setBanners),
    ]).finally(() => setLoading(false));
  }, [vehicleType]);

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

  const bestSellers = useMemo(
    () => [...trending].sort((a, b) => (b.reviewsCount ?? 0) - (a.reviewsCount ?? 0)).slice(0, 8),
    [trending],
  );
  const flashDeals = useMemo(
    () => trending.filter(p => (p.discountPercentage ?? 0) > 0).sort((a, b) => (b.discountPercentage ?? 0) - (a.discountPercentage ?? 0)).slice(0, 8),
    [trending],
  );
  const brands = useMemo(
    () => Array.from(new Set(trending.map(p => p.brand).filter(Boolean))).slice(0, 10),
    [trending],
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Container style={styles.section}>
        <HeroCarousel banners={banners} />
      </Container>

      <Container style={styles.section}>
        <SectionHeading>Shop by Category</SectionHeading>
        <CategoryGridDesktop categories={categories} />
      </Container>

      <Container style={styles.section}>
        <SectionHeading>Service Highlights</SectionHeading>
        <ServiceHighlights />
      </Container>

      <Container style={styles.section}>
        <ProductRail
          title={`Trending ${vehicleType === 'BIKE' ? 'Bike' : 'Car'} Parts`}
          products={trending}
          wishlist={wishlist}
          onWishlistToggle={handleWishlistToggle}
        />
      </Container>

      {bestSellers.length > 0 && (
        <Container style={styles.section}>
          <ProductRail title="Best Sellers" products={bestSellers} wishlist={wishlist} onWishlistToggle={handleWishlistToggle} />
        </Container>
      )}

      {flashDeals.length > 0 && (
        <Container style={styles.section}>
          <ProductRail title="Flash Deals" products={flashDeals} wishlist={wishlist} onWishlistToggle={handleWishlistToggle} />
        </Container>
      )}

      {brands.length > 0 && (
        <Container style={styles.section}>
          <SectionHeading>Popular Brands</SectionHeading>
          <BrandsRow brands={brands} />
        </Container>
      )}

      <Container style={styles.section}>
        <TrustBadges />
      </Container>

      <Container style={styles.section}>
        <SectionHeading>What Our Customers Say</SectionHeading>
        <Testimonials />
      </Container>

      <Container style={styles.section}>
        <DownloadAppSection />
      </Container>

      <DesktopFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg },
  content: { paddingTop: spacing.xl },
  section: { marginBottom: spacing.xxl },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: colors.textDark, marginBottom: spacing.md },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
