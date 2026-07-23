import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Product } from '../types/product';
import { getProductById, NO_IMAGE_PLACEHOLDER } from '../services/product.service';
import { fetchMyWishlist, addToWishlist, removeFromWishlist } from '../services/wishlist.service';
import { useDispatch, useSelector } from 'react-redux';
import { addToCart, RootState } from '../store';
import { HeaderCartButton } from '../components/HeaderCartButton';

type ParamList = {
  ProductDetails: {
    productId: string;
  };
};

export default function ProductDetailsScreen() {
  const route = useRoute<RouteProp<ParamList, 'ProductDetails'>>();
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { productId } = route.params;

  const { user, token } = useSelector((state: RootState) => state.auth);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

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
    });
  }, [token, productId]);

  const handleToggleWishlist = async () => {
    if (!token) {
      alert('Please log in to save items to your wishlist.');
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
        <ActivityIndicator size="large" color="#034C8C" />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.loaderContainer}>
        <Text style={{ fontSize: 16 }}>Product not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 20 }}>
          <Text style={{ color: '#034C8C', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
              <Text style={styles.discountText}>{product.discountPercentage}% OFF</Text>
            </View>
          )}
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.brand}>{product.brand}</Text>
          <Text style={styles.name}>{product.name}</Text>
          
          <View style={styles.ratingRow}>
            <Text style={styles.star}>★</Text>
            <Text style={styles.rating}>{product.rating}</Text>
            <Text style={styles.reviews}>({product.reviewsCount} reviews)</Text>
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
              <Text style={[styles.metaText, { color: product.stockStatus === 'In Stock' ? '#1E9E5A' : '#E23B22' }]}>
                {product.stockStatus}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>⏱</Text>
              <Text style={styles.metaText}>Delivery in {product.time}</Text>
            </View>
          </View>

          <View style={styles.descriptionBox}>
            <Text style={styles.sectionTitle}>Product Details</Text>
            <Text style={styles.descriptionText}>
              {product.description || `This is a high-quality ${product.name} from ${product.brand}. It provides excellent performance and durability.`}
            </Text>
          </View>

          {product.oemNumber && (
            <View style={styles.specBox}>
              <Text style={styles.specTitle}>OEM Part Number</Text>
              <Text style={styles.specValue}>{product.oemNumber}</Text>
            </View>
          )}

          {(product as any).compatibleVehicles && (product as any).compatibleVehicles.length > 0 && (
            <View style={styles.specBox}>
              <Text style={styles.sectionTitle}>Compatible Vehicles</Text>
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
              <Text style={styles.sectionTitle}>Specifications</Text>
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
              <Text style={styles.sectionTitle}>Warranty</Text>
              <Text style={styles.descriptionText}>{product.warranty}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.addToCartBtn} onPress={handleAddToCart}>
          <Text style={styles.addToCartText}>Add to Cart</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.buyNowBtn} onPress={handleBuyNow}>
          <Text style={styles.buyNowText}>Buy Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
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
  backBtn: { width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: '#161B21', marginTop: -2 },
  wishlistBtn: { width: 44, height: 44, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  imageContainer: {
    width: '100%',
    height: 220,
    backgroundColor: '#FFFFFF',
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#E3E6EA',
  },
  image: { width: '100%', height: '100%', resizeMode: 'contain' },
  discountBadge: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: '#E23B22',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  discountText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  detailsContainer: { padding: 16 },
  brand: { fontSize: 13, color: '#6B7480', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
  name: { fontSize: 18, fontWeight: '900', color: '#161B21', marginBottom: 12, lineHeight: 24 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  star: { color: '#F5A300', fontSize: 16, marginRight: 4 },
  rating: { fontSize: 14, fontWeight: '600', color: '#161B21', marginRight: 6 },
  reviews: { fontSize: 14, color: '#6B7480' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 20 },
  price: { fontSize: 26, fontWeight: '900', color: '#161B21', marginRight: 12 },
  originalPrice: { fontSize: 16, color: '#6B7480', textDecorationLine: 'line-through', marginBottom: 4 },
  metaBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E3E6EA',
  },
  metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  metaIcon: { fontSize: 18, marginRight: 8 },
  metaText: { fontSize: 13, fontWeight: 'bold', color: '#161B21' },
  descriptionBox: { 
    marginBottom: 20, 
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E6EA',
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#161B21', marginBottom: 12 },
  descriptionText: { fontSize: 14, color: '#6B7480', lineHeight: 22 },
  specBox: { 
    marginBottom: 20,
    backgroundColor: '#FFFFFF', 
    padding: 16, 
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E3E6EA',
  },
  specTitle: { fontSize: 13, fontWeight: '600', color: '#6B7480', marginBottom: 4 },
  specValue: { fontSize: 15, color: '#161B21', fontWeight: 'bold' },
  bulletRow: { flexDirection: 'row', marginBottom: 6 },
  bullet: { fontSize: 16, color: '#E23B22', marginRight: 8 },
  bulletText: { fontSize: 14, color: '#161B21' },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#E3E6EA' },
  specKey: { fontSize: 14, color: '#6B7480' },
  specVal: { fontSize: 14, color: '#161B21', fontWeight: 'bold' },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 32, // Safe area
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E3E6EA',
  },
  addToCartBtn: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: '#161B21',
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 10,
  },
  addToCartText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  buyNowBtn: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: '#E23B22',
    borderRadius: 10,
    alignItems: 'center',
  },
  buyNowText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }
});
