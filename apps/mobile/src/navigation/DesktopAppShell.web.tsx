import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useBreakpoint } from '../hooks/useBreakpoint';
import DesktopHeader from '../components/desktop/header/DesktopHeader';
import DesktopFooter from '../components/desktop/footer/DesktopFooter';
import { colors } from '../theme/tokens';

// Web-only (Metro resolves this over DesktopAppShell.tsx when bundling for
// web). Below desktop width this stays a passthrough -- mobile web keeps
// today's exact layout. At desktop width and up it wraps content with real
// header/footer chrome. Every header/footer/mega-menu component is imported
// only from this file, so none of it ever reaches the native bundle
// regardless of how large it grows across later stages.
export default function DesktopAppShell({ children }: { children: React.ReactNode }) {
  const { isDesktopUp } = useBreakpoint();

  if (!isDesktopUp) {
    return <>{children}</>;
  }

  return (
    <View style={styles.page}>
      <DesktopHeader />
      <View style={styles.content}>{children}</View>
      <DesktopFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg },
  content: { flex: 1 },
});
