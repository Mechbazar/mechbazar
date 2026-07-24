import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Image, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { Product } from '../../../types/product';
import { colors, spacing, radius } from '../../../theme/tokens';
import { NO_IMAGE_PLACEHOLDER } from '../../../services/product.service';

interface QuickViewModalProps {
  product: Product | null;
  onClose: () => void;
  isWishlisted: boolean;
  onToggleWishlist: (product: Product) => void;
  qtyInCart: number;
  onAddToCart: (product: Product) => void;
  onQtyChange: (product: Product, nextQty: number) => void;
}

export default function QuickViewModal({
  product, onClose, isWishlisted, onToggleWishlist, qtyInCart, onAddToCart, onQtyChange,
}: QuickViewModalProps) {
  const navigation = useNavigation<NavigationProp<any>>();
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [product?.id]);
  if (!product) return null;
  const outOfStock = product.stockStatus === 'Out of Stock';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.closeBtn} onPress={onClose} accessibilityLabel="Close quick view">
            <Ionicons name="close" size={20} color={colors.textDark} />
          </Pressable>

          <ScrollView horizontal={false} contentContainerStyle={styles.body}>
            <View style={styles.imageCol}>
              <Image
                source={{ uri: imageFailed ? NO_IMAGE_PLACEHOLDER : product.image }}
                style={styles.image}
                resizeMode="contain"
                onError={() => setImageFailed(true)}
              />
            </View>

            <View style={styles.infoCol}>
              <Text style={styles.brand}>{product.brand}</Text>
              <Text style={styles.name}>{product.name}</Text>

              <View style={styles.ratingRow}>
                {product.reviewsCount ? (
                  <>
                    <Ionicons name="star" size={14} color="#F5A300" />
                    <Text style={styles.ratingText}>{product.rating} ({product.reviewsCount} reviews)</Text>
                  </>
                ) : (
                  <Text style={styles.ratingText}>New — no reviews yet</Text>
                )}
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.price}>₹{product.price}</Text>
                {product.originalPrice > product.price && <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>}
                {(product.discountPercentage ?? 0) > 0 && (
                  <View style={styles.discountBadge}><Text style={styles.discountText}>{product.discountPercentage}% OFF</Text></View>
                )}
              </View>

              <Text style={[styles.stock, { color: outOfStock ? colors.danger : colors.success }]}>{product.stockStatus}</Text>

              {!!product.description && <Text style={styles.description} numberOfLines={4}>{product.description}</Text>}

              <View style={styles.actionsRow}>
                {outOfStock ? (
                  <View style={styles.disabledBtn}><Text style={styles.disabledBtnText}>Out of Stock</Text></View>
                ) : qtyInCart > 0 ? (
                  <View style={styles.qtyRow}>
                    <Pressable style={styles.qtyBtn} onPress={() => onQtyChange(product, qtyInCart - 1)}>
                      <Text style={styles.qtyBtnText}>-</Text>
                    </Pressable>
                    <Text style={styles.qtyVal}>{qtyInCart}</Text>
                    <Pressable style={styles.qtyBtn} onPress={() => onQtyChange(product, qtyInCart + 1)}>
                      <Text style={styles.qtyBtnText}>+</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable style={styles.addBtn} onPress={() => onAddToCart(product)}>
                    <Ionicons name="cart-outline" size={16} color={colors.white} />
                    <Text style={styles.addBtnText}>Add to Cart</Text>
                  </Pressable>
                )}

                <Pressable style={styles.wishBtn} onPress={() => onToggleWishlist(product)}>
                  <Ionicons name={isWishlisted ? 'heart' : 'heart-outline'} size={18} color={isWishlisted ? colors.primary : colors.textMuted} />
                </Pressable>
              </View>

              <Pressable
                style={styles.detailsLink}
                onPress={() => { onClose(); navigation.navigate('ProductDetails', { productId: product.id }); }}
              >
                <Text style={styles.detailsLinkText}>View Full Details</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(17,17,18,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  dialog: {
    width: '100%', maxWidth: 760, maxHeight: '85%', backgroundColor: colors.white,
    borderRadius: radius.lg, overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute', top: spacing.sm, right: spacing.sm, zIndex: 10,
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.pageBg, alignItems: 'center', justifyContent: 'center',
  },
  body: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.xl },
  imageCol: { width: 320, height: 320, backgroundColor: colors.pageBg, borderRadius: radius.md, marginRight: spacing.xl },
  image: { width: '100%', height: '100%' },
  infoCol: { flex: 1, minWidth: 260 },
  brand: { fontSize: 12, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  name: { fontSize: 20, fontWeight: '700', color: colors.textDark, marginBottom: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  ratingText: { fontSize: 13, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  price: { fontSize: 24, fontWeight: '800', color: colors.textDark },
  originalPrice: { fontSize: 14, color: colors.textMuted, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: colors.danger, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  discountText: { color: colors.white, fontSize: 11, fontWeight: '700' },
  stock: { fontSize: 13, fontWeight: '700', marginBottom: 12 },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 20, marginBottom: 16 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  addBtn: { flexDirection: 'row', gap: 8, backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 12, alignItems: 'center' },
  addBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  disabledBtn: { backgroundColor: colors.pageBg, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  disabledBtnText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  wishBtn: { width: 44, height: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.pageBg, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 10 },
  qtyBtn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: colors.primary },
  qtyVal: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  detailsLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailsLinkText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
