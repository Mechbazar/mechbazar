import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import { addToCart } from '../store/cartSlice';
import { RootState } from '../store';
import { Product } from '../types/product';
import { fetchMyWishlist, removeFromWishlist } from '../services/wishlist.service';

const colors = {
  primary: '#E53935',
  secondary: '#1C1C1E',
  white: '#FFFFFF',
  pageBg: '#F8F9FA',
  borderLight: '#E8ECEF',
  textDark: '#111112',
  textMuted: '#8E8E93',
  lightGray: '#F2F2F7',
};

export default function WishlistScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useDispatch();
  const { token } = useSelector((state: RootState) => state.auth);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setWishlist([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const items = await fetchMyWishlist(token);
    setWishlist(items);
    setIsLoading(false);
  }, [token]);

  // Refetch every time this screen gains focus so a heart toggled elsewhere
  // (product details, home) is reflected here without a manual pull-to-refresh.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRemove = async (id: string) => {
    if (!token) return;
    setRemovingId(id);
    const prev = wishlist;
    setWishlist(current => current.filter(item => item.id !== id));
    const result = await removeFromWishlist(token, id);
    setRemovingId(null);
    if (!result.ok) {
      setWishlist(prev);
      Alert.alert('Error', result.error || 'Failed to remove from wishlist');
    }
  };

  const handleMoveToCart = (item: Product) => {
    dispatch(addToCart({
      id: item.id,
      name: item.name,
      price: item.price,
      originalPrice: item.originalPrice,
      image: item.image,
      isB2B: item.isB2B,
      vehicleType: item.vehicleType,
      moq: item.moq,
    }));
    handleRemove(item.id);
    Alert.alert('Success', `${item.name} moved to cart successfully!`);
  };

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.cardProductRow}
        onPress={() => navigation.navigate('ProductDetails', { productId: item.id })}
      >
        <Image source={{ uri: item.image }} style={styles.productImg} />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{item.price}</Text>
            <Text style={styles.originalPrice}>₹{item.originalPrice}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.btnRow}>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => handleRemove(item.id)}
          disabled={removingId === item.id}
        >
          {removingId === item.id
            ? <ActivityIndicator size="small" color={colors.textMuted} />
            : <Ionicons name="trash-outline" size={16} color={colors.textMuted} />}
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cartBtn}
          onPress={() => handleMoveToCart(item)}
        >
          <Ionicons name="cart-outline" size={16} color={colors.primary} />
          <Text style={styles.cartText}>Move To Cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Wishlist</Text>
        <View style={{ width: 24 }} />
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={wishlist}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="heart-dislike-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
              <Text style={styles.emptySubtitle}>Tap the heart icon on spare parts to save them here for later.</Text>
              <TouchableOpacity
                style={styles.shopBtn}
                onPress={() => navigation.navigate('Categories')}
              >
                <Text style={styles.shopBtnText}>Explore Products</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: colors.secondary
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: colors.white },
  listContent: { padding: 16 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 12,
    marginBottom: 12,
  },
  cardProductRow: { flexDirection: 'row', alignItems: 'center' },
  productImg: { width: 56, height: 56, borderRadius: 8, resizeMode: 'cover' },
  productName: { fontSize: 13, fontWeight: 'bold', color: colors.textDark, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  price: { fontSize: 14, fontWeight: '800', color: colors.primary },
  originalPrice: { fontSize: 11, textDecorationLine: 'line-through', color: colors.textMuted, marginLeft: 8 },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 10,
    marginTop: 12,
  },
  removeBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  removeText: { fontSize: 11, fontWeight: 'bold', color: colors.textMuted, marginLeft: 4 },
  cartBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  cartText: { fontSize: 11, fontWeight: 'bold', color: colors.primary, marginLeft: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textDark, marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18, marginBottom: 20 },
  shopBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  shopBtnText: { color: colors.white, fontSize: 13, fontWeight: 'bold' }
});
