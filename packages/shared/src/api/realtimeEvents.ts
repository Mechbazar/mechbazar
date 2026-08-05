// Client-side mirror of apps/backend/src/realtime/events.ts's CLIENT_EVENTS /
// SERVER_EVENTS name tables. Duplicated rather than imported because this
// package must stay buildable without pulling in the backend's Express/Prisma
// dependency tree -- but the two files MUST agree on every string. If you add
// or rename an event on the backend, mirror the change here in the same
// commit.

export const CLIENT_EVENTS = {
  JOB_SUBSCRIBE: 'job:subscribe',
  JOB_UNSUBSCRIBE: 'job:unsubscribe',
  ORDER_SUBSCRIBE: 'order:subscribe',
  ORDER_UNSUBSCRIBE: 'order:unsubscribe',
  LOCATION_BATCH: 'location:batch',
  ADMIN_WATCH_LIVE_MAP: 'admin:watch-live-map',
  ADMIN_UNWATCH_LIVE_MAP: 'admin:unwatch-live-map',
} as const;

export const SERVER_EVENTS = {
  READY: 'ready',
  JOB_STATUS: 'job:status',
  JOB_TIMELINE: 'job:timeline',
  JOB_LOCATION: 'job:location',
  JOB_ETA: 'job:eta',
  JOB_DISPATCH: 'job:dispatch',
  JOB_OTP: 'job:otp',
  JOB_PHOTO: 'job:photo',
  JOB_MESSAGE: 'job:message',
  ORDER_STATUS: 'order:status',
  ORDER_TIMELINE: 'order:timeline',
  OFFER_NEW: 'offer:new',
  OFFER_CLOSED: 'offer:closed',
  NOTIFICATION: 'notification',
  ADMIN_MECHANIC_LOCATION: 'admin:mechanic-location',
  ADMIN_JOB_UPDATE: 'admin:job-update',
  ADMIN_ORDER_UPDATE: 'admin:order-update',
} as const;

export interface JobStatusEvent {
  bookingId: string;
  bookingNumber: string;
  status: string;
  previousStatus: string | null;
  at: string;
  message: string;
  technician?: { id: string; name: string | null; rating: number; totalJobs: number; photoUrl: string | null } | null;
}

// Named distinctly from jobService.ts's JobTimelineStep (the REST response
// shape) purely to avoid an ambiguous re-export from this package's index --
// the two are structurally identical.
export interface JobTimelineStepEvent { key: string; label: string; at: string | null; done: boolean }
export interface JobTimelineEvent { bookingId: string; steps: JobTimelineStepEvent[] }

export interface JobLocationEvent {
  bookingId: string;
  technicianId: string;
  lat: number;
  lng: number;
  headingDeg: number | null;
  speedMps: number | null;
  recordedAt: string;
}

export interface JobEtaEvent {
  bookingId: string;
  etaSeconds: number | null;
  distanceRemainingM: number | null;
  routePolyline: string | null;
  source: 'directions' | 'haversine';
  at: string;
}

export interface JobDispatchEvent {
  bookingId: string;
  wave: number;
  radiusKm: number | null;
  mechanicsNotified: number;
  totalNotified: number;
  expiresInSeconds: number | null;
  exhausted: boolean;
}

export interface JobOtpEvent {
  bookingId: string;
  purpose: 'START' | 'COMPLETION';
  code?: string;
  expiresAt: string;
}

export interface JobPhotoEvent {
  bookingId: string;
  imageId: string;
  type: string;
  uploadedByRole: string;
  capturedAt: string | null;
}

export interface OfferEvent {
  offerId: string;
  bookingId: string;
  bookingNumber: string;
  wave: number;
  distanceKm: number | null;
  etaSeconds: number | null;
  expiresAt: string;
  expiresInSeconds: number;
  category: string;
  packageName: string;
  estimatedCost: number;
  vehicle: { type: string; brand: string; model: string; registrationNumber: string | null };
  issueDescription: string | null;
  area: string;
  jobLat: number | null;
  jobLng: number | null;
}

export interface OfferClosedEvent {
  offerId: string;
  bookingId: string;
  reason: 'EXPIRED' | 'SUPERSEDED' | 'CANCELLED' | 'DECLINED';
}

export interface OrderStatusEvent {
  orderId: string;
  status: string;
  previousStatus: string | null;
  at: string;
  message: string;
}

export interface OrderTimelineStepEvent { key: string; label: string; at: string | null; done: boolean }
export interface OrderTimelineEvent { orderId: string; steps: OrderTimelineStepEvent[] }

export interface NotificationEvent {
  id: string | null;
  type: string | null;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}
