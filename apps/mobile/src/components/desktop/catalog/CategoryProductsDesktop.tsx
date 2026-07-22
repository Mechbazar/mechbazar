import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { addToCart, updateQuantity } from '../../../store/cartSlice';
import { Category, FilterOptions, Product } from '../../../types/product';
import { fetchCategories, getCategoryProducts } from '../../../services/product.service';
import { fetchMyWishlist, addToWishlist, removeFromWishlist } from '../../../services/wishlist.service';
import { setDesktopFullPageScreenActive } from '../../../navigation/desktopFullPageScreenStore';
import { colors, spacing, radius } from '../../../theme/tokens';
import Container from '../shared/Container';
import DesktopFooter from '../footer/DesktopFooter';
import Breadcrumb from './Breadcrumb';
import VehicleFinder from './VehicleFinder';
import FilterSidebar from './FilterSidebar';
import SortBar from './SortBar';
import ProductCardDesktop from './ProductCardDesktop';
import QuickViewModal from './QuickViewModal';
import Pagination from './Pagination';
import { ProductGridSkeleton, SkeletonSection } from '../states/Skeletons';
import ErrorState, { ErrorKind, classifyError } from '../states/ErrorState';
import EmptyState from '../states/EmptyState';

const FETCH_TIMEOUT_MS = 15000;

type ParamList = {
  CategoryProducts: {
    categoryName: string;
    brandId?: string;
    modelId?: string;
    year?: string;
    initialSearchQuery?: string;
  };
};

const PAGE_SIZE = 24;
const FETCH_LIMIT = 200;

function applyFiltersAndSort(products: Product[], filters: FilterOptions): Product[] {
  let results = products;
  if (filters.inStockOnly) results = results.filter(p => p.stockStatus === 'In Stock');
  if (filters.brands.length > 0) results = results.filter(p => filters.brands.includes(p.brand));
  if (typeof filters.priceMin === 'number') results = results.filter(p => p.price >= filters.priceMin!);
  if (typeof filters.priceMax === 'number') results = results.filter(p => p.price <= filters.priceMax!);
  if (typeof filters.minRating === 'number') results = results.filter(p => (p.rating ?? 0) >= filters.minRating!);

  results = [...results];
  switch (filters.sortBy) {
    case 'price_low_high': results.sort((a, b) => a.price - b.price); break;
    case 'price_high_low': results.sort((a, b) => b.price - a.price); break;
    case 'discount': results.sort((a, b) => (b.discountPercentage || 0) - (a.discountPercentage || 0)); break;
    case 'popular': results.sort((a, b) => (b.reviewsCount || 0) - (a.reviewsCount || 0)); break;
    case 'newest': results.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()); break;
    case 'best_selling': results.sort((a, b) => (b.salesCount || 0) - (a.salesCount || 0)); break;
    case 'rating': results.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
  }
  return results;
}

// Desktop-only catalog page (rendered by CategoryProductsScreen.web.tsx at
// desktop widths). Fetches one batch via the existing getCategoryProducts
// service (same as mobile, no new endpoints, no filters/sort passed so the
// batch stays complete for brand-facet purposes) and does all
// filtering/sorting/pagination client-side over that batch -- no network
// round-trip per filter/sort/page change, which is what keeps this
// responsive against a large catalog.
export default function CategoryProductsDesktop() {
  const route = useRoute<RouteProp<ParamList, 'CategoryProducts'>>();
  const navigation = useNavigation<NavigationProp<any>>();
  const dispatch = useDispatch();
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);
  const token = useSelector((state: RootState) => state.auth.token);
  const cartItems = useSelector((state: RootState) => state.cart.items);

  const routeParams = route.params || ({} as ParamList['CategoryProducts']);
  const [categoryName, setCategoryName] = useState(routeParams.categoryName || 'Products');
  const [searchQuery, setSearchQuery] = useState(routeParams.initialSearchQuery || '');
  const [vehicleBrandName, setVehicleBrandName] = useState(routeParams.brandId);
  const [vehicleModelName, setVehicleModelName] = useState(routeParams.modelId);
  const [vehicleYear, setVehicleYear] = useState(routeParams.year);

  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [wishlist, setWishlist] = useState<Record<string, boolean>>({});
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({ sortBy: 'popular', brands: [], inStockOnly: false });
  const [searchFocused, setSearchFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, []),
  );

  useEffect(() => {
    fetchCategories(vehicleType).then(setCategories);
  }, [vehicleType]);

  useEffect(() => {
    if (!token) { setWishlist({}); return; }
    fetchMyWishlist(token).then(items => setWishlist(Object.fromEntries(items.map(i => [i.id, true]))));
  }, [token]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setPage(1);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const debounce = setTimeout(() => {
      getCategoryProducts(
        vehicleType,
        categoryName === 'Search Results' ? '' : categoryName,
        searchQuery,
        vehicleBrandName,
        vehicleModelName,
        vehicleYear,
        undefined,
        1,
        FETCH_LIMIT,
        { rethrow: true, signal: controller.signal },
      )
        .then(res => setRawProducts(res.products))
        .catch(err => setError(classifyError(err)))
        .finally(() => { clearTimeout(timeoutId); setLoading(false); });
    }, 300);
    return () => { clearTimeout(debounce); clearTimeout(timeoutId); controller.abort(); };
  }, [vehicleType, categoryName, searchQuery, vehicleBrandName, vehicleModelName, retryToken]);

  const availableBrands = useMemo(
    () => Array.from(new Set(rawProducts.map(p => p.brand))).sort(),
    [rawProducts],
  );
  const filteredSorted = useMemo(() => applyFiltersAndSort(rawProducts, filters), [rawProducts, filters]);
  const pageItems = filteredSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasMore = page * PAGE_SIZE < filteredSorted.length;
  const hasActiveFilters = filters.brands.length > 0 || filters.inStockOnly || filters.priceMin != null || filters.priceMax != null || filters.minRating != null;

  const getQty = (id: string) => cartItems.find(i => i.id === id)?.qty ?? 0;

  // Stabilized with useCallback so identity stays constant across re-renders
  // (filter/sort/page changes) -- required for React.memo on
  // ProductCardDesktop to actually skip re-rendering the other ~23 cards in
  // the grid when only one card's own state changes.
  const handleQuickAdd = useCallback((product: Product) => {
    dispatch(addToCart({
      id: product.id, name: product.name, price: product.price, originalPrice: product.originalPrice,
      image: product.image, isB2B: product.isB2B, moq: product.moq, vehicleType: product.vehicleType,
    }));
  }, [dispatch]);

  const handleQtyChange = useCallback((product: Product, nextQty: number) => {
    dispatch(updateQuantity({ id: product.id, qty: nextQty }));
  }, [dispatch]);

  const handleToggleWishlist = useCallback(async (product: Product) => {
    if (!token) {
      Alert.alert('Sign in required', 'Please log in to save items to your wishlist.');
      return;
    }
    const was = !!wishlist[product.id];
    setWishlist(prev => ({ ...prev, [product.id]: !was }));
    const result = was ? await removeFromWishlist(token, product.id) : await addToWishlist(token, product.id);
    if (!result.ok) setWishlist(prev => ({ ...prev, [product.id]: was }));
  }, [token, wishlist]);

  const handleOpenDetails = useCallback((p: Product) => {
    navigation.navigate('ProductDetails', { productId: p.id });
  }, [navigation]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} role="main">
      <Container>
        <Breadcrumb categoryName={categoryName} />

        <View style={[styles.searchRow, searchFocused && styles.searchRowFocused]}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder={`Search in ${categoryName}...`}
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <VehicleFinder
          hasActiveSelection={!!vehicleBrandName}
          onFind={({ brandName, modelName, year }) => {
            setVehicleBrandName(brandName);
            setVehicleModelName(modelName);
            setVehicleYear(year);
          }}
          onClear={() => { setVehicleBrandName(undefined); setVehicleModelName(undefined); setVehicleYear(undefined); }}
        />

        <View style={styles.layout}>
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            availableBrands={availableBrands}
            categories={categories}
            currentCategoryName={categoryName}
            onCategoryChange={setCategoryName}
          />

          <View style={styles.main}>
            <SortBar sortBy={filters.sortBy} onChange={(sortBy) => setFilters(f => ({ ...f, sortBy }))} resultCount={filteredSorted.length} />

            {loading ? (
              <SkeletonSection label={`Loading ${categoryName}`}>
                <ProductGridSkeleton count={PAGE_SIZE} />
              </SkeletonSection>
            ) : error ? (
              <ErrorState kind={error} onRetry={() => setRetryToken(t => t + 1)} compact />
            ) : pageItems.length === 0 ? (
              <EmptyState
                icon="search-outline"
                title="No products found"
                message="Try adjusting your filters, search, or vehicle selection."
                actionLabel={hasActiveFilters ? 'Clear Filters' : undefined}
                onAction={hasActiveFilters ? () => setFilters({ sortBy: filters.sortBy, brands: [], inStockOnly: false }) : undefined}
                compact
              />
            ) : (
              <>
                <View style={styles.grid}>
                  {pageItems.map(product => (
                    <ProductCardDesktop
                      key={product.id}
                      product={product}
                      isWishlisted={!!wishlist[product.id]}
                      onToggleWishlist={handleToggleWishlist}
                      onQuickView={setQuickViewProduct}
                      onQuickAdd={handleQuickAdd}
                      onOpenDetails={handleOpenDetails}
                      qtyInCart={getQty(product.id)}
                      onQtyChange={handleQtyChange}
                    />
                  ))}
                </View>

                <Pagination page={page} hasMore={hasMore} loading={false} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => p + 1)} />
              </>
            )}
          </View>
        </View>
      </Container>

      <DesktopFooter />

      <QuickViewModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        isWishlisted={quickViewProduct ? !!wishlist[quickViewProduct.id] : false}
        onToggleWishlist={handleToggleWishlist}
        qtyInCart={quickViewProduct ? getQty(quickViewProduct.id) : 0}
        onAddToCart={handleQuickAdd}
        onQtyChange={handleQtyChange}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg },
  content: { paddingTop: spacing.md },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderLight,
    height: 44, paddingLeft: spacing.sm, marginBottom: spacing.md, maxWidth: 480,
  },
  // Replaces the native input outline (suppressed on searchInput below) with
  // a visible focus indicator on the wrapping pill instead.
  searchRowFocused: { borderColor: colors.primary },
  searchInput: { flex: 1, height: '100%', fontSize: 14, color: colors.textDark, outlineStyle: 'none' as any },
  layout: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  main: { flex: 1, minWidth: 0 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
