import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { HeaderCartButton } from '../components/HeaderCartButton';
import { RootState } from '../store';

const { width } = Dimensions.get('window');

import { API_BASE_URL } from '../services/api';

const TRACKING_POLL_INTERVAL_MS = 10000;

export default function DeliveryTrackingScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const orderId = route.params?.orderId;
  const initialStatus = route.params?.status || 'PLACED';
  const { token } = useSelector((state: RootState) => state.auth);

  const [status, setStatus] = useState(initialStatus);

  // Pulse animation for active node
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
    primary: '#034C8C',
    secondary: '#F29F05',
    accent: '#BF3617',
    dark: '#111111',
    light: '#F8F8F8',
    white: '#FFFFFF',
    gray: '#E0E0E0',
    success: '#28A745',
  };

  // Fetches the real current status immediately on open (instead of only
  // whatever was passed via navigation params, which can be stale), then
  // polls on an interval for as long as this screen is mounted -- there's no
  // live push channel, so this is how the timeline picks up status changes.
  useEffect(() => {
    if (!orderId || !token) return;
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok && !cancelled) {
          const order = await response.json();
          if (order?.status) setStatus(order.status);
        }
      } catch (error) {
        console.error('Failed to fetch order status', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, TRACKING_POLL_INTERVAL_MS);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      
      {/* Map Placeholder */}
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapEmoji}>🗺️</Text>
        <Text style={styles.mapText}>Map Integration Ready</Text>
      </View>

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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F8' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#FFFFFF' },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: '#1C1C1C', fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1C1C1C' },
  headerSubtitle: { fontSize: 13, color: '#777777' },

  mapPlaceholder: { height: 250, backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
  mapEmoji: { fontSize: 48, marginBottom: 8 },
  mapText: { fontSize: 16, color: '#777777', fontWeight: '600' },

  trackingCard: { flex: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, marginTop: -24, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10 },
  trackingTitle: { fontSize: 20, fontWeight: '800', color: '#111111', marginBottom: 24 },
  
  timeline: { paddingLeft: 8 },
  timelineNodeContainer: { flexDirection: 'row', minHeight: 80 },
  
  nodeColumn: { alignItems: 'center', width: 30, marginRight: 16, position: 'relative' },
  pulseRing: { position: 'absolute', top: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: '#034C8C', zIndex: 1 },
  nodeCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  nodeIcon: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
  nodeLine: { width: 2, flex: 1, backgroundColor: '#D1D5DB', marginVertical: -2 },
  
  nodeContent: { flexDirection: 'row', flex: 1, paddingBottom: 32, alignItems: 'flex-start' },
  nodeEmoji: { fontSize: 24, marginRight: 16 },
  nodeTitle: { fontSize: 16, fontWeight: 'bold', color: '#9CA3AF', marginBottom: 4 },
  nodeDesc: { fontSize: 13, color: '#6B7280' }
});
