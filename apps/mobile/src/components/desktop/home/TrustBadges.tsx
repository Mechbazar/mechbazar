import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../../theme/tokens';

// Wide trust banner right below "Shop by Category". Same claims the old
// 4-badge TrustBadges strip made (Genuine Parts, Secure Payments) plus the
// return-window claim already published on the Help Center / Returns
// static page -- restyled into the reference's heading+3-badges layout,
// not new copy. "10-Day" (not the reference mock's "7 Days") because
// staticPages.ts's actual Returns copy is a 10-day window -- see
// HelpCenterScreen.tsx / staticPages.ts's "10-day return window" heading.
const BADGES: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string }[] = [
  { icon: 'ribbon-outline', title: 'Genuine Products', subtitle: '100% Authentic' },
  { icon: 'return-down-back-outline', title: 'Easy Returns', subtitle: '10-Day Return Policy' },
  { icon: 'lock-closed-outline', title: 'Secure Payments', subtitle: '100% Secure Checkout' },
];

export default function TrustBadges() {
  return (
    <View style={styles.banner}>
      <View style={styles.headline}>
        <View style={styles.shieldCircle}>
          <Ionicons name="shield-checkmark" size={26} color={colors.primary} />
        </View>
        <View style={styles.headlineText}>
          <Text style={styles.title}>Quality Parts. Trusted Service.</Text>
          <Text style={styles.subtitle}>100% genuine auto parts with warranty and easy returns.</Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        {BADGES.map(badge => (
          <View key={badge.title} style={styles.badgeItem}>
            <View style={styles.badgeIconCircle}>
              <Ionicons name={badge.icon} size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.badgeTitle}>{badge.title}</Text>
              <Text style={styles.badgeSubtitle}>{badge.subtitle}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    backgroundColor: '#FDEEEC',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#F7D3CE',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  headline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexShrink: 1 },
  shieldCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  headlineText: { flexShrink: 1 },
  title: { fontSize: 19, fontWeight: '800', color: colors.textDark, marginBottom: 2 },
  subtitle: { fontSize: 13, color: colors.textMuted },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  badgeItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badgeIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeTitle: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  badgeSubtitle: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
});
