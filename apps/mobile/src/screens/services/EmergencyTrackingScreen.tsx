import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  jobService, Job, getSocket, subscribeToJob, SERVER_EVENTS,
  JobStatusEvent, JobLocationEvent, JobEtaEvent, NotificationEvent,
} from '@mechbazar/shared';
import LiveTrackingMap from '../../components/shared/maps/LiveTrackingMap';
import AssignmentWaitingCard from '../../components/services/AssignmentWaitingCard';
import { useIsDarkMode } from '../../theme/useThemeColors';
import { useTranslation } from 'react-i18next';
import { notify, confirm } from '../../utils/notify';

// Live emergency job tracking. Distinct from ServiceTrackingScreen (the
// scheduled-booking tracker, which polls every 10s) because "instant" only
// feels instant if updates arrive over the socket rather than on the next
// poll tick -- an emergency job's whole point is urgency.
//
// The socket is the primary channel; a 20s poll is kept underneath purely as
// a safety net for a dropped connection (background app, dead Wi-Fi) so the
// screen can never get permanently stuck showing a stale status.
//
// There is no automatic mechanic matching any more -- PENDING_ADMIN_ASSIGNMENT,
// MECHANIC_ASSIGNED (not yet accepted) and REJECTED all render the same
// reassuring AssignmentWaitingCard rather than a status-specific banner; only
// MECHANIC_ACCEPTED and later show the live map/timeline.

type ParamList = { EmergencyTracking: { bookingId: string } };
const POLL_FALLBACK_MS = 20000;

const STATUS_STEPS: { statuses: string[]; titleKey: string; icon: string }[] = [
  { statuses: ['PENDING', 'CONFIRMED', 'PENDING_ADMIN_ASSIGNMENT'], titleKey: 'tracking.requestReceived', icon: '📝' },
  { statuses: ['MECHANIC_ASSIGNED'], titleKey: 'tracking.mechanicAssigned', icon: '👨‍🔧' },
  { statuses: ['MECHANIC_ACCEPTED'], titleKey: 'tracking.mechanicAccepted', icon: '✅' },
  { statuses: ['MECHANIC_ON_THE_WAY'], titleKey: 'tracking.mechanicEnRoute', icon: '🚗' },
  { statuses: ['ARRIVED'], titleKey: 'tracking.mechanicArrived', icon: '📍' },
  { statuses: ['WORK_STARTED'], titleKey: 'tracking.workStarted', icon: '🛠️' },
  { statuses: ['COMPLETED'], titleKey: 'tracking.workCompleted', icon: '🎉' },
];
const STATUS_WEIGHT: Record<string, number> = {
  PENDING: 1, CONFIRMED: 1, PENDING_ADMIN_ASSIGNMENT: 1, SEARCHING: 1, MECHANIC_ASSIGNED: 2, MECHANIC_ACCEPTED: 3,
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
  const { t } = useTranslation();
  const { bookingId } = route.params;

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveMechanic, setLiveMechanic] = useState<{ lat: number; lng: number } | null>(null);
  const [otp, setOtp] = useState<{ purpose: 'START' | 'COMPLETION'; code: string; expiresAt: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [callMessage, setCallMessage] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submittingRating, setSubmittingRating] = useState(false);

  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);

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
      socket.on(SERVER_EVENTS.NOTIFICATION, onNotification);

      unsubscribe = () => {
        socket.off(SERVER_EVENTS.JOB_STATUS, onStatus);
        socket.off(SERVER_EVENTS.JOB_LOCATION, onLocation);
        socket.off(SERVER_EVENTS.JOB_ETA, onEta);
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
    confirm('Cancel request', 'Are you sure you want to cancel this emergency request?', async () => {
      setCancelling(true);
      const res = await jobService.cancelJob(bookingId, 'Cancelled by customer');
      setCancelling(false);
      if (!res.ok) notify('Error', res.error || 'Failed to cancel');
      else refresh();
    }, 'Yes, cancel');
  };

  const handleCall = async () => {
    const res = await jobService.callCounterparty(bookingId);
    if ('error' in res) {
      notify('Cannot call right now', res.error);
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
    if (!res.ok) notify('Error', res.error || 'Failed to submit rating');
    else refresh();
  };

  if (loading || !job) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: colors.textMuted }}>{t('tracking.loadingRequest')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isPendingAssignment =
    job.status === 'PENDING_ADMIN_ASSIGNMENT' || job.status === 'PENDING' ||
    job.status === 'CONFIRMED' || job.status === 'SEARCHING' || job.status === 'NO_MECHANIC_FOUND';
  const isAwaitingMechanicAcceptance = job.status === 'MECHANIC_ASSIGNED';
  const isCancelled = job.status === 'CANCELLED';
  const isRejected = job.status === 'REJECTED';
  const isCompleted = job.status === 'COMPLETED';
  const isWaiting = isPendingAssignment || isAwaitingMechanicAcceptance || isRejected;
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
          <Text style={styles.headerTitle}>{t('tracking.emergencyAssistance')}</Text>
          <Text style={styles.headerSubtitle}>#{job.bookingNumber}</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {isCancelled ? (
          <View style={styles.bannerBlock}>
            <Text style={styles.bannerIcon}>✕</Text>
            <Text style={styles.bannerTitle}>{t('tracking.requestCancelled')}</Text>
            {!!job.cancelReason && <Text style={styles.bannerText}>{job.cancelReason}</Text>}
          </View>
        ) : isWaiting ? (
          <AssignmentWaitingCard
            phase={isAwaitingMechanicAcceptance ? 'MECHANIC_ASSIGNED' : isRejected ? 'REJECTED' : 'PENDING_ADMIN_ASSIGNMENT'}
            bookingNumber={job.bookingNumber}
            serviceName={job.package.name}
            vehicleLabel={`${job.vehicle.brand} ${job.vehicle.model}`}
            onContactSupport={() => navigation.navigate('HelpCenter')}
            onCancel={handleCancel}
            cancelling={cancelling}
          />
        ) : (
          <>
            {mechanicLat != null && mechanicLng != null ? (
              <LiveTrackingMap
                height={220}
                routePolyline={isLive ? job.tracking.routePolyline : null}
                markers={[
                  { latitude: mechanicLat, longitude: mechanicLng, title: t('tracking.yourMechanic'), color: colors.primary },
                  ...(job.location.lat != null && job.location.lng != null
                    ? [{ latitude: job.location.lat, longitude: job.location.lng, title: t('tracking.you'), color: colors.success }]
                    : []),
                ]}
              />
            ) : (
              <View style={styles.mapPlaceholder}>
                <Text style={styles.mapEmoji}>📍</Text>
                <Text style={styles.mapText}>{t('tracking.waitingForMechanicLocation')}</Text>
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
                  <Text style={styles.technicianName}>{job.technician.name || t('tracking.yourMechanicFallback')}</Text>
                  <Text style={styles.technicianMeta}>⭐ {job.technician.rating.toFixed(1)} · {t('tracking.jobsSuffix', { count: job.technician.totalJobs })}</Text>
                  {isLive && job.tracking.etaSeconds != null && (
                    <Text style={styles.technicianMeta}>
                      {t('tracking.etaLabel', { eta: formatEta(job.tracking.etaSeconds) })}
                      {job.tracking.distanceRemainingM != null && t('tracking.kmAway', { km: (job.tracking.distanceRemainingM / 1000).toFixed(1) })}
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
                <Text style={styles.otpTitle}>{otp.purpose === 'START' ? t('tracking.startCode') : t('tracking.completionCode')}</Text>
                <Text style={styles.otpCode}>{otp.code}</Text>
                <Text style={styles.otpHint}>
                  {otp.purpose === 'START'
                    ? t('tracking.startCodeHint')
                    : t('tracking.completionCodeHint')}
                </Text>
              </View>
            )}
            {job.status === 'WORK_STARTED' && !otp && (
              <TouchableOpacity style={styles.refreshOtpBtn} onPress={() => loadOtp('COMPLETION')}>
                <Text style={styles.refreshOtpText}>{t('tracking.getCompletionCode')}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.trackingCard}>
              <Text style={styles.trackingTitle}>{t('tracking.status')}</Text>
              {STATUS_STEPS.map((s, i) => {
                const isActive = s.statuses.includes(job.status);
                const isPast = currentWeight > STATUS_WEIGHT[s.statuses[0]];
                const isLast = i === STATUS_STEPS.length - 1;
                return (
                  <View key={s.titleKey} style={styles.timelineNode}>
                    <View style={styles.nodeColumn}>
                      <View style={[styles.nodeCircle, (isActive || isPast) && styles.nodeCircleActive]}>
                        <Text style={styles.nodeIcon}>{(isActive || isPast) ? '✓' : ''}</Text>
                      </View>
                      {!isLast && <View style={[styles.nodeLine, (isActive || isPast) && styles.nodeLineActive]} />}
                    </View>
                    <View style={styles.nodeContent}>
                      <Text style={styles.nodeEmoji}>{s.icon}</Text>
                      <Text style={[styles.nodeTitle, (isActive || isPast) && styles.nodeTitleActive]}>{t(s.titleKey)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {isCompleted && !job.review && (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>{t('tracking.howWasYourService')}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <TouchableOpacity key={i} onPress={() => setRating(i)}>
                  <Text style={[styles.star, i <= rating && styles.starActive]}>★</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.commentInputWrap}>
              <TouchableOpacity style={styles.ratingSubmitBtn} disabled={rating === 0 || submittingRating} onPress={handleRate}>
                <Text style={styles.ratingSubmitText}>{submittingRating ? t('tracking.submittingRating') : t('tracking.submitRating')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {isCompleted && job.review && (
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>{t('tracking.yourRating')}</Text>
            <Text style={styles.reportStars}>{'★'.repeat(job.review.rating)}{'☆'.repeat(Math.max(0, 5 - job.review.rating))}</Text>
            {!!job.review.comment && <Text style={styles.bannerText}>"{job.review.comment}"</Text>}
          </View>
        )}

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{t('tracking.service')}</Text><Text style={styles.summaryValue}>{job.package.name}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{t('tracking.vehicle')}</Text><Text style={styles.summaryValue}>{job.vehicle.brand} {job.vehicle.model}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{t('tracking.total')}</Text><Text style={styles.summaryValue}>₹{job.pricing.finalAmount}</Text></View>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          {!isCancelled && !isCompleted && !isWaiting && job.status !== 'WORK_STARTED' && (
            <TouchableOpacity style={styles.cancelOutlineBtn} disabled={cancelling} onPress={handleCancel}>
              <Text style={styles.cancelOutlineBtnText}>{cancelling ? t('tracking.cancellingRequest') : t('tracking.cancelRequest')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// `white` (icon/label text on colored buttons and status pills) stays
// literal white in both themes; `surface` is the actual card/header
// background and inverts along with the `textDark`/`textMuted` text drawn
// on it. `infoTint` backs the OTP card -- it holds dynamic `textDark`/
// `textMuted` text, so (unlike a purely decorative pastel accent) it must
// invert to a muted dark tint rather than stay a fixed light blue, or that
// text goes near-white-on-still-light-blue in dark mode. The neutral grays
// (`#D1D5DB` / `#9CA3AF`) used for the *inactive* timeline nodes/stars are
// deliberately left as literal, un-themed values -- they're single-role
// "unfilled state" chrome with no text ever drawn on top of them, and they
// stay legibly muted against both a light and a near-black page background.
const LIGHT_COLORS = {
  primary: '#DA3830',
  danger: '#D32F2F',
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  borderLight: '#E3E6EA',
  textDark: '#1B1B1B',
  textMuted: '#6B7480',
  success: '#1E9E5A',
  warning: '#F5A300',
  infoTint: '#EEF2FF',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  danger: '#FF6B6B',
  pageBg: '#121212',
  white: '#FFFFFF',
  surface: '#1E1E1E',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  success: '#4FE092',
  warning: '#F5B94D',
  infoTint: '#1E2340',
};

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBg },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: colors.surface },
  backButton: { marginRight: 16, padding: 4 },
  backIcon: { fontSize: 24, color: colors.textDark, fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.textDark },
  headerSubtitle: { fontSize: 13, color: colors.textMuted },

  bannerBlock: { alignItems: 'center', padding: 40 },
  bannerIcon: { fontSize: 40, marginBottom: 12 },
  bannerTitle: { fontSize: 18, fontWeight: '800', color: colors.textDark, marginBottom: 8 },
  bannerText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },

  mapPlaceholder: { height: 180, backgroundColor: colors.borderLight, justifyContent: 'center', alignItems: 'center' },
  mapEmoji: { fontSize: 40, marginBottom: 8 },
  mapText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },

  technicianPhoto: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.pageBg },

  otpCard: { backgroundColor: colors.infoTint, margin: 14, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.primary, alignItems: 'center' },
  otpTitle: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  otpCode: { fontSize: 30, fontWeight: '900', color: colors.primary, letterSpacing: 6, marginVertical: 6 },
  otpHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  refreshOtpBtn: { alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  refreshOtpText: { color: colors.primary, fontWeight: '700', fontSize: 13 },

  technicianCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: 14, marginTop: 14, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.borderLight },
  technicianName: { fontSize: 14, fontWeight: '800', color: colors.textDark, marginBottom: 3 },
  technicianMeta: { fontSize: 12, color: colors.textMuted },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.pageBg, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  callToast: { backgroundColor: colors.success, marginHorizontal: 14, marginTop: 10, borderRadius: 10, padding: 10, alignItems: 'center' },
  callToastText: { color: colors.white, fontWeight: '700', fontSize: 12 },

  trackingCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, margin: 14 },
  trackingTitle: { fontSize: 16, fontWeight: '800', color: colors.textDark, marginBottom: 16 },

  timelineNode: { flexDirection: 'row', minHeight: 56 },
  nodeColumn: { alignItems: 'center', width: 26, marginRight: 14 },
  nodeCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  nodeCircleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  nodeIcon: { color: colors.white, fontSize: 9, fontWeight: 'bold' },
  nodeLine: { width: 2, flex: 1, backgroundColor: '#D1D5DB', marginVertical: -2 },
  nodeLineActive: { backgroundColor: colors.primary },
  nodeContent: { flexDirection: 'row', flex: 1, paddingBottom: 20, alignItems: 'center' },
  nodeEmoji: { fontSize: 18, marginRight: 10 },
  nodeTitle: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  nodeTitleActive: { color: colors.textDark, fontWeight: '700' },

  ratingCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginHorizontal: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight, alignItems: 'center' },
  ratingTitle: { fontSize: 15, fontWeight: '800', color: colors.textDark, marginBottom: 12 },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  star: { fontSize: 34, color: '#D1D5DB' },
  starActive: { color: colors.warning },
  commentInputWrap: { width: '100%' },
  ratingSubmitBtn: { backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ratingSubmitText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  reportStars: { fontSize: 20, color: colors.warning, marginBottom: 6 },

  summaryCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, marginHorizontal: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.borderLight },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: colors.textMuted },
  summaryValue: { fontSize: 13, color: colors.textDark, fontWeight: '700' },

  cancelOutlineBtn: { borderWidth: 1.5, borderColor: colors.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelOutlineBtnText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
});
