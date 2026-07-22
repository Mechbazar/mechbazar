import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../../theme/tokens';

// Same claims the mobile "Our Promises" section already makes -- restyled
// for desktop, not new copy.
const BADGES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: 'lock-closed', label: 'Secure Payments' },
  { icon: 'ribbon', label: 'Genuine Parts' },
  { icon: 'rocket', label: 'Fast Delivery' },
  { icon: 'shield-checkmark', label: 'Verified Mechanics' },
];

export default function TrustBadges() {
  return (
    <View style={styles.row}>
      {BADGES.map(badge => (
        <View key={badge.label} style={styles.item}>
          <Ionicons name={badge.icon} size={20} color={colors.primary} />
          <Text style={styles.label}>{badge.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: colors.textDark },
});
