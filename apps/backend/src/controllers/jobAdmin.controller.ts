import { Response } from 'express';
import { Prisma, BookingStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { AuthRequest } from '../middlewares/auth';
import {
  transitionJob, JobTransitionError, buildTimeline, ACTIVE_JOB_STATUSES, LIVE_TRACKING_STATUSES,
  ASSIGNMENT_RESPONSE_WINDOW_MS,
} from '../services/jobState';
import { closeOpenOffers, createSingleOffer } from '../services/dispatch.service';
import { getJobTrail } from '../services/tracking.service';
import { notifyUser, notifyAdmins, NOTIFY } from '../utils/notify';
import { recordAuditLog } from '../utils/auditLog';

// Admin live-ops surface for emergency dispatch.
//
// Split from job.controller.ts because the audience is different in kind: ops
// sees real phone numbers, can override the OTP gate, and can reassign a job
// out from under a mechanic. Keeping those powers in a separate file behind a
// separate route group makes the blast radius of an authorization mistake
// smaller and easier to review.

function fail(res: Response, err: unknown, context: string) {
  if (err instanceof JobTransitionError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error(`[job-admin] ${context} failed:`, err);
  return res.status(500).json({ error: 'Something went wrong.', code: 'INTERNAL' });
}

/**
 * GET /api/jobs/admin/live
 * The live-ops board: every job currently in flight, with enough context to
 * triage without opening each one.
 */
export const getLiveOps = async (req: AuthRequest, res: Response) => {
  try {
    const includeScheduled = req.query.includeScheduled === 'true';

    const jobs = await prisma.serviceBooking.findMany({
      where: {
        status: { in: ACTIVE_JOB_STATUSES },
        ...(includeScheduled ? {} : { isEmergency: true }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        category: { select: { name: true, icon: true } },
        package: { select: { name: true } },
        address: { select: { city: true, pincode: true, lat: true, lng: true, line1: true } },
        user: { select: { id: true, name: true, phone: true } },
        technician: { include: { user: { select: { name: true, phone: true } } } },
        _count: { select: { dispatchOffers: true, images: true } },
      },
    });

    const now = Date.now();

    const rows = jobs.map((job) => {
      const lat = job.jobLat ?? job.address.lat;
      const lng = job.jobLng ?? job.address.lng;
      const ageSeconds = Math.round((now - job.createdAt.getTime()) / 1000);

      return {
        id: job.id,
        bookingNumber: job.bookingNumber,
        status: job.status,
        isEmergency: job.isEmergency,
        createdAt: job.createdAt,
        ageSeconds,
        // Ops triage signal. A job waiting on admin assignment for too long,
        // an assigned mechanic who hasn't responded, or one who has stopped
        // moving, is what an operator needs to spot on a wall display without
        // reading each row.
        alert: computeAlert(job.status, ageSeconds, job.assignmentExpiresAt, job.technician?.lastLocationAt ?? null, job.etaSeconds),
        customer: { id: job.user.id, name: job.user.name, phone: job.user.phone },
        customerLocation: { lat, lng, city: job.address.city, pincode: job.address.pincode },
        category: job.category.name,
        package: job.package.name,
        vehicle: `${job.vehicleBrand} ${job.vehicleModel}`.trim(),
        issueDescription: job.issueDescription,
        amount: job.finalAmount,
        paymentStatus: job.paymentCompletedAt ? 'PAID' : 'PENDING',
        dispatch: {
          wave: job.dispatchWave,
          radiusKm: job.dispatchRadiusKm,
          offersMade: job._count.dispatchOffers,
          startedAt: job.dispatchStartedAt,
        },
        verification: {
          startOtpVerifiedAt: job.startOtpVerifiedAt,
          completionOtpVerifiedAt: job.completionOtpVerifiedAt,
          verifiedByCustomer: job.verifiedByCustomer,
        },
        tracking: {
          etaSeconds: job.etaSeconds,
          distanceRemainingM: job.distanceRemainingM,
          distanceTravelledKm: Number(job.distanceTravelledKm.toFixed(2)),
          isLive: LIVE_TRACKING_STATUSES.includes(job.status),
        },
        photoCount: job._count.images,
        technician: job.technician
          ? {
              id: job.technician.id,
              name: job.technician.user?.name ?? null,
              phone: job.technician.user?.phone ?? null,
              rating: job.technician.rating,
              lat: job.technician.currentLat,
              lng: job.technician.currentLng,
              lastLocationAt: job.technician.lastLocationAt,
              // Explicit staleness flag rather than making every client
              // recompute the threshold from lastLocationAt.
              locationStale:
                !job.technician.lastLocationAt ||
                now - job.technician.lastLocationAt.getTime() > env.DISPATCH_STALE_LOCATION_SECONDS * 1000,
            }
          : null,
      };
    });

    // Online mechanics, including idle ones -- the map needs the supply side,
    // not just the demand side.
    const staleBefore = new Date(now - env.DISPATCH_STALE_LOCATION_SECONDS * 1000);
    const mechanics = await prisma.serviceTechnician.findMany({
      where: { isOnline: true, isActive: true, status: 'APPROVED', lastLocationAt: { gte: staleBefore } },
      select: {
        id: true, currentLat: true, currentLng: true, rating: true, lastLocationAt: true,
        lastHeadingDeg: true,
        user: { select: { name: true } },
        _count: { select: { bookings: { where: { status: { in: ACTIVE_JOB_STATUSES } } } } },
      },
      take: 500,
    });

    const [pendingAssignment, enRoute, working, needsReassignmentToday] = await Promise.all([
      prisma.serviceBooking.count({ where: { status: 'PENDING_ADMIN_ASSIGNMENT' } }),
      prisma.serviceBooking.count({ where: { status: { in: ['MECHANIC_ACCEPTED', 'MECHANIC_ON_THE_WAY'] } } }),
      prisma.serviceBooking.count({ where: { status: { in: ['ARRIVED', 'WORK_STARTED'] } } }),
      prisma.serviceBooking.count({
        where: { status: 'REJECTED', createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      }),
    ]);

    res.status(200).json({
      jobs: rows,
      mechanics: mechanics.map((m) => ({
        id: m.id,
        name: m.user?.name ?? null,
        lat: m.currentLat,
        lng: m.currentLng,
        headingDeg: m.lastHeadingDeg,
        rating: m.rating,
        lastLocationAt: m.lastLocationAt,
        busy: m._count.bookings > 0,
      })),
      stats: { pendingAssignment, enRoute, working, needsReassignmentToday, mechanicsOnline: mechanics.length },
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    fail(res, err, 'getLiveOps');
  }
};

/**
 * Triage severity for the ops board. Thresholds are derived from the
 * assignment response window (how long a mechanic has to accept/reject) now
 * that there is no automatic dispatch budget to derive them from.
 */
function computeAlert(
  status: string,
  ageSeconds: number,
  assignmentExpiresAt: Date | null,
  lastLocationAt: Date | null,
  etaSeconds: number | null
): { level: 'ok' | 'warn' | 'critical'; reason: string | null } {
  if (status === 'PENDING_ADMIN_ASSIGNMENT' || status === 'REJECTED') {
    if (ageSeconds > 600) return { level: 'critical', reason: 'Waiting for admin assignment for over 10 minutes' };
    if (ageSeconds > 180) return { level: 'warn', reason: 'Waiting for admin assignment' };
  }
  if (status === 'MECHANIC_ASSIGNED' && assignmentExpiresAt) {
    const overdueSeconds = (Date.now() - assignmentExpiresAt.getTime()) / 1000;
    if (overdueSeconds > 0) return { level: 'warn', reason: 'Mechanic has not responded to the assignment' };
  }
  if (status === 'MECHANIC_ACCEPTED' && ageSeconds > 300) {
    return { level: 'warn', reason: 'Accepted but not yet en route' };
  }
  if ((status === 'MECHANIC_ON_THE_WAY' || status === 'MECHANIC_ACCEPTED') && lastLocationAt) {
    const staleFor = Date.now() - lastLocationAt.getTime();
    if (staleFor > env.DISPATCH_STALE_LOCATION_SECONDS * 1000) {
      return { level: 'critical', reason: 'Mechanic GPS has gone silent' };
    }
  }
  if (status === 'MECHANIC_ON_THE_WAY' && etaSeconds != null && etaSeconds > 3600) {
    return { level: 'warn', reason: 'ETA over an hour' };
  }
  if (status === 'ARRIVED' && ageSeconds > 1800) {
    return { level: 'warn', reason: 'Arrived but work has not started' };
  }
  return { level: 'ok', reason: null };
}

/** GET /api/jobs/admin/:id — full detail, including everything ops may need. */
export const getJobAdminDetail = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const job = await prisma.serviceBooking.findUnique({
      where: { id },
      include: {
        category: true, package: true, address: true, payment: true, invoice: true, review: true,
        user: { select: { id: true, name: true, phone: true, email: true } },
        technician: { include: { user: { select: { name: true, phone: true } } } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        images: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true, type: true, uploadedByRole: true, uploadedByUserId: true,
            capturedAt: true, lat: true, lng: true, sizeBytes: true, sha256: true, createdAt: true,
          },
        },
        dispatchOffers: {
          orderBy: { offeredAt: 'asc' },
          include: { technician: { include: { user: { select: { name: true } } } } },
        },
        // OTP metadata only -- never codeEnc. An admin has no business reading
        // a live customer code, and there is no ops task that requires it.
        otps: {
          orderBy: { createdAt: 'asc' },
          select: { id: true, purpose: true, attempts: true, maxAttempts: true, expiresAt: true, consumedAt: true, createdAt: true },
        },
        callSessions: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const trail = await getJobTrail(id, 2000);

    // Durations ops actually asks about, computed once here rather than in
    // three different frontends.
    const ms = (a: Date | null, b: Date | null) => (a && b ? Math.max(0, b.getTime() - a.getTime()) : null);
    const durations = {
      timeToAcceptMs: ms(job.dispatchStartedAt ?? job.createdAt, job.acceptedAt),
      travelMs: ms(job.enRouteAt, job.arrivedAt),
      waitAtSiteMs: ms(job.arrivedAt, job.startedAt),
      workMs: ms(job.startedAt, job.completedAt),
      totalMs: ms(job.createdAt, job.completedAt),
    };

    res.status(200).json({
      job: {
        ...job,
        // Bytes are never inlined; images[] above is metadata only.
        timeline: buildTimeline(job as unknown as Record<string, unknown>),
        durations,
        dispatchOffers: job.dispatchOffers.map((o) => ({
          id: o.id,
          technicianId: o.technicianId,
          technicianName: o.technician.user?.name ?? null,
          wave: o.wave,
          status: o.status,
          distanceKm: o.distanceKm,
          etaSeconds: o.etaSeconds,
          offeredAt: o.offeredAt,
          expiresAt: o.expiresAt,
          respondedAt: o.respondedAt,
          declineReason: o.declineReason,
          notifiedVia: o.notifiedVia,
        })),
      },
      trail,
    });
  } catch (err) {
    fail(res, err, 'getJobAdminDetail');
  }
};

/**
 * POST /api/jobs/admin/:id/assign  { technicianId }
 * Manual assignment. The escape hatch for a job dispatch could not fill.
 */
export const adminAssign = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { technicianId } = req.body || {};
    if (!technicianId) return res.status(400).json({ error: 'technicianId is required' });

    const tech = await prisma.serviceTechnician.findUnique({
      where: { id: technicianId },
      select: { id: true, userId: true, status: true, isActive: true },
    });
    if (!tech || tech.status !== 'APPROVED') {
      return res.status(400).json({ error: 'That mechanic is not approved.' });
    }

    const job = await prisma.serviceBooking.findUnique({ where: { id }, select: { status: true, bookingNumber: true, userId: true } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const assignmentExpiresAt = new Date(Date.now() + ASSIGNMENT_RESPONSE_WINDOW_MS);

    // Emergency jobs go through a single-candidate offer (same accept/decline/
    // countdown lifecycle the mechanic app already renders for OfferInboxScreen)
    // rather than writing technicianId directly -- the mechanic still has to
    // explicitly accept before the job is really theirs.
    const { booking } = await transitionJob({
      bookingId: id,
      to: 'MECHANIC_ASSIGNED',
      expectedFrom: job.status as BookingStatus,
      actorUserId: req.user!.userId,
      note: `Manually assigned by admin`,
      data: { assignmentExpiresAt },
    });

    await closeOpenOffers(id, 'CANCELLED');
    await createSingleOffer(id, technicianId, assignmentExpiresAt);

    recordAuditLog({
      userId: req.user!.userId,
      action: 'JOB_MANUAL_ASSIGN',
      entity: 'ServiceBooking',
      entityId: id,
      details: `Assigned ${booking.bookingNumber} to technician ${technicianId}`,
      req,
    });

    await notifyUser(job.userId, 'Waiting for mechanic acceptance', `We are assigning a nearby mechanic to your request #${booking.bookingNumber}. Thank you for your patience.`, { bookingId: id }, { type: NOTIFY.JOB_MECHANIC_FOUND });

    res.status(200).json({ ok: true, status: booking.status });
  } catch (err) {
    fail(res, err, 'adminAssign');
  }
};

/**
 * POST /api/jobs/admin/:id/redispatch — bail on a stuck MECHANIC_ASSIGNED job
 * (offer sent, mechanic not responding) without waiting out the full 60s
 * countdown. Cancels the open offer and returns the job to REJECTED, the same
 * "needs reassignment" resting state a decline or a timed-out sweep produces
 * -- an admin can immediately assign someone else from there.
 */
export const adminRedispatch = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const job = await prisma.serviceBooking.findUnique({ where: { id }, select: { status: true, bookingNumber: true, userId: true } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    await closeOpenOffers(id, 'CANCELLED');

    const { booking } = await transitionJob({
      bookingId: id,
      to: 'REJECTED',
      expectedFrom: job.status as BookingStatus,
      actorUserId: req.user!.userId,
      note: 'Returned to queue by admin',
      data: { technicianId: null, assignmentExpiresAt: null },
    });

    recordAuditLog({
      userId: req.user!.userId,
      action: 'JOB_REDISPATCH',
      entity: 'ServiceBooking',
      entityId: id,
      details: `Returned ${job.bookingNumber} to the assignment queue`,
      req,
    });

    res.status(200).json({ ok: true, status: booking.status });
  } catch (err) {
    fail(res, err, 'adminRedispatch');
  }
};

/**
 * POST /api/jobs/admin/:id/force-status  { status, reason }
 *
 * Override for stuck jobs. Two things make this safe enough to expose:
 * it refuses to fabricate customer verification (`verifiedByCustomer` stays
 * false and the OTP-verified timestamps stay null), and every use is written
 * to the audit log and stamped `[admin override]` in the status history.
 */
export const adminForceStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, reason } = req.body || {};
    if (!status || !Object.values(BookingStatus).includes(status)) {
      return res.status(400).json({ error: 'A valid status is required' });
    }
    if (!reason || String(reason).trim().length < 5) {
      // A forced transition without a stated reason is unauditable, and this
      // is the one endpoint that can bypass the customer's consent gate.
      return res.status(400).json({ error: 'A reason (at least 5 characters) is required for a forced transition.' });
    }

    const job = await prisma.serviceBooking.findUnique({ where: { id }, select: { status: true, bookingNumber: true, userId: true } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const { booking, previousStatus } = await transitionJob({
      bookingId: id,
      to: status as BookingStatus,
      expectedFrom: job.status as BookingStatus,
      actorUserId: req.user!.userId,
      note: String(reason).slice(0, 500),
      adminOverride: true,
      // Deliberately does NOT set verifiedByCustomer / *OtpVerifiedAt. A job
      // force-completed by ops must remain distinguishable from one the
      // customer actually signed off, forever.
    });

    if (status === 'CANCELLED' || status === 'COMPLETED') {
      await closeOpenOffers(id, 'CANCELLED');
    }

    recordAuditLog({
      userId: req.user!.userId,
      action: 'JOB_FORCE_STATUS',
      entity: 'ServiceBooking',
      entityId: id,
      details: `${booking.bookingNumber}: ${previousStatus} -> ${status}. Reason: ${String(reason).slice(0, 200)}`,
      req,
    });

    await notifyUser(job.userId, 'Service update', `Your job #${booking.bookingNumber} was updated by our team.`, { bookingId: id });

    res.status(200).json({ ok: true, status: booking.status, previousStatus });
  } catch (err) {
    fail(res, err, 'adminForceStatus');
  }
};

/** GET /api/jobs/admin/metrics — dispatch health over a window. */
export const getDispatchMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 24 * 30);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [created, filled, unfilled, cancelled, offerStats, accepted] = await Promise.all([
      prisma.serviceBooking.count({ where: { isEmergency: true, createdAt: { gte: since } } }),
      prisma.serviceBooking.count({ where: { isEmergency: true, createdAt: { gte: since }, acceptedAt: { not: null } } }),
      prisma.serviceBooking.count({ where: { isEmergency: true, createdAt: { gte: since }, status: 'NO_MECHANIC_FOUND' } }),
      prisma.serviceBooking.count({ where: { isEmergency: true, createdAt: { gte: since }, status: 'CANCELLED' } }),
      prisma.jobDispatchOffer.groupBy({
        by: ['status'],
        where: { offeredAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.serviceBooking.findMany({
        where: { isEmergency: true, createdAt: { gte: since }, acceptedAt: { not: null } },
        select: { createdAt: true, acceptedAt: true, arrivedAt: true, enRouteAt: true, completedAt: true, startedAt: true, dispatchWave: true },
      }),
    ]);

    // Percentiles, not just means: a mean time-to-accept hides the tail, and
    // the tail is where stranded customers live.
    const pick = (fn: (j: (typeof accepted)[number]) => number | null) =>
      accepted.map(fn).filter((v): v is number => v != null && Number.isFinite(v)).sort((a, b) => a - b);
    const pct = (arr: number[], p: number) => (arr.length ? Math.round(arr[Math.min(arr.length - 1, Math.floor((arr.length - 1) * p))]) : null);

    const acceptSecs = pick((j) => (j.acceptedAt ? (j.acceptedAt.getTime() - j.createdAt.getTime()) / 1000 : null));
    const arriveSecs = pick((j) => (j.arrivedAt && j.enRouteAt ? (j.arrivedAt.getTime() - j.enRouteAt.getTime()) / 1000 : null));
    const workSecs = pick((j) => (j.completedAt && j.startedAt ? (j.completedAt.getTime() - j.startedAt.getTime()) / 1000 : null));

    res.status(200).json({
      windowHours: hours,
      jobs: { created, filled, unfilled, cancelled, fillRate: created ? Number((filled / created).toFixed(3)) : null },
      offers: Object.fromEntries(offerStats.map((o) => [o.status, o._count._all])),
      timeToAcceptSeconds: { p50: pct(acceptSecs, 0.5), p90: pct(acceptSecs, 0.9), p99: pct(acceptSecs, 0.99) },
      travelSeconds: { p50: pct(arriveSecs, 0.5), p90: pct(arriveSecs, 0.9) },
      workSeconds: { p50: pct(workSecs, 0.5), p90: pct(workSecs, 0.9) },
      waveDistribution: accepted.reduce<Record<number, number>>((acc, j) => {
        acc[j.dispatchWave] = (acc[j.dispatchWave] || 0) + 1;
        return acc;
      }, {}),
    });
  } catch (err) {
    fail(res, err, 'getDispatchMetrics');
  }
};
