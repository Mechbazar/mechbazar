import React from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../../theme/tokens';

interface PaginationProps {
  page: number;
  hasMore: boolean;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  // Real total-count from the backend (X-Total-Count header, see
  // getCategoryProducts) -- optional so callers that don't have it yet keep
  // the plain "Page N" display instead of breaking.
  total?: number;
  pageSize?: number;
}

export default function Pagination({ page, hasMore, loading, onPrev, onNext, total, pageSize }: PaginationProps) {
  if (page === 1 && !hasMore) return null;
  const totalPages = total != null && pageSize ? Math.max(1, Math.ceil(total / pageSize)) : undefined;

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.btn, page === 1 && styles.btnDisabled]}
        disabled={page === 1 || loading}
        onPress={onPrev}
        accessibilityRole="button"
        accessibilityLabel="Previous page"
      >
        <Ionicons name="chevron-back" size={16} color={page === 1 ? colors.textMuted : colors.textDark} />
        <Text style={[styles.btnText, page === 1 && styles.btnTextDisabled]}>Previous</Text>
      </Pressable>

      <View style={styles.pageIndicator} accessibilityLiveRegion="polite">
        {loading
          ? <ActivityIndicator size="small" color={colors.primary} />
          : <Text style={styles.pageText}>{totalPages ? `Page ${page} of ${totalPages}` : `Page ${page}`}</Text>}
      </View>

      <Pressable
        style={[styles.btn, !hasMore && styles.btnDisabled]}
        disabled={!hasMore || loading}
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel="Next page"
      >
        <Text style={[styles.btnText, !hasMore && styles.btnTextDisabled]}>Next</Text>
        <Ionicons name="chevron-forward" size={16} color={!hasMore ? colors.textMuted : colors.textDark} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.xl },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: colors.white,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 13, fontWeight: '700', color: colors.textDark },
  btnTextDisabled: { color: colors.textMuted },
  pageIndicator: { minWidth: 70, alignItems: 'center' },
  pageText: { fontSize: 13, fontWeight: '700', color: colors.textDark },
});
