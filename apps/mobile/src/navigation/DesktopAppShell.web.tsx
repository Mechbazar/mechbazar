import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useDesktopFullPageScreenActive } from './desktopFullPageScreenStore';
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
  const isFullPageScreenActive = useDesktopFullPageScreenActive();

  if (!isDesktopUp) {
    return <>{children}</>;
  }

  if (isFullPageScreenActive) {
    // react-navigation's Stack Screen wrapper clips its content to exactly
    // the viewport slot it's given (flex:1 + overflow:hidden, baked in for
    // its card-transition system). A footer rendered here as a sibling of
    // {children} would always sit pinned right below that slot instead of
    // appearing after scrolling through a long page. Screens like
    // HomeScreenDesktop/CategoryProductsDesktop own their own full-height
    // ScrollView with a DesktopFooter as their last element instead, so this
    // shell steps out of the way rather than double-wrapping.
    return (
      <View style={styles.page}>
        <DesktopHeader />
        {children}
      </View>
    );
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
