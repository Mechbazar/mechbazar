import React from 'react';

// Native (iOS/Android) and any non-.web bundle: trivial passthrough. Metro
// resolves this file for every platform except web, where DesktopAppShell.web.tsx
// wins instead -- so the real desktop shell (and everything it imports) never
// enters the native dependency graph at all, not just "doesn't render there."
export default function DesktopAppShell({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
