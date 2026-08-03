import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { colors } from '../../screens/services/theme';

// Replaces the old "No Mechanic Available / Retry Now" dead end for both the
// Emergency and scheduled ("Garage") booking flows now that mechanic
// assignment is admin-controlled -- there is no automatic search to fail, so
// this screen never has a failure state to show, only "waiting" in one of
// three flavors:
//   PENDING_ADMIN_ASSIGNMENT -- brand new, nobody picked yet.
//   MECHANIC_ASSIGNED        -- admin picked someone, awaiting their accept/reject.
//   REJECTED                 -- that mechanic declined/timed out, back with admin.
export type AssignmentWaitingPhase = 'PENDING_ADMIN_ASSIGNMENT' | 'MECHANIC_ASSIGNED' | 'REJECTED';

const COPY: Record<AssignmentWaitingPhase, { title: string; body: string }> = {
  PENDING_ADMIN_ASSIGNMENT: {
    title: 'Finding the Best Mechanic',
    body:
      'Thank you for your patience.\n\n' +
      'Your service request has been received successfully.\n\n' +
      'Our support team is assigning the nearest available mechanic for your request.\n\n' +
      'You will receive a notification as soon as a mechanic accepts your service.\n\n' +
      'Please keep the app open.',
  },
  MECHANIC_ASSIGNED: {
    title: 'Waiting for Mechanic Acceptance',
    body: 'We are assigning a nearby mechanic.\n\nThank you for your patience.',
  },
  REJECTED: {
    title: 'Finding a New Mechanic',
    body: 'We are assigning another nearby mechanic.\n\nThank you for your patience.',
  },
};

export default function AssignmentWaitingCard({
  phase,
  bookingNumber,
  serviceName,
  vehicleLabel,
  estimatedResponseText = 'Usually assigned within 10-15 minutes',
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

  const copy = COPY[phase];

  return (
    <View style={styles.block}>
      <View style={styles.spinnerWrap}>
        <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }] }]} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>

      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.body}>{copy.body}</Text>

      <View style={styles.detailsCard}>
        <DetailRow label="Booking ID" value={`#${bookingNumber}`} />
        <DetailRow label="Service" value={serviceName} />
        <DetailRow label="Vehicle" value={vehicleLabel} />
        <DetailRow label="Estimated Response" value={estimatedResponseText} />
      </View>

      <TouchableOpacity style={styles.supportBtn} onPress={onContactSupport}>
        <Text style={styles.supportBtnText}>Contact Support</Text>
      </TouchableOpacity>

      {onCancel && (
        <TouchableOpacity style={styles.cancelBtn} disabled={cancelling} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>{cancelling ? 'Cancelling...' : 'Cancel Request'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 36, paddingBottom: 20 },
  spinnerWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  pulseRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFE4E1' },
  title: { fontSize: 19, fontWeight: '800', color: colors.textDark, textAlign: 'center', marginBottom: 10 },
  body: { fontSize: 13.5, color: colors.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: 22 },
  detailsCard: {
    width: '100%', backgroundColor: colors.white, borderRadius: 14, borderWidth: 1, borderColor: colors.borderLight,
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
