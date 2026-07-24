import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../theme/tokens';

interface MapPlaceholderProps {
  // What this particular map would show once wired up -- keeps the
  // placeholder honest about what's missing rather than a generic "Map"
  // label everywhere (e.g. "Store locator", "Delivery tracking").
  label: string;
  height?: number;
}

// Rendered anywhere a real Google Map will eventually go (see
// config/maps.ts) -- an honest "not available yet" state instead of a
// broken embed or a fake static image pretending to be an interactive map.
export default function MapPlaceholder({ label, height = 200 }: MapPlaceholderProps) {
  return (
    <View style={[styles.wrapper, { height }]}>
      <Ionicons name="map-outline" size={28} color={colors.textMuted} />
      <Text style={styles.title}>{label}</Text>
      <Text style={styles.subtitle}>Map view coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    backgroundColor: colors.pageBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  title: { fontSize: 13, fontWeight: '700', color: colors.textDark, marginTop: 6 },
  subtitle: { fontSize: 11, color: colors.textMuted },
});
