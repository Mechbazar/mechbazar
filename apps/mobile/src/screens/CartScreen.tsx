import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { updateQuantity, clearCart } from '../store/cartSlice';
import { API_BASE_URL } from '../services/api';
import { ServiceAddress } from '../types/service';
import { fetchMyAddresses } from '../services/address.service';
import { AddressPickerSheet } from '../components/services/AddressPickerSheet';

export default function CartScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const [couponCode, setCouponCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<ServiceAddress | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);
  const [showAddressSheet, setShowAddressSheet] = useState(false);

  const cartItems = useSelector((state: RootState) => state.cart.items);
  const deliveryFee = useSelector((state: RootState) => state.cart.deliveryFee);
  const { user, token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (!token) {
      setIsLoadingAddress(false);
      return;
    }
    fetchMyAddresses(token).then(addresses => {
      // Real customer-selected/default address -- previously checkout silently
      // ignored this entirely and let the backend pick an arbitrary saved
      // address (or fall back to a hardcoded string) instead.
      const preferred = addresses.find(a => a.isDefault) || addresses[0] || null;
      setSelectedAddress(preferred);
      setIsLoadingAddress(false);
    });
  }, [token]);

  const handleChangeAddress = () => {
    setShowAddressSheet(true);
  };

  // MechBazar Brand Colors (New Design System)
  const colors = {
    primary: '#E23B22',
    darkInk: '#161B21',
    steel: '#242C35',
    pageBg: '#F3F4F6',
    white: '#FFFFFF',
    borderLight: '#E3E6EA',
    textDark: '#161B21',
    textMuted: '#6B7480',
    success: '#1E9E5A',
  };

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalOriginalPrice = cartItems.reduce((sum, item) => sum + (item.originalPrice * item.qty), 0);
  
  const [discount, setDiscount] = useState(0);

  const grandTotal = subtotal + deliveryFee - discount;
  const totalSavings = (totalOriginalPrice - subtotal) + discount;

  const handleApplyCoupon = async () => {
    if (!couponCode) return;
    try {
      const response = await fetch(`${API_BASE_URL}/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({ code: couponCode, cartTotal: subtotal })
      });
      const data = await response.json();
      if (response.ok) {
        if (data.discountType === 'percentage') {
          setDiscount((subtotal * data.discountValue) / 100);
        } else {
          setDiscount(data.discountValue);
        }
        alert(data.message || 'Coupon applied successfully');
      } else {
        setDiscount(0);
        alert(data.error || 'Invalid coupon');
      }
    } catch (err) {
      console.error(err);
      alert('Network error validating coupon');
    }
  };

  const handleCheckout = async () => {
    if (!selectedAddress) {
      alert('Please select a delivery address before checking out.');
      return;
    }
    setIsProcessing(true);
    try {
      const isB2B = user?.role === 'B2B' || user?.accountType === 'WHOLESALE' || user?.accountType === 'B2B';
      const payload = {
        items: cartItems.map(item => ({ id: item.id, qty: item.qty })),
        addressId: selectedAddress.id,
        couponCode,
        isB2B,
        phone: user?.phone
      };

      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        dispatch(clearCart());
        alert('Order placed successfully!');
        (navigation as any).navigate('MainTabs', { screen: 'Orders' });
      } else {
        alert(data.error || 'Failed to place order');
      }
    } catch (error) {
      console.error(error);
      alert('Network error. Could not place order.');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Checkout</Text>
    </View>
  );

  const renderDeliveryInfo = () => (
    <View style={styles.deliveryCard}>
      <View style={styles.deliveryHeader}>
        <Text style={styles.deliveryIcon}>⏱️</Text>
        <View style={styles.deliveryTextContainer}>
          <Text style={styles.deliveryTitle}>Delivery in 10-15 mins</Text>
          <Text style={styles.deliverySubtitle}>Shipment of {cartItems.length} items</Text>
        </View>
      </View>
    </View>
  );

  const renderCartItems = () => (
    <View style={styles.itemsCard}>
      {cartItems.map((item, index) => (
        <View key={item.id}>
          <View style={styles.cartItem}>
            <Image source={{ uri: item.image }} style={styles.itemImage} />
            
            <View style={styles.itemDetails}>
              <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
              
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {item.vehicleType && (
                  <View style={[styles.b2bBadge, { backgroundColor: item.vehicleType === 'CAR' ? '#034C8C' : '#BF3617' }]}>
                    <Text style={styles.b2bText}>{item.vehicleType === 'CAR' ? '🚗 CAR PART' : '🏍️ BIKE PART'}</Text>
                  </View>
                )}
                {item.isB2B && (
                  <View style={styles.b2bBadge}>
                    <Text style={styles.b2bText}>B2B BULK</Text>
                  </View>
                )}
              </View>
              
              <View style={styles.priceAndQty}>
                <View>
                  <Text style={styles.originalPrice}>₹{item.originalPrice}</Text>
                  <Text style={styles.itemPrice}>₹{item.price}</Text>
                </View>
                
                <View style={styles.qtyControl}>
                  <TouchableOpacity 
                    style={styles.qtyBtn}
                    onPress={() => dispatch(updateQuantity({ id: item.id, qty: item.qty - 1 }))}
                  >
                    <Text style={styles.qtyBtnText}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.qty}</Text>
                  <TouchableOpacity 
                    style={styles.qtyBtn}
                    onPress={() => dispatch(updateQuantity({ id: item.id, qty: item.qty + 1 }))}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
          {index < cartItems.length - 1 && <View style={styles.divider} />}
        </View>
      ))}
    </View>
  );

  const renderCouponSection = () => (
    <View style={styles.couponCard}>
      <Text style={styles.couponIcon}>🎟️</Text>
      <TextInput
        style={styles.couponInput}
        placeholder="Enter Coupon Code"
        value={couponCode}
        onChangeText={setCouponCode}
        placeholderTextColor={colors.textMuted}
      />
      <TouchableOpacity style={styles.applyBtn} onPress={handleApplyCoupon}>
        <Text style={styles.applyBtnText}>Apply</Text>
      </TouchableOpacity>
    </View>
  );

  const renderBillDetails = () => (
    <View style={styles.billCard}>
      <Text style={styles.billTitle}>Bill Details</Text>
      
      <View style={styles.billRow}>
        <Text style={styles.billText}>Item Total</Text>
        <Text style={styles.billValue}>₹{subtotal}</Text>
      </View>
      
      <View style={styles.billRow}>
        <Text style={styles.billText}>Delivery Fee</Text>
        <Text style={styles.billValue}>₹{deliveryFee}</Text>
      </View>

      {discount > 0 && (
        <View style={styles.billRow}>
          <Text style={[styles.billText, { color: colors.success }]}>Promo Discount</Text>
          <Text style={[styles.billValue, { color: colors.success }]}>-₹{discount}</Text>
        </View>
      )}

      <View style={styles.dashedDivider} />
      
      <View style={styles.billRow}>
        <Text style={styles.grandTotalText}>Grand Total</Text>
        <Text style={styles.grandTotalValue}>₹{grandTotal}</Text>
      </View>
      
      {totalSavings > 0 && (
        <View style={styles.savingsBanner}>
          <Text style={styles.savingsText}>You are saving ₹{totalSavings} on this order!</Text>
        </View>
      )}
    </View>
  );

  const renderAddressSelection = () => (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <Text style={styles.addressTitle}>Delivery Address</Text>
        <TouchableOpacity onPress={handleChangeAddress}>
          <Text style={styles.changeText}>{selectedAddress ? 'Change' : 'Select'}</Text>
        </TouchableOpacity>
      </View>
      {isLoadingAddress ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : selectedAddress ? (
        <View style={styles.stackedInput}>
          <Text style={styles.addressType}>{selectedAddress.isDefault ? '⭐ ' : '📍 '}{selectedAddress.title}</Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {selectedAddress.line1}{selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}, {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.stackedInput} onPress={handleChangeAddress}>
          <Text style={[styles.addressText, { color: colors.primary, fontWeight: '700' }]}>+ Add a delivery address to continue</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPaymentSelection = () => (
    <View style={styles.addressCard}>
      <Text style={styles.addressTitle}>Payment</Text>
      <View style={styles.paymentRadioRow}>
        <View style={styles.radioSelected}>
          <View style={styles.radioDot} />
        </View>
        <Text style={styles.paymentText}>Cash on Delivery</Text>
      </View>
    </View>
  );

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>Looks like you haven't added any parts or accessories to your cart yet.</Text>
          <TouchableOpacity 
            style={styles.continueShoppingBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.continueShoppingText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {renderCartItems()}
        {renderCouponSection()}
        {renderBillDetails()}
        {renderAddressSelection()}
        {renderPaymentSelection()}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerTotal}>
          <Text style={styles.footerTotalLabel}>Total to pay</Text>
          <Text style={styles.footerTotalValue}>₹{grandTotal}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, (isProcessing || !selectedAddress) && { opacity: 0.7 }]}
          onPress={handleCheckout}
          disabled={isProcessing || !selectedAddress}
        >
          <Text style={styles.checkoutText}>
            {isProcessing ? 'PROCESSING...' : !selectedAddress ? 'SELECT AN ADDRESS' : `PLACE ORDER · ₹${grandTotal}`}
          </Text>
        </TouchableOpacity>
      </View>

      {token && (
        <AddressPickerSheet
          visible={showAddressSheet}
          token={token}
          onClose={() => setShowAddressSheet(false)}
          onSelect={(addr) => { setSelectedAddress(addr); setShowAddressSheet(false); }}
        />
      )}
    </SafeAreaView>
  );
}

const colors = {
  primary: '#E23B22',
  darkInk: '#161B21',
  steel: '#242C35',
  pageBg: '#F3F4F6',
  white: '#FFFFFF',
  borderLight: '#E3E6EA',
  textDark: '#161B21',
  textMuted: '#6B7480',
  success: '#1E9E5A',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.darkInk, borderBottomWidth: 1, borderBottomColor: colors.darkInk },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.white, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  
  scrollContent: { padding: 14, paddingBottom: 40 },
  
  // Delivery Info
  deliveryCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: colors.borderLight },
  deliveryHeader: { flexDirection: 'row', alignItems: 'center' },
  deliveryIcon: { fontSize: 32, marginRight: 14 },
  deliveryTextContainer: { flex: 1 },
  deliveryTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textDark, marginBottom: 4 },
  deliverySubtitle: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  
  // Cart Items
  itemsCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: colors.borderLight },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  itemImage: { width: 70, height: 70, borderRadius: 8, marginRight: 12, borderWidth: 1, borderColor: colors.borderLight, resizeMode: 'contain' },
  itemDetails: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: colors.textDark, marginBottom: 4 },
  b2bBadge: { alignSelf: 'flex-start', backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 8 },
  b2bText: { color: colors.white, fontSize: 9, fontWeight: 'bold' },
  priceAndQty: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  originalPrice: { fontSize: 12, color: colors.textMuted, textDecorationLine: 'line-through' },
  itemPrice: { fontSize: 16, fontWeight: 'bold', color: colors.textDark },
  
  qtyControl: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  qtyBtnText: { color: colors.textDark, fontWeight: 'bold', fontSize: 16 },
  qtyValue: { color: colors.textDark, fontWeight: 'bold', fontSize: 14, marginHorizontal: 12 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 12 },

  // Coupon
  couponCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight, borderStyle: 'dashed' },
  couponIcon: { fontSize: 20, marginRight: 12 },
  couponInput: { flex: 1, fontSize: 14, color: colors.textDark, fontWeight: '500' },
  applyBtn: { backgroundColor: colors.darkInk, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  applyBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 12 },

  // Bill Details
  billCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: colors.borderLight },
  billTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textDark, marginBottom: 16 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  billText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  billValue: { fontSize: 14, color: colors.textDark, fontWeight: '600' },
  dashedDivider: { height: 1, borderColor: colors.borderLight, borderWidth: 1, borderStyle: 'dashed', marginVertical: 12 },
  grandTotalText: { fontSize: 16, fontWeight: 'bold', color: colors.textDark },
  grandTotalValue: { fontSize: 18, fontWeight: 'bold', color: colors.textDark },
  savingsBanner: { backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8, marginTop: 16, alignItems: 'center' },
  savingsText: { color: colors.success, fontSize: 12, fontWeight: '600' },

  // Address Selection
  addressCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: colors.borderLight },
  addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addressTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textDark },
  changeText: { fontSize: 14, fontWeight: 'bold', color: colors.primary },
  stackedInput: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 10, padding: 12 },
  addressType: { fontSize: 14, fontWeight: '600', color: colors.textDark, marginBottom: 4 },
  addressText: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },

  paymentRadioRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10, padding: 12, marginTop: 10 },
  radioSelected: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  paymentText: { fontSize: 14, fontWeight: '600', color: colors.textDark },

  // Footer
  footer: { backgroundColor: colors.white, padding: 14, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingBottom: 32 },
  footerTotal: { display: 'none' },
  footerTotalLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '500', marginBottom: 2 },
  footerTotalValue: { fontSize: 18, fontWeight: 'bold', color: colors.textDark },
  checkoutButton: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  checkoutText: { color: colors.white, fontWeight: 'bold', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  // Empty State
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyEmoji: { fontSize: 80, marginBottom: 24 },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: colors.textDark, marginBottom: 12 },
  emptySubtitle: { fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  continueShoppingBtn: { backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 13, borderRadius: 10 },
  continueShoppingText: { color: '#FFF', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }
});
