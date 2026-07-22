import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../../theme/tokens';

// No confirmed live app-store listing URLs today -- badges are static
// (non-interactive), matching the same honesty precedent as the footer's
// "Get the App" column, just presented as a bigger promo band here.
export default function DownloadAppSection() {
  return (
    <View style={styles.wrapper}>
      <View style={styles.textBlock}>
        <Text style={styles.title}>Get the MechBazar App</Text>
        <Text style={styles.subtitle}>Track orders, book mechanics, and manage your garage on the go.</Text>
      </View>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Ionicons name="logo-google-playstore" size={22} color={colors.white} />
          <View>
            <Text style={styles.badgeSmall}>GET IT ON</Text>
            <Text style={styles.badgeBig}>Google Play</Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Ionicons name="logo-apple" size={22} color={colors.white} />
          <View>
            <Text style={styles.badgeSmall}>Download on the</Text>
            <Text style={styles.badgeBig}>App Store</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    backgroundColor: colors.darkInk,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  textBlock: { flexShrink: 1, minWidth: 260 },
  title: { color: colors.white, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 20 },
  badgeRow: { flexDirection: 'row', gap: spacing.sm },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.steel, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  badgeSmall: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
  badgeBig: { color: colors.white, fontSize: 15, fontWeight: '700' },
});
