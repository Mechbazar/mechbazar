import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'vendor-theme';

function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

// Module-level store shared by every useTheme() call in the app. A plain
// per-component useState here would give each caller (Sidebar's Logo, its
// ThemeToggle, Layout's mobile Logo, ...) its own independent copy -- toggling
// in one would never notify the others, leaving e.g. the Logo's tone stuck on
// the old theme (invisible "MECH" text) after a live toggle. useSyncExternalStore
// keeps every instance reading the same value and re-renders them all on change.
let currentTheme: Theme = readStoredTheme();
const listeners = new Set<() => void>();

function setGlobalTheme(theme: Theme) {
  if (theme === currentTheme) return;
  currentTheme = theme;
  applyTheme(theme);
  localStorage.setItem(STORAGE_KEY, theme);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  return currentTheme;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot);

  const setTheme = useCallback((next: Theme) => setGlobalTheme(next), []);
  const toggleTheme = useCallback(() => {
    setGlobalTheme(currentTheme === 'light' ? 'dark' : 'light');
  }, []);

  return { theme, setTheme, toggleTheme };
}
