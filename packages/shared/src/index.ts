export * from './api/client';
export * from './api/notificationTypes';
export * from './api/vendorService';
export * from './api/riderService';
export * from './api/technicianService';
export * from './api/adminService';
export * from './api/geocodeService';
export * from './api/jobService';
export * from './api/realtime';
export * from './api/realtimeEvents';
export * from './utils/currency';

// Design System
export * from './theme';
// Flat exports are the RN API — every screen in admin-mobile/seller-mobile/rider
// imports { Button, Card, Input, Loader, Typography, Badge } directly.
export { Button, Card, Input, Loader, Typography, Badge, Toast, Logo } from './components/mobile';

// Brand assets. The wordmark outlines/colours are exported too so the handful
// of places that draw their own <Svg> (or need the raw hex) stay on-brand.
export * from './brand/logoPaths';
export * from './brand/logoSvg';
// Web components (apps/admin, apps/vendor) live at the '@mechbazar/shared/web'
// subpath instead of being re-exported here — they depend on lucide-react,
// which RN apps don't (and shouldn't) install, so keeping them off this entry
// point stops that dependency from leaking into the RN bundle/typecheck.
