import { createNavigationContainerRef } from '@react-navigation/native';

// Shared between App.web.tsx (which attaches this to <NavigationContainer
// ref={...}>) and DesktopHeader.tsx (which reads getCurrentRoute() from it to
// capture "what page was the guest on" before sending them to Welcome -- see
// postLoginRedirect.ts). Pulled into its own file rather than living inline
// in App.web.tsx to avoid a require cycle: App.web.tsx -> DesktopAppShell.web
// -> DesktopHeader -> (would be) App.web.tsx.
export const navigationRef = createNavigationContainerRef<any>();
