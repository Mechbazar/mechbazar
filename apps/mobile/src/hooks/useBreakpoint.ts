import { useWindowDimensions } from 'react-native';

// Matches the breakpoints documented (unused today) in the root repo's
// DESIGN_SYSTEM_README.md, so there's no future clash with other apps.
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

export interface Breakpoint {
  width: number;
  height: number;
  breakpoint: BreakpointName;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  /** True at tablet width and above (>= 768). */
  isTabletUp: boolean;
  /** True at desktop width and above (>= 1024) -- the usual "show desktop layout" gate. */
  isDesktopUp: boolean;
}

const resolveBreakpoint = (width: number): BreakpointName => {
  if (width >= BREAKPOINTS.wide) return 'wide';
  if (width >= BREAKPOINTS.desktop) return 'desktop';
  if (width >= BREAKPOINTS.tablet) return 'tablet';
  return 'mobile';
};

/**
 * Reactive breakpoint info based on the live window size. Plain RN API
 * (useWindowDimensions), safe to call on any platform -- on native it just
 * always resolves to "mobile" since phone/tablet viewports never reach the
 * desktop threshold, so existing native call sites are unaffected by using
 * this instead of hardcoding values.
 */
export const useBreakpoint = (): Breakpoint => {
  const { width, height } = useWindowDimensions();
  const breakpoint = resolveBreakpoint(width);

  return {
    width,
    height,
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet: breakpoint === 'tablet',
    isDesktop: breakpoint === 'desktop',
    isWide: breakpoint === 'wide',
    isTabletUp: width >= BREAKPOINTS.tablet,
    isDesktopUp: width >= BREAKPOINTS.desktop,
  };
};
