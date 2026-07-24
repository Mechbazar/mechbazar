// Used for native builds only -- CategoryProductsScreen.web.tsx shadows this
// file on web (desktop width renders CategoryProductsDesktop.tsx, narrower
// web widths render CategoryProductsScreenMobile.tsx, a deliberate
// byte-for-byte duplicate of this file's original content). Mirror any
// native/mobile behavior change here in CategoryProductsScreenMobile.tsx too.
import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { VehicleType, Product, FilterOptions } from '../types/product';
import { getCategoryProducts } from '../services/product.service';
import { fetchMyWishlist, addToWishlist, removeFromWishlist } from '../services/wishlist.service';
import { ProductGridCard } from '../components/ProductGridCard';
import { FilterSortSheet } from '../components/FilterSortSheet';
import { HeaderCartButton } from '../components/HeaderCartButton';

type ParamList = {
  CategoryProducts: {
    categoryName: string;
    brandId?: string;
    modelId?: string;
    year?: string;
    initialSearchQuery?: string;
  };
};

export default function CategoryProductsScreen() {
  const route = useRoute<RouteProp<ParamList, 'CategoryProducts'>>();
  const navigation = useNavigation<any>();
  const vehicleType = useSelector((state: RootState) => state.app.vehicleType);
  const { token } = useSelector((state: RootState) => state.auth);
  const { categoryName = 'Products', brandId, modelId, year, initialSearchQuery } = route.params || {};

  const [products, setProducts] = useState<Product[]>([]);
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    sortBy: 'popular',
    brands: [],
    inStockOnly: false
  });

  const fetchProducts = useCallback(async (isLoadMore = false) => {
    if (isLoadMore && !hasMore) return;
    
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const currentPage = isLoadMore ? page + 1 : 1;
      const res = await getCategoryProducts(
        vehicleType, 
        categoryName === 'Search Results' ? '' : categoryName, 
        searchQuery, 
        brandId, 
        modelId, 
        year, 
        filters, 
        currentPage, 
        10
      );
      
      if (isLoadMore) {
        setProducts(prev => [...prev, ...res.products]);
        setPage(currentPage);
      } else {
        setProducts(res.products);
        setPage(1);
      }
      setHasMore(res.hasMore);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [vehicleType, categoryName, brandId, modelId, year, searchQuery, filters, page, hasMore]);

  // Initial load and filter/search changes
  useEffect(() => {
    // debounce search
    const timer = setTimeout(() => {
      fetchProducts(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [vehicleType, categoryName, brandId, modelId, year, searchQuery, filters]);

  const handleProductPress = (product: Product) => {
    navigation.navigate('ProductDetails', { productId: product.id });
  };

  useEffect(() => {
    if (!token) return;
    fetchMyWishlist(token).then(items => setWishlistedIds(new Set(items.map(i => i.id))));
  }, [token]);

  const handleToggleWishlist = async (product: Product) => {
    if (!token) {
      alert('Please log in to save items to your wishlist.');
      return;
    }
    const wasWishlisted = wishlistedIds.has(product.id);
    setWishlistedIds(prev => {
      const next = new Set(prev);
      wasWishlisted ? next.delete(product.id) : next.add(product.id);
      return next;
    });
    const result = wasWishlisted ? await removeFromWishlist(token, product.id) : await addToWishlist(token, product.id);
    if (!result.ok) {
      setWishlistedIds(prev => {
        const next = new Set(prev);
        wasWishlisted ? next.add(product.id) : next.delete(product.id);
        return next;
      });
      alert(result.error || 'Failed to update wishlist');
    }
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🔍</Text>
        <Text style={styles.emptyText}>No products found in {categoryName}</Text>
        <Text style={styles.emptySub}>Try adjusting your filters or search query.</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { flex: 1, textAlign: 'center' }]}>{categoryName}</Text>
        <HeaderCartButton color="#1C1C1C" backgroundColor="rgba(0,0,0,0.05)" />
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Text style={{ marginRight: 8, fontSize: 16 }}>🔍</Text>
          <TextInput 
            style={styles.searchInput}
            placeholder="Search in this category..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={() => {
              // The search is already debounced on change, just dismiss keyboard
              const { Keyboard } = require('react-native');
              Keyboard.dismiss();
            }}
          />
        </View>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilterSheet(true)}>
          <Text style={styles.filterBtnIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterSummary}>
        <Text style={styles.resultsText}>{products.length} Results</Text>
        {(filters.inStockOnly || filters.sortBy !== 'popular') && (
          <TouchableOpacity onPress={() => setFilters({ sortBy: 'popular', brands: [], inStockOnly: false })}>
            <Text style={styles.clearFiltersText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading && !loadingMore ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#DA3830" />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          renderItem={({ item }) => (
            <ProductGridCard
              product={item}
              onPress={handleProductPress}
              isWishlisted={wishlistedIds.has(item.id)}
              onToggleWishlist={handleToggleWishlist}
            />
          )}
          ListEmptyComponent={renderEmpty}
          onEndReached={() => fetchProducts(true)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 20 }} color="#DA3830" /> : null}
        />
      )}

      <FilterSortSheet
        visible={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        currentFilters={filters}
        onApply={setFilters}
        vehicleType={vehicleType}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  backText: { fontSize: 24, color: '#333' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  searchSection: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    marginRight: 12,
  },
  searchInput: { flex: 1, height: '100%', fontSize: 15 },
  filterBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#F0F2F5',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnIcon: { fontSize: 20, color: '#333' },
  filterSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultsText: { fontSize: 13, color: '#666', fontWeight: '500' },
  clearFiltersText: { fontSize: 13, color: '#D32F2F', fontWeight: '500' },
  listContent: { padding: 16, paddingBottom: 100 },
  columnWrapper: { justifyContent: 'space-between' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#666' }
});
