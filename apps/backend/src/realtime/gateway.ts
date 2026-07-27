import type { Server as HttpServer } from 'http';
import { Server as IOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { verifyToken } from '../utils/jwt';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { ROOMS, CLIENT_EVENTS, SERVER_EVENTS } from './events';

// Socket.IO gateway.
//
// Design notes:
//
// * Auth reuses the same HS256 JWT as the REST API (utils/jwt.ts) and
//   re-resolves the user against the database on connect, exactly like
//   middlewares/auth.ts does per-request. Without the DB re-resolution a
//   deleted or demoted account would keep a live socket for up to the token's
//   full 7-day life -- and unlike a REST call, a socket is not re-checked on
//   every message. Long-lived sockets are additionally re-validated on a timer
//   (see SESSION_RECHECK_MS).
//
// * Rooms are the authorization boundary. A socket is auto-joined only to
//   rooms derived from its own verified identity; joining a job room requires
//   an explicit ownership check against the database. Nothing is ever emitted
//   to a raw socket id.
//
// * The Redis adapter is attached when REDIS_URL is set, so the VPS can run
//   more than one backend container behind Nginx and still have an event
//   emitted by container A reach a socket held by container B. Without it the
//   gateway still works, but only single-instance -- which is the current
//   docker-compose topology, hence "optional, not required".

let io: IOServer | null = null;

const SESSION_RECHECK_MS = 5 * 60 * 1000;

const ADMIN_ROLES = new Set([
  'ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CUSTOMER_SUPPORT', 'FINANCE_MANAGER',
]);

export interface SocketIdentity {
  userId: string;
  role: string;
  /** ServiceTechnician.id, present only for SERVICE_TECHNICIAN sockets. */
  technicianId?: string;
}

type AuthedSocket = Socket & { identity: SocketIdentity };

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

/**
 * Can this identity watch this job? Customer owner, assigned mechanic, any
 * mechanic currently holding an open offer for it (they need the offer card to
 * stay live), or an admin.
 *
 * The open-offer case is why this is not a simple `booking.userId === userId`:
 * during dispatch several mechanics legitimately need a read on a job none of
 * them owns yet, and they must lose that read the moment their offer closes.
 */
export async function canAccessJob(identity: SocketIdentity, bookingId: string): Promise<boolean> {
  if (ADMIN_ROLES.has(identity.role)) return true;

  const booking = await prisma.serviceBooking.findUnique({
    where: { id: bookingId },
    select: { userId: true, technicianId: true },
  });
  if (!booking) return false;

  if (booking.userId === identity.userId) return true;
  if (identity.technicianId && booking.technicianId === identity.technicianId) return true;

  if (identity.technicianId) {
    const openOffer = await prisma.jobDispatchOffer.findFirst({
      where: { bookingId, technicianId: identity.technicianId, status: 'OFFERED' },
      select: { id: true },
    });
    if (openOffer) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function initRealtime(httpServer: HttpServer): Promise<IOServer> {
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  io = new IOServer(httpServer, {
    path: '/socket.io',
    // Mirrors the REST CORS policy in index.ts: an explicit allowlist when one
    // is configured, permissive otherwise, so this can't be the thing that
    // silently breaks admin/vendor web access on deploy.
    cors: allowedOrigins.length > 0 ? { origin: allowedOrigins, credentials: true } : { origin: '*' },
    // Mobile networks drop and resume constantly. A generous but bounded
    // window: long enough to survive a tunnel or a lift, short enough that a
    // genuinely dead client's rooms are reclaimed.
    pingInterval: 20_000,
    pingTimeout: 25_000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: false,
    },
    // Mechanic location batches are the largest inbound payload; 256 KB is far
    // above a realistic backlog flush and well below anything worth OOMing for.
    maxHttpBufferSize: 256 * 1024,
  });

  await attachRedisAdapter(io);

  io.use(async (socket, next) => {
    try {
      const token: string | undefined =
        socket.handshake.auth?.token ||
        (typeof socket.handshake.headers.authorization === 'string'
          ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
          : undefined);

      if (!token) return next(new Error('UNAUTHORIZED'));

      const decoded = verifyToken(token) as { userId: string; role: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, role: true, deletedAt: true, technicianProfile: { select: { id: true } } },
      });
      if (!user || user.deletedAt) return next(new Error('UNAUTHORIZED'));

      (socket as AuthedSocket).identity = {
        userId: user.id,
        role: user.role,
        technicianId: user.technicianProfile?.id,
      };
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket) => onConnection(socket as AuthedSocket));

  console.log('[realtime] Socket.IO gateway listening on /socket.io');
  return io;
}

async function attachRedisAdapter(server: IOServer): Promise<void> {
  if (!env.REDIS_URL) {
    console.log('[realtime] REDIS_URL unset -- running single-instance (no cross-process fan-out).');
    return;
  }
  try {
    const pubClient = createClient({ url: env.REDIS_URL, socket: { connectTimeout: 3000, reconnectStrategy: (n) => Math.min(n * 200, 5000) } });
    const subClient = pubClient.duplicate();
    // Both clients must survive Redis restarts on their own; a throw here
    // would take down the whole gateway, so they only log.
    pubClient.on('error', (err) => console.error('[realtime] redis pub error:', err.message));
    subClient.on('error', (err) => console.error('[realtime] redis sub error:', err.message));
    await Promise.all([pubClient.connect(), subClient.connect()]);
    server.adapter(createAdapter(pubClient, subClient));
    console.log('[realtime] Redis adapter attached -- multi-instance fan-out enabled.');
  } catch (err) {
    // Degraded, not fatal: single-instance delivery still works, and this is
    // exactly the deployment we run today.
    console.error('[realtime] Redis adapter unavailable, continuing single-instance:', err instanceof Error ? err.message : err);
  }
}

function onConnection(socket: AuthedSocket) {
  const { identity } = socket;

  socket.join(ROOMS.user(identity.userId));
  if (identity.technicianId) socket.join(ROOMS.technician(identity.technicianId));
  if (ADMIN_ROLES.has(identity.role)) socket.join(ROOMS.admins);

  socket.emit(SERVER_EVENTS.READY, {
    userId: identity.userId,
    role: identity.role,
    technicianId: identity.technicianId ?? null,
    // Server-driven so cadence is tunable without a new mobile build.
    trackingIntervalSeconds: env.TRACKING_PING_INTERVAL_SECONDS,
    serverTime: new Date().toISOString(),
  });

  // Re-validate long-lived sockets. A REST request re-checks the account on
  // every call; a socket that connected a week ago would otherwise never
  // notice the account was deleted or demoted.
  const recheck = setInterval(async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: identity.userId },
        select: { role: true, deletedAt: true },
      });
      if (!user || user.deletedAt || user.role !== identity.role) {
        socket.emit('session:invalidated', { reason: !user || user.deletedAt ? 'ACCOUNT_INACTIVE' : 'ROLE_CHANGED' });
        socket.disconnect(true);
      }
    } catch {
      // Transient DB blip -- keep the socket and try again next tick rather
      // than disconnecting every client during a database restart.
    }
  }, SESSION_RECHECK_MS);

  socket.on('disconnect', () => clearInterval(recheck));

  socket.on(CLIENT_EVENTS.JOB_SUBSCRIBE, async (payload: { bookingId?: string }, ack?: (r: unknown) => void) => {
    const bookingId = typeof payload?.bookingId === 'string' ? payload.bookingId : null;
    if (!bookingId) return ack?.({ ok: false, error: 'bookingId is required' });
    if (!(await canAccessJob(identity, bookingId))) {
      return ack?.({ ok: false, error: 'FORBIDDEN' });
    }
    await socket.join(ROOMS.job(bookingId));
    ack?.({ ok: true });
  });

  socket.on(CLIENT_EVENTS.JOB_UNSUBSCRIBE, async (payload: { bookingId?: string }, ack?: (r: unknown) => void) => {
    if (typeof payload?.bookingId === 'string') await socket.leave(ROOMS.job(payload.bookingId));
    ack?.({ ok: true });
  });

  socket.on(CLIENT_EVENTS.ADMIN_WATCH_LIVE_MAP, async (_p: unknown, ack?: (r: unknown) => void) => {
    if (!ADMIN_ROLES.has(identity.role)) return ack?.({ ok: false, error: 'FORBIDDEN' });
    await socket.join(ROOMS.adminLiveMap);
    ack?.({ ok: true });
  });

  socket.on(CLIENT_EVENTS.ADMIN_UNWATCH_LIVE_MAP, async (_p: unknown, ack?: (r: unknown) => void) => {
    await socket.leave(ROOMS.adminLiveMap);
    ack?.({ ok: true });
  });

  // The location batch handler is registered by tracking.service.ts to keep
  // ingestion logic out of the transport layer.
  registerLocationHandler?.(socket);
}

// tracking.service.ts installs this at import time. Kept as a mutable hook
// rather than a direct import so gateway.ts has no dependency on the tracking
// pipeline (which imports the emit helpers below -- a direct import both ways
// would be a require cycle).
let registerLocationHandler: ((socket: Socket & { identity: SocketIdentity }) => void) | null = null;
export function setLocationHandler(handler: (socket: Socket & { identity: SocketIdentity }) => void) {
  registerLocationHandler = handler;
}

// ---------------------------------------------------------------------------
// Emit helpers
// ---------------------------------------------------------------------------
// All emission goes through these. Every one is a no-op when the gateway is
// not initialised (unit tests, scripts, or a boot where Socket.IO failed to
// start) -- a realtime broadcast must never be able to fail the database
// transaction that produced it.

export function emitToJob(bookingId: string, event: string, payload: unknown): void {
  io?.to(ROOMS.job(bookingId)).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  io?.to(ROOMS.user(userId)).emit(event, payload);
}

export function emitToTechnician(technicianId: string, event: string, payload: unknown): void {
  io?.to(ROOMS.technician(technicianId)).emit(event, payload);
}

export function emitToAdmins(event: string, payload: unknown): void {
  io?.to(ROOMS.admins).emit(event, payload);
}

export function emitToAdminLiveMap(event: string, payload: unknown): void {
  io?.to(ROOMS.adminLiveMap).emit(event, payload);
}

/**
 * True when at least one socket for this mechanic is connected. Used by the
 * dispatch engine to record which channels an offer actually went out on, so
 * "mechanic never saw the job" can be distinguished from "mechanic ignored the
 * job" when auditing a slow fill.
 */
export async function isTechnicianOnSocket(technicianId: string): Promise<boolean> {
  if (!io) return false;
  const sockets = await io.in(ROOMS.technician(technicianId)).fetchSockets();
  return sockets.length > 0;
}

export function getIO(): IOServer | null {
  return io;
}

export async function shutdownRealtime(): Promise<void> {
  if (!io) return;
  await new Promise<void>((resolve) => io!.close(() => resolve()));
  io = null;
  console.log('[realtime] Gateway closed');
}
