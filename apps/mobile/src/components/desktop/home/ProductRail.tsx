import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { addToCart, updateQuantity } from '../../../store/cartSlice';
import { Product } from '../../../types/product';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';

interface ProductRailProps {
  title: string;
  products: Product[];
  wishlist: Record<string, boolean>;
  onWishlistToggle: (id: string) => void;
  seeAllCategoryName?: string;
}

// Same Product[] shape and cart/wishlist actions the mobile trending rail
// already uses (product.service.ts, cartSlice, wishlist.service.ts) -- just
// laid out as a desktop grid with hover affordances instead of a horizontal
// scroller. Reused for Trending / Best Sellers / Flash Deals by passing in
// differently sorted slices of the same fetched data (see HomeScreenDesktop).
export default function ProductRail({ title, products, wishlist, onWishlistToggle, seeAllCategoryName }: ProductRailProps) {
  const navigation = useNavigation<NavigationProp<any>>();
  const dispatch = useDispatch();
  const cartItems = useSelector((state: RootState) => state.cart.items);

  if (products.length === 0) return null;

  const getQty = (id: string) => cartItems.find(i => i.id === id)?.qty ?? 0;

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {!!seeAllCategoryName && (
          <Pressable onPress={() => navigation.navigate('CategoryProducts', { categoryName: seeAllCategoryName })}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.grid}>
        {products.map(prod => {
          const qty = getQty(prod.id);
          return (
            <Pressable
              key={prod.id}
              style={({ hovered }: any) => [styles.card, hovered && styles.cardHovered]}
              onPress={() => navigation.navigate('ProductDetails', { productId: prod.id })}
            >
              <View style={styles.imageWrap}>
                <Image source={{ uri: prod.image }} style={styles.image} resizeMode="cover" />
                {(prod.discountPercentage ?? 0) > 0 && (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountText}>{prod.discountPercentage}% OFF</Text>
                  </View>
                )}
                <Pressable
                  style={styles.wishBtn}
                  onPress={(e) => { e.stopPropagation(); onWishlistToggle(prod.id); }}
                  accessibilityLabel="Toggle wishlist"
                >
                  <Ionicons
                    name={wishlist[prod.id] ? 'heart' : 'heart-outline'}
                    size={16}
                    color={wishlist[prod.id] ? colors.primary : colors.textMuted}
                  />
                </Pressable>
              </View>

              <View style={styles.info}>
                <Text style={styles.brand}>{prod.brand}</Text>
                <Text style={styles.name} numberOfLines={2}>{prod.name}</Text>
                <View style={styles.ratingRow}>
                  {prod.reviewsCount ? (
                    <>
                      <Ionicons name="star" size={12} color="#F5A300" />
                      <Text style={styles.ratingText}>{prod.rating} ({prod.reviewsCount})</Text>
                    </>
                  ) : (
                    <Text style={styles.ratingText}>New</Text>
                  )}
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>₹{prod.price}</Text>
                  {prod.originalPrice > prod.price && (
                    <Text style={styles.originalPrice}>₹{prod.originalPrice}</Text>
                  )}
                </View>

                {qty > 0 ? (
                  <View style={styles.qtyRow}>
                    <Pressable
                      style={styles.qtyBtn}
                      onPress={(e) => { e.stopPropagation(); dispatch(updateQuantity({ id: prod.id, qty: qty - 1 })); }}
                    >
                      <Text style={styles.qtyBtnText}>-</Text>
                    </Pressable>
                    <Text style={styles.qtyVal}>{qty}</Text>
                    <Pressable
                      style={styles.qtyBtn}
                      onPress={(e) => { e.stopPropagation(); dispatch(updateQuantity({ id: prod.id, qty: qty + 1 })); }}
                    >
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.addBtn}
                    onPress={(e) => {
                      e.stopPropagation();
                      dispatch(addToCart({
                        id: prod.id, name: prod.name, price: prod.price, originalPrice: prod.originalPrice,
                        image: prod.image, isB2B: prod.isB2B, moq: prod.moq, vehicleType: prod.vehicleType,
                      }));
                    }}
                  >
                    <Text style={styles.addBtnText}>Add to Cart</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '700', color: colors.textDark },
  seeAll: { fontSize: 14, fontWeight: '700', color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    width: 220,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  cardHovered: { ...shadows.md, borderColor: colors.borderLight },
  imageWrap: { width: '100%', height: 160, position: 'relative', backgroundColor: colors.pageBg },
  image: { width: '100%', height: '100%' },
  discountBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: colors.danger, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2,
  },
  discountText: { color: colors.white, fontSize: 10, fontWeight: '700' },
  wishBtn: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadows.sm,
  },
  info: { padding: spacing.sm },
  brand: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 2 },
  name: { fontSize: 13, fontWeight: '600', color: colors.textDark, marginBottom: 4, minHeight: 34 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  ratingText: { fontSize: 11, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 },
  price: { fontSize: 16, fontWeight: '800', color: colors.textDark },
  originalPrice: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through' },
  addBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center' },
  addBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.pageBg, borderRadius: radius.sm, paddingVertical: 4 },
  qtyBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  qtyVal: { fontSize: 13, fontWeight: '700', color: colors.textDark },
});
