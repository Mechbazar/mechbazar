import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Alert, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  jobService, Job, getSocket, subscribeToJob, SERVER_EVENTS,
  JobStatusEvent, JobLocationEvent, JobEtaEvent, JobDispatchEvent, NotificationEvent,
} from '@mechbazar/shared';
import LiveTrackingMap from '../../components/shared/maps/LiveTrackingMap';
import { colors } from './theme';

// Live emergency job tracking. Distinct from ServiceTrackingScreen (the
// scheduled-booking tracker, which polls every 10s and has no dispatch phase)
// because this screen has a whole phase -- SEARCHING -- that scheduled
// bookings never enter, and because "instant" only feels instant if updates
// arrive over the socket rather than on the next poll tick.
//
// The socket is the primary channel; a 20s poll is kept underneath purely as
// a safety net for a dropped connection (background app, dead Wi-Fi) so the
// screen can never get permanently stuck showing a stale status.

type ParamList = { EmergencyTracking: { bookingId: string } };
const POLL_FALLBACK_MS = 20000;

const STATUS_STEPS: { statuses: string[]; title: string; icon: string }[] = [
  { statuses: ['PENDING', 'CONFIRMED', 'SEARCHING'], title: 'Searching...', icon: '🔍' },
  { statuses: ['MECHANIC_ASSIGNED'], title: 'Mechanic Found', icon: '👨‍🔧' },
  { statuses: ['MECHANIC_ACCEPTED'], title: 'Mechanic Accepted', icon: '✅' },
  { statuses: ['MECHANIC_ON_THE_WAY'], title: 'Mechanic En Route', icon: '🚗' },
  { statuses: ['ARRIVED'], title: 'Mechanic Arrived', icon: '📍' },
  { statuses: ['WORK_STARTED'], title: 'Work Started', icon: '🛠️' },
  { statuses: ['COMPLETED'], title: 'Work Completed', icon: '🎉' },
];
const STATUS_WEIGHT: Record<string, number> = {
  PENDING: 1, CONFIRMED: 1, SEARCHING: 1, MECHANIC_ASSIGNED: 2, MECHANIC_ACCEPTED: 3,
  MECHANIC_ON_THE_WAY: 4, ARRIVED: 5, WORK_STARTED: 6, COMPLETED: 7,
  CANCELLED: 0, REJECTED: 0, NO_MECHANIC_FOUND: 0,
};

function formatEta(seconds: number | null): string {
  if (seconds == null) return '';
  const m = Math.round(seconds / 60);
  return m <= 1 ? '< 1 min' : `${m} min`;
}

export default function EmergencyTrackingScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'EmergencyTracking'>>();
  const { bookingId } = route.params;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveMechanic, setLiveMechanic] = useState<{ lat: number; lng: number } | null>(null);
  const [dispatchProgress, setDispatchProgress] = useState<JobDispatchEvent | null>(null);
  const [otp, setOtp] = useState<{ purpose: 'START' | 'COMPLETION'; code: string; expiresAt: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [callMessage, setCallMessage] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const refresh = useCallback(async () => {
    const data = await jobService.getJob(bookingId);
    if (data) setJob(data);
    setLoading(false);
  }, [bookingId]);

  // Fetches (or auto-issues) the OTP for the current status, so the card is
  // never empty at the moment the customer actually needs to read it aloud.
  const loadOtp = useCallback(async (purpose: 'START' | 'COMPLETION') => {
    const res = await jobService.getOtp(bookingId, purpose);
    // Narrow on 'expiresAt' rather than 'code' -- ApiErrorShape also carries an
    // optional `code` field (an error code like 'NOT_YET'), so checking for
    // 'code' alone would misidentify an error response as a successful one.
    if ('expiresAt' in res) setOtp({ purpose, code: res.code, expiresAt: res.expiresAt });
  }, [bookingId]);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, POLL_FALLBACK_MS);
    return () => clearInterval(poll);
  }, [refresh]);

  // When the job crosses into ARRIVED, the start code exists; into
  // WORK_STARTED, the previous (start) code is spent and a completion code
  // will exist once the mechanic requests it. Cleared otherwise so a stale
  // code from an earlier phase can never linger on screen.
  useEffect(() => {
    if (!job) return;
    if (job.status === 'ARRIVED') loadOtp('START');
    else if (job.status !== 'WORK_STARTED') setOtp(null);
  }, [job?.status, loadOtp]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    (async () => {
      const socket = await getSocket();
      unsubscribe = await subscribeToJob(bookingId);
      if (!mounted) return;

      const onStatus = (payload: JobStatusEvent) => {
        if (payload.bookingId !== bookingId) return;
        setJob((prev) => (prev ? { ...prev, status: payload.status, statusMessage: payload.message } as Job : prev));
        setDispatchProgress(null);
        // A fresh technician object only exists on the full job payload
        // (this event is deliberately thin) -- refetch once per real
        // transition rather than on every high-frequency location tick.
        refresh();
      };
      const onLocation = (payload: JobLocationEvent) => {
        if (payload.bookingId !== bookingId) return;
        setLiveMechanic({ lat: payload.lat, lng: payload.lng });
      };
      const onEta = (payload: JobEtaEvent) => {
        if (payload.bookingId !== bookingId) return;
        setJob((prev) =>
          prev
            ? {
                ...prev,
                tracking: {
                  ...prev.tracking,
                  etaSeconds: payload.etaSeconds,
                  distanceRemainingM: payload.distanceRemainingM,
                  routePolyline: payload.routePolyline,
                },
              }
            : prev
        );
      };
      const onDispatch = (payload: JobDispatchEvent) => {
        if (payload.bookingId !== bookingId) return;
        setDispatchProgress(payload);
      };
      const onNotification = (payload: NotificationEvent) => {
        const data = payload.data as { bookingId?: string; otp?: string; purpose?: string } | null;
        if (data?.bookingId !== bookingId || !data?.otp) return;
        setOtp({
          purpose: (data.purpose as 'START' | 'COMPLETION') || 'START',
          code: data.otp,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        });
      };

      socket.on(SERVER_EVENTS.JOB_STATUS, onStatus);
      socket.on(SERVER_EVENTS.JOB_LOCATION, onLocation);
      socket.on(SERVER_EVENTS.JOB_ETA, onEta);
      socket.on(SERVER_EVENTS.JOB_DISPATCH, onDispatch);
      socket.on(SERVER_EVENTS.NOTIFICATION, onNotification);

      unsubscribe = () => {
        socket.off(SERVER_EVENTS.JOB_STATUS, onStatus);
        socket.off(SERVER_EVENTS.JOB_LOCATION, onLocation);
        socket.off(SERVER_EVENTS.JOB_ETA, onEta);
        socket.off(SERVER_EVENTS.JOB_DISPATCH, onDispatch);
        socket.off(SERVER_EVENTS.NOTIFICATION, onNotification);
        socket.emit('job:unsubscribe', { bookingId });
      };
    })();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [bookingId, refresh]);

  const handleCancel = () => {
    Alert.alert('Cancel request', 'Are you sure you want to cancel this emergency request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel', style: 'destructive', onPress: async () => {
          setCancelling(true);
          const res = await jobService.cancelJob(bookingId, 'Cancelled by customer');
          setCancelling(false);
          if (!res.ok) Alert.alert('Error', res.error || 'Failed to cancel');
          else refresh();
        },
      },
    ]);
  };

  const handleRetry = async () => {
    setRetrying(true);
    const res = await jobService.retryDispatch(bookingId);
    setRetrying(false);
    if ('error' in res && res.error) Alert.alert('Error', res.error);
    else refresh();
  };

  const handleCall = async () => {
    const res = await jobService.callCounterparty(bookingId);
    if ('error' in res) {
      Alert.alert('Cannot call right now', res.error);
    } else {
      setCallMessage(res.message);
      setTimeout(() => setCallMessage(null), 6000);
    }
  };

  const handleRate = async () => {
    if (rating === 0) return;
    setSubmittingRating(true);
    const res = await jobService.rateJob(bookingId, rating, comment || undefined);
    setSubmittingRating(false);
    if (!res.ok) Alert.alert('Error', res.error || 'Failed to submit rating');
    else refresh();
  };

  if (loading || !job) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted }}>Loading your request...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isSearching = job.status === 'SEARCHING' || job.status === 'PENDING' || job.status === 'CONFIRMED';
  const isNoMechanic = job.status === 'NO_MECHANIC_FOUND';
  const isCancelled = job.status === 'CANCELLED';
  const isRejected = job.status === 'REJECTED';
  const isCompleted = job.status === 'COMPLETED';
  const isLive = job.tracking.isLive;
  const currentWeight = STATUS_WEIGHT[job.status] ?? 0;

  const mechanicLat = liveMechanic?.lat ?? job.technician?.currentLat ?? null;
  const mechanicLng = liveMechanic?.lng ?? job.technician?.currentLng ?? null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🚨 Emergency Assistance</Text>
          <Text style={styles.headerSubtitle}>#{job.bookingNumber}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {isCancelled ? (
          <View style={styles.bannerBlock}>
            <Text style={styles.bannerIcon}>✕</Text>
            <Text style={styles.bannerTitle}>Request Cancelled</Text>
            {!!job.cancelReason && <Text style={styles.bannerText}>{job.cancelReason}</Text>}
          </View>
        ) : isNoMechanic ? (
          <View style={styles.bannerBlock}>
            <Text style={styles.bannerIcon}>😕</Text>
            <Text style={styles.bannerTitle}>No Mechanic Available</Text>
            <Text style={styles.bannerText}>
              We couldn't reach a mechanic near you right now. You can retry, or our team has been notified and may call you.
            </Text>
            <TouchableOpacity style={styles.retryBtn} disabled={retrying} onPress={handleRetry}>
              <Text style={styles.retryBtnText}>{retrying ? 'Retrying...' : 'Retry Now'}</Text>
            </TouchableOpacity>
          </View>
        ) : isRejected ? (
          <View style={styles.bannerBlock}>
            <Text style={styles.bannerIcon}>🔄</Text>
            <Text style={styles.bannerTitle}>Finding a New Mechanic</Text>
            <Text style={styles.bannerText}>Your previous mechanic became unavailable. We're searching for a replacement.</Text>
          </View>
        ) : isSearching ? (
          <View style={styles.searchingBlock}>
            <Animated.View style={[styles.searchPulse, { transform: [{ scale: pulseAnim }] }]} />
            <Text style={styles.searchIcon}>🔍</Text>
            <Text style={styles.searchTitle}>Searching for a mechanic near you...</Text>
            {dispatchProgress && (
              <Text style={styles.searchMeta}>
                {dispatchProgress.exhausted
                  ? 'No mechanics responded yet -- expanding search...'
                  : `Wave ${dispatchProgress.wave} · notified ${dispatchProgress.totalNotified} mechanic${dispatchProgress.totalNotified === 1 ? '' : 's'}` +
                    (dispatchProgress.radiusKm ? ` within ${dispatchProgress.radiusKm}km` : '')}
              </Text>
            )}
            <TouchableOpacity style={styles.cancelBtn} disabled={cancelling} onPress={handleCancel}>
              <Text style={styles.cancelBtnText}>{cancelling ? 'Cancelling...' : 'Cancel Request'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {mechanicLat != null && mechanicLng != null ? (
              <LiveTrackingMap
                height={220}
                routePolyline={isLive ? job.tracking.routePolyline : null}
                markers={[
                  { latitude: mechanicLat, longitude: mechanicLng, title: 'Your mechanic', color: colors.primary },
                  ...(job.location.lat != null && job.location.lng != null
                    ? [{ latitude: job.location.lat, longitude: job.location.lng, title: 'You', color: colors.success }]
                    : []),
                ]}
              />
            ) : (
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapEmoji}>📍</Text>
                <Text style={styles.mapText}>Waiting for mechanic location...</Text>
              </View>
            )}

            {job.technician && (
              <View style={styles.technicianCard}>
                <Image
                  source={{ uri: `${jobService.technicianPhotoUrl(job.id)}` }}
                  style={styles.technicianPhoto}
                  onError={() => {}}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.technicianName}>{job.technician.name || 'Your Mechanic'}</Text>
                  <Text style={styles.technicianMeta}>⭐ {job.technician.rating.toFixed(1)} · {job.technician.totalJobs} jobs</Text>
                  {isLive && job.tracking.etaSeconds != null && (
                    <Text style={styles.technicianMeta}>
                      ETA {formatEta(job.tracking.etaSeconds)}
                      {job.tracking.distanceRemainingM != null && ` · ${(job.tracking.distanceRemainingM / 1000).toFixed(1)} km away`}
                    </Text>
                  )}
                </View>
                {job.contact.canCall && (
                  <TouchableOpacity style={styles.iconBtn} onPress={handleCall}>
                    <Text style={{ fontSize: 18 }}>📞</Text>
                  </TouchableOpacity>
                )}
                {job.contact.canChat && (
                  <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('ServiceChat', { bookingId })}>
                    <Text style={{ fontSize: 18 }}>💬</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {!!callMessage && (
              <View style={styles.callToast}><Text style={styles.callToastText}>{callMessage}</Text></View>
            )}

            {otp && (job.status === 'ARRIVED' || job.status === 'WORK_STARTED') && (
              <View style={styles.otpCard}>
                <Text style={styles.otpTitle}>{otp.purpose === 'START' ? 'Start Code' : 'Completion Code'}</Text>
                <Text style={styles.otpCode}>{otp.code}</Text>
                <Text style={styles.otpHint}>
                  {otp.purpose === 'START'
                    ? 'Read this code to your mechanic to let them begin work.'
                    : 'Read this code to your mechanic once you\'re happy the job is done.'}
                </Text>
              </View>
            )}
            {job.status === 'WORK_STARTED' && !otp && (
              <TouchableOpacity style={styles.refreshOtpBtn} onPress={() => loadOtp('COMPLETION')}>
                <Text style={styles.refreshOtpText}>Get Completion Code</Text>
              </TouchableOpacity>
            )}

            <View style={styles.trackingCard}>
              <Text style={styles.trackingTitle}>Status</Text>
              {STATUS_STEPS.map((s, i) => {
                const isActive = s.statuses.includes(job.status);
                const isPast = currentWeight > STATUS_WEIGHT[s.statuses[0]];
                const isLast = i === STATUS_STEPS.length - 1;
                return (
                  <View key={s.title} style={styles.timelineNode}>
                    <View style={styles.nodeColumn}>
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

        {isCompleted && !job.review && (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>How was your service?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <TouchableOpacity key={i} onPress={() => setRating(i)}>
                  <Text style={[styles.star, i <= rating && styles.starActive]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.commentInputWrap}>
              <TouchableOpacity style={styles.ratingSubmitBtn} disabled={rating === 0 || submittingRating} onPress={handleRate}>
                <Text style={styles.ratingSubmitText}>{submittingRating ? 'Submitting...' : 'Submit Rating'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {isCompleted && job.review && (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>Your Rating</Text>
            <Text style={styles.reportStars}>{'★'.repeat(job.review.rating)}{'☆'.repeat(Math.max(0, 5 - job.review.rating))}</Text>
            {!!job.review.comment && <Text style={styles.bannerText}>"{job.review.comment}"</Text>}
          </View>
        )}

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Service</Text><Text style={styles.summaryValue}>{job.package.name}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Vehicle</Text><Text style={styles.summaryValue}>{job.vehicle.brand} {job.vehicle.model}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total</Text><Text style={styles.summaryValue}>₹{job.pricing.finalAmount}</Text></View>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {!isCancelled && !isCompleted && !isSearching && !isNoMechanic && job.status !== 'WORK_STARTED' && (
            <TouchableOpacity style={styles.cancelOutlineBtn} disabled={cancelling} onPress={handleCancel}>
              <Text style={styles.cancelOutlineBtnText}>{cancelling ? 'Cancelling...' : 'Cancel Request'}</Text>
            </TouchableOpacity>
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

  bannerBlock: { alignItems: 'center', padding: 40 },
  bannerIcon: { fontSize: 40, marginBottom: 12 },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: colors.textDark, marginBottom: 8 },
  bannerText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  retryBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 16 },
  retryBtnText: { color: colors.white, fontWeight: '800', fontSize: 14 },

  searchingBlock: { alignItems: 'center', padding: 50 },
  searchPulse: { position: 'absolute', top: 40, width: 70, height: 70, borderRadius: 35, backgroundColor: '#FFE4E1' },
  searchIcon: { fontSize: 44, marginBottom: 16 },
  searchTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark, marginBottom: 8, textAlign: 'center' },
  searchMeta: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginBottom: 20 },
  cancelBtn: { borderWidth: 1.5, borderColor: colors.danger, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 10 },
  cancelBtnText: { color: colors.danger, fontWeight: '800', fontSize: 13 },

  mapPlaceholder: { height: 180, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center' },
  mapEmoji: { fontSize: 40, marginBottom: 8 },
  mapText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },

  technicianPhoto: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.pageBg },

  otpCard: { backgroundColor: '#EEF2FF', margin: 14, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.primary, alignItems: 'center' },
  otpTitle: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  otpCode: { fontSize: 30, fontWeight: '900', color: colors.primary, letterSpacing: 6, marginVertical: 6 },
  otpHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  refreshOtpBtn: { alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  refreshOtpText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  technicianCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, marginHorizontal: 14, marginTop: 14, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.borderLight },
  technicianName: { fontSize: 14, fontWeight: '800', color: colors.textDark, marginBottom: 3 },
  technicianMeta: { fontSize: 12, color: colors.textMuted },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.pageBg, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  callToast: { backgroundColor: colors.success, marginHorizontal: 14, marginTop: 10, borderRadius: 10, padding: 10, alignItems: 'center' },
  callToastText: { color: colors.white, fontWeight: '700', fontSize: 12 },

  trackingCard: { backgroundColor: colors.white, borderRadius: 20, padding: 20, margin: 14 },
  trackingTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark, marginBottom: 16 },

  timelineNode: { flexDirection: 'row', minHeight: 56 },
  nodeColumn: { alignItems: 'center', width: 26, marginRight: 14 },
  nodeCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center' },
  nodeCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  nodeIcon: { color: colors.white, fontSize: 9, fontWeight: 'bold' },
  nodeLine: { width: 2, flex: 1, backgroundColor: '#D1D5DB', marginVertical: -2 },
  nodeLineActive: { backgroundColor: colors.primary },
  nodeContent: { flexDirection: 'row', flex: 1, paddingBottom: 20, alignItems: 'center' },
  nodeEmoji: { fontSize: 18, marginRight: 10 },
  nodeTitle: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  nodeTitleActive: { color: colors.textDark, fontWeight: '700' },

  ratingCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginHorizontal: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center' },
  ratingTitle: { fontSize: 15, fontWeight: '800', color: colors.textDark, marginBottom: 12 },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  star: { fontSize: 34, color: '#D1D5DB' },
  starActive: { color: colors.warning },
  commentInputWrap: { width: '100%' },
  ratingSubmitBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ratingSubmitText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  reportStars: { fontSize: 20, color: colors.warning, marginBottom: 6 },

  summaryCard: { backgroundColor: colors.white, borderRadius: 14, padding: 16, marginHorizontal: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.textDark, fontWeight: '700' },

  cancelOutlineBtn: { borderWidth: 1.5, borderColor: colors.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelOutlineBtnText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
});
