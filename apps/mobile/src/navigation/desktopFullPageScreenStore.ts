import { useSyncExternalStore } from 'react';

// Tiny external store (no Redux, no navigation-context dependency) used only
// to tell DesktopAppShell.web.tsx whether the currently focused screen
// manages its own full-height scroll region (header sticky + its own
// DesktopFooter as the last element -- see HomeScreenDesktop.tsx and
// CategoryProductsDesktop.tsx) rather than needing the shell's default boxed
// content area + external footer.
//
// DesktopAppShell sits *outside* the Stack.Navigator (it wraps
// <Stack.Navigator> itself), so react-navigation hooks like
// useNavigationState -- which need to be called from inside the navigator
// tree -- throw "Couldn't get the navigation state" when called there.
// Self-managing screens report their own focus via useFocusEffect instead,
// which is the supported way to do this.
//
// A reference count, not a plain boolean: during an in-app navigation
// between two full-page screens (e.g. Home -> Categories), the incoming
// screen's useFocusEffect can commit and call setDesktopFullPageScreenActive
// (true) *before* the outgoing screen's own cleanup fires and calls it
// (false) -- live-traced as Categories setting true, then Home's blur
// cleanup immediately setting false again, clobbering it back off for the
// screen that's actually still on screen. A plain boolean has no way to
// tell "the screen that turned this off is the one that's currently
// active" apart from "some other screen still wants it on"; a count does,
// since matching increment/decrement pairs net out correctly regardless of
// which order the two screens' effects fire in.
let count = 0;
const listeners = new Set<() => void>();

export function setDesktopFullPageScreenActive(value: boolean) {
  const wasActive = count > 0;
  count = Math.max(0, count + (value ? 1 : -1));
  if (wasActive !== (count > 0)) {
    listeners.forEach(l => l());
  }
}

export function useDesktopFullPageScreenActive(): boolean {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => count > 0,
    () => false,
  );
}
