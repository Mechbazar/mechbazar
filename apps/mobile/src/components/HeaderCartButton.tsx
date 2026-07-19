import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useNavigation, NavigationProp } from '@react-navigation/native';

interface HeaderCartButtonProps {
  color?: string;
  backgroundColor?: string;
}

export const HeaderCartButton: React.FC<HeaderCartButtonProps> = ({ 
  color = '#FFFFFF', 
  backgroundColor = 'rgba(255,255,255,0.15)' 
}) => {
  const navigation = useNavigation<NavigationProp<any>>();
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const cartItemCount = cartItems.reduce((sum, item) => sum + item.qty, 0);

  return (
    <TouchableOpacity 
      style={[styles.profileButton, { backgroundColor }]} 
      onPress={() => navigation.navigate('Cart')}
    >
      {cartItemCount > 0 && (
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{cartItemCount}</Text>
        </View>
      )}
      <Text style={[styles.cartIcon, { color }]}>🛒</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  profileButton: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    justifyContent: 'center', 
    alignItems: 'center', 
    position: 'relative' 
  },
  cartIcon: { 
    fontSize: 20 
  },
  cartBadge: { 
    position: 'absolute', 
    top: -4, 
    right: -4, 
    backgroundColor: '#BF3617', 
    width: 20, 
    height: 20, 
    borderRadius: 10, 
    justifyContent: 'center', 
    alignItems: 'center', 
    zIndex: 2 
  },
  cartBadgeText: { 
    color: '#FFF', 
    fontSize: 10, 
    fontWeight: 'bold' 
  },
});
