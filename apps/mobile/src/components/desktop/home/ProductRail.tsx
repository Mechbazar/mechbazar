import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { addToCart, updateQuantity } from '../../../store/cartSlice';
import { Product, VehicleType, FilterOptions } from '../../../types/product';
import { colors, spacing } from '../../../theme/tokens';
import ProductCardDesktop from '../catalog/ProductCardDesktop';
import QuickViewModal from '../catalog/QuickViewModal';

interface ProductRailProps {
  title: string;
  products: Product[];
  wishlist: Record<string, boolean>;
  onWishlistToggle: (id: string) => void;
  /** Rail represents one real category -- "View All" opens that category directly. */
  seeAllCategoryName?: string;
  /** Rail is a cross-category curation (deals/best sellers/trending/...) --
   *  "View All" opens the unfiltered catalog pre-sorted to match. */
  viewAllSortBy?: FilterOptions['sortBy'];
  /** Only needed when the rail's own products come from a fixed vehicle type
   *  (Popular Bike Parts / Car Parts & Accessories) that may differ from the
   *  app's single global vehicle filter -- keeps "View All" showing the same
   *  vehicle's products instead of whatever the global toggle happens to be. */
  viewAllVehicleType?: VehicleType;
}

// Same Product[] shape and cart/wishlist actions the mobile trending rail
// already uses (product.service.ts, cartSlice, wishlist.service.ts), laid
// out as a desktop grid. Reuses the same ProductCardDesktop + QuickViewModal
// the catalog page (CategoryProductsDesktop.tsx) already uses instead of a
// separate homepage-only card, so badges/quick-view/wishlist/cart behave
// identically everywhere a product card appears.
export default function ProductRail({
  title, products, wishlist, onWishlistToggle, seeAllCategoryName, viewAllSortBy, viewAllVehicleType,
}: ProductRailProps) {
  const navigation = useNavigation<NavigationProp<any>>();
  const dispatch = useDispatch();
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const getQty = useCallback((id: string) => cartItems.find(i => i.id === id)?.qty ?? 0, [cartItems]);

  const handleQuickAdd = useCallback((product: Product) => {
    dispatch(addToCart({
      id: product.id, name: product.name, price: product.price, originalPrice: product.originalPrice,
      image: product.image, isB2B: product.isB2B, moq: product.moq, vehicleType: product.vehicleType,
    }));
  }, [dispatch]);

  const handleQtyChange = useCallback((product: Product, nextQty: number) => {
    dispatch(updateQuantity({ id: product.id, qty: nextQty }));
  }, [dispatch]);

  const handleOpenDetails = useCallback((p: Product) => {
    navigation.navigate('ProductDetails', { productId: p.id });
  }, [navigation]);

  const handleToggleWishlist = useCallback((p: Product) => onWishlistToggle(p.id), [onWishlistToggle]);

  if (products.length === 0) return null;

  const handleViewAll = () => {
    if (seeAllCategoryName) {
      navigation.navigate('CategoryProducts', { categoryName: seeAllCategoryName });
    } else {
      navigation.navigate('CategoryProducts', {
        categoryName: 'Search Results',
        initialSortBy: viewAllSortBy,
        vehicleType: viewAllVehicleType,
      });
    }
  };

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={handleViewAll}>
          <Text style={styles.seeAll}>View All →</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {products.map(prod => (
          <ProductCardDesktop
            key={prod.id}
            product={prod}
            isWishlisted={!!wishlist[prod.id]}
            onToggleWishlist={handleToggleWishlist}
            onQuickView={setQuickViewProduct}
            onQuickAdd={handleQuickAdd}
            onOpenDetails={handleOpenDetails}
            qtyInCart={getQty(prod.id)}
            onQtyChange={handleQtyChange}
          />
        ))}
      </View>

      <QuickViewModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        isWishlisted={quickViewProduct ? !!wishlist[quickViewProduct.id] : false}
        onToggleWishlist={handleToggleWishlist}
        qtyInCart={quickViewProduct ? getQty(quickViewProduct.id) : 0}
        onAddToCart={handleQuickAdd}
        onQtyChange={handleQtyChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: colors.textDark },
  seeAll: { fontSize: 14, fontWeight: '700', color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
