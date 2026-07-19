export * from './api/client';
export * from './api/vendorService';
export * from './api/riderService';
export * from './api/technicianService';
export * from './api/adminService';

// Design System
export * from './theme';
// Flat exports are the RN API — every screen in admin-mobile/seller-mobile/rider
// imports { Button, Card, Input, Loader, Typography, Badge } directly.
export { Button, Card, Input, Loader, Typography, Badge, Toast } from './components/mobile';
// Web components (apps/admin, apps/vendor) live at the '@mechbazar/shared/web'
// subpath instead of being re-exported here — they depend on lucide-react,
// which RN apps don't (and shouldn't) install, so keeping them off this entry
// point stops that dependency from leaking into the RN bundle/typecheck.
