import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ServiceBooking, BookingStatus } from '../../types/service';
import { cancelServiceBooking, fetchTechnicianPhotoDataUri } from '../../services/service.service';
import { colors } from '../../screens/services/theme';

// Customer-facing labels -- PENDING/CONFIRMED and ASSIGNED/ACCEPTED collapse
// into single steps for the same reason as ServiceTrackingScreen's timeline.
const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: 'Booking Confirmed',
  CONFIRMED: 'Booking Confirmed',
  MECHANIC_ASSIGNED: 'Mechanic Assigned',
  MECHANIC_ACCEPTED: 'Mechanic Assigned',
  MECHANIC_ON_THE_WAY: 'Mechanic On The Way',
  ARRIVED: 'Arrived',
  WORK_STARTED: 'Service In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Reassigning Mechanic',
};

const STATUS_STYLE: Record<BookingStatus, { bg: string; border: string; text: string }> = {
  PENDING: { bg: '#FFF8E1', border: colors.warning, text: colors.warning },
  CONFIRMED: { bg: '#FFF8E1', border: colors.warning, text: colors.warning },
  MECHANIC_ASSIGNED: { bg: '#FFF8E1', border: colors.warning, text: colors.warning },
  MECHANIC_ACCEPTED: { bg: '#FFF8E1', border: colors.warning, text: colors.warning },
  MECHANIC_ON_THE_WAY: { bg: '#EEF2FF', border: colors.primary, text: colors.primary },
  ARRIVED: { bg: '#EEF2FF', border: colors.primary, text: colors.primary },
  WORK_STARTED: { bg: '#EEF2FF', border: colors.primary, text: colors.primary },
  COMPLETED: { bg: '#F0FDF4', border: colors.success, text: colors.success },
  CANCELLED: { bg: '#FEF2F2', border: colors.danger, text: colors.danger },
  REJECTED: { bg: '#FFF8E1', border: colors.warning, text: colors.warning },
};

// Mirrors CANCELLABLE in ServiceTrackingScreen -- once the mechanic is en
// route the backend rejects customer cancellation.
const CANCELLABLE = new Set<BookingStatus>(['PENDING', 'CONFIRMED', 'MECHANIC_ASSIGNED', 'MECHANIC_ACCEPTED']);
const CLOSED = new Set<BookingStatus>(['COMPLETED', 'CANCELLED']);

// Same rough client-side ETA as ServiceTrackingScreen: haversine at an
// assumed flat urban speed, a "~X min away" figure rather than a routed ETA.
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

// The technician-photo endpoint is per-booking and auth-gated; cache the data
// URIs so scrolling the list doesn't refetch a photo per re-render.
const photoCache = new Map<string, string | null>();

interface Props {
  booking: ServiceBooking;
  token: string;
  onChanged: () => void;
}

export default function ServiceBookingCard({ booking, token, onChanged }: Props) {
  const navigation = useNavigation<any>();
  const [photoUri, setPhotoUri] = useState<string | null>(photoCache.get(booking.id) ?? null);
  const [cancelling, setCancelling] = useState(false);

  const technician = booking.technician;
  const status = booking.status;
  const badge = STATUS_STYLE[status];
  const isActive = !CLOSED.has(status) && status !== 'REJECTED';
  const canContact = isActive && !!technician;

  useEffect(() => {
    if (!technician || photoCache.has(booking.id)) return;
    let cancelled = false;
    fetchTechnicianPhotoDataUri(token, booking.id).then((uri) => {
      photoCache.set(booking.id, uri);
      if (!cancelled) setPhotoUri(uri);
    });
    return () => { cancelled = true; };
  }, [token, booking.id, technician?.id]);

  const etaKm =
    status === 'MECHANIC_ON_THE_WAY' &&
    technician?.currentLat != null && technician?.currentLng != null &&
    booking.address?.lat != null && booking.address?.lng != null
      ? haversineKm(technician.currentLat, technician.currentLng, booking.address.lat, booking.address.lng)
      : null;
  const etaMinutes = etaKm != null ? Math.max(1, Math.round((etaKm / ASSUMED_SPEED_KMH) * 60)) : null;

  const scheduled = new Date(booking.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const goTrack = () => navigation.navigate('ServiceTracking', { bookingId: booking.id });
  const goRebook = () => navigation.navigate('ServiceBooking', { packageId: booking.packageId, categoryId: booking.categoryId });

  const handleCall = () => {
    const phone = technician?.user?.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleCancel = () => {
    Alert.alert('Cancel booking', 'Are you sure you want to cancel this service booking?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel', style: 'destructive', onPress: async () => {
          setCancelling(true);
          const res = await cancelServiceBooking(token, booking.id);
          setCancelling(false);
          if (!res.ok) Alert.alert('Error', res.error || 'Failed to cancel booking');
          else onChanged();
        },
      },
    ]);
  };

  // No reschedule API exists yet, so offer the honest equivalent built from
  // real endpoints: cancel this booking, then rebook the same package at a
  // fresh date/time.
  const handleReschedule = () => {
    Alert.alert(
      'Reschedule booking',
      'To pick a new date or time, cancel this booking and book the same service again at a slot that suits you.',
      [
        { text: 'Keep Booking', style: 'cancel' },
        {
          text: 'Cancel & Rebook', style: 'destructive', onPress: async () => {
            setCancelling(true);
            const res = await cancelServiceBooking(token, booking.id, 'Rescheduled by customer');
            setCancelling(false);
            if (!res.ok) Alert.alert('Error', res.error || 'Failed to cancel booking');
            else {
              onChanged();
              goRebook();
            }
          },
        },
      ]
    );
  };

  const review = booking.review;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.bookingId}>#{booking.bookingNumber}</Text>
        <View style={[styles.badge, { backgroundColor: badge.bg, borderColor: badge.border }]}>
          <Text style={[styles.badgeText, { color: badge.text }]}>{STATUS_LABEL[status]}</Text>
        </View>
      </View>

      <Text style={styles.serviceName}>{booking.package?.name || 'Service'}</Text>
      <Text style={styles.meta}>🚗 {booking.vehicleBrand} {booking.vehicleModel}{booking.vehicleRegistrationNumber ? ` · ${booking.vehicleRegistrationNumber}` : ''}</Text>
      <Text style={styles.meta}>🗓️ {scheduled}{booking.timeSlot ? ` · ${booking.timeSlot.label}` : ''}</Text>

      {technician && (
        <View style={styles.mechanicRow}>
          <View style={styles.mechanicAvatar}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.mechanicPhoto} />
            ) : (
              <Text style={{ fontSize: 18 }}>👨‍🔧</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.mechanicName}>{technician.user?.name || 'Your Mechanic'}</Text>
            <Text style={styles.mechanicMeta}>⭐ {technician.rating.toFixed(1)} · {technician.totalJobs} jobs</Text>
          </View>
          {canContact && (
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity style={styles.iconBtn} onPress={handleCall}>
                <Text style={{ fontSize: 15 }}>📞</Text>
              </TouchableOpacity>
              {/* Video call removed -- see ServiceTrackingScreen.tsx for why. */}
              <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('ServiceChat', { bookingId: booking.id })}>
                <Text style={{ fontSize: 15 }}>💬</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {status === 'MECHANIC_ON_THE_WAY' && (
        <TouchableOpacity style={styles.liveRow} onPress={goTrack}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            Live location available{etaMinutes != null ? ` · arriving in ~${etaMinutes} min (${etaKm!.toFixed(1)} km away)` : ''}
          </Text>
          <Text style={styles.liveArrow}>›</Text>
        </TouchableOpacity>
      )}

      {status === 'WORK_STARTED' && booking.completionOtp && (
        <View style={styles.otpRow}>
          <Text style={styles.otpLabel}>Completion OTP</Text>
          <Text style={styles.otpCode}>{booking.completionOtp}</Text>
        </View>
      )}

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.amount}>₹{booking.finalAmount}</Text>
          {booking.payment && (
            <Text style={styles.paymentMeta}>{booking.payment.method} · {booking.payment.status}</Text>
          )}
        </View>
        {review && (
          <Text style={styles.ratingStars}>{'★'.repeat(review.rating)}{'☆'.repeat(Math.max(0, 5 - review.rating))}</Text>
        )}
      </View>

      <View style={styles.actionsRow}>
        {isActive && (
          <TouchableOpacity style={styles.primaryBtn} onPress={goTrack}>
            <Text style={styles.primaryBtnText}>Track Mechanic</Text>
          </TouchableOpacity>
        )}
        {!isActive && (
          <TouchableOpacity style={styles.outlineBtn} onPress={goTrack}>
            <Text style={styles.outlineBtnText}>View Details</Text>
          </TouchableOpacity>
        )}
        {status === 'COMPLETED' && (
          <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate('ServiceInvoice', { bookingId: booking.id })}>
            <Text style={styles.outlineBtnText}>Invoice</Text>
          </TouchableOpacity>
        )}
        {status === 'COMPLETED' && !review && (
          <TouchableOpacity style={styles.outlineBtn} onPress={() => navigation.navigate('ServiceReview', { bookingId: booking.id })}>
            <Text style={styles.outlineBtnText}>Rate Mechanic</Text>
          </TouchableOpacity>
        )}
        {CLOSED.has(status) && (
          <TouchableOpacity style={styles.primaryBtn} onPress={goRebook}>
            <Text style={styles.primaryBtnText}>Book Again</Text>
          </TouchableOpacity>
        )}
        {CANCELLABLE.has(status) && (
          <>
            <TouchableOpacity style={styles.outlineBtn} disabled={cancelling} onPress={handleReschedule}>
              <Text style={styles.outlineBtnText}>Reschedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerBtn} disabled={cancelling} onPress={handleCancel}>
              <Text style={styles.dangerBtnText}>{cancelling ? 'Cancelling...' : 'Cancel'}</Text>
            </TouchableOpacity>
          </>
        )}
        {isActive && (
          <TouchableOpacity style={styles.outlineBtn} onPress={goTrack}>
            <Text style={styles.outlineBtnText}>Details</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bookingId: { fontSize: 14, fontWeight: '900', color: colors.textDark },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  badgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' },
  serviceName: { fontSize: 15, fontWeight: '700', color: colors.textDark, marginBottom: 4 },
  meta: { fontSize: 12, color: colors.textMuted, marginBottom: 3 },

  mechanicRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.pageBg, borderRadius: 10, padding: 10, marginTop: 8 },
  mechanicAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', marginRight: 10, overflow: 'hidden' },
  mechanicPhoto: { width: 38, height: 38, borderRadius: 19 },
  mechanicName: { fontSize: 13, fontWeight: '800', color: colors.textDark },
  mechanicMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  iconBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', marginLeft: 6, borderWidth: 1, borderColor: colors.borderLight },

  liveRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', borderRadius: 10, padding: 10, marginTop: 8 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginRight: 8 },
  liveText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.textDark },
  liveArrow: { fontSize: 18, color: colors.textMuted, marginLeft: 4 },

  otpRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EEF2FF', borderRadius: 10, padding: 10, marginTop: 8, borderWidth: 1, borderColor: colors.primary },
  otpLabel: { fontSize: 12, fontWeight: '700', color: colors.textDark },
  otpCode: { fontSize: 18, fontWeight: '900', color: colors.primary, letterSpacing: 3 },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  amount: { fontSize: 16, fontWeight: '900', color: colors.textDark },
  paymentMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  ratingStars: { fontSize: 14, color: colors.warning, fontWeight: '700' },

  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  primaryBtnText: { color: colors.white, fontSize: 12, fontWeight: 'bold' },
  outlineBtn: { borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  outlineBtnText: { color: colors.primary, fontSize: 12, fontWeight: 'bold' },
  dangerBtn: { borderWidth: 1.5, borderColor: colors.danger, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  dangerBtnText: { color: colors.danger, fontSize: 12, fontWeight: 'bold' },
});
