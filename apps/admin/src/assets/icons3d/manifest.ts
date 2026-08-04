// Kept at the same path/export names so the ~30 files across the app that
// import `Icon3DName` from here don't need to change -- only the underlying
// icon set changed (Lucide outline icons instead of 3D renders), not the
// naming contract Icon3D.tsx and its callers rely on.
export type Icon3DName =
  | 'dashboard' | 'orders' | 'bookings' | 'mechanics' | 'categories' | 'service_catalog'
  | 'vendors' | 'riders' | 'customers' | 'vehicles' | 'banners' | 'coupons' | 'payouts'
  | 'reports' | 'audit' | 'warehouses' | 'suppliers' | 'purchase_orders' | 'revenue'
  | 'users_total' | 'trophy' | 'star' | 'check' | 'search' | 'bell' | 'megaphone'
  | 'gear' | 'shield';
