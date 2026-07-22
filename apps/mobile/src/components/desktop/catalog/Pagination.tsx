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
}

// getCategoryProducts's response has no total-count field (it fetches one
// large batch and paginates client-side -- see product.service.ts), so this
// shows Prev/current page/Next rather than a fabricated total page count.
export default function Pagination({ page, hasMore, loading, onPrev, onNext }: PaginationProps) {
  if (page === 1 && !hasMore) return null;

  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.btn, page === 1 && styles.btnDisabled]}
        disabled={page === 1 || loading}
        onPress={onPrev}
      >
        <Ionicons name="chevron-back" size={16} color={page === 1 ? colors.textMuted : colors.textDark} />
        <Text style={[styles.btnText, page === 1 && styles.btnTextDisabled]}>Previous</Text>
      </Pressable>

      <View style={styles.pageIndicator}>
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.pageText}>Page {page}</Text>}
      </View>

      <Pressable
        style={[styles.btn, !hasMore && styles.btnDisabled]}
        disabled={!hasMore || loading}
        onPress={onNext}
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
