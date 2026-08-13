import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Loader } from '@mechbazar/shared';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { updateQuantity, clearCart } from '../store/cartSlice';
import { ServiceAddress } from '../types/service';
import { fetchMyAddresses } from '../services/address.service';
import { createOrder, validateCoupon as validateCouponApi } from '../services/order.service';
import { getPaymentConfig, openRazorpayCheckout, verifyRazorpayPayment } from '../services/payment.service';
import { AddressPickerSheet } from '../components/services/AddressPickerSheet';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { setPendingRedirect } from '../navigation/postLoginRedirect';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../components/desktop/shared/CompactBookingShell';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

type PaymentMethod = 'COD' | 'RAZORPAY';

export default function CartScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [couponCode, setCouponCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<ServiceAddress | null>(null);
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const cartItems = useSelector((state: RootState) => state.cart.items);
  const deliveryFee = useSelector((state: RootState) => state.cart.deliveryFee);
  const { user, token } = useSelector((state: RootState) => state.auth);
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { isDesktopUp } = useBreakpoint();
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

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

  useEffect(() => {
    // "Pay Online" only ever appears once the backend reports a configured
    // gateway -- unset Razorpay keys means this silently stays COD-only, no
    // build-time flag needed. See services/payment.service.ts on the backend.
    getPaymentConfig().then(config => setRazorpayEnabled(config.razorpayEnabled));
  }, []);

  const handleChangeAddress = () => {
    // Guest on web: AddressPickerSheet below only renders when a token
    // exists, so opening it here would be a dead click -- send them to log
    // in and back to Cart instead. Native never reaches this with !token
    // (Cart is only reachable there once logged in), so this is a no-op off web.
    if (Platform.OS === 'web' && !token) {
      setPendingRedirect({ screen: 'Cart' });
      (navigation as any).navigate('Welcome');
      return;
    }
    setShowAddressSheet(true);
  };

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalOriginalPrice = cartItems.reduce((sum, item) => sum + (item.originalPrice * item.qty), 0);
  
  const [discount, setDiscount] = useState(0);

  const grandTotal = subtotal + deliveryFee - discount;
  const totalSavings = (totalOriginalPrice - subtotal) + discount;

  const handleApplyCoupon = async () => {
    if (!couponCode || !token || isApplyingCoupon) return;
    setIsApplyingCoupon(true);
    try {
      const result = await validateCouponApi(token, couponCode, subtotal);
      if (result.ok) {
        if (result.discountType === 'percentage') {
          setDiscount((subtotal * (result.discountValue || 0)) / 100);
        } else {
          setDiscount(result.discountValue || 0);
        }
        alert(result.message || 'Coupon applied successfully');
      } else {
        setDiscount(0);
        alert(result.error || 'Invalid coupon');
      }
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleCheckout = async () => {
    // Guest on web placing an order: send to login and back to Cart instead
    // of the generic "select an address" alert below (which would just loop
    // forever since AddressPickerSheet can't open for a guest either).
    if (Platform.OS === 'web' && !token) {
      setPendingRedirect({ screen: 'Cart' });
      (navigation as any).navigate('Welcome');
      return;
    }
    if (!selectedAddress || !token) {
      alert('Please select a delivery address before checking out.');
      return;
    }
    setIsProcessing(true);
    try {
      const isB2B = user?.role === 'B2B' || user?.accountType === 'WHOLESALE' || user?.accountType === 'B2B';
      const result = await createOrder(token, {
        items: cartItems.map(item => ({ id: item.id, qty: item.qty })),
        addressId: selectedAddress.id,
        couponCode,
        isB2B,
        phone: user?.phone,
        payment_method: paymentMethod,
      });

      if (!result.ok || !result.order) {
        alert(result.error || 'Failed to place order');
        return;
      }

      dispatch(clearCart());

      // The backend only hands back a razorpayOrderId when it actually
      // created one server-side (paymentMethod resolved to RAZORPAY there
      // too) -- so this branch is unreachable in the current COD-only
      // deployment, exactly like every other Razorpay code path.
      if (result.razorpayOrderId && result.razorpayKeyId) {
        const checkoutResult = await openRazorpayCheckout({
          razorpayOrderId: result.razorpayOrderId,
          keyId: result.razorpayKeyId,
          amount: result.order.finalAmount,
          orderId: result.order.id,
          prefillPhone: user?.phone,
        });

        if (!checkoutResult.success) {
          if (checkoutResult.cancelled) {
            (navigation as any).navigate('PaymentCancelled', {
              orderId: result.order.id,
              amount: result.order.finalAmount,
              razorpayOrderId: result.razorpayOrderId,
              razorpayKeyId: result.razorpayKeyId,
            });
          } else {
            (navigation as any).navigate('PaymentFailure', { orderId: result.order.id, reason: checkoutResult.error });
          }
          return;
        }

        const verification = await verifyRazorpayPayment(token, {
          razorpay_order_id: checkoutResult.razorpay_order_id!,
          razorpay_payment_id: checkoutResult.razorpay_payment_id!,
          razorpay_signature: checkoutResult.razorpay_signature!,
        });

        if (verification.ok) {
          (navigation as any).navigate('PaymentSuccess', { orderId: result.order.id, amount: result.order.finalAmount });
        } else {
          (navigation as any).navigate('PaymentPending', { orderId: result.order.id });
        }
        return;
      }

      alert('Order placed successfully!');
      (navigation as any).navigate('MainTabs', { screen: 'Orders' });
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
      <Text style={styles.headerTitle}>{t('cart.checkout')}</Text>
    </View>
  );

  const renderDeliveryInfo = () => (
    <View style={styles.deliveryCard}>
      <View style={styles.deliveryHeader}>
        <Text style={styles.deliveryIcon}>⏱️</Text>
        <View style={styles.deliveryTextContainer}>
          <Text style={styles.deliveryTitle}>{t('cart.deliveryIn')}</Text>
          <Text style={styles.deliverySubtitle}>{t('cart.shipmentOf', { count: cartItems.length })}</Text>
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
                  <View style={[styles.b2bBadge, { backgroundColor: item.vehicleType === 'CAR' ? '#DA3830' : '#BF3617' }]}>
                    <Text style={styles.b2bText}>{item.vehicleType === 'CAR' ? t('cart.carPart') : t('cart.bikePart')}</Text>
                  </View>
                )}
                {item.isB2B && (
                  <View style={styles.b2bBadge}>
                    <Text style={styles.b2bText}>{t('cart.b2bBulk')}</Text>
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
        placeholder={t('cart.enterCouponCode')}
        value={couponCode}
        onChangeText={setCouponCode}
        placeholderTextColor={colors.textMuted}
      />
      <TouchableOpacity
        style={[styles.applyBtn, isApplyingCoupon && { opacity: 0.6 }]}
        onPress={handleApplyCoupon}
        disabled={isApplyingCoupon}
      >
        {isApplyingCoupon ? (
          <Loader size="small" color={colors.white} />
        ) : (
          <Text style={styles.applyBtnText}>{t('cart.apply')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderBillDetails = () => (
    <View style={styles.billCard}>
      <Text style={styles.billTitle}>{t('cart.billDetails')}</Text>

      <View style={styles.billRow}>
        <Text style={styles.billText}>{t('cart.itemTotal')}</Text>
        <Text style={styles.billValue}>₹{subtotal}</Text>
      </View>

      <View style={styles.billRow}>
        <Text style={styles.billText}>{t('cart.deliveryFee')}</Text>
        <Text style={styles.billValue}>₹{deliveryFee}</Text>
      </View>

      {discount > 0 && (
        <View style={styles.billRow}>
          <Text style={[styles.billText, { color: colors.success }]}>{t('cart.promoDiscount')}</Text>
          <Text style={[styles.billValue, { color: colors.success }]}>-₹{discount}</Text>
        </View>
      )}

      <View style={styles.dashedDivider} />

      <View style={styles.billRow}>
        <Text style={styles.grandTotalText}>{t('cart.grandTotal')}</Text>
        <Text style={styles.grandTotalValue}>₹{grandTotal}</Text>
      </View>

      {totalSavings > 0 && (
        <View style={styles.savingsBanner}>
          <Text style={styles.savingsText}>{t('cart.youAreSaving', { amount: totalSavings })}</Text>
        </View>
      )}
    </View>
  );

  const renderAddressSelection = () => (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <Text style={styles.addressTitle}>{t('cart.deliveryAddress')}</Text>
        <TouchableOpacity onPress={handleChangeAddress}>
          <Text style={styles.changeText}>{selectedAddress ? t('cart.change') : t('cart.select')}</Text>
        </TouchableOpacity>
      </View>
      {isLoadingAddress ? (
        <Loader size="small" />
      ) : selectedAddress ? (
        <View style={styles.stackedInput}>
          <Text style={styles.addressType}>{selectedAddress.isDefault ? '⭐ ' : '📍 '}{selectedAddress.title}</Text>
          <Text style={styles.addressText} numberOfLines={2}>
            {selectedAddress.line1}{selectedAddress.line2 ? `, ${selectedAddress.line2}` : ''}, {selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.stackedInput} onPress={handleChangeAddress}>
          <Text style={[styles.addressText, { color: colors.primary, fontWeight: '700' }]}>{t('cart.addAddressToContinue')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderPaymentOption = (method: PaymentMethod, label: string) => {
    const selected = paymentMethod === method;
    return (
      <TouchableOpacity
        style={[styles.paymentRadioRow, !selected && styles.paymentRadioRowUnselected]}
        onPress={() => setPaymentMethod(method)}
      >
        <View style={[styles.radioSelected, !selected && styles.radioUnselected]}>
          {selected && <View style={styles.radioDot} />}
        </View>
        <Text style={styles.paymentText}>{label}</Text>
      </TouchableOpacity>
    );
  };

  const renderPaymentSelection = () => (
    <View style={styles.addressCard}>
      <Text style={styles.addressTitle}>{t('cart.payment')}</Text>
      {renderPaymentOption('COD', t('cart.cashOnDelivery'))}
      {razorpayEnabled && renderPaymentOption('RAZORPAY', t('cart.payOnline'))}
    </View>
  );

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🛒</Text>
          <Text style={styles.emptyTitle}>{t('cart.emptyCart')}</Text>
          <Text style={styles.emptySubtitle}>{t('cart.emptyCartSubtitle')}</Text>
          <TouchableOpacity
            style={styles.continueShoppingBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.continueShoppingText}>{t('cart.continueShopping')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      
      <CompactBookingShell maxWidth={960} style={styles.flexFill}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {renderCartItems()}
          {renderCouponSection()}
          {renderBillDetails()}
          {renderAddressSelection()}
          {renderPaymentSelection()}
        </ScrollView>
      </CompactBookingShell>

      <View style={styles.footer}>
        <CompactBookingShell maxWidth={960}>
          <View style={styles.footerTotal}>
            <Text style={styles.footerTotalLabel}>{t('cart.totalToPay')}</Text>
            <Text style={styles.footerTotalValue}>₹{grandTotal}</Text>
          </View>
          <TouchableOpacity
            style={[styles.checkoutButton, (isProcessing || !selectedAddress) && { opacity: 0.7 }]}
            onPress={handleCheckout}
            disabled={isProcessing || !selectedAddress}
          >
            <Text style={styles.checkoutText}>
              {isProcessing ? t('cart.processing') : !selectedAddress ? t('cart.selectAnAddress') : t('cart.placeOrder', { amount: grandTotal })}
            </Text>
          </TouchableOpacity>
        </CompactBookingShell>
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

// `darkInk` is a fixed brand-dark bar (header/apply-button) that's already
// dark in light mode -- deliberately unchanged in dark mode too, unlike
// `white`, which is card backgrounds (-> `surface`, inverts) blended with
// text-on-colored-surface (stays literal white in both themes).
const LIGHT_COLORS = {
  primary: '#DA3830',
  darkInk: '#1B1B1B',
  steel: '#242C35',
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  borderLight: '#E3E6EA',
  textDark: '#1B1B1B',
  textMuted: '#6B7480',
  success: '#1E9E5A',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  darkInk: '#1B1B1B',
  steel: '#242C35',
  pageBg: '#121212',
  white: '#FFFFFF',
  surface: '#1E1E1E',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  success: '#4FE092',
};

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  flexFill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.darkInk, borderBottomWidth: 1, borderBottomColor: colors.darkInk },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.white, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  
  scrollContent: { padding: 14, paddingBottom: 40 },
  
  // Delivery Info
  deliveryCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: colors.borderLight },
  deliveryHeader: { flexDirection: 'row', alignItems: 'center' },
  deliveryIcon: { fontSize: 32, marginRight: 14 },
  deliveryTextContainer: { flex: 1 },
  deliveryTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textDark, marginBottom: 4 },
  deliverySubtitle: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },
  
  // Cart Items
  itemsCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: colors.borderLight },
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
  qtyBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: colors.borderLight, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  qtyBtnText: { color: colors.textDark, fontWeight: 'bold', fontSize: 16 },
  qtyValue: { color: colors.textDark, fontWeight: 'bold', fontSize: 14, marginHorizontal: 12 },
  divider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 12 },

  // Coupon
  couponCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight, borderStyle: 'dashed' },
  couponIcon: { fontSize: 20, marginRight: 12 },
  couponInput: { flex: 1, fontSize: 14, color: colors.textDark, fontWeight: '500' },
  applyBtn: { backgroundColor: colors.darkInk, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  applyBtnText: { color: colors.white, fontWeight: 'bold', fontSize: 12 },

  // Bill Details
  billCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: colors.borderLight },
  billTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textDark, marginBottom: 16 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  billText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  billValue: { fontSize: 14, color: colors.textDark, fontWeight: '600' },
  dashedDivider: { height: 1, borderColor: colors.borderLight, borderWidth: 1, borderStyle: 'dashed', marginVertical: 12 },
  grandTotalText: { fontSize: 16, fontWeight: 'bold', color: colors.textDark },
  grandTotalValue: { fontSize: 18, fontWeight: 'bold', color: colors.textDark },
  // Fixed light-green banner (doesn't invert with the theme) -- its text is
  // pinned to the light-mode success color too, not the dynamic one, which
  // would turn near-white in dark mode and wash out against this bg.
  savingsBanner: { backgroundColor: '#E8F5E9', padding: 10, borderRadius: 8, marginTop: 16, alignItems: 'center' },
  savingsText: { color: LIGHT_COLORS.success, fontSize: 12, fontWeight: '600' },

  // Address Selection
  addressCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: colors.borderLight },
  addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addressTitle: { fontSize: 16, fontWeight: 'bold', color: colors.textDark },
  changeText: { fontSize: 14, fontWeight: 'bold', color: colors.primary },
  stackedInput: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: 10, padding: 12 },
  addressType: { fontSize: 14, fontWeight: '600', color: colors.textDark, marginBottom: 4 },
  addressText: { fontSize: 13, color: colors.textMuted, lineHeight: 20 },

  paymentRadioRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.primary, borderRadius: 10, padding: 12, marginTop: 10 },
  paymentRadioRowUnselected: { borderColor: colors.borderLight },
  radioSelected: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  radioUnselected: { borderColor: colors.borderLight },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  paymentText: { fontSize: 14, fontWeight: '600', color: colors.textDark },

  // Footer
  footer: { backgroundColor: colors.surface, padding: 14, borderTopWidth: 1, borderTopColor: colors.borderLight, paddingBottom: 32 },
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
