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
// which is the supported way to do this. Only one screen is ever focused at
// a time, so a single shared flag is enough regardless of how many screens
// opt into this pattern.
let active = false;
const listeners = new Set<() => void>();

export function setDesktopFullPageScreenActive(value: boolean) {
  if (active === value) return;
  active = value;
  listeners.forEach(l => l());
}

export function useDesktopFullPageScreenActive(): boolean {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => active,
    () => false,
  );
}
