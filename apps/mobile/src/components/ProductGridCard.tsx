import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Product } from '../types/product';
import { useDispatch } from 'react-redux';
import { addToCart } from '../store';
import { NO_IMAGE_PLACEHOLDER } from '../services/product.service';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 columns with 16 padding on edges and middle

interface ProductGridCardProps {
  product: Product;
  onPress: (product: Product) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (product: Product) => void;
}

export const ProductGridCard: React.FC<ProductGridCardProps> = ({ product, onPress, isWishlisted, onToggleWishlist }) => {
  const dispatch = useDispatch();
  const [imageFailed, setImageFailed] = useState(false);

  const handleAddToCart = () => {
    dispatch(addToCart({ 
      id: product.id, 
      name: product.name, 
      price: product.price, 
      originalPrice: product.originalPrice, 
      image: product.image, 
      isB2B: product.isB2B 
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
            <Text style={styles.discountText}>{product.discountPercentage}% OFF</Text>
          </View>
        )}
        <TouchableOpacity style={styles.wishlistBtn} onPress={() => onToggleWishlist?.(product)}>
          <Text style={{ fontSize: 18, color: isWishlisted ? '#E23B22' : '#999' }}>{isWishlisted ? '♥' : '♡'}</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.brand}>{product.brand}</Text>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        
        <View style={styles.priceRow}>
          <Text style={styles.price}>₹{product.price}</Text>
          <Text style={styles.originalPrice}>₹{product.originalPrice}</Text>
        </View>

        <Text style={[styles.stockText, { color: product.stockStatus === 'In Stock' ? '#1E9E5A' : product.stockStatus === 'Limited Stock' ? '#F5A300' : '#E23B22' }]}>
          {product.stockStatus}
        </Text>
        <Text style={styles.deliveryText}>⏱ {product.time}</Text>
      </View>
      <TouchableOpacity style={styles.addButton} onPress={handleAddToCart}>
        <Text style={styles.addButtonText}>ADD TO CART</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E3E6EA',
    overflow: 'hidden',
    padding: 14,
  },
  imageContainer: {
    width: '100%',
    height: 100,
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#E23B22',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
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
    color: '#6B7480',
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: '#161B21',
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
    color: '#161B21',
    marginRight: 6,
  },
  originalPrice: {
    fontSize: 11,
    color: '#6B7480',
    textDecorationLine: 'line-through',
  },
  stockText: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  deliveryText: {
    fontSize: 11,
    color: '#6B7480',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#E23B22',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  }
});
