// Mirrors each page's real backend authorization (the `admins`/`inventoryAdmins`/
// etc. arrays in apps/backend/src/routes/*.routes.ts) -- server-side authorize()
// already enforces these correctly, so this is UX polish only: without it, a
// lower-privilege login (e.g. CUSTOMER_SUPPORT) saw every nav item and only
// found out which ones it couldn't use by clicking into a raw 403. A path with
// no entry here has no role restriction server-side either (e.g. Vehicle
// Master), so every authenticated admin-panel role can see it.
//
// Single source of truth for both App.tsx's route table and Sidebar.tsx's nav
// list -- moved here verbatim from the pre-redesign App.tsx, not retyped, so
// nothing about who-sees-what silently changed during the redesign.
export const NAV_ROLES: Record<string, string[]> = {
  '/': ['SUPER_ADMIN', 'ADMIN'],
  '/orders': ['SUPER_ADMIN', 'ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER', 'VENDOR_MANAGER', 'FINANCE_MANAGER', 'CUSTOMER_SUPPORT'],
  '/service-bookings': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER'],
  '/mechanics': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER'],
  '/categories': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER'],
  '/vehicles': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER', 'INVENTORY_MANAGER'],
  '/inventory': ['ADMIN', 'SUPER_ADMIN', 'INVENTORY_MANAGER', 'OPERATIONS_MANAGER', 'VENDOR_MANAGER'],
  '/services': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER'],
  '/vendors': ['ADMIN', 'SUPER_ADMIN', 'VENDOR_MANAGER'],
  '/riders': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER'],
  '/customers': ['ADMIN', 'SUPER_ADMIN', 'CUSTOMER_SUPPORT'],
  '/cms': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER', 'VENDOR_MANAGER'],
  '/coupons': ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER', 'FINANCE_MANAGER'],
  // Now covers vendor + rider + mechanic payouts in one page (used to be
  // three separate pages/tabs with three separate role sets: vendor payouts
  // was VENDOR_MANAGER-only, rider/technician payouts were
  // OPERATIONS_MANAGER-only) -- union of both so neither role loses access.
  '/payouts': ['ADMIN', 'SUPER_ADMIN', 'VENDOR_MANAGER', 'OPERATIONS_MANAGER'],
  '/reports': ['SUPER_ADMIN', 'ADMIN'],
  '/audit-logs': ['SUPER_ADMIN', 'ADMIN'],
};
