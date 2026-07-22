import { useSyncExternalStore } from 'react';

// Tiny external store (no Redux, no navigation-context dependency) used only
// to tell DesktopAppShell.web.tsx whether the Home screen is currently
// focused. DesktopAppShell sits *outside* the Stack.Navigator (it wraps
// <Stack.Navigator> itself), so react-navigation hooks like
// useNavigationState -- which need to be called from inside the navigator
// tree -- throw "Couldn't get the navigation state" when called there.
// HomeScreenDesktop (a real descendant of the Home screen) reports its own
// focus via useFocusEffect instead, which is the supported way to do this.
let focused = false;
const listeners = new Set<() => void>();

export function setDesktopHomeFocused(value: boolean) {
  if (focused === value) return;
  focused = value;
  listeners.forEach(l => l());
}

export function useDesktopHomeFocused(): boolean {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => focused,
    () => false,
  );
}
