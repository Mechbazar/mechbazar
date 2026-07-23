import React, { useState } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Product } from '../../../types/product';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';
import { NO_IMAGE_PLACEHOLDER } from '../../../services/product.service';

const NEW_WINDOW_DAYS = 14;

function isNewProduct(createdAt?: string): boolean {
  if (!createdAt) return false;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return ageMs >= 0 && ageMs <= NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

interface ProductCardDesktopProps {
  product: Product;
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  onQuickView: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
  onOpenDetails: (product: Product) => void;
  qtyInCart: number;
  onQtyChange: (product: Product, nextQty: number) => void;
}

// Badges are all derived from real fields (discountPercentage, stockStatus,
// createdAt, isFeatured -- Product.isFeatured/createdAt in
// prisma/schema.prisma) rather than invented ones.
// Wrapped in React.memo since this renders up to PAGE_SIZE (24) times per
// catalog grid -- without it, every card in the grid re-renders whenever any
// single card's local hover/focus state (or unrelated parent state such as
// filters/sort) changes.
function ProductCardDesktop({
  product, isWishlisted, onToggleWishlist, onQuickView, onQuickAdd, onOpenDetails, qtyInCart, onQtyChange,
}: ProductCardDesktopProps) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const outOfStock = product.stockStatus === 'Out of Stock';
  const showHoverActions = (hovered || focused) && !outOfStock;

  return (
    <Pressable
      style={styles.card}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={() => onOpenDetails(product)}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${product.brand}, ₹${product.price}`}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: imageFailed ? NO_IMAGE_PLACEHOLDER : product.image }}
          style={[styles.image, outOfStock && styles.imageDimmed]}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />

        <View style={styles.badgeStack}>
          {outOfStock && (
            <View style={[styles.badge, styles.badgeOutOfStock]}><Text style={styles.badgeText}>OUT OF STOCK</Text></View>
          )}
          {isNewProduct(product.createdAt) && (
            <View style={[styles.badge, styles.badgeNew]}><Text style={styles.badgeText}>NEW</Text></View>
          )}
          {product.isFeatured && (
            <View style={[styles.badge, styles.badgeBestSeller]}><Text style={styles.badgeText}>BEST SELLER</Text></View>
          )}
          {(product.discountPercentage ?? 0) > 0 && (
            <View style={[styles.badge, styles.badgeDiscount]}><Text style={styles.badgeText}>{product.discountPercentage}% OFF</Text></View>
          )}
        </View>

        <Pressable
          style={styles.wishBtn}
          onPress={(e) => { e.stopPropagation(); onToggleWishlist(product); }}
          accessibilityLabel="Toggle wishlist"
        >
          <Ionicons name={isWishlisted ? 'heart' : 'heart-outline'} size={16} color={isWishlisted ? colors.primary : colors.textMuted} />
        </Pressable>

        {!outOfStock && (
          <View style={[styles.hoverActions, !showHoverActions && styles.hoverActionsHidden]}>
            <Pressable
              style={styles.hoverActionBtn}
              onPress={(e) => { e.stopPropagation(); onQuickView(product); }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              accessibilityRole="button"
              accessibilityLabel={`Quick view ${product.name}`}
            >
              <Ionicons name="eye-outline" size={16} color={colors.textDark} />
              <Text style={styles.hoverActionText}>Quick View</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.brand}>{product.brand}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <View style={styles.ratingRow}>
          <Ionicons name="star" size={12} color="#F5A300" />
          <Text style={styles.ratingText}>{product.rating} ({product.reviewsCount ?? 0})</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{product.price}</Text>
          {product.originalPrice > product.price && <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>}
        </View>

        {outOfStock ? (
          <View style={styles.disabledBtn}><Text style={styles.disabledBtnText}>Out of Stock</Text></View>
        ) : qtyInCart > 0 ? (
          <View style={styles.qtyRow}>
            <Pressable style={styles.qtyBtn} onPress={(e) => { e.stopPropagation(); onQtyChange(product, qtyInCart - 1); }}>
              <Text style={styles.qtyBtnText}>-</Text>
            </Pressable>
            <Text style={styles.qtyVal}>{qtyInCart}</Text>
            <Pressable style={styles.qtyBtn} onPress={(e) => { e.stopPropagation(); onQtyChange(product, qtyInCart + 1); }}>
              <Text style={styles.qtyBtnText}>+</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addBtn} onPress={(e) => { e.stopPropagation(); onQuickAdd(product); }}>
            <Ionicons name="cart-outline" size={14} color={colors.white} />
            <Text style={styles.addBtnText}>Add to Cart</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

export default React.memo(ProductCardDesktop);

const styles = StyleSheet.create({
  card: {
    flexBasis: 220, flexGrow: 1, maxWidth: 280,
    backgroundColor: colors.white, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderLight, overflow: 'hidden',
  },
  imageWrap: { width: '100%', height: 180, position: 'relative', backgroundColor: colors.pageBg },
  image: { width: '100%', height: '100%' },
  imageDimmed: { opacity: 0.5 },
  badgeStack: { position: 'absolute', top: 8, left: 8, gap: 4 },
  badge: { borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  badgeOutOfStock: { backgroundColor: colors.textMuted },
  badgeNew: { backgroundColor: colors.success },
  badgeBestSeller: { backgroundColor: colors.warning },
  badgeDiscount: { backgroundColor: colors.danger },
  wishBtn: {
    position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', ...shadows.sm,
  },
  hoverActions: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(22,27,33,0.85)', paddingVertical: 8, alignItems: 'center',
  },
  // Always rendered (not conditionally mounted) so the Quick View button
  // stays reachable by Tab -- only its visibility is hover/focus-gated, via
  // opacity rather than removing it from the tree.
  hoverActionsHidden: { opacity: 0, pointerEvents: 'none' as any },
  hoverActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  hoverActionText: { fontSize: 12, fontWeight: '700', color: colors.textDark },
  info: { padding: spacing.sm },
  brand: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginBottom: 2 },
  name: { fontSize: 13, fontWeight: '600', color: colors.textDark, marginBottom: 4, minHeight: 34 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  ratingText: { fontSize: 11, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: 8 },
  price: { fontSize: 16, fontWeight: '800', color: colors.textDark },
  originalPrice: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through' },
  addBtn: { flexDirection: 'row', gap: 6, backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  disabledBtn: { backgroundColor: colors.pageBg, borderRadius: radius.sm, paddingVertical: 8, alignItems: 'center' },
  disabledBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.pageBg, borderRadius: radius.sm, paddingVertical: 4 },
  qtyBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  qtyVal: { fontSize: 13, fontWeight: '700', color: colors.textDark },
});
