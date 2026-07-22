import React from 'react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import CategoryProductsScreenMobile from './CategoryProductsScreenMobile';
import CategoryProductsDesktop from '../components/desktop/catalog/CategoryProductsDesktop';

// Metro resolves this file over CategoryProductsScreen.tsx for every web
// bundle. Native never sees this file or anything it imports.
export default function CategoryProductsScreen(props: any) {
  const { isDesktopUp } = useBreakpoint();
  return isDesktopUp ? <CategoryProductsDesktop /> : <CategoryProductsScreenMobile {...props} />;
}
