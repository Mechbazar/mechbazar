import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { Product } from '../types/product';
import { getProductById, getRelatedProducts, NO_IMAGE_PLACEHOLDER } from '../services/product.service';
import { fetchMyWishlist, addToWishlist, removeFromWishlist } from '../services/wishlist.service';
import { fetchProductReviews, submitProductReview, ProductReview } from '../services/review.service';
import ProductRail from '../components/desktop/home/ProductRail';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, RootState } from '../store';
import { HeaderCartButton } from '../components/HeaderCartButton';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import { setPendingRedirect } from '../navigation/postLoginRedirect';
import CompactBookingShell from '../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../components/desktop/shared/MinimalFooter';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

// `ctaDark` is the fixed near-black "Add to Cart" button (already dark in
// light mode, deliberately unchanged in dark mode); `textDark` is the real
// body-text ink, which does invert -- both happened to be the same literal
// hex before this split, which is the landmine to avoid re-merging them into.
const LIGHT_COLORS = {
  pageBg: '#F8F9FA',
  surface: '#FFFFFF',
  border: '#E3E6EA',
  textDark: '#1B1B1B',
  textMuted: '#6B7480',
  primary: '#DA3830',
  white: '#FFFFFF',
  ctaDark: '#1B1B1B',
  success: '#1E9E5A',
  danger: '#D32F2F',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  pageBg: '#121212',
  surface: '#1E1E1E',
  border: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  primary: '#FF5A4E',
  white: '#FFFFFF',
  ctaDark: '#1B1B1B',
  success: '#4FE092',
  danger: '#FF6B6B',
};

type ParamList = {
  ProductDetails: {
    productId: string;
  };
};

export default function ProductDetailsScreen() {
  const route = useRoute<RouteProp<ParamList, 'ProductDetails'>>();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { productId } = route.params;

  const { user, token } = useSelector((state: RootState) => state.auth);
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [relatedWishlist, setRelatedWishlist] = useState<Record<string, boolean>>({});
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const { isDesktopUp } = useBreakpoint();
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  useEffect(() => {
    (async () => {
      try {
        const data = await getProductById(productId);
        if (data) setProduct(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  useEffect(() => {
    if (!token) return;
    fetchMyWishlist(token).then(items => {
      setIsWishlisted(items.some(item => item.id === productId));
      setRelatedWishlist(Object.fromEntries(items.map(i => [i.id, true])));
    });
  }, [token, productId]);

  useEffect(() => {
    getRelatedProducts(productId).then(setRelatedProducts);
  }, [productId]);

  const loadReviews = useCallback(() => {
    setReviewsLoading(true);
    fetchProductReviews(productId).then(setReviews).finally(() => setReviewsLoading(false));
  }, [productId]);

  useEffect(() => { loadReviews(); }, [loadReviews]);

  // Web: redirect-with-return instead of a bare alert, matching the pattern
  // used elsewhere (Cart checkout, DesktopHeader's wishlist icon) -- see
  // postLoginRedirect.ts. Native keeps the plain alert unchanged.
  const promptWishlistLogin = () => {
    if (Platform.OS === 'web') {
      setPendingRedirect({ screen: 'ProductDetails', params: { productId } });
      navigation.navigate('Welcome');
      return;
    }
    alert('Please log in to save items to your wishlist.');
  };

  const handleRelatedWishlistToggle = async (id: string) => {
    if (!token) {
      promptWishlistLogin();
      return;
    }
    const was = !!relatedWishlist[id];
    setRelatedWishlist(prev => ({ ...prev, [id]: !was }));
    const result = was ? await removeFromWishlist(token, id) : await addToWishlist(token, id);
    if (!result.ok) setRelatedWishlist(prev => ({ ...prev, [id]: was }));
  };

  const handleSubmitReview = async () => {
    if (!token) {
      alert('Please log in to write a review.');
      return;
    }
    if (reviewRating < 1) {
      setReviewMessage({ text: t('productDetails.pleaseSelectRating'), ok: false });
      return;
    }
    setReviewSubmitting(true);
    setReviewMessage(null);
    const result = await submitProductReview(token, productId, reviewRating, reviewComment);
    setReviewSubmitting(false);
    if (result.ok) {
      setReviewMessage({ text: t('productDetails.thanksForReview'), ok: true });
      setReviewRating(0);
      setReviewComment('');
      loadReviews();
      // Refresh the product's own avgRating/reviewCount badge too.
      getProductById(productId).then(data => { if (data) setProduct(data); });
    } else {
      setReviewMessage({ text: result.error || t('productDetails.reviewSubmitFailed'), ok: false });
    }
  };

  const handleToggleWishlist = async () => {
    if (!token) {
      promptWishlistLogin();
      return;
    }
    setWishlistBusy(true);
    const nextState = !isWishlisted;
    setIsWishlisted(nextState);
    const result = nextState ? await addToWishlist(token, productId) : await removeFromWishlist(token, productId);
    setWishlistBusy(false);
    if (!result.ok) {
      setIsWishlisted(!nextState);
      alert(result.error || 'Failed to update wishlist');
    }
  };

  const isB2B = user?.role === 'B2B' || user?.accountType === 'WHOLESALE' || user?.accountType === 'B2B';
  const displayPrice = isB2B && product?.b2bPrice ? product.b2bPrice : product?.price || 0;

  const handleAddToCart = () => {
    if (product) {
      if (product.stockStatus === 'Out of Stock') {
        alert('This product is currently out of stock.');
        return;
      }

      dispatch(addToCart({
        id: product.id,
        name: product.name,
        price: displayPrice,
        originalPrice: product.originalPrice,
        image: product.image,
        isB2B,
        moq: product.moq,
        vehicleType: product.vehicleType
      }));
      alert('Added to cart!');
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (product.stockStatus === 'Out of Stock') {
      alert('This product is currently out of stock.');
      return;
    }

    dispatch(addToCart({
      id: product.id,
      name: product.name,
      price: displayPrice,
      originalPrice: product.originalPrice,
      image: product.image,
      isB2B,
      moq: product.moq,
      vehicleType: product.vehicleType
    }));
    navigation.navigate('Cart');
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={{ fontSize: 16, color: colors.textDark }}>{t('productDetails.productNotFound')}</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('productDetails.goBack')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CompactBookingShell maxWidth={880} style={styles.flexFill}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={styles.wishlistBtn} onPress={handleToggleWishlist} disabled={wishlistBusy}>
              <Text style={{ fontSize: 24, color: isWishlisted ? '#E53935' : '#333' }}>{isWishlisted ? '♥' : '♡'}</Text>
            </TouchableOpacity>
            <HeaderCartButton color="#333" backgroundColor="rgba(255,255,255,0.8)" />
          </View>
        </View>

        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageFailed ? NO_IMAGE_PLACEHOLDER : product.image }}
            style={styles.image}
            onError={() => setImageFailed(true)}
          />
          {product.discountPercentage && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{t('home.percentOff', { percent: product.discountPercentage })}</Text>
            </View>
          )}
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.brand}>{product.brand}</Text>
          <Text style={styles.name}>{product.name}</Text>
          
          <View style={styles.ratingRow}>
            {product.reviewsCount ? (
              <>
                <Text style={styles.star}>★</Text>
                <Text style={styles.rating}>{product.rating}</Text>
                <Text style={styles.reviews}>{t('productDetails.reviewsCount', { count: product.reviewsCount })}</Text>
              </>
            ) : (
              <Text style={styles.reviews}>{t('productDetails.noReviewsYetBeFirst')}</Text>
            )}
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{displayPrice}</Text>
            {product.originalPrice > displayPrice && (
              <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>
            )}
          </View>

          <View style={styles.metaBox}>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📦</Text>
              <Text style={[styles.metaText, { color: product.stockStatus === 'In Stock' ? colors.success : colors.primary }]}>
                {product.stockStatus}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>⏱</Text>
              <Text style={styles.metaText}>{t('productDetails.deliveryInTime', { time: product.time })}</Text>
            </View>
          </View>

          <View style={styles.descriptionBox}>
            <Text style={styles.sectionTitle}>{t('productDetails.productDetailsTitle')}</Text>
            <Text style={styles.descriptionText}>
              {product.description || `This is a high-quality ${product.name} from ${product.brand}. It provides excellent performance and durability.`}
            </Text>
          </View>

          {product.oemNumber && (
            <View style={styles.specBox}>
              <Text style={styles.specTitle}>{t('productDetails.oemPartNumber')}</Text>
              <Text style={styles.specValue}>{product.oemNumber}</Text>
            </View>
          )}

          {(product as any).compatibleVehicles && (product as any).compatibleVehicles.length > 0 && (
            <View style={styles.specBox}>
              <Text style={styles.sectionTitle}>{t('productDetails.compatibleVehicles')}</Text>
              {(product as any).compatibleVehicles.map((v: any) => (
                <View key={v} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{v}</Text>
                </View>
              ))}
            </View>
          )}

          {product.specs && Object.keys(product.specs).length > 0 && (
            <View style={styles.specBox}>
              <Text style={styles.sectionTitle}>{t('productDetails.specifications')}</Text>
              {Object.entries(product.specs).map(([key, val]) => (
                <View key={key} style={styles.specRow}>
                  <Text style={styles.specKey}>{key}</Text>
                  <Text style={styles.specVal}>{val}</Text>
                </View>
              ))}
            </View>
          )}

          {product.warranty && (
            <View style={styles.specBox}>
              <Text style={styles.sectionTitle}>{t('productDetails.warranty')}</Text>
              <Text style={styles.descriptionText}>{product.warranty}</Text>
            </View>
          )}

          <View style={styles.specBox}>
            <Text style={styles.sectionTitle}>{t('productDetails.ratingsReviews')}</Text>

            {reviewsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
            ) : reviews.length === 0 ? (
              <Text style={styles.descriptionText}>{t('productDetails.noReviewsYetFull')}</Text>
            ) : (
              reviews.map(r => (
                <View key={r.id} style={styles.reviewRow}>
                  <View style={styles.reviewHeader}>
                    <View style={{ flexDirection: 'row' }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons key={i} name={i < r.rating ? 'star' : 'star-outline'} size={14} color="#F5A300" />
                      ))}
                    </View>
                    <Text style={styles.reviewAuthor}>{r.userName || t('productDetails.mechBazarCustomer')}</Text>
                    {r.verifiedPurchase && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={12} color="#1E9E5A" />
                        <Text style={styles.verifiedBadgeText}>{t('productDetails.verifiedPurchase')}</Text>
                      </View>
                    )}
                  </View>
                  {!!r.comment && <Text style={styles.reviewComment}>{r.comment}</Text>}
                  <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString()}</Text>
                </View>
              ))
            )}

            <View style={styles.writeReviewBox}>
              <Text style={styles.writeReviewTitle}>{t('productDetails.writeAReview')}</Text>
              <View style={{ flexDirection: 'row', marginBottom: 10 }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TouchableOpacity key={i} onPress={() => setReviewRating(i + 1)} hitSlop={6}>
                    <Ionicons
                      name={i < reviewRating ? 'star' : 'star-outline'}
                      size={26}
                      color="#F5A300"
                      style={{ marginRight: 4 }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.reviewInput}
                placeholder={t('productDetails.shareYourExperience')}
                placeholderTextColor={colors.textMuted}
                value={reviewComment}
                onChangeText={setReviewComment}
                multiline
                numberOfLines={3}
              />
              {reviewMessage && (
                <Text style={[styles.reviewMessage, { color: reviewMessage.ok ? colors.success : colors.danger }]}>
                  {reviewMessage.text}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.submitReviewBtn, reviewSubmitting && { opacity: 0.6 }]}
                onPress={handleSubmitReview}
                disabled={reviewSubmitting}
              >
                {reviewSubmitting
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.submitReviewBtnText}>{t('productDetails.submitReview')}</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {relatedProducts.length > 0 && (
            <View style={styles.relatedBox}>
              <ProductRail
                title={t('productDetails.relatedProducts')}
                products={relatedProducts}
                wishlist={relatedWishlist}
                onWishlistToggle={handleRelatedWishlistToggle}
              />
            </View>
          )}
        </View>
        <MinimalFooter />
      </ScrollView>
      </CompactBookingShell>

      {/* Left absolute-positioned (not CompactBookingShell-wrapped) so it keeps
          pinning to the true screen bottom on every platform -- a wrapping
          View around only an absolutely-positioned child would collapse to
          zero height and break that anchoring. */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.addToCartBtn} onPress={handleAddToCart}>
          <Text style={styles.addToCartText}>{t('productDetails.addToCart')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buyNowBtn} onPress={handleBuyNow}>
          <Text style={styles.buyNowText}>{t('home.buyNow')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  flexFill: { flex: 1 },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  // Floats over the product photo, not the page bg -- product photography is
  // shot on a plain light background regardless of app theme, so these chips
  // stay a fixed translucent white/dark-ink pair in both themes.
  backBtn: { width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: '#1B1B1B', marginTop: -2 },
  wishlistBtn: { width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  imageContainer: {
    width: '100%',
    height: 220,
    backgroundColor: colors.surface,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  image: { width: '100%', height: '100%', resizeMode: 'contain' },
  discountBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  discountText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  detailsContainer: { padding: 16 },
  brand: { fontSize: 13, color: colors.textMuted, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  name: { fontSize: 18, fontWeight: '900', color: colors.textDark, marginBottom: 12, lineHeight: 24 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  star: { color: '#F5A300', fontSize: 16, marginRight: 4 },
  rating: { fontSize: 14, fontWeight: '600', color: colors.textDark, marginRight: 6 },
  reviews: { fontSize: 14, color: colors.textMuted },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20 },
  price: { fontSize: 26, fontWeight: '900', color: colors.textDark, marginRight: 12 },
  originalPrice: { fontSize: 16, color: colors.textMuted, textDecorationLine: 'line-through', marginBottom: 4 },
  metaBox: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  metaIcon: { fontSize: 18, marginRight: 8 },
  metaText: { fontSize: 13, fontWeight: 'bold', color: colors.textDark },
  descriptionBox: {
    marginBottom: 20,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textDark, marginBottom: 12 },
  descriptionText: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },
  relatedBox: { marginTop: 8, marginBottom: 20 },
  reviewRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  reviewAuthor: { fontSize: 13, fontWeight: '600', color: colors.textDark },
  // Fixed light-green badge (doesn't invert) -- its text stays fixed too,
  // matching the same "pin text to the badge's own bg" rule used elsewhere.
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#EBFBEE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  verifiedBadgeText: { fontSize: 10, fontWeight: '700', color: '#1E9E5A' },
  reviewComment: { fontSize: 13, color: colors.textDark, lineHeight: 19, marginBottom: 4 },
  reviewDate: { fontSize: 11, color: colors.textMuted },
  writeReviewBox: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  writeReviewTitle: { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: 10 },
  reviewInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12,
    fontSize: 13, color: colors.textDark, minHeight: 70, textAlignVertical: 'top', marginBottom: 8,
  },
  reviewMessage: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  submitReviewBtn: {
    backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 24,
  },
  submitReviewBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  specBox: {
    marginBottom: 20,
    backgroundColor: colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  specTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: 4 },
  specValue: { fontSize: 15, color: colors.textDark, fontWeight: 'bold' },
  bulletRow: { flexDirection: 'row', marginBottom: 6 },
  bullet: { fontSize: 16, color: colors.primary, marginRight: 8 },
  bulletText: { fontSize: 14, color: colors.textDark },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.border },
  specKey: { fontSize: 14, color: colors.textMuted },
  specVal: { fontSize: 14, color: colors.textDark, fontWeight: 'bold' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32, // Safe area
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  // Deliberately fixed near-black CTA (see `ctaDark` above), not `textDark`.
  addToCartBtn: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: colors.ctaDark,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 10,
  },
  addToCartText: { color: colors.white, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  buyNowBtn: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
  },
  buyNowText: { color: colors.white, fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }
});
