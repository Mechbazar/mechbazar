// Design tokens for the new desktop web components (components/desktop/**).
// Self-contained: does NOT import the root repo's packages/shared design
// system (that targets apps/admin/apps/vendor; this app is deliberately
// isolated from the root workspace per metro.config.js) and does NOT import
// screens/services/theme.ts (copied below instead, to avoid coupling a new
// module to an existing screen's local file). Colors are copied from that
// file's "New Design System" palette for visual consistency with existing
// mobile content -- not invented fresh.
import { BREAKPOINTS } from '../hooks/useBreakpoint';

// Brand palette: Primary #E53935, Dark #1B1B1B, Light #F8F9FA, Accent #2ECC71.
export const colors = {
  // Nudged one step darker than the brand spec's #E53935 -- that value only
  // reaches ~4.2:1 contrast against white text (buttons/badges use primary as
  // a solid background with white text throughout), under WCAG AA's 4.5:1
  // minimum. This shade clears it (~4.6:1) while staying visually
  // indistinguishable from the brand red at a glance. Use `primaryBrand`
  // (the exact spec hex) for decorative/large-text-only surfaces where
  // contrast isn't load-bearing (e.g. hero gradients).
  primary: '#DA3830',
  primaryBrand: '#E53935',
  primaryDark: '#C6301B',
  darkInk: '#1B1B1B',
  steel: '#242C35',
  pageBg: '#F8F9FA',
  white: '#FFFFFF',
  borderLight: '#E3E6EA',
  textDark: '#1B1B1B',
  textMuted: '#6B7480',
  // For muted/secondary text on dark backgrounds (footer) -- textMuted
  // itself only reaches ~3.7:1 against darkInk/steel, below the 4.5:1
  // minimum; this reaches ~6.7:1. Not a replacement for textMuted, which is
  // tuned for (and passes on) the light backgrounds it's normally used on.
  mutedOnDark: '#9AA2AD',
  // Accent #2ECC71 only reaches ~1.9:1 against white -- fine as a fill behind
  // white icons/badges (non-text, no AA text requirement) but not for text
  // on white. `accentText` is a darkened shade (~3.9:1) for green text/links.
  accent: '#2ECC71',
  accentText: '#1E9E5A',
  success: '#1E9E5A',
  warning: '#F5A300',
  danger: '#D32F2F',
} as const;

// Dark-mode counterpart, same keys as `colors` so consumers can switch
// palettes without branching per-key. Surfaces invert (dark backgrounds,
// light text); brand/semantic hues are lifted slightly for AA contrast
// against the dark surfaces instead of white.
export const darkColors = {
  primary: '#FF5A4E',
  primaryBrand: '#FF6B5E',
  primaryDark: '#DA3830',
  darkInk: '#F8F9FA',
  steel: '#C7CCD3',
  pageBg: '#121212',
  white: '#1E1E1E',
  borderLight: '#2E2E2E',
  textDark: '#F1F2F4',
  textMuted: '#A6ACB5',
  mutedOnDark: '#9AA2AD',
  accent: '#2ECC71',
  accentText: '#4FE092',
  success: '#4FE092',
  warning: '#F5B94D',
  danger: '#FF6B6B',
} as const;

export type ThemeColors = typeof colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const typography = {
  h1: { fontSize: 40, fontWeight: '700' as const, lineHeight: 48 },
  h2: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  h3: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32 },
  h4: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodySmall: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 20 },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

/** Max content width for centered desktop layouts (Container component). */
export const maxContentWidth = 1280;

/** Max width for centered single-column booking/form flows (CompactBookingShell)
 *  -- deliberately narrower than maxContentWidth, since a wide form reads worse
 *  than a wide product grid. */
export const bookingMaxWidth = 720;

export { BREAKPOINTS as breakpoints } from '../hooks/useBreakpoint';
