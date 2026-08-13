import { useEffect, useState } from 'react';
import { BREAKPOINTS } from './useBreakpoint';

const getIsDesktopUp = () =>
  typeof window !== 'undefined' ? window.innerWidth >= BREAKPOINTS.desktop : false;

// HomeScreen.web.tsx / CategoryProductsScreen.web.tsx switch between an
// entirely different Desktop/Mobile component based on this value, and each
// side independently fetches its own category/banner/product data on mount
// -- so any transient flip shortly after first mount unmounts one screen and
// mounts the other, duplicating every one of those requests (UX-04 fix).
//
// useBreakpoint()/useWindowDimensions() (react-native-web) always re-commits
// a second Dimensions.get() reading from a mount effect as a safety
// catch-up, one tick after the first render -- live-traced: close to the
// 1024px boundary that's enough to flip isDesktopUp and trigger exactly this
// kind of full-tree remount (captured as an AbortError firing from React's
// own "deleted tree" unmount path). Reading window.innerWidth directly via a
// plain resize listener sidesteps that internal catch-up tick entirely --
// it's the same underlying browser value useBreakpoint eventually settles on
// anyway, just without the extra intermediate render.
export const useStableIsDesktopUp = (): boolean => {
  const [isDesktopUp, setIsDesktopUp] = useState(getIsDesktopUp);

  useEffect(() => {
    const handleResize = () => setIsDesktopUp(getIsDesktopUp());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isDesktopUp;
};
