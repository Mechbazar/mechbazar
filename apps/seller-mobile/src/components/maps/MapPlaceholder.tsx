import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { colors, Typography } from '@mechbazar/shared';

interface MapPlaceholderProps {
  label: string;
  height?: number;
}

// Rendered anywhere a real Google Map would go once MAPS_ENABLED is true --
// an honest "not available" state instead of a broken embed, mirroring
// apps/mobile's components/shared/MapPlaceholder.tsx.
export default function MapPlaceholder({ label, height = 200 }: MapPlaceholderProps) {
  return (
    <View style={[styles.wrapper, { height }]}>
      <MapPin size={26} color={colors.textSecondary} />
      <Typography variant="caption" style={{ fontWeight: '700', marginTop: 6 }}>{label}</Typography>
      <Typography variant="caption" style={{ color: colors.textSecondary }}>Map view unavailable</Typography>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
