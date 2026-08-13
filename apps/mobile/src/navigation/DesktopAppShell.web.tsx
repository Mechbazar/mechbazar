import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useStableIsDesktopUp } from '../hooks/useStableIsDesktopUp';
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
//
// Uses useStableIsDesktopUp (not useBreakpoint) deliberately, and keeps
// {children} at one stable tree position regardless of isFullPageScreenActive
// (UX-04 fix, two compounding causes found via a live network trace):
//
// 1. useBreakpoint's one-tick-later Dimensions resync could flip isDesktopUp
//    shortly after first mount, and this component used to switch {children}
//    between a bare Fragment and a real View wrapper on that flip -- a
//    structural element-type change at children's exact tree position, which
//    makes React tear down and rebuild every mounted screen underneath.
//    useStableIsDesktopUp reads window.innerWidth directly instead, so this
//    decision is already correct on the very first render.
// 2. isFullPageScreenActive itself is *expected* to flip shortly after
//    mount: HomeScreenDesktop/CategoryProductsDesktop report it true via
//    useFocusEffect, which only fires after they've already committed once
//    under the isFullPageScreenActive=false structure below. The two
//    branches used to be structurally different at {children}'s position
//    (wrapped in an extra View vs. not, footer present vs. not), so that
//    *correct, designed* flip was itself unmounting and remounting the
//    screen that just triggered it -- live-traced as HomeScreen mounting,
//    unmounting, and remounting within ~150ms of first paint, each cycle
//    re-issuing the same categories/banners/home/products requests. Keeping
//    {children} inside the same `<View role="main">` in both cases (only its
//    style and the trailing DesktopFooter sibling now differ) lets React
//    reconcile it in place instead.
export default function DesktopAppShell({ children }: { children: React.ReactNode }) {
  const isDesktopUp = useStableIsDesktopUp();
  const isFullPageScreenActive = useDesktopFullPageScreenActive();

  if (!isDesktopUp) {
    return <>{children}</>;
  }

  return (
    <View style={styles.page}>
      <DesktopHeader />
      {/* `role` is a react-native-web web-only passthrough prop (not part of
          RN's accessibilityRole enum) -- gives the document a <main> landmark.
          Styled flex:1 either way -- a no-op wrapper around a full-page
          screen's own internal ScrollView, which is why it's safe to keep
          present (not conditionally mounted) in both cases. */}
      <View style={styles.content} role="main">{children}</View>
      {/* react-navigation's Stack Screen wrapper clips its content to exactly
          the viewport slot it's given (flex:1 + overflow:hidden, baked in for
          its card-transition system). A footer rendered here as a sibling of
          {children} would always sit pinned right below that slot instead of
          appearing after scrolling through a long page, so full-page screens
          (HomeScreenDesktop/CategoryProductsDesktop) own their own
          full-height ScrollView with a DesktopFooter as their last element
          instead -- this shell steps out of the way of ITS OWN footer for
          those, rather than double-wrapping. */}
      {!isFullPageScreenActive && <DesktopFooter />}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg },
  content: { flex: 1 },
});
