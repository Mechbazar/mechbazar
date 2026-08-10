import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { useIsDarkMode } from '../../theme/useThemeColors';
import { useTranslation } from 'react-i18next';

// File-local copy of screens/services/theme.ts's palette (that file stays a
// static light-only export for its other, not-yet-converted consumers) --
// `surface` is split from `white`, which theme.ts uses both as text-on-
// colored-button (stays fixed) and as this card's `detailsCard` background
// (needs to invert).
const LIGHT_COLORS = {
  primary: '#DA3830',
  white: '#FFFFFF',
  surface: '#FFFFFF',
  borderLight: '#E3E6EA',
  textDark: '#1B1B1B',
  textMuted: '#6B7480',
  danger: '#D32F2F',
};

const DARK_COLORS: typeof LIGHT_COLORS = {
  primary: '#FF5A4E',
  white: '#FFFFFF',
  surface: '#1E1E1E',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  danger: '#FF6B6B',
};

// Replaces the old "No Mechanic Available / Retry Now" dead end for both the
// Emergency and scheduled ("Garage") booking flows now that mechanic
// assignment is admin-controlled -- there is no automatic search to fail, so
// this screen never has a failure state to show, only "waiting" in one of
// three flavors:
//   PENDING_ADMIN_ASSIGNMENT -- brand new, nobody picked yet.
//   MECHANIC_ASSIGNED        -- admin picked someone, awaiting their accept/reject.
//   REJECTED                 -- that mechanic declined/timed out, back with admin.
export type AssignmentWaitingPhase = 'PENDING_ADMIN_ASSIGNMENT' | 'MECHANIC_ASSIGNED' | 'REJECTED';

const getCopy = (t: (key: string) => string, phase: AssignmentWaitingPhase): { title: string; body: string } => {
  switch (phase) {
    case 'PENDING_ADMIN_ASSIGNMENT':
      return { title: t('assignmentWaiting.pendingAdminTitle'), body: t('assignmentWaiting.pendingAdminBody') };
    case 'MECHANIC_ASSIGNED':
      return { title: t('assignmentWaiting.mechanicAssignedTitle'), body: t('assignmentWaiting.mechanicAssignedBody') };
    case 'REJECTED':
      return { title: t('assignmentWaiting.rejectedTitle'), body: t('assignmentWaiting.rejectedBody') };
  }
};

export default function AssignmentWaitingCard({
  phase,
  bookingNumber,
  serviceName,
  vehicleLabel,
  estimatedResponseText,
  onContactSupport,
  onCancel,
  cancelling = false,
}: {
  phase: AssignmentWaitingPhase;
  bookingNumber: string;
  serviceName: string;
  vehicleLabel: string;
  estimatedResponseText?: string;
  onContactSupport: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const copy = getCopy(t, phase);

  return (
    <View style={styles.block}>
      <View style={styles.spinnerWrap}>
        <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>

      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>

      <View style={styles.detailsCard}>
        <DetailRow label={t('assignmentWaiting.bookingId')} value={`#${bookingNumber}`} />
        <DetailRow label={t('serviceBooking.service')} value={serviceName} />
        <DetailRow label={t('serviceBooking.vehicle')} value={vehicleLabel} />
        <DetailRow label={t('assignmentWaiting.estimatedResponse')} value={estimatedResponseText ?? t('assignmentWaiting.estimatedResponseDefault')} />
      </View>

      <TouchableOpacity style={styles.supportBtn} onPress={onContactSupport}>
        <Text style={styles.supportBtnText}>{t('assignmentWaiting.contactSupport')}</Text>
      </TouchableOpacity>

      {onCancel && (
        <TouchableOpacity style={styles.cancelBtn} disabled={cancelling} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>{cancelling ? t('assignmentWaiting.cancelling') : t('assignmentWaiting.cancelRequest')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const colors = useIsDarkMode() ? DARK_COLORS : LIGHT_COLORS;
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const createStyles = (colors: typeof LIGHT_COLORS) => StyleSheet.create({
  block: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 36, paddingBottom: 20 },
  spinnerWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  pulseRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFE4E1' },
  title: { fontSize: 19, fontWeight: '800', color: colors.textDark, textAlign: 'center', marginBottom: 10 },
  body: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 22 },
  detailsCard: {
    width: '100%', backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.borderLight,
    padding: 16, marginBottom: 16,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  detailLabel: { fontSize: 13, color: colors.textMuted },
  detailValue: { fontSize: 13, color: colors.textDark, fontWeight: '700', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  supportBtn: { width: '100%', borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  supportBtnText: { color: colors.primary, fontWeight: '800', fontSize: 14 },
  cancelBtn: { width: '100%', borderWidth: 1.5, borderColor: colors.danger, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelBtnText: { color: colors.danger, fontWeight: '800', fontSize: 14 },
});
