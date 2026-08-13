import React from 'react';
import { useStableIsDesktopUp } from '../hooks/useStableIsDesktopUp';
import CategoryProductsScreenMobile from './CategoryProductsScreenMobile';
import CategoryProductsDesktop from '../components/desktop/catalog/CategoryProductsDesktop';

// Metro resolves this file over CategoryProductsScreen.tsx for every web
// bundle. Native never sees this file or anything it imports.
export default function CategoryProductsScreen(props: any) {
  const isDesktopUp = useStableIsDesktopUp();
  return isDesktopUp ? <CategoryProductsDesktop /> : <CategoryProductsScreenMobile {...props} />;
}
