import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Image, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { HeaderCartButton } from '../components/HeaderCartButton';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { API_BASE_URL, SERVER_ORIGIN } from '../services/api';
import { addToCart } from '../store/cartSlice';
import { ServiceBooking } from '../types/service';
import { fetchMyBookings } from '../services/service.service';
import ServiceBookingCard from '../components/services/ServiceBookingCard';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../components/desktop/shared/MinimalFooter';

type OrdersTab = 'products' | 'services';

const resolveImageUrl = (image?: string | null) => {
  if (!image) return null;
  return image.startsWith('/') ? `${SERVER_ORIGIN}${image}` : image;
};

export default function OrderHistoryScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { token } = useSelector((state: RootState) => state.auth);

  const [tab, setTab] = useState<OrdersTab>('products');

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  // MechBazar Brand Colors (New Design System)
  const colors = {
    primary: '#DA3830',
    darkInk: '#1B1B1B',
    steel: '#242C35',
    pageBg: '#F8F9FA',
    white: '#FFFFFF',
    borderLight: '#E3E6EA',
    textDark: '#1B1B1B',
    textMuted: '#6B7480',
    success: '#1E9E5A',
    warning: '#F5A300'
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders/my-orders`, {
        headers: { 'Authorization': `Bearer ${token || ''}` }
      });
      const data = await response.json();
      if (response.ok) {
        setOrders(data);
      }
    } catch (error) {
      console.error('Failed to fetch orders', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = useCallback(async () => {
    if (!token) {
      setBookingsLoading(false);
      return;
    }
    const data = await fetchMyBookings(token);
    setBookings(data);
    setBookingsLoading(false);
  }, [token]);

  useFocusEffect(useCallback(() => {
    fetchOrders();
    fetchBookings();
  }, [token]));

  const { isDesktopUp } = useBreakpoint();
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchOrders(), fetchBookings()]);
    setRefreshing(false);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSubtitle}>{tab === 'products' ? 'Track and view past purchases' : 'Doorstep service bookings'}</Text>
      </View>
      <HeaderCartButton color="#FFFFFF" backgroundColor="rgba(255,255,255,0.15)" />
    </View>
  );

  const renderTabs = () => (
    <View style={styles.tabsRow}>
      <TouchableOpacity
        style={[styles.tabBtn, tab === 'products' && styles.tabBtnActive]}
        onPress={() => setTab('products')}
      >
        <Text style={[styles.tabText, tab === 'products' && styles.tabTextActive]}>🛒 Product Orders</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabBtn, tab === 'services' && styles.tabBtnActive]}
        onPress={() => setTab('services')}
      >
        <Text style={[styles.tabText, tab === 'services' && styles.tabTextActive]}>🛠️ Service Bookings</Text>
      </TouchableOpacity>
    </View>
  );

  // Matches the real backend OrderStatus enum (schema.prisma) -- this used to
  // check for RECEIVED/OUT_FOR_DELIVERY, neither of which exist, so every
  // real in-progress order (PLACED/ACCEPTED/PACKING/PICKUP/ON_THE_WAY) fell
  // through to the default case and showed its raw enum value instead of a
  // readable label (same class of bug already fixed in
  // DeliveryTrackingScreen's getStatusWeight).
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PLACED':
      case 'ACCEPTED':
      case 'PACKING':
        return <View style={[styles.badge, { backgroundColor: '#FFFDF9', borderColor: colors.warning }]}><Text style={[styles.badgeText, { color: colors.warning }]}>PROCESSING</Text></View>;
      case 'PICKUP':
        return <View style={[styles.badge, { backgroundColor: '#FFFDF9', borderColor: colors.warning }]}><Text style={[styles.badgeText, { color: colors.warning }]}>RIDER ASSIGNED</Text></View>;
      case 'ON_THE_WAY':
        return <View style={[styles.badge, { backgroundColor: '#FFFDF9', borderColor: colors.warning }]}><Text style={[styles.badgeText, { color: colors.warning }]}>OUT FOR DELIVERY</Text></View>;
      case 'DELIVERED':
        return <View style={[styles.badge, { backgroundColor: '#F0FDF4', borderColor: colors.success }]}><Text style={[styles.badgeText, { color: colors.success }]}>COMPLETED</Text></View>;
      case 'CANCELLED':
      case 'RETURNED':
        return <View style={[styles.badge, { backgroundColor: '#FEF2F2', borderColor: '#DC2626' }]}><Text style={[styles.badgeText, { color: '#DC2626' }]}>{status}</Text></View>;
      default:
        return <View style={[styles.badge, { backgroundColor: '#FFFDF9', borderColor: colors.warning }]}><Text style={[styles.badgeText, { color: colors.warning }]}>{status?.toUpperCase() || 'PROCESSING'}</Text></View>;
    }
  };

  const handleBuyAgain = (order: any) => {
    const items = order.items || [];
    if (items.length === 0) return;
    items.forEach((oi: any) => {
      const p = oi.product;
      if (!p) return;
      dispatch(addToCart({
        id: p.id,
        name: p.name,
        price: p.discountPrice ?? p.price,
        originalPrice: p.mrp ?? p.price,
        image: resolveImageUrl(p.images?.[0]) || '',
        isB2B: false,
        vehicleType: p.vehicleType,
      }));
    });
    (navigation as any).navigate('Cart');
  };

  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancelOrder = (orderId: string) => {
    Alert.alert(
      'Cancel order',
      'Are you sure you want to cancel this order? This cannot be undone.',
      [
        { text: 'Keep Order', style: 'cancel' },
        {
          text: 'Cancel Order',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(orderId);
            try {
              const response = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token || ''}` },
              });
              const data = await response.json();
              if (!response.ok) {
                Alert.alert(
                  'Cannot Cancel',
                  data.error || 'This order can no longer be cancelled. Please contact support.',
                  [
                    { text: 'Close', style: 'cancel' },
                    { text: 'Get Help', onPress: () => (navigation as any).navigate('HelpCenter') },
                  ]
                );
                return;
              }
              setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: data.status } : o)));
            } catch (error) {
              console.error('Failed to cancel order', error);
              Alert.alert('Error', 'Could not reach the server. Please try again.');
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const itemCount = item.items?.reduce((acc: number, curr: any) => acc + curr.quantity, 0) || 0;
    const firstProduct = item.items?.[0]?.product;
    const productImage = resolveImageUrl(firstProduct?.images?.[0]);
    const moreCount = (item.items?.length || 0) - 1;
    const expanded = expandedOrderId === item.id;
    const cancellable = item.status === 'PLACED' || item.status === 'ACCEPTED' || item.status === 'PACKING';

    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>#{item.id.split('-')[0].toUpperCase()}</Text>
          {getStatusBadge(item.status)}
        </View>

        <View style={styles.productRow}>
          <View style={styles.productThumbWrap}>
            {productImage ? (
              <Image source={{ uri: productImage }} style={styles.productThumb} />
            ) : (
              <Text style={{ fontSize: 22 }}>📦</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.productName} numberOfLines={2}>
              {firstProduct?.name || `${itemCount} items`}{moreCount > 0 ? `  +${moreCount} more` : ''}
            </Text>
            <Text style={styles.orderDate}>{new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })} · {itemCount} items</Text>
            {item.payment && (
              <Text style={styles.paymentMeta}>{item.payment.method} · {item.payment.status}</Text>
            )}
          </View>
          <Text style={styles.orderTotal}>₹{item.finalAmount}</Text>
        </View>

        {expanded && (
          <View style={styles.detailsBox}>
            {(item.items || []).map((oi: any) => (
              <View key={oi.id} style={styles.detailsRow}>
                <Text style={styles.detailsItemName} numberOfLines={1}>{oi.product?.name || 'Item'} × {oi.quantity}</Text>
                <Text style={styles.detailsItemPrice}>₹{oi.price * oi.quantity}</Text>
              </View>
            ))}
            <View style={styles.detailsDivider} />
            <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Subtotal</Text><Text style={styles.detailsValue}>₹{item.totalAmount}</Text></View>
            {!!item.discountAmount && (
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Discount</Text><Text style={styles.detailsValue}>-₹{item.discountAmount}</Text></View>
            )}
            <View style={styles.detailsRow}><Text style={styles.detailsLabel}>Delivery</Text><Text style={styles.detailsValue}>₹{item.deliveryFee ?? 0}</Text></View>
            <View style={styles.detailsRow}><Text style={[styles.detailsLabel, { fontWeight: '900', color: colors.textDark }]}>Total</Text><Text style={[styles.detailsValue, { fontWeight: '900' }]}>₹{item.finalAmount}</Text></View>
            {item.address && (
              <Text style={styles.detailsAddress}>📍 {item.address.line1}, {item.address.city} {item.address.pincode}</Text>
            )}
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => (navigation as any).navigate('DeliveryTracking', { orderId: item.id, status: item.status })}
          >
            <Text style={styles.primaryBtnText}>Track Order</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => setExpandedOrderId(expanded ? null : item.id)}>
            <Text style={styles.outlineBtnText}>{expanded ? 'Hide Details' : 'View Details'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => (navigation as any).navigate('OrderInvoice', { order: item })}>
            <Text style={styles.outlineBtnText}>Invoice</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => handleBuyAgain(item)}>
            <Text style={styles.outlineBtnText}>Buy Again</Text>
          </TouchableOpacity>
          {cancellable && (
            <TouchableOpacity
              style={[styles.dangerBtn, cancellingId === item.id && { opacity: 0.6 }]}
              disabled={cancellingId === item.id}
              onPress={() => handleCancelOrder(item.id)}
            >
              <Text style={styles.dangerBtnText}>{cancellingId === item.id ? 'Cancelling…' : 'Cancel'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderServicesEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyArt}>
        <Text style={styles.emptyArtEmoji}>🧰</Text>
        <Text style={styles.emptyArtEmojiSmall}>🔧  🚗  🛞</Text>
      </View>
      <Text style={styles.emptyTitle}>No service bookings yet</Text>
      <Text style={styles.emptySubtitle}>Book a doorstep service and our mechanic will come to you.</Text>
      <TouchableOpacity style={styles.emptyPrimaryBtn} onPress={() => (navigation as any).navigate('Services')}>
        <Text style={styles.emptyPrimaryBtnText}>Book a Service</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.emptyOutlineBtn} onPress={() => (navigation as any).navigate('Services')}>
        <Text style={styles.emptyOutlineBtnText}>Explore Services</Text>
      </TouchableOpacity>
    </View>
  );

  const renderProductsTab = () => {
    if (loading) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    if (orders.length === 0) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 16, color: '#777' }}>You have no orders yet.</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      />
    );
  };

  const renderServicesTab = () => {
    if (bookingsLoading) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    if (bookings.length === 0) {
      return renderServicesEmpty();
    }
    return (
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ServiceBookingCard booking={item} token={token || ''} onChanged={fetchBookings} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {renderTabs()}
      <CompactBookingShell maxWidth={960} style={styles.flexFill}>
        {tab === 'products' ? renderProductsTab() : renderServicesTab()}
      </CompactBookingShell>
      <CompactBookingShell maxWidth={960}>
        <MinimalFooter />
      </CompactBookingShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  flexFill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#1B1B1B' },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: '#FFFFFF', fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: '#6B7480', marginTop: 2 },

  tabsRow: { flexDirection: 'row', backgroundColor: '#1B1B1B', paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  tabBtnActive: { backgroundColor: '#DA3830' },
  tabText: { color: '#9AA5B1', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },

  listContent: { padding: 14 },

  orderCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#E3E6EA' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderId: { fontSize: 16, fontWeight: '900', color: '#1B1B1B' },
  orderDate: { fontSize: 12, color: '#6B7480', marginTop: 3 },
  orderTotal: { fontSize: 16, fontWeight: '900', color: '#1B1B1B', marginLeft: 8 },
  paymentMeta: { fontSize: 11, color: '#6B7480', marginTop: 2 },

  productRow: { flexDirection: 'row', alignItems: 'center' },
  productThumbWrap: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  productThumb: { width: 52, height: 52, borderRadius: 10 },
  productName: { fontSize: 14, fontWeight: '700', color: '#1B1B1B' },

  detailsBox: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginTop: 12 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailsItemName: { flex: 1, fontSize: 12, color: '#1B1B1B', marginRight: 8 },
  detailsItemPrice: { fontSize: 12, fontWeight: '700', color: '#1B1B1B' },
  detailsDivider: { height: 1, backgroundColor: '#E3E6EA', marginVertical: 8 },
  detailsLabel: { fontSize: 12, color: '#6B7480' },
  detailsValue: { fontSize: 12, fontWeight: '700', color: '#1B1B1B' },
  detailsAddress: { fontSize: 12, color: '#6B7480', marginTop: 8 },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  primaryBtn: { backgroundColor: '#DA3830', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  outlineBtn: { borderWidth: 1.5, borderColor: '#DA3830', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  outlineBtnText: { color: '#DA3830', fontSize: 12, fontWeight: 'bold' },
  dangerBtn: { borderWidth: 1.5, borderColor: '#DC2626', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  dangerBtnText: { color: '#DC2626', fontSize: 12, fontWeight: 'bold' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyArt: { alignItems: 'center', marginBottom: 18 },
  emptyArtEmoji: { fontSize: 64 },
  emptyArtEmojiSmall: { fontSize: 20, marginTop: 6, letterSpacing: 2 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1B1B1B', marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: '#6B7480', textAlign: 'center', marginBottom: 22 },
  emptyPrimaryBtn: { backgroundColor: '#DA3830', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12, marginBottom: 10, minWidth: 220, alignItems: 'center' },
  emptyPrimaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  emptyOutlineBtn: { borderWidth: 1.5, borderColor: '#DA3830', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12, minWidth: 220, alignItems: 'center' },
  emptyOutlineBtnText: { color: '#DA3830', fontSize: 14, fontWeight: '800' },
});
