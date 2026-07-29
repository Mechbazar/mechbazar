import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Typography } from '@mechbazar/shared';
import { colors, spacing } from '../../../theme/tokens';

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
      <Typography variant="h3" style={styles.title} numberOfLines={2}>{title}</Typography>
      <Typography variant="caption" color={colors.textMuted} style={styles.message}>{message}</Typography>

      {(actionLabel || secondaryActionLabel) && (
        <View style={styles.actions}>
          {actionLabel && onAction && (
            <Button title={actionLabel} onPress={onAction} size="sm" />
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button title={secondaryActionLabel} onPress={onSecondaryAction} variant="outline" size="sm" />
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
  title: { marginBottom: 6, textAlign: 'center' },
  message: { textAlign: 'center', maxWidth: 380, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
