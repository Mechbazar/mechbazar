import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Linking, Platform, Alert, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { ServiceBooking, BookingStatus } from '../../types/service';
import { fetchBookingById, cancelServiceBooking, respondToBookingApproval, fetchTechnicianPhotoDataUri, fetchBookingImageDataUri } from '../../services/service.service';
import { HeaderCartButton } from '../../components/HeaderCartButton';
import { colors } from './theme';

let MapView: any = null;
let Marker: any = null;
if (Platform.OS !== 'web') {
  // Native-only -- react-native-maps has no reliable web target, mirrors the
  // guard pattern already used for other native-only modules in this app.
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
}

type ParamList = { ServiceTracking: { bookingId: string } };
const POLL_INTERVAL_MS = 10000;
const CANCELLABLE = new Set<BookingStatus>(['PENDING', 'CONFIRMED', 'MECHANIC_ASSIGNED', 'MECHANIC_ACCEPTED']);

// PENDING and CONFIRMED collapse into a single "Booking Confirmed" step --
// the transition between them is synchronous server-side (no payment
// gateway to wait on yet), so a customer never meaningfully observes PENDING
// on its own.
const STATUS_STEPS: { statuses: BookingStatus[]; title: string; icon: string }[] = [
  { statuses: ['PENDING', 'CONFIRMED'], title: 'Booking Confirmed', icon: '📝' },
  { statuses: ['MECHANIC_ASSIGNED'], title: 'Mechanic Assigned', icon: '👨‍🔧' },
  { statuses: ['MECHANIC_ACCEPTED'], title: 'Mechanic Accepted', icon: '✅' },
  { statuses: ['MECHANIC_ON_THE_WAY'], title: 'Mechanic On The Way', icon: '🚗' },
  { statuses: ['ARRIVED'], title: 'Arrived', icon: '📍' },
  { statuses: ['WORK_STARTED'], title: 'Work Started', icon: '🛠️' },
  { statuses: ['COMPLETED'], title: 'Completed', icon: '🎉' },
];
const STATUS_WEIGHT: Record<BookingStatus, number> = {
  PENDING: 1, CONFIRMED: 1, MECHANIC_ASSIGNED: 2, MECHANIC_ACCEPTED: 3, MECHANIC_ON_THE_WAY: 4,
  ARRIVED: 5, WORK_STARTED: 6, COMPLETED: 7, CANCELLED: 0, REJECTED: 0,
};

// Small local haversine for a client-side-only ETA estimate -- no backend
// change, no new dependency. Assumes a flat urban average speed; this is
// meant as a rough "~X min away" figure, not a routed ETA.
const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const ASSUMED_SPEED_KMH = 30;

export default function ServiceTrackingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ServiceTracking'>>();
  const { bookingId } = route.params;
  const { token } = useSelector((state: RootState) => state.auth);

  const [booking, setBooking] = useState<ServiceBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [respondingApproval, setRespondingApproval] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const poll = async () => {
      const data = await fetchBookingById(token, bookingId);
      if (!cancelled && data) {
        setBooking(data);
        setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token, bookingId]);

  const technicianId = booking?.technician?.id;
  useEffect(() => {
    if (!token || !technicianId) {
      setPhotoUri(null);
      return;
    }
    let cancelled = false;
    fetchTechnicianPhotoDataUri(token, bookingId).then((uri) => {
      if (!cancelled) setPhotoUri(uri);
    });
    return () => { cancelled = true; };
  }, [token, bookingId, technicianId]);

  // Before/after service photos for the completed-booking report. Keyed on the
  // image-id list rather than the booking object -- the 10s poll replaces the
  // booking reference every tick, and these bytes should be fetched once.
  const [servicePhotos, setServicePhotos] = useState<{ id: string; type: string; uri: string }[]>([]);
  const imageIdsKey = (booking?.images || [])
    .filter((im) => im.type === 'BEFORE' || im.type === 'AFTER')
    .map((im) => im.id)
    .join(',');
  useEffect(() => {
    if (!token || !imageIdsKey) {
      setServicePhotos([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const metas = (booking?.images || []).filter((im) => im.type === 'BEFORE' || im.type === 'AFTER');
      const out: { id: string; type: string; uri: string }[] = [];
      for (const im of metas) {
        const uri = await fetchBookingImageDataUri(token, im.id);
        if (uri) out.push({ id: im.id, type: im.type, uri });
      }
      if (!cancelled) setServicePhotos(out);
    })();
    return () => { cancelled = true; };
  }, [token, imageIdsKey]);

  const handleCancel = () => {
    Alert.alert('Cancel booking', 'Are you sure you want to cancel this service booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel', style: 'destructive', onPress: async () => {
          if (!token) return;
          setCancelling(true);
          const res = await cancelServiceBooking(token, bookingId);
          setCancelling(false);
          if (!res.ok) Alert.alert('Error', res.error || 'Failed to cancel booking');
          else {
            const data = await fetchBookingById(token, bookingId);
            if (data) setBooking(data);
          }
        },
      },
    ]);
  };

  const handleApproval = async (approve: boolean) => {
    if (!token) return;
    setRespondingApproval(true);
    const res = await respondToBookingApproval(token, bookingId, approve);
    setRespondingApproval(false);
    if (!res.ok) Alert.alert('Error', res.error || 'Failed to respond');
    else {
      const data = await fetchBookingById(token, bookingId);
      if (data) setBooking(data);
    }
  };

  const handleCall = () => {
    const phone = booking?.technician?.user?.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  if (loading || !booking) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted }}>Loading booking...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const technician = booking.technician;
  const isCancelled = booking.status === 'CANCELLED';
  const isRejected = booking.status === 'REJECTED';
  const isCompleted = booking.status === 'COMPLETED';
  // Non-blocking: approvalStatus is a flag layered on top of WORK_STARTED, not
  // a status of its own -- the timeline below keeps showing normally while
  // this banner is up.
  const isWaitingApproval = booking.approvalStatus === 'PENDING';
  const currentWeight = STATUS_WEIGHT[booking.status];

  const distanceKm =
    booking.status === 'MECHANIC_ON_THE_WAY' &&
    technician?.currentLat != null && technician?.currentLng != null &&
    booking.address?.lat != null && booking.address?.lng != null
      ? haversineKm(technician.currentLat, technician.currentLng, booking.address.lat, booking.address.lng)
      : null;
  const etaMinutes = distanceKm != null ? Math.max(1, Math.round((distanceKm / ASSUMED_SPEED_KMH) * 60)) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Tracking Service</Text>
          <Text style={styles.headerSubtitle}>#{booking.bookingNumber}</Text>
        </View>
        <HeaderCartButton color="#1C1C1C" backgroundColor="rgba(0,0,0,0.05)" />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {isCancelled || isRejected ? (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledIcon}>✕</Text>
            <Text style={styles.cancelledTitle}>{isRejected ? 'Finding a New Mechanic' : 'Booking Cancelled'}</Text>
            {isRejected ? (
              <Text style={styles.cancelledReason}>Your previous mechanic became unavailable. We're assigning a new one shortly.</Text>
            ) : (
              !!booking.cancelReason && <Text style={styles.cancelledReason}>{booking.cancelReason}</Text>
            )}
          </View>
        ) : (
          <>
            {technician && technician.currentLat != null && technician.currentLng != null ? (
              MapView ? (
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: technician.currentLat,
                    longitude: technician.currentLng,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                  region={{
                    latitude: technician.currentLat,
                    longitude: technician.currentLng,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }}
                >
                  <Marker
                    coordinate={{ latitude: technician.currentLat, longitude: technician.currentLng }}
                    title="Your mechanic"
                  />
                </MapView>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <Text style={styles.mapEmoji}>🗺️</Text>
                  <Text style={styles.mapText}>Live map is available on the mobile app</Text>
                </View>
              )
            ) : (
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapEmoji}>📍</Text>
                <Text style={styles.mapText}>Waiting for mechanic location...</Text>
              </View>
            )}

            {isWaitingApproval && (
              <View style={styles.approvalCard}>
                <Text style={styles.approvalTitle}>Approval Required</Text>
                <Text style={styles.approvalNote}>{booking.approvalNote}</Text>
                <Text style={styles.approvalCost}>+ ₹{booking.additionalCost} additional work</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.approvalBtn, styles.approvalRejectBtn]}
                    disabled={respondingApproval}
                    onPress={() => handleApproval(false)}
                  >
                    <Text style={styles.approvalRejectText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.approvalBtn, styles.approvalAcceptBtn]}
                    disabled={respondingApproval}
                    onPress={() => handleApproval(true)}
                  >
                    <Text style={styles.approvalAcceptText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {technician && (
              <View style={styles.technicianCard}>
                <View style={styles.technicianAvatar}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.technicianPhoto} />
                  ) : (
                    <Text style={{ fontSize: 20 }}>👨‍🔧</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.technicianName}>{technician.user?.name || 'Your Mechanic'}</Text>
                  <Text style={styles.technicianMeta}>⭐ {technician.rating.toFixed(1)} · {technician.totalJobs} jobs</Text>
                  {etaMinutes != null && <Text style={styles.technicianMeta}>Estimated arrival: ~{etaMinutes} min · {distanceKm!.toFixed(1)} km away</Text>}
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={handleCall}>
                  <Text style={{ fontSize: 18 }}>📞</Text>
                </TouchableOpacity>
                {/* Video call removed -- it had no real video SDK behind it
                    (simulated connection + a canned diagnosis message
                    regardless of the actual booking). Call + chat below are
                    real, backend-backed contact channels. */}
                <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('ServiceChat', { bookingId })}>
                  <Text style={{ fontSize: 18 }}>💬</Text>
                </TouchableOpacity>
              </View>
            )}

            {booking.status === 'WORK_STARTED' && booking.completionOtp && (
              <View style={styles.otpCard}>
                <Text style={styles.otpTitle}>Completion Code</Text>
                <Text style={styles.otpCode}>{booking.completionOtp}</Text>
                <Text style={styles.otpHint}>Share this code with your mechanic once the work is done to confirm completion.</Text>
              </View>
            )}

            <View style={styles.trackingCard}>
              <Text style={styles.trackingTitle}>Service Status</Text>
              {STATUS_STEPS.map((s, i) => {
                const isActive = s.statuses.includes(booking.status);
                const isPast = currentWeight > STATUS_WEIGHT[s.statuses[0]];
                const isLast = i === STATUS_STEPS.length - 1;
                return (
                  <View key={s.title} style={styles.timelineNode}>
                    <View style={styles.nodeColumn}>
                      {isActive && (
                        <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }], opacity: pulseAnim.interpolate({ inputRange: [1, 1.5], outputRange: [0.6, 0] }) }]} />
                      )}
                      <View style={[styles.nodeCircle, (isActive || isPast) && styles.nodeCircleActive]}>
                        <Text style={styles.nodeIcon}>{(isActive || isPast) ? '✓' : ''}</Text>
                      </View>
                      {!isLast && <View style={[styles.nodeLine, (isActive || isPast) && styles.nodeLineActive]} />}
                    </View>
                    <View style={styles.nodeContent}>
                      <Text style={styles.nodeEmoji}>{s.icon}</Text>
                      <Text style={[styles.nodeTitle, (isActive || isPast) && styles.nodeTitleActive]}>{s.title}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {isCompleted && (
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>Service Report</Text>

            {servicePhotos.length > 0 && (
              <>
                <Text style={styles.reportSectionLabel}>Before / After Photos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {servicePhotos.map((p) => (
                    <View key={p.id} style={styles.reportPhotoWrap}>
                      <Image source={{ uri: p.uri }} style={styles.reportPhoto} />
                      <Text style={styles.reportPhotoLabel}>{p.type === 'BEFORE' ? 'Before' : 'After'}</Text>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}

            {!!booking.package?.includedServices?.length && (
              <>
                <Text style={styles.reportSectionLabel}>Services Performed</Text>
                {booking.package.includedServices.map((s) => (
                  <Text key={s} style={styles.reportListItem}>✓ {s}</Text>
                ))}
              </>
            )}

            {(!!booking.approvalNote || booking.additionalCost > 0) && (
              <>
                <Text style={styles.reportSectionLabel}>Additional Work & Mechanic Notes</Text>
                {!!booking.approvalNote && <Text style={styles.reportNote}>{booking.approvalNote}</Text>}
                {booking.additionalCost > 0 && <Text style={styles.reportNote}>Additional work charged: ₹{booking.additionalCost}</Text>}
              </>
            )}

            {booking.review && (
              <>
                <Text style={styles.reportSectionLabel}>Your Rating</Text>
                <Text style={styles.reportStars}>{'★'.repeat(booking.review.rating)}{'☆'.repeat(Math.max(0, 5 - booking.review.rating))}</Text>
                {!!booking.review.comment && <Text style={styles.reportNote}>"{booking.review.comment}"</Text>}
              </>
            )}
          </View>
        )}

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Service</Text><Text style={styles.summaryValue}>{booking.package?.name}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Vehicle</Text><Text style={styles.summaryValue}>{booking.vehicleBrand} {booking.vehicleModel}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total</Text><Text style={styles.summaryValue}>₹{booking.finalAmount}</Text></View>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {!isCancelled && !isCompleted && CANCELLABLE.has(booking.status) && (
            <TouchableOpacity style={styles.cancelBtn} disabled={cancelling} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>{cancelling ? 'Cancelling...' : 'Cancel Booking'}</Text>
            </TouchableOpacity>
          )}
          {isCompleted && (
            <>
              <TouchableOpacity style={styles.primaryActionBtn} onPress={() => navigation.navigate('ServiceInvoice', { bookingId })}>
                <Text style={styles.primaryActionText}>View Invoice</Text>
              </TouchableOpacity>
              {!booking.review && (
                <TouchableOpacity style={styles.secondaryActionBtn} onPress={() => navigation.navigate('ServiceReview', { bookingId })}>
                  <Text style={styles.secondaryActionText}>Rate & Review Mechanic</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.white },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.textDark, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  headerSubtitle: { fontSize: 13, color: colors.textMuted },

  map: { height: 220, width: '100%' },
  mapPlaceholder: { height: 180, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center' },
  mapEmoji: { fontSize: 40, marginBottom: 8 },
  mapText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },

  technicianPhoto: { width: 44, height: 44, borderRadius: 22 },

  otpCard: { backgroundColor: '#EEF2FF', margin: 14, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.primary, alignItems: 'center' },
  otpTitle: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  otpCode: { fontSize: 28, fontWeight: '900', color: colors.primary, letterSpacing: 4, marginVertical: 6 },
  otpHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },

  cancelledBanner: { alignItems: 'center', padding: 40 },
  cancelledIcon: { fontSize: 40, color: colors.danger, marginBottom: 12, fontWeight: 'bold' },
  cancelledTitle: { fontSize: 18, fontWeight: '800', color: colors.textDark, marginBottom: 8 },
  cancelledReason: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  approvalCard: { backgroundColor: '#FFF8E1', margin: 14, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.warning },
  approvalTitle: { fontSize: 15, fontWeight: '800', color: colors.textDark, marginBottom: 6 },
  approvalNote: { fontSize: 13, color: colors.textDark, marginBottom: 8, lineHeight: 18 },
  approvalCost: { fontSize: 14, fontWeight: '800', color: colors.warning },
  approvalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  approvalRejectBtn: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.danger },
  approvalRejectText: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  approvalAcceptBtn: { backgroundColor: colors.success },
  approvalAcceptText: { color: colors.white, fontWeight: '700', fontSize: 13 },

  technicianCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, marginHorizontal: 14, marginTop: 14, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.borderLight },
  technicianAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.pageBg, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  technicianName: { fontSize: 14, fontWeight: '800', color: colors.textDark, marginBottom: 3 },
  technicianMeta: { fontSize: 12, color: colors.textMuted },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.pageBg, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  trackingCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20, margin: 14 },
  trackingTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark, marginBottom: 16 },

  timelineNode: { flexDirection: 'row', minHeight: 60 },
  nodeColumn: { alignItems: 'center', width: 26, marginRight: 14, position: 'relative' },
  pulseRing: { position: 'absolute', top: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, zIndex: 1 },
  nodeCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', zIndex: 2 },
  nodeCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  nodeIcon: { color: colors.white, fontSize: 9, fontWeight: 'bold' },
  nodeLine: { width: 2, flex: 1, backgroundColor: '#D1D5DB', marginVertical: -2 },
  nodeLineActive: { backgroundColor: colors.primary },
  nodeContent: { flexDirection: 'row', flex: 1, paddingBottom: 22, alignItems: 'center' },
  nodeEmoji: { fontSize: 18, marginRight: 10 },
  nodeTitle: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  nodeTitleActive: { color: colors.textDark, fontWeight: '700' },

  reportCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginHorizontal: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight },
  reportTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark, marginBottom: 12 },
  reportSectionLabel: { fontSize: 12, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  reportPhotoWrap: { marginRight: 10, alignItems: 'center' },
  reportPhoto: { width: 110, height: 110, borderRadius: 10, backgroundColor: colors.pageBg },
  reportPhotoLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted, marginTop: 4 },
  reportListItem: { fontSize: 13, color: colors.textDark, marginBottom: 4 },
  reportNote: { fontSize: 13, color: colors.textDark, lineHeight: 19, marginBottom: 4 },
  reportStars: { fontSize: 18, color: colors.warning, marginBottom: 4 },

  summaryCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginHorizontal: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.textDark, fontWeight: '700' },

  cancelBtn: { borderWidth: 1.5, borderColor: colors.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
  primaryActionBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryActionText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  secondaryActionBtn: { borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondaryActionText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
});
