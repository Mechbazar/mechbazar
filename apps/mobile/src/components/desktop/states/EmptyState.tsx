import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../../theme/tokens';

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
}

// Generic, reusable empty-state -- used for "no products", "empty cart",
// "no search results", etc. by passing a different icon/title/message/action.
export default function EmptyState({
  icon, title, message, actionLabel, onAction, secondaryActionLabel, onSecondaryAction, compact,
}: EmptyStateProps) {
  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]} accessibilityRole="text">
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={36} color={colors.textMuted} />
      </View>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {(actionLabel || secondaryActionLabel) && (
        <View style={styles.actions}>
          {actionLabel && onAction && (
            <Pressable style={styles.primaryBtn} onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
              <Text style={styles.primaryBtnText}>{actionLabel}</Text>
            </Pressable>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Pressable style={styles.secondaryBtn} onPress={onSecondaryAction} accessibilityRole="button" accessibilityLabel={secondaryActionLabel}>
              <Text style={styles.secondaryBtnText}>{secondaryActionLabel}</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', paddingVertical: 90, paddingHorizontal: spacing.xl },
  wrapperCompact: { paddingVertical: 40 },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: colors.pageBg,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textDark, marginBottom: 6, textAlign: 'center' },
  message: { fontSize: 14, color: colors.textMuted, textAlign: 'center', maxWidth: 380, lineHeight: 20, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  primaryBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  secondaryBtn: { borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 12, borderWidth: 1, borderColor: colors.borderLight },
  secondaryBtnText: { color: colors.textDark, fontSize: 14, fontWeight: '700' },
});
