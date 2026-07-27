import { BookingStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { haversineKm } from './geocoding.service';
import { getRoute } from './routing.service';
import {
  emitToJob, emitToAdminLiveMap, setLocationHandler, SocketIdentity,
} from '../realtime/gateway';
import { SERVER_EVENTS, CLIENT_EVENTS, JobLocationEvent, JobEtaEvent } from '../realtime/events';
import { LIVE_TRACKING_STATUSES } from './jobState';

// Live GPS ingestion and derivation.
//
// Shape of the pipeline:
//
//   mechanic app --(socket batch, every ~4s)--> ingestPings()
//        |                                          |
//        |                                    JobLocationPing rows (raw trail)
//        |                                          |
//        |                            ServiceTechnician.current* (latest fix)
//        |                                          |
//        |                       ServiceBooking.distanceTravelledKm (rollup)
//        |                                          |
//        +--> job room: JOB_LOCATION (every ping) ---+
//             job room: JOB_ETA (throttled recompute)
//             admin live map: ADMIN_MECHANIC_LOCATION
//
// Three things this design is specifically buying:
//
//  * BATCHING. The app buffers pings locally and sends arrays. A mechanic who
//    drives through a tunnel replays the gap on reconnect and the customer's
//    route redraws correctly instead of teleporting. It also means one socket
//    frame per few seconds rather than one per fix.
//
//  * THROTTLED ROUTING. A Directions call per ping would be roughly 900 calls
//    per hour per active job -- a five-figure monthly bill and a rate-limit
//    breach. Routes/ETAs recompute at most once per
//    TRACKING_ROUTE_REFRESH_SECONDS; positions still stream at full rate, so
//    the marker moves smoothly while the ETA updates periodically.
//
//  * JITTER REJECTION. A stationary phone's GPS wanders tens of metres. Moves
//    under TRACKING_MIN_MOVE_METERS are stored but excluded from the
//    distance-travelled rollup, otherwise a mechanic parked for an hour
//    accrues kilometres they never drove -- which matters, because that figure
//    is shown to admins and is a candidate input for reimbursement.

export interface PingInput {
  lat: number;
  lng: number;
  accuracyM?: number;
  headingDeg?: number;
  speedMps?: number;
  batteryPct?: number;
  /** Device capture time (ISO). Falls back to now for clients that omit it. */
  recordedAt?: string;
}

export interface IngestResult {
  accepted: number;
  rejected: number;
  /** Echoed so a client with a skewed clock can correct its own buffering. */
  serverTime: string;
  eta?: { etaSeconds: number | null; distanceRemainingM: number | null } | null;
}

/** Last time we recomputed a route per booking, to enforce the throttle. */
const lastRouteAt = new Map<string, number>();

function isValidCoord(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    // Exactly (0,0) is the null island -- a device reporting a failed fix, not
    // a mechanic in the Gulf of Guinea.
    !(lat === 0 && lng === 0)
  );
}

/**
 * Ingest a batch of GPS fixes for one mechanic on one job.
 *
 * Authorization is the caller's job for the HTTP path; the socket path checks
 * it here because a socket has no per-message middleware.
 */
export async function ingestPings(
  bookingId: string,
  technicianId: string,
  pings: PingInput[]
): Promise<IngestResult> {
  const serverTime = new Date().toISOString();

  const booking = await prisma.serviceBooking.findUnique({
    where: { id: bookingId },
    select: {
      id: true, status: true, technicianId: true, jobLat: true, jobLng: true,
      distanceTravelledKm: true, etaUpdatedAt: true,
      address: { select: { lat: true, lng: true } },
    },
  });

  if (!booking || booking.technicianId !== technicianId) {
    return { accepted: 0, rejected: pings.length, serverTime };
  }

  // Tracking is only meaningful between acceptance and completion. Silently
  // dropping post-completion pings (rather than erroring) is intentional: an
  // app that is a few seconds late noticing the job ended should stop cleanly,
  // not surface an error to a mechanic who did nothing wrong.
  if (!LIVE_TRACKING_STATUSES.includes(booking.status as BookingStatus)) {
    return { accepted: 0, rejected: pings.length, serverTime, eta: null };
  }

  const clean = pings
    .filter((p) => isValidCoord(p.lat, p.lng))
    // Reject fixes the device itself flagged as very low confidence; they
    // would corrupt both the drawn trail and the distance rollup.
    .filter((p) => p.accuracyM == null || p.accuracyM <= 200)
    .map((p) => ({
      ...p,
      recordedAtDate: p.recordedAt ? new Date(p.recordedAt) : new Date(),
    }))
    .filter((p) => !Number.isNaN(p.recordedAtDate.getTime()))
    // Device clock order, not arrival order -- see JobLocationPing.recordedAt.
    .sort((a, b) => a.recordedAtDate.getTime() - b.recordedAtDate.getTime());

  if (clean.length === 0) {
    return { accepted: 0, rejected: pings.length, serverTime };
  }

  // Previous fix, to measure incremental distance against. Read once for the
  // whole batch rather than per ping.
  const previous = await prisma.jobLocationPing.findFirst({
    where: { bookingId },
    orderBy: { recordedAt: 'desc' },
    select: { lat: true, lng: true },
  });

  let cursor = previous;
  let addedKm = 0;
  for (const p of clean) {
    if (cursor) {
      const stepKm = haversineKm(cursor.lat, cursor.lng, p.lat, p.lng);
      if (stepKm * 1000 >= env.TRACKING_MIN_MOVE_METERS) {
        addedKm += stepKm;
        cursor = { lat: p.lat, lng: p.lng };
      }
      // Below threshold: keep the old cursor so successive jitter can't
      // accumulate into a real-looking distance.
    } else {
      cursor = { lat: p.lat, lng: p.lng };
    }
  }

  const latest = clean[clean.length - 1];

  await prisma.$transaction([
    prisma.jobLocationPing.createMany({
      data: clean.map((p) => ({
        bookingId,
        technicianId,
        lat: p.lat,
        lng: p.lng,
        accuracyM: p.accuracyM ?? null,
        headingDeg: p.headingDeg ?? null,
        speedMps: p.speedMps ?? null,
        batteryPct: p.batteryPct ?? null,
        recordedAt: p.recordedAtDate,
      })),
    }),
    prisma.serviceTechnician.update({
      where: { id: technicianId },
      data: {
        currentLat: latest.lat,
        currentLng: latest.lng,
        lastLocationAt: new Date(),
        lastHeadingDeg: latest.headingDeg ?? null,
        lastSpeedMps: latest.speedMps ?? null,
      },
    }),
    ...(addedKm > 0
      ? [
          prisma.serviceBooking.update({
            where: { id: bookingId },
            // Incremental increment, not a recomputed total: two concurrent
            // batches (a live one and an offline flush) must not clobber each
            // other's contribution.
            data: { distanceTravelledKm: { increment: Number(addedKm.toFixed(4)) } },
          }),
        ]
      : []),
  ]);

  const locationEvent: JobLocationEvent = {
    bookingId,
    technicianId,
    lat: latest.lat,
    lng: latest.lng,
    headingDeg: latest.headingDeg ?? null,
    speedMps: latest.speedMps ?? null,
    recordedAt: latest.recordedAtDate.toISOString(),
  };
  emitToJob(bookingId, SERVER_EVENTS.JOB_LOCATION, locationEvent);
  emitToAdminLiveMap(SERVER_EVENTS.ADMIN_MECHANIC_LOCATION, { ...locationEvent, status: booking.status });

  const eta = await maybeRefreshEta(bookingId, booking, latest.lat, latest.lng);

  return { accepted: clean.length, rejected: pings.length - clean.length, serverTime, eta };
}

type EtaBooking = {
  id: string;
  status: string;
  jobLat: number | null;
  jobLng: number | null;
  address: { lat: number | null; lng: number | null };
};

/**
 * Recompute route/ETA if the throttle allows. Returns the current values
 * either way so the caller always has something to echo back.
 */
async function maybeRefreshEta(
  bookingId: string,
  booking: EtaBooking,
  mechLat: number,
  mechLng: number
): Promise<{ etaSeconds: number | null; distanceRemainingM: number | null } | null> {
  // ETA only means something while the mechanic is travelling. Once they have
  // arrived, "3 minutes away" is noise on the customer's screen.
  if (booking.status !== 'MECHANIC_ACCEPTED' && booking.status !== 'MECHANIC_ON_THE_WAY') {
    return null;
  }

  const destLat = booking.jobLat ?? booking.address.lat;
  const destLng = booking.jobLng ?? booking.address.lng;
  if (destLat == null || destLng == null) return null;

  const last = lastRouteAt.get(bookingId) || 0;
  if (Date.now() - last < env.TRACKING_ROUTE_REFRESH_SECONDS * 1000) {
    const cached = await prisma.serviceBooking.findUnique({
      where: { id: bookingId },
      select: { etaSeconds: true, distanceRemainingM: true },
    });
    return cached ? { etaSeconds: cached.etaSeconds, distanceRemainingM: cached.distanceRemainingM } : null;
  }
  lastRouteAt.set(bookingId, Date.now());

  const route = await getRoute({ lat: mechLat, lng: mechLng }, { lat: destLat, lng: destLng });

  await prisma.serviceBooking.update({
    where: { id: bookingId },
    data: {
      etaSeconds: route.etaSeconds,
      distanceRemainingM: route.distanceM,
      etaUpdatedAt: new Date(),
      // Only overwrite the stored polyline when we actually got one; a
      // transient Directions failure shouldn't erase a good route the
      // customer's map is currently drawing.
      ...(route.polyline ? { routePolyline: route.polyline } : {}),
    },
  });

  const payload: JobEtaEvent = {
    bookingId,
    etaSeconds: route.etaSeconds,
    distanceRemainingM: route.distanceM,
    routePolyline: route.polyline,
    source: route.source,
    at: new Date().toISOString(),
  };
  emitToJob(bookingId, SERVER_EVENTS.JOB_ETA, payload);

  return { etaSeconds: route.etaSeconds, distanceRemainingM: route.distanceM };
}

/** Breadcrumb trail for a job, for the customer's replay and the admin console. */
export async function getJobTrail(bookingId: string, limit = 500) {
  return prisma.jobLocationPing.findMany({
    where: { bookingId },
    orderBy: { recordedAt: 'asc' },
    take: limit,
    select: { lat: true, lng: true, recordedAt: true, headingDeg: true, speedMps: true },
  });
}

/** Clears per-job throttle state once a job ends, so the map doesn't leak. */
export function forgetJobTracking(bookingId: string): void {
  lastRouteAt.delete(bookingId);
}

/**
 * Retention sweep for raw breadcrumbs. The derived rollups
 * (distanceTravelledKm, the timeline timestamps, the final polyline) are
 * permanent; the second-by-second trail is not worth keeping forever.
 */
export async function sweepOldPings(): Promise<number> {
  const cutoff = new Date(Date.now() - env.TRACKING_PING_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.jobLocationPing.deleteMany({
    where: {
      recordedAt: { lt: cutoff },
      booking: { status: { in: ['COMPLETED', 'CANCELLED'] } },
    },
  });
  return count;
}

// ---------------------------------------------------------------------------
// Socket wiring
// ---------------------------------------------------------------------------

// Registered with the gateway at import time. Kept here rather than in
// gateway.ts so the transport layer stays free of ingestion logic (and so the
// two modules don't form an import cycle).
setLocationHandler((socket) => {
  const identity: SocketIdentity = (socket as unknown as { identity: SocketIdentity }).identity;

  socket.on(CLIENT_EVENTS.LOCATION_BATCH, async (payload: { bookingId?: string; pings?: PingInput[] }, ack?: (r: unknown) => void) => {
    try {
      if (!identity.technicianId) return ack?.({ ok: false, error: 'NOT_A_MECHANIC' });

      const bookingId = typeof payload?.bookingId === 'string' ? payload.bookingId : null;
      const pings = Array.isArray(payload?.pings) ? payload.pings : [];
      if (!bookingId || pings.length === 0) return ack?.({ ok: false, error: 'INVALID_PAYLOAD' });

      // Bound the batch so a buggy or hostile client can't push an unbounded
      // array through in one frame. 300 fixes at a 4s cadence is ~20 minutes
      // of backlog, comfortably more than any real offline gap.
      if (pings.length > 300) return ack?.({ ok: false, error: 'BATCH_TOO_LARGE' });

      // ingestPings re-checks that this mechanic owns this job, so there is no
      // separate authorization step to keep in sync.
      const result = await ingestPings(bookingId, identity.technicianId, pings);
      ack?.({ ok: true, ...result });
    } catch (err) {
      console.error('[tracking] socket batch failed:', err);
      ack?.({ ok: false, error: 'INGEST_FAILED' });
    }
  });
});
