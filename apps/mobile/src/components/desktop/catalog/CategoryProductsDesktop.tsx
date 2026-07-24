import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute, NavigationProp, RouteProp } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { addToCart, updateQuantity } from '../../../store/cartSlice';
import { Category, FilterOptions, Product } from '../../../types/product';
import { fetchCategories, fetchBrands, getCategoryProducts } from '../../../services/product.service';
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

// Desktop-only catalog page (rendered by CategoryProductsScreen.web.tsx at
// desktop widths). Filtering/sorting/pagination all happen server-side via
// getCategoryProducts (GET /products' brand/priceMin/priceMax/inStock/
// minRating/sortBy/page/limit params) -- this used to fetch one flat
// 200-item batch and filter/sort/paginate it client-side, which silently
// capped every category at 200 products and made "available brands" shrink
// to whatever page was loaded.
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

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorKind | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
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
    fetchBrands(vehicleType).then(setAvailableBrands);
  }, [vehicleType]);

  useEffect(() => {
    if (!token) { setWishlist({}); return; }
    fetchMyWishlist(token).then(items => setWishlist(Object.fromEntries(items.map(i => [i.id, true]))));
  }, [token]);

  // Filters/sort changing resets to page 1 (a stale page 4 could easily be
  // out of range against a newly-filtered result set); page changing on its
  // own does not reset itself, obviously.
  useEffect(() => {
    setPage(1);
  }, [vehicleType, categoryName, searchQuery, vehicleBrandName, vehicleModelName, filters]);

  useEffect(() => {
    setLoading(true);
    setError(null);
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
        filters,
        page,
        PAGE_SIZE,
        { rethrow: true, signal: controller.signal },
      )
        .then(res => { setProducts(res.products); setTotal(res.total); setHasMore(res.hasMore); })
        .catch(err => setError(classifyError(err)))
        .finally(() => { clearTimeout(timeoutId); setLoading(false); });
    }, 300);
    return () => { clearTimeout(debounce); clearTimeout(timeoutId); controller.abort(); };
  }, [vehicleType, categoryName, searchQuery, vehicleBrandName, vehicleModelName, filters, page, retryToken]);

  const pageItems = products;
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
            <SortBar sortBy={filters.sortBy} onChange={(sortBy) => setFilters(f => ({ ...f, sortBy }))} resultCount={total} />

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

                <Pagination page={page} hasMore={hasMore} loading={false} total={total} pageSize={PAGE_SIZE} onPrev={() => setPage(p => Math.max(1, p - 1))} onNext={() => setPage(p => p + 1)} />
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
