import React from 'react';
import { useBreakpoint } from '../hooks/useBreakpoint';

// Web-only (Metro resolves this over DesktopAppShell.tsx when bundling for
// web). Stage 0: still a passthrough -- proves useBreakpoint() and the
// platform-file split both resolve cleanly with zero visual change. Stage 1
// adds <DesktopHeader/> / <DesktopFooter/> here, gated on isDesktopUp; every
// new header/footer/mega-menu/hero component will be imported only from this
// file, so none of it ever reaches the native bundle regardless of how large
// it grows across later stages.
export default function DesktopAppShell({ children }: { children: React.ReactNode }) {
  useBreakpoint();
  return <>{children}</>;
}
