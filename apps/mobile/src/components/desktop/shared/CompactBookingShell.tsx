import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useBreakpoint } from '../../../hooks/useBreakpoint';
import { spacing, bookingMaxWidth } from '../../../theme/tokens';

interface Props {
  children: React.ReactNode;
  /** Defaults to the standard form width (720). Pass wider (880-960) for
   *  list/summary-heavy screens that aren't a narrow step-by-step form. */
  maxWidth?: number;
  style?: any;
}

// Centers and caps the width of a booking-flow screen's existing content on
// desktop, reusing the same marginLeft/Right:'auto' technique Container.tsx
// already uses in production. On native and mobile-web this is a pure
// passthrough -- no wrapping View, no style applied -- so it can never affect
// the native app's layout, only widen a booking screen's own content when
// isDesktopUp() is true.
export default function CompactBookingShell({ children, maxWidth = bookingMaxWidth, style }: Props) {
  const { isDesktopUp } = useBreakpoint();
  if (!isDesktopUp) return <>{children}</>;
  return <View style={[styles.wrapper, { maxWidth }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    marginLeft: 'auto' as any,
    marginRight: 'auto' as any,
    paddingHorizontal: spacing.lg,
  },
});
