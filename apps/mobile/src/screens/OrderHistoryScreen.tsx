import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Image, Alert, RefreshControl, Platform } from 'react-native';
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
import { useStableIsDesktopUp } from '../hooks/useStableIsDesktopUp';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../components/desktop/shared/MinimalFooter';
import { useIsDarkMode } from '../theme/useThemeColors';
import { useTranslation } from 'react-i18next';
import { notify, confirm } from '../utils/notify';

type OrdersTab = 'products' | 'services';

const resolveImageUrl = (image?: string | null) => {
  if (!image) return null;
  return image.startsWith('/') ? `${SERVER_ORIGIN}${image}` : image;
};

// MechBazar Brand Colors (New Design System)
// `header`/`tabsRow` render a permanently-dark branded bar (unchanged across
// themes -- see styles below), so darkInk/steel/white are kept fixed since
// nothing dynamic sits on top of them. `surface` is a NEW key split out from
// `white`: `white` stays literal FFFFFF (button/badge text on fixed-color
// surfaces), `surface` is the card background that actually inverts.
// `danger`/`inset` are NEW keys lifted out of hardcoded literals ('#DC2626',
// '#F9FAFB') that were previously untethered to the colors object.
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
  warning: '#F5A300',
  danger: '#DC2626',
  inset: '#F9FAFB',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  darkInk: '#F1F2F4',
  steel: '#242C35',
  pageBg: '#121212',
  white: '#FFFFFF',
  surface: '#1E1E1E',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  success: '#4FE092',
  warning: '#F5B94D',
  danger: '#FF6B6B',
  inset: '#181818',
};

export default function OrderHistoryScreen() {
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const { token } = useSelector((state: RootState) => state.auth);

  const [tab, setTab] = useState<OrdersTab>('products');

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  const isDesktopUp = useStableIsDesktopUp();
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
        <Text style={styles.headerTitle}>{t('orderHistory.myOrders')}</Text>
        <Text style={styles.headerSubtitle}>{tab === 'products' ? t('orderHistory.trackAndViewPastPurchases') : t('orderHistory.doorstepServiceBookings')}</Text>
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
        <Text style={[styles.tabText, tab === 'products' && styles.tabTextActive]}>{t('orderHistory.productOrders')}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tabBtn, tab === 'services' && styles.tabBtnActive]}
        onPress={() => setTab('services')}
      >
        <Text style={[styles.tabText, tab === 'services' && styles.tabTextActive]}>{t('orderHistory.serviceBookings')}</Text>
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
        return <View style={[styles.badge, { backgroundColor: '#FFFDF9', borderColor: colors.warning }]}><Text style={[styles.badgeText, { color: colors.warning }]}>{t('orderHistory.statusProcessing')}</Text></View>;
      case 'PICKUP':
        return <View style={[styles.badge, { backgroundColor: '#FFFDF9', borderColor: colors.warning }]}><Text style={[styles.badgeText, { color: colors.warning }]}>{t('orderHistory.statusRiderAssigned')}</Text></View>;
      case 'ON_THE_WAY':
        return <View style={[styles.badge, { backgroundColor: '#FFFDF9', borderColor: colors.warning }]}><Text style={[styles.badgeText, { color: colors.warning }]}>{t('orderHistory.statusOutForDelivery')}</Text></View>;
      case 'DELIVERED':
        return <View style={[styles.badge, { backgroundColor: '#F0FDF4', borderColor: colors.success }]}><Text style={[styles.badgeText, { color: colors.success }]}>{t('orderHistory.statusCompleted')}</Text></View>;
      case 'CANCELLED':
      case 'RETURNED':
        return <View style={[styles.badge, { backgroundColor: '#FEF2F2', borderColor: colors.danger }]}><Text style={[styles.badgeText, { color: colors.danger }]}>{status}</Text></View>;
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
    // Alert.alert(...) is a no-op stub on react-native-web (see utils/notify.ts),
    // so this whole confirm→cancel→error flow was silently dead on web. The
    // Platform.OS branches below keep native's Alert.alert calls byte-identical
    // and only add a working web path via notify()/confirm() (real
    // window.confirm/window.alert).
    const performCancel = async () => {
      setCancellingId(orderId);
      try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token || ''}` },
        });
        const data = await response.json();
        if (!response.ok) {
          const message = data.error || 'This order can no longer be cancelled. Please contact support.';
          if (Platform.OS === 'web') {
            confirm('Cannot Cancel', message, () => (navigation as any).navigate('HelpCenter'), 'Get Help');
          } else {
            Alert.alert('Cannot Cancel', message, [
              { text: 'Close', style: 'cancel' },
              { text: 'Get Help', onPress: () => (navigation as any).navigate('HelpCenter') },
            ]);
          }
          return;
        }
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: data.status } : o)));
      } catch (error) {
        console.error('Failed to cancel order', error);
        notify('Error', 'Could not reach the server. Please try again.');
      } finally {
        setCancellingId(null);
      }
    };

    if (Platform.OS === 'web') {
      confirm(
        'Cancel order',
        'Are you sure you want to cancel this order? This cannot be undone.',
        performCancel,
        'Cancel Order'
      );
      return;
    }
    Alert.alert(
      'Cancel order',
      'Are you sure you want to cancel this order? This cannot be undone.',
      [
        { text: 'Keep Order', style: 'cancel' },
        { text: 'Cancel Order', style: 'destructive', onPress: performCancel },
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
              {firstProduct?.name || t('orderHistory.itemsCountLabel', { count: itemCount })}{moreCount > 0 ? t('orderHistory.moreCount', { count: moreCount }) : ''}
            </Text>
            <Text style={styles.orderDate}>{new Date(item.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' })} · {t('orderHistory.itemsCountLabel', { count: itemCount })}</Text>
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
                <Text style={styles.detailsItemName} numberOfLines={1}>{oi.product?.name || t('orderHistory.item')} × {oi.quantity}</Text>
                <Text style={styles.detailsItemPrice}>₹{oi.price * oi.quantity}</Text>
              </View>
            ))}
            <View style={styles.detailsDivider} />
            <View style={styles.detailsRow}><Text style={styles.detailsLabel}>{t('orderHistory.subtotal')}</Text><Text style={styles.detailsValue}>₹{item.totalAmount}</Text></View>
            {!!item.discountAmount && (
              <View style={styles.detailsRow}><Text style={styles.detailsLabel}>{t('orderHistory.discount')}</Text><Text style={styles.detailsValue}>-₹{item.discountAmount}</Text></View>
            )}
            <View style={styles.detailsRow}><Text style={styles.detailsLabel}>{t('orderHistory.delivery')}</Text><Text style={styles.detailsValue}>₹{item.deliveryFee ?? 0}</Text></View>
            <View style={styles.detailsRow}><Text style={[styles.detailsLabel, { fontWeight: '900', color: colors.textDark }]}>{t('orderHistory.total')}</Text><Text style={[styles.detailsValue, { fontWeight: '900' }]}>₹{item.finalAmount}</Text></View>
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
            <Text style={styles.primaryBtnText}>{t('orderHistory.trackOrder')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => setExpandedOrderId(expanded ? null : item.id)}>
            <Text style={styles.outlineBtnText}>{expanded ? t('orderHistory.hideDetails') : t('orderHistory.viewDetails')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => (navigation as any).navigate('OrderInvoice', { order: item })}>
            <Text style={styles.outlineBtnText}>{t('orderHistory.invoice')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.outlineBtn} onPress={() => handleBuyAgain(item)}>
            <Text style={styles.outlineBtnText}>{t('orderHistory.buyAgain')}</Text>
          </TouchableOpacity>
          {cancellable && (
            <TouchableOpacity
              style={[styles.dangerBtn, cancellingId === item.id && { opacity: 0.6 }]}
              disabled={cancellingId === item.id}
              onPress={() => handleCancelOrder(item.id)}
            >
              <Text style={styles.dangerBtnText}>{cancellingId === item.id ? t('orderHistory.cancelling') : t('orderHistory.cancel')}</Text>
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
      <Text style={styles.emptyTitle}>{t('orderHistory.noServiceBookingsYet')}</Text>
      <Text style={styles.emptySubtitle}>{t('orderHistory.bookDoorstepServiceMsg')}</Text>
      <TouchableOpacity style={styles.emptyPrimaryBtn} onPress={() => (navigation as any).navigate('Services')}>
        <Text style={styles.emptyPrimaryBtnText}>{t('orderHistory.bookAService')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.emptyOutlineBtn} onPress={() => (navigation as any).navigate('Services')}>
        <Text style={styles.emptyOutlineBtnText}>{t('orderHistory.exploreServices')}</Text>
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
          <Text style={{ fontSize: 16, color: colors.textMuted }}>{t('orderHistory.noOrdersYet')}</Text>
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

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  flexFill: { flex: 1 },
  // header/tabsRow are a permanently-dark branded bar -- it does not invert
  // with the theme, so its background and the white/muted text sitting on it
  // stay fixed literals in both light and dark mode (landmine check: nothing
  // here reads from `colors` except tabBtnActive's brand red, which is safe
  // since white text on primary red stays legible whether primary is the
  // light or dark shade).
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#1B1B1B' },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: '#FFFFFF', fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: '#6B7480', marginTop: 2 },

  tabsRow: { flexDirection: 'row', backgroundColor: '#1B1B1B', paddingHorizontal: 14, paddingBottom: 12, gap: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: { color: '#9AA5B1', fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },

  listContent: { padding: 14 },

  orderCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: colors.borderLight },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  orderId: { fontSize: 16, fontWeight: '900', color: colors.textDark },
  orderDate: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  orderTotal: { fontSize: 16, fontWeight: '900', color: colors.textDark, marginLeft: 8 },
  paymentMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  productRow: { flexDirection: 'row', alignItems: 'center' },
  productThumbWrap: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.pageBg, justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' },
  productThumb: { width: 52, height: 52, borderRadius: 10 },
  productName: { fontSize: 14, fontWeight: '700', color: colors.textDark },

  detailsBox: { backgroundColor: colors.inset, borderRadius: 10, padding: 12, marginTop: 12 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  detailsItemName: { flex: 1, fontSize: 12, color: colors.textDark, marginRight: 8 },
  detailsItemPrice: { fontSize: 12, fontWeight: '700', color: colors.textDark },
  detailsDivider: { height: 1, backgroundColor: colors.borderLight, marginVertical: 8 },
  detailsLabel: { fontSize: 12, color: colors.textMuted },
  detailsValue: { fontSize: 12, fontWeight: '700', color: colors.textDark },
  detailsAddress: { fontSize: 12, color: colors.textMuted, marginTop: 8 },

  // Status badge backgrounds ('#FFFDF9'/'#F0FDF4'/'#FEF2F2', set inline in
  // getStatusBadge) are deliberately left as fixed light pastel chips in both
  // themes -- decorative accents, same as HomeScreen's offer cards. Their
  // border/text colors (colors.warning/success/danger) DO invert, which stays
  // legible against the fixed pastel since none of those shades approach
  // white.
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  outlineBtn: { borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  outlineBtnText: { color: colors.primary, fontSize: 12, fontWeight: 'bold' },
  dangerBtn: { borderWidth: 1.5, borderColor: colors.danger, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  dangerBtnText: { color: colors.danger, fontSize: 12, fontWeight: 'bold' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyArt: { alignItems: 'center', marginBottom: 18 },
  emptyArtEmoji: { fontSize: 64 },
  emptyArtEmojiSmall: { fontSize: 20, marginTop: 6, letterSpacing: 2 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.textDark, marginBottom: 8 },
  emptySubtitle: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 22 },
  emptyPrimaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12, marginBottom: 10, minWidth: 220, alignItems: 'center' },
  emptyPrimaryBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  emptyOutlineBtn: { borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 12, minWidth: 220, alignItems: 'center' },
  emptyOutlineBtnText: { color: colors.primary, fontSize: 14, fontWeight: '800' },
});
