// Single source of truth for every Socket.IO event name and payload shape.
//
// This file is the contract between the backend and all four clients
// (customer app, mechanic app, admin panel, and the E2E test harness). It is
// deliberately dependency-free so it can be copied verbatim into a client
// bundle without dragging Prisma or Express in behind it.

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------
// A socket is auto-joined to its identity rooms at connect time and may join
// job rooms on demand (subject to an authorization check -- see gateway.ts).

export const ROOMS = {
  /** Every socket authenticated as this User id, across all their devices. */
  user: (userId: string) => `user:${userId}`,
  /** A mechanic's own room, keyed by ServiceTechnician id (not User id). */
  technician: (technicianId: string) => `tech:${technicianId}`,
  /** Everyone currently watching one job: its customer, its mechanic, admins. */
  job: (bookingId: string) => `job:${bookingId}`,
  /** Everyone currently watching one order: its customer, its rider, admins. */
  order: (orderId: string) => `order:${orderId}`,
  /** All connected admin/ops consoles. */
  admins: 'admins',
  /** Admin live-ops map -- opt-in, because it is the only high-frequency feed. */
  adminLiveMap: 'admin:live-map',
} as const;

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------

export const CLIENT_EVENTS = {
  /** Subscribe to a job's room. Ack: { ok, error? }. */
  JOB_SUBSCRIBE: 'job:subscribe',
  JOB_UNSUBSCRIBE: 'job:unsubscribe',
  /** Subscribe to an order's room. Ack: { ok, error? }. */
  ORDER_SUBSCRIBE: 'order:subscribe',
  ORDER_UNSUBSCRIBE: 'order:unsubscribe',
  /**
   * Mechanic location batch. Sent every TRACKING_PING_INTERVAL_SECONDS while a
   * job is active, and as a backlog flush after a reconnect. Ack carries the
   * server's view so the client can drop what was accepted and retry the rest.
   */
  LOCATION_BATCH: 'location:batch',
  /** Admin console opting into the live-map firehose. */
  ADMIN_WATCH_LIVE_MAP: 'admin:watch-live-map',
  ADMIN_UNWATCH_LIVE_MAP: 'admin:unwatch-live-map',
} as const;

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

export const SERVER_EVENTS = {
  /** Emitted once per connection, immediately after auth succeeds. */
  READY: 'ready',

  /** Job moved to a new BookingStatus. Payload: JobStatusEvent. */
  JOB_STATUS: 'job:status',
  /** Full timeline refresh (sent on subscribe, and after any status change). */
  JOB_TIMELINE: 'job:timeline',
  /** Mechanic moved. Payload: JobLocationEvent. Highest-frequency event. */
  JOB_LOCATION: 'job:location',
  /** ETA/route/distance recalculated. Payload: JobEtaEvent. */
  JOB_ETA: 'job:eta',
  /** Dispatch progress for a job still SEARCHING. Payload: JobDispatchEvent. */
  JOB_DISPATCH: 'job:dispatch',
  /** An OTP was issued for this job. The code itself only goes to the customer. */
  JOB_OTP: 'job:otp',
  /** A work photo was attached. Payload: JobPhotoEvent. */
  JOB_PHOTO: 'job:photo',
  /** Chat message on a job. */
  JOB_MESSAGE: 'job:message',

  /** Order moved to a new OrderStatus. Payload: OrderStatusEvent. */
  ORDER_STATUS: 'order:status',
  /** Full timeline refresh (sent on subscribe, and after any status change). */
  ORDER_TIMELINE: 'order:timeline',

  /** A new offer is on the table for this mechanic. Payload: OfferEvent. */
  OFFER_NEW: 'offer:new',
  /** An offer this mechanic held is gone (expired, superseded, cancelled). */
  OFFER_CLOSED: 'offer:closed',

  /** Per-user notification mirror of a push. Payload: NotificationEvent. */
  NOTIFICATION: 'notification',

  /** Admin live map: one mechanic's position changed. */
  ADMIN_MECHANIC_LOCATION: 'admin:mechanic-location',
  /** Admin live map: a job entered/left the active set. */
  ADMIN_JOB_UPDATE: 'admin:job-update',
  /** Admin ops feed: an order's status changed. */
  ADMIN_ORDER_UPDATE: 'admin:order-update',
} as const;

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

export interface JobStatusEvent {
  bookingId: string;
  bookingNumber: string;
  status: string;
  previousStatus: string | null;
  at: string; // ISO8601
  /** Customer-facing one-liner, so clients don't each invent their own copy. */
  message: string;
  /** Present once a mechanic owns the job. Never includes a phone number. */
  technician?: {
    id: string;
    name: string | null;
    rating: number;
    totalJobs: number;
    photoUrl: string | null;
  } | null;
}

export interface JobTimelineStep {
  key: string;
  label: string;
  at: string | null;
  done: boolean;
}

export interface JobTimelineEvent {
  bookingId: string;
  steps: JobTimelineStep[];
}

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
  /** Encoded Google polyline, or null when routing is unavailable. */
  routePolyline: string | null;
  /** 'directions' = real road route; 'haversine' = straight-line fallback. */
  source: 'directions' | 'haversine';
  at: string;
}

export interface JobDispatchEvent {
  bookingId: string;
  /** 1-based; 0 means dispatch has not started. */
  wave: number;
  radiusKm: number | null;
  mechanicsNotified: number;
  /** Total distinct mechanics offered this job so far, across all waves. */
  totalNotified: number;
  /** Seconds until the current wave's offers expire. */
  expiresInSeconds: number | null;
  exhausted: boolean;
}

export interface JobOtpEvent {
  bookingId: string;
  purpose: 'START' | 'COMPLETION';
  /** Only ever populated on the customer's own socket. */
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
  /** Seconds remaining at emit time -- lets the app start its countdown without a clock-sync assumption. */
  expiresInSeconds: number;
  category: string;
  packageName: string;
  estimatedCost: number;
  vehicle: { type: string; brand: string; model: string; registrationNumber: string | null };
  issueDescription: string | null;
  /** Approximate pickup area only. The precise pin is released on acceptance. */
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
  at: string; // ISO8601
  /** Customer-facing one-liner, so clients don't each invent their own copy. */
  message: string;
}

export interface OrderTimelineStep {
  key: string;
  label: string;
  at: string | null;
  done: boolean;
}

export interface OrderTimelineEvent {
  orderId: string;
  steps: OrderTimelineStep[];
}

export interface NotificationEvent {
  id: string;
  type: string | null;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}
