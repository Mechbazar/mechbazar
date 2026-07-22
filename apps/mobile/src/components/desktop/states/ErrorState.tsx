import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../../../theme/tokens';
import { ApiError } from '../../../services/product.service';

export type ErrorKind = 400 | 401 | 403 | 404 | 429 | 500 | 'network' | 'timeout' | 'unknown';

interface ErrorCopy {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}

const COPY: Record<ErrorKind, ErrorCopy> = {
  network: {
    icon: 'cloud-offline-outline',
    title: "You're offline",
    message: 'Check your internet connection and try again.',
  },
  timeout: {
    icon: 'time-outline',
    title: 'This is taking too long',
    message: 'The request timed out. Please try again.',
  },
  400: {
    icon: 'alert-circle-outline',
    title: "That request didn't go through",
    message: 'Something about this request was invalid. Please try again.',
  },
  401: {
    icon: 'lock-closed-outline',
    title: 'Please sign in to continue',
    message: 'Your session may have expired.',
  },
  403: {
    icon: 'shield-outline',
    title: "You don't have access to this",
    message: "You don't have permission to view this content.",
  },
  404: {
    icon: 'search-outline',
    title: "We couldn't find that",
    message: "This page or item doesn't exist or may have been removed.",
  },
  429: {
    icon: 'hourglass-outline',
    title: 'Too many requests',
    message: "You've made too many requests. Please wait a moment and try again.",
  },
  500: {
    icon: 'construct-outline',
    title: 'Something went wrong on our end',
    message: "We're already looking into it. Please try again shortly.",
  },
  unknown: {
    icon: 'warning-outline',
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
  },
};

export function classifyError(err: unknown): ErrorKind {
  if (err instanceof ApiError) {
    if (err.kind === 'network') return 'network';
    if (err.kind === 'timeout') return 'timeout';
    if (err.status && [400, 401, 403, 404, 429, 500].includes(err.status)) return err.status as ErrorKind;
    return 'unknown';
  }
  return 'unknown';
}

interface ErrorStateProps {
  kind: ErrorKind;
  onRetry?: () => void;
  onSignIn?: () => void;
  compact?: boolean;
}

// Covers every error kind Stage 4 asks for (400/401/403/404/429/500,
// network, timeout) from one component -- pass whichever `kind` applies
// (see classifyError, which reads it off the ApiError thrown by
// product.service.ts's opt-in rethrow path) and it renders the right
// icon/copy/action. role="alert" announces the message to screen readers
// as soon as it mounts, without needing to steal focus.
export default function ErrorState({ kind, onRetry, onSignIn, compact }: ErrorStateProps) {
  const copy = COPY[kind] ?? COPY.unknown;
  const isAuthError = kind === 401;

  return (
    <View
      style={[styles.wrapper, compact && styles.wrapperCompact]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
    >
      <View style={styles.iconCircle}>
        <Ionicons name={copy.icon} size={36} color={colors.danger} />
      </View>
      <Text style={styles.title} accessibilityRole="header">{copy.title}</Text>
      <Text style={styles.message}>{copy.message}</Text>

      <View style={styles.actions}>
        {isAuthError && onSignIn && (
          <Pressable style={styles.primaryBtn} onPress={onSignIn} accessibilityRole="button" accessibilityLabel="Log in">
            <Text style={styles.primaryBtnText}>Log In</Text>
          </Pressable>
        )}
        {!isAuthError && onRetry && (
          <Pressable style={styles.primaryBtn} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry">
            <Ionicons name="refresh" size={15} color={colors.white} />
            <Text style={styles.primaryBtnText}>Try Again</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', justifyContent: 'center', paddingVertical: 90, paddingHorizontal: spacing.xl },
  wrapperCompact: { paddingVertical: 40 },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#FDEDEA',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.textDark, marginBottom: 6, textAlign: 'center' },
  message: { fontSize: 14, color: colors.textMuted, textAlign: 'center', maxWidth: 380, lineHeight: 20, marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  primaryBtnText: { color: colors.white, fontSize: 14, fontWeight: '700' },
});
