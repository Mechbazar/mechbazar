import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { colors, darkColors } from './tokens';

// Components that need to react to the user's dark-mode preference use this
// instead of importing `colors` directly from tokens.ts (a static import,
// same value regardless of theme). Components using the static import still
// work exactly as before -- this is additive, not a breaking change to the
// existing token module.
export function useThemeColors() {
  const resolvedScheme = useSelector((state: RootState) => state.theme.resolvedScheme);
  return resolvedScheme === 'dark' ? darkColors : colors;
}

export function useIsDarkMode(): boolean {
  return useSelector((state: RootState) => state.theme.resolvedScheme === 'dark');
}
