// 3D icon set sourced from Microsoft's fluentui-emoji (MIT License):
// https://github.com/microsoft/fluentui-emoji — "3D" style renders, vendored
// locally (self-hosted, no runtime CDN dependency) and re-encoded to WebP.
const modules = import.meta.glob('./*.webp', { eager: true, import: 'default' }) as Record<string, string>;

const icons: Record<string, string> = {};
for (const path in modules) {
  const name = path.replace('./', '').replace('.webp', '');
  icons[name] = modules[path];
}

export type Icon3DName =
  | 'dashboard' | 'orders' | 'bookings' | 'mechanics' | 'categories' | 'service_catalog'
  | 'vendors' | 'riders' | 'customers' | 'vehicles' | 'banners' | 'coupons' | 'payouts'
  | 'reports' | 'audit' | 'warehouses' | 'suppliers' | 'purchase_orders' | 'revenue'
  | 'users_total' | 'trophy' | 'star' | 'check' | 'search' | 'bell' | 'megaphone'
  | 'gear' | 'shield';

export const icon3dSrc = icons as Record<Icon3DName, string>;
