import React, { useMemo, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Product } from '../types/product';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { addToCart } from '../store';
import { RootState } from '../store';
import { NO_IMAGE_PLACEHOLDER } from '../services/product.service';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with 16 padding on edges and middle

const LIGHT_COLORS = {
  surface: '#FFFFFF',
  border: '#E3E6EA',
  textDark: '#1B1B1B',
  textMuted: '#6B7480',
  primary: '#DA3830',
  white: '#FFFFFF',
  success: '#1E9E5A',
  warning: '#F5A300',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  surface: '#1E1E1E',
  border: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  primary: '#FF5A4E',
  white: '#FFFFFF',
  success: '#4FE092',
  warning: '#F5B94D',
};

interface ProductGridCardProps {
  product: Product;
  onPress: (product: Product) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: Product) => void;
}

export const ProductGridCard: React.FC<ProductGridCardProps> = ({ product, onPress, isWishlisted, onToggleWishlist }) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp<any>>();
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [imageFailed, setImageFailed] = useState(false);
  // The desktop equivalent (ProductRail.tsx) already reacts to cart state; this
  // card didn't, so "ADD TO CART" stayed on screen forever even after the item
  // was added -- no feedback that it worked, and no way back to the cart short
  // of the header icon.
  const inCart = useSelector((state: RootState) => state.cart.items.some((i) => i.id === product.id));

  const handleAddButtonPress = () => {
    if (inCart) {
      navigation.navigate('Cart');
      return;
    }
    dispatch(addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.image,
      isB2B: product.isB2B,
    }));
  };

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(product)} activeOpacity={0.9}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageFailed ? NO_IMAGE_PLACEHOLDER : product.image }}
          style={styles.image}
          onError={() => setImageFailed(true)}
        />
        {!!product.discountPercentage && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{t('home.percentOff', { percent: product.discountPercentage })}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.wishlistBtn} onPress={() => onToggleWishlist?.(product)}>
          <Text style={{ fontSize: 18, color: isWishlisted ? '#DA3830' : '#999' }}>{isWishlisted ? '♥' : '♡'}</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.brand}>{product.brand}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{product.price}</Text>
          <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>
        </View>

        <Text style={[styles.stockText, { color: product.stockStatus === 'In Stock' ? colors.success : product.stockStatus === 'Limited Stock' ? colors.warning : colors.primary }]}>
          {product.stockStatus}
        </Text>
        <Text style={styles.deliveryText}>⏱ {product.time}</Text>
      </View>
      <TouchableOpacity style={styles.addButton} onPress={handleAddButtonPress}>
        <Text style={styles.addButtonText}>{inCart ? t('productGridCard.goToCart') : t('productGridCard.addToCart')}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: 14,
  },
  imageContainer: {
    width: '100%',
    height: 100,
    backgroundColor: colors.surface,
    position: 'relative',
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  discountBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  // Sits on top of the product photo, not the card surface -- product images
  // are photographed on a plain white background regardless of app theme, so
  // this stays a fixed translucent white in both themes rather than flipping.
  wishlistBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 0,
    flex: 1,
  },
  brand: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDark,
    height: 36, // max 2 lines
    lineHeight: 18,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  price: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.textDark,
    marginRight: 6,
  },
  originalPrice: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  stockText: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  deliveryText: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  addButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  }
});
