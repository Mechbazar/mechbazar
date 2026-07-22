import React from 'react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import HomeScreenMobile from './HomeScreenMobile';
import HomeScreenDesktop from '../components/desktop/home/HomeScreenDesktop';

// Metro resolves this file over HomeScreen.tsx for every web bundle (Metro's
// platform-extension resolution, same mechanism as DesktopAppShell.web.tsx).
// Native never sees this file or anything it imports.
export default function HomeScreen(props: any) {
  const { isDesktopUp } = useBreakpoint();
  return isDesktopUp ? <HomeScreenDesktop /> : <HomeScreenMobile {...props} />;
}
