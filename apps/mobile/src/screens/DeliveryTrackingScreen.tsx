import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Linking, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { HeaderCartButton } from '../components/HeaderCartButton';
import { RootState } from '../store';

import { API_BASE_URL } from '../services/api';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { setDesktopFullPageScreenActive } from '../navigation/desktopFullPageScreenStore';
import CompactBookingShell from '../components/desktop/shared/CompactBookingShell';
import MinimalFooter from '../components/desktop/shared/MinimalFooter';

const TRACKING_POLL_INTERVAL_MS = 10000;

let MapView: any = null;
let Marker: any = null;
if (Platform.OS !== 'web') {
  // Native-only -- react-native-maps has no reliable web target, mirrors the
  // guard pattern already used in services/ServiceTrackingScreen.tsx.
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
}

// Small local haversine for a client-side-only ETA estimate -- no backend
// change, no new dependency. Same approach as ServiceTrackingScreen.tsx.
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const ASSUMED_SPEED_KMH = 25;

export default function DeliveryTrackingScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const orderId = route.params?.orderId;
  const initialStatus = route.params?.status || 'PLACED';
  const { token } = useSelector((state: RootState) => state.auth);

  const [status, setStatus] = useState(initialStatus);
  const [order, setOrder] = useState<any>(null);

  // Pulse animation for active node
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { isDesktopUp } = useBreakpoint();
  useFocusEffect(
    useCallback(() => {
      if (!isDesktopUp) return;
      setDesktopFullPageScreenActive(true);
      return () => setDesktopFullPageScreenActive(false);
    }, [isDesktopUp]),
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  // MechBazar Brand Colors
  const colors = {
    primary: '#DA3830',
    secondary: '#F29F05',
    accent: '#BF3617',
    dark: '#111111',
    light: '#F8F8F8',
    white: '#FFFFFF',
    gray: '#E0E0E0',
    success: '#28A745',
  };

  // Fetches the real current order (not just status) immediately on open,
  // then polls on an interval for as long as this screen is mounted -- there's
  // no live push channel, so this is how the timeline and rider card pick up
  // status/location changes.
  useEffect(() => {
    if (!orderId || !token) return;
    let cancelled = false;

    const fetchOrder = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok && !cancelled) {
          const data = await response.json();
          setOrder(data);
          if (data?.status) setStatus(data.status);
        }
      } catch (error) {
        console.error('Failed to fetch order status', error);
      }
    };

    fetchOrder();
    const interval = setInterval(fetchOrder, TRACKING_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderId, token]);

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backIcon}>←</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Tracking Order</Text>
        <Text style={styles.headerSubtitle}>{orderId ? `#${String(orderId).slice(-8).toUpperCase()}` : ''}</Text>
      </View>
      <HeaderCartButton color="#1C1C1C" backgroundColor="rgba(0,0,0,0.05)" />
    </View>
  );

  const renderTimelineNode = (nodeStatus: string, title: string, description: string, icon: string, isLast = false) => {
    const isActive = status === nodeStatus;
    const isPast = getStatusWeight(status) > getStatusWeight(nodeStatus);

    return (
      <View style={styles.timelineNodeContainer}>
        {/* Node Icon */}
        <View style={styles.nodeColumn}>
          {isActive && (
            <Animated.View style={[
              styles.pulseRing,
              { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.5], outputRange: [0.6, 0] }) }
            ]} />
          )}
          <View style={[
            styles.nodeCircle,
            (isActive || isPast) ? { backgroundColor: colors.primary, borderColor: colors.primary } : {}
          ]}>
            <Text style={styles.nodeIcon}>{(isActive || isPast) ? '✓' : ''}</Text>
          </View>
          {!isLast && (
            <View style={[styles.nodeLine, (isActive || isPast) ? { backgroundColor: colors.primary } : {}]} />
          )}
        </View>

        {/* Node Content */}
        <View style={styles.nodeContent}>
          <Text style={styles.nodeEmoji}>{icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.nodeTitle, (isActive || isPast) ? { color: colors.dark } : {}]}>{title}</Text>
            <Text style={styles.nodeDesc}>{description}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Matches the real backend OrderStatus enum (schema.prisma) -- this
  // previously checked for RECEIVED/PROCESSING/OUT_FOR_DELIVERY, none of
  // which exist, so the timeline never highlighted correctly for a real order.
  const getStatusWeight = (s: string) => {
    switch (s) {
      case 'PLACED': return 1;
      case 'ACCEPTED': return 2;
      case 'PACKING': return 3;
      case 'PICKUP': return 4;
      case 'ON_THE_WAY': return 5;
      case 'DELIVERED': return 6;
      default: return 0;
    }
  };

  const rider = order?.deliveryPartner;
  const hasRiderLocation = rider?.currentLat != null && rider?.currentLng != null;
  const address = order?.address;
  const distanceKm =
    (status === 'PICKUP' || status === 'ON_THE_WAY') && hasRiderLocation && address?.lat != null && address?.lng != null
      ? haversineKm(rider.currentLat, rider.currentLng, address.lat, address.lng)
      : null;
  const etaMinutes = distanceKm != null ? Math.max(1, Math.round((distanceKm / ASSUMED_SPEED_KMH) * 60)) : null;

  const handleCallRider = () => {
    const phone = rider?.user?.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}

      <CompactBookingShell maxWidth={880} style={styles.flexFill}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      {rider && hasRiderLocation ? (
        MapView ? (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: rider.currentLat,
              longitude: rider.currentLng,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            region={{
              latitude: rider.currentLat,
              longitude: rider.currentLng,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
          >
            <Marker coordinate={{ latitude: rider.currentLat, longitude: rider.currentLng }} title="Your rider" />
            {address?.lat != null && address?.lng != null && (
              <Marker
                coordinate={{ latitude: address.lat, longitude: address.lng }}
                title="Delivery address"
                pinColor={colors.accent}
              />
            )}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapEmoji}>🗺️</Text>
            <Text style={styles.mapText}>Live map is available on the mobile app</Text>
          </View>
        )
      ) : (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapEmoji}>{rider ? '📍' : '🗺️'}</Text>
          <Text style={styles.mapText}>{rider ? 'Waiting for rider location...' : 'A rider will be assigned before pickup'}</Text>
        </View>
      )}

      {rider && (
        <View style={styles.riderCard}>
          <View style={styles.riderAvatar}>
            <Text style={{ fontSize: 20 }}>🛵</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.riderName}>{rider.user?.name || 'Your Rider'}</Text>
            <Text style={styles.riderMeta}>
              {[rider.vehicleType, rider.vehicleModel].filter(Boolean).join(' · ') || 'Delivery partner'}
            </Text>
            {etaMinutes != null && (
              <Text style={styles.riderMeta}>Estimated arrival: ~{etaMinutes} min · {distanceKm!.toFixed(1)} km away</Text>
            )}
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={handleCallRider}>
            <Text style={{ fontSize: 18 }}>📞</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'ON_THE_WAY' && order?.deliveryOtp && (
        <View style={styles.otpCard}>
          <Text style={styles.otpTitle}>Delivery Code</Text>
          <Text style={styles.otpCode}>{order.deliveryOtp}</Text>
          <Text style={styles.otpHint}>Share this code with your delivery partner once your order arrives to confirm delivery.</Text>
        </View>
      )}

      <View style={styles.trackingCard}>
        <Text style={styles.trackingTitle}>Delivery Status</Text>

        <View style={styles.timeline}>
          {renderTimelineNode('PLACED', 'Order Placed', 'We have received your order.', '📝')}
          {renderTimelineNode('ACCEPTED', 'Accepted', 'The seller has accepted your order.', '✅')}
          {renderTimelineNode('PACKING', 'Packing', 'Your items are being packed.', '📦')}
          {renderTimelineNode('PICKUP', 'Rider Assigned', 'A rider is heading to pick up your order.', '🛵')}
          {renderTimelineNode('ON_THE_WAY', 'Out for Delivery', 'Driver is on the way.', '🚚')}
          {renderTimelineNode('DELIVERED', 'Delivered', 'Enjoy your products!', '🎉', true)}
        </View>
      </View>

      <MinimalFooter />
      </ScrollView>
      </CompactBookingShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  flexFill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF' },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: '#1C1C1C', fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1C' },
  headerSubtitle: { fontSize: 13, color: '#777777' },

  map: { height: 220, width: '100%' },
  mapPlaceholder: { height: 200, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  mapEmoji: { fontSize: 40, marginBottom: 8 },
  mapText: { fontSize: 13, color: '#777777', fontWeight: '600', paddingHorizontal: 24, textAlign: 'center' },

  otpCard: { backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 14, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E3E6EA', alignItems: 'center' },
  otpTitle: { fontSize: 13, fontWeight: '800', color: '#1B1B1B' },
  otpCode: { fontSize: 28, fontWeight: '900', color: '#DA3830', letterSpacing: 4, marginVertical: 6 },
  otpHint: { fontSize: 12, color: '#6B7480', textAlign: 'center' },

  riderCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 16, marginTop: 14, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E3E6EA' },
  riderAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F4F6F8', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  riderName: { fontSize: 14, fontWeight: '800', color: '#1B1B1B', marginBottom: 3 },
  riderMeta: { fontSize: 12, color: '#6B7480' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F4F6F8', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  trackingCard: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, marginTop: 14, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  trackingTitle: { fontSize: 20, fontWeight: '800', color: '#111111', marginBottom: 24 },

  timeline: { paddingLeft: 8 },
  timelineNodeContainer: { flexDirection: 'row', minHeight: 80 },

  nodeColumn: { alignItems: 'center', width: 30, marginRight: 16, position: 'relative' },
  pulseRing: { position: 'absolute', top: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#DA3830', zIndex: 1 },
  nodeCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  nodeIcon: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  nodeLine: { width: 2, flex: 1, backgroundColor: '#D1D5DB', marginVertical: -2 },

  nodeContent: { flexDirection: 'row', flex: 1, paddingBottom: 32, alignItems: 'flex-start' },
  nodeEmoji: { fontSize: 24, marginRight: 16 },
  nodeTitle: { fontSize: 16, fontWeight: 'bold', color: '#9CA3AF', marginBottom: 4 },
  nodeDesc: { fontSize: 13, color: '#6B7280' }
});
