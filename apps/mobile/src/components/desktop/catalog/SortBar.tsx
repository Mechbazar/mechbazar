import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FilterOptions } from '../../../types/product';
import { colors, spacing, radius, shadows } from '../../../theme/tokens';

const SORT_OPTIONS: { value: FilterOptions['sortBy']; label: string }[] = [
  { value: 'popular', label: 'Popularity' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_low_high', label: 'Price: Low to High' },
  { value: 'price_high_low', label: 'Price: High to Low' },
  { value: 'best_selling', label: 'Best Selling' },
  { value: 'rating', label: 'Highest Rated' },
];

interface SortBarProps {
  sortBy: FilterOptions['sortBy'];
  onChange: (sortBy: FilterOptions['sortBy']) => void;
  resultCount: number;
  onOpenFiltersMobile?: () => void;
}

export default function SortBar({ sortBy, onChange, resultCount }: SortBarProps) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find(o => o.value === sortBy) ?? SORT_OPTIONS[0];

  return (
    <View style={styles.row}>
      <Text style={styles.resultText}>{resultCount} {resultCount === 1 ? 'result' : 'results'}</Text>

      <Pressable style={styles.trigger} onPress={() => setOpen(o => !o)}>
        <Text style={styles.triggerLabel}>Sort by:</Text>
        <Text style={styles.triggerValue}>{current.label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textDark} />

        {open && (
          <View style={styles.panel}>
            {SORT_OPTIONS.map(opt => (
              <Pressable
                key={opt.value}
                style={styles.panelItem}
                onPress={() => { onChange(opt.value); setOpen(false); }}
              >
                <Text style={[styles.panelItemText, opt.value === sortBy && styles.panelItemTextActive]}>{opt.label}</Text>
                {opt.value === sortBy && <Ionicons name="checkmark" size={14} color={colors.primary} />}
              </Pressable>
            ))}
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, marginBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderLight,
  },
  resultText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.borderLight, backgroundColor: colors.white,
  },
  triggerLabel: { fontSize: 12, color: colors.textMuted },
  triggerValue: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  panel: {
    position: 'absolute' as any, top: '100%', right: 0, marginTop: 4, minWidth: 220,
    backgroundColor: colors.white, borderRadius: radius.sm, paddingVertical: 4, zIndex: 30,
    ...shadows.lg,
  },
  panelItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: spacing.sm },
  panelItemText: { fontSize: 13, color: colors.textDark },
  panelItemTextActive: { fontWeight: '700', color: colors.primary },
});
