import { Response } from 'express';
import crypto from 'crypto';
import { Prisma, BookingStatus, VehicleType } from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { AuthRequest } from '../middlewares/auth';
import { pendingPaymentCreateInput } from '../services/payment.service';
import {
  acceptOffer, declineOffer, closeOpenOffers, DispatchError,
} from '../services/dispatch.service';
import {
  transitionJob, JobTransitionError, buildTimeline, STATUS_MESSAGE,
  LIVE_TRACKING_STATUSES, ACTIVE_JOB_STATUSES,
} from '../services/jobState';
import {
  issueJobOtp, getOrIssueCustomerOtp, verifyAndConsumeOtp, OtpError,
} from '../services/jobOtp.service';
import { ingestPings, getJobTrail, forgetJobTracking, PingInput } from '../services/tracking.service';
import { isPincodeServiceable } from '../services/serviceability.service';
import { placeMaskedCall, contactAvailability, CallError, recordCallStatus } from '../services/call.service';
import { creditServiceCompletion } from '../services/commission.service';
import { emitToJob } from '../realtime/gateway';
import { SERVER_EVENTS } from '../realtime/events';
import { notifyUser, notifyAdmins, NOTIFY } from '../utils/notify';
import { broadcastBookingStatus } from '../utils/realtimeBooking';

// Emergency job API.
//
// Everything here is instant-dispatch. There is no scheduledDate and no
// timeSlotId on any request this controller accepts -- the legacy scheduled
// flow keeps living in service.controller.ts, untouched.

const generateBookingNumber = () =>
  `EJ-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

const ADMIN_ROLES = new Set([
  'ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER', 'CUSTOMER_SUPPORT', 'FINANCE_MANAGER',
]);

class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Maps every error type this module can produce onto an HTTP response. */
function fail(res: Response, err: unknown, context: string) {
  if (err instanceof ApiError || err instanceof JobTransitionError || err instanceof DispatchError || err instanceof OtpError || err instanceof CallError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error(`[job] ${context} failed:`, err);
  return res.status(500).json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' });
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

const JOB_INCLUDE = {
  category: true,
  package: true,
  address: true,
  payment: true,
  user: { select: { id: true, name: true, phone: true } },
  technician: { include: { user: { select: { id: true, name: true, phone: true } } } },
  review: true,
} satisfies Prisma.ServiceBookingInclude;

type JobRow = Prisma.ServiceBookingGetPayload<{ include: typeof JOB_INCLUDE }>;

type Viewer = 'CUSTOMER' | 'TECHNICIAN' | 'ADMIN';

/**
 * The single serializer for a job, for every audience.
 *
 * Phone numbers are the reason this is centralised. The privacy rule ("neither
 * party sees the other's number, ever") is only as strong as its weakest
 * serializer, so there is exactly one, and it strips by default and reveals by
 * explicit exception rather than the other way round.
 */
function serializeJob(job: JobRow, viewer: Viewer) {
  const contact = contactAvailability(job.status, !!job.technicianId);

  const technician = job.technician
    ? {
        id: job.technician.id,
        name: job.technician.user?.name ?? 'Your mechanic',
        rating: job.technician.rating,
        totalJobs: job.technician.totalJobs,
        experienceYears: job.technician.experienceYears,
        skills: job.technician.skills,
        photoUrl: `/api/services/bookings/${job.id}/technician-photo`,
        // Live position, but only while the job is actually live. After
        // completion the mechanic's whereabouts are none of the customer's
        // business.
        currentLat: LIVE_TRACKING_STATUSES.includes(job.status) ? job.technician.currentLat : null,
        currentLng: LIVE_TRACKING_STATUSES.includes(job.status) ? job.technician.currentLng : null,
        lastLocationAt: LIVE_TRACKING_STATUSES.includes(job.status) ? job.technician.lastLocationAt : null,
      }
    : null;

  const base = {
    id: job.id,
    bookingNumber: job.bookingNumber,
    isEmergency: job.isEmergency,
    status: job.status,
    statusMessage: STATUS_MESSAGE[job.status as BookingStatus],
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,

    vehicle: {
      type: job.vehicleType,
      brand: job.vehicleBrand,
      model: job.vehicleModel,
      fuelType: job.vehicleFuelType,
      registrationNumber: job.vehicleRegistrationNumber,
    },
    category: { id: job.categoryId, name: job.category.name, icon: job.category.icon },
    package: { id: job.packageId, name: job.package.name, estimatedMinutes: job.package.estimatedMinutes },

    issueDescription: job.issueDescription,
    customerNotes: job.customerNotes,
    landmark: job.landmark,

    location: {
      lat: job.jobLat ?? job.address.lat,
      lng: job.jobLng ?? job.address.lng,
      addressText: job.jobAddressText || [job.address.line1, job.address.line2, job.address.city].filter(Boolean).join(', '),
      city: job.address.city,
      pincode: job.address.pincode,
    },

    pricing: {
      estimatedCost: job.estimatedCost,
      additionalCost: job.additionalCost,
      finalAmount: job.finalAmount,
      approvalStatus: job.approvalStatus,
      approvalNote: job.approvalNote,
    },
    payment: job.payment ? { method: job.payment.method, status: job.payment.status, amount: job.payment.amount } : null,

    dispatch: {
      wave: job.dispatchWave,
      radiusKm: job.dispatchRadiusKm,
      startedAt: job.dispatchStartedAt,
      endedAt: job.dispatchEndedAt,
    },

    tracking: {
      etaSeconds: job.etaSeconds,
      distanceRemainingM: job.distanceRemainingM,
      etaUpdatedAt: job.etaUpdatedAt,
      routePolyline: LIVE_TRACKING_STATUSES.includes(job.status) ? job.routePolyline : null,
      distanceTravelledKm: Number(job.distanceTravelledKm.toFixed(2)),
      isLive: LIVE_TRACKING_STATUSES.includes(job.status),
      pingIntervalSeconds: env.TRACKING_PING_INTERVAL_SECONDS,
    },

    verification: {
      verifiedByCustomer: job.verifiedByCustomer,
      startOtpVerifiedAt: job.startOtpVerifiedAt,
      completionOtpVerifiedAt: job.completionOtpVerifiedAt,
    },

    timeline: buildTimeline(job as unknown as Record<string, unknown>),
    technician,
    contact,
    review: job.review ? { rating: job.review.rating, comment: job.review.comment, createdAt: job.review.createdAt } : null,
    cancelReason: job.cancelReason,
  };

  if (viewer === 'CUSTOMER') {
    // The customer never receives the mechanic's number, at any status.
    return base;
  }

  if (viewer === 'TECHNICIAN') {
    return {
      ...base,
      customer: {
        // First name only. A mechanic needs enough to greet someone at a
        // roadside, not a full identity.
        name: (job.user.name || 'Customer').split(' ')[0],
      },
      // The precise pin and the free-text address are released to the mechanic
      // only once they own the job -- before acceptance they saw area only
      // (see dispatch.service.ts's offer payload).
      ...(job.technicianId
        ? {}
        : { location: { ...base.location, lat: null, lng: null, addressText: base.location.city } }),
    };
  }

  // Admin. Ops genuinely needs to phone both parties when a dispatch goes
  // wrong, so numbers are visible here and nowhere else -- and every admin
  // request that reaches this branch is already behind authorize([admins]).
  return {
    ...base,
    customer: { id: job.user.id, name: job.user.name, phone: job.user.phone },
    technicianContact: job.technician ? { phone: job.technician.user?.phone ?? null } : null,
  };
}

/** Resolves the caller's relationship to a job, or throws 404 (never 403 -- a
 *  403 would confirm the job exists to someone who has no business knowing). */
async function loadJobFor(req: AuthRequest, bookingId: string): Promise<{ job: JobRow; viewer: Viewer; technicianId?: string }> {
  const job = await prisma.serviceBooking.findUnique({ where: { id: bookingId }, include: JOB_INCLUDE });
  if (!job) throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found');

  const { userId, role } = req.user!;
  if (ADMIN_ROLES.has(role)) return { job, viewer: 'ADMIN' };
  if (job.userId === userId) return { job, viewer: 'CUSTOMER' };
  if (role === 'SERVICE_TECHNICIAN' && job.technician?.userId === userId) {
    return { job, viewer: 'TECHNICIAN', technicianId: job.technician.id };
  }

  // A mechanic holding a live offer may read the job (for the offer card) but
  // gets the pre-acceptance projection.
  if (role === 'SERVICE_TECHNICIAN') {
    const tech = await prisma.serviceTechnician.findUnique({ where: { userId }, select: { id: true } });
    if (tech) {
      const offer = await prisma.jobDispatchOffer.findFirst({
        where: { bookingId, technicianId: tech.id, status: 'OFFERED' },
        select: { id: true },
      });
      if (offer) return { job, viewer: 'TECHNICIAN', technicianId: tech.id };
    }
  }

  throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found');
}

async function requireMechanic(req: AuthRequest) {
  const tech = await prisma.serviceTechnician.findUnique({
    where: { userId: req.user!.userId },
    select: { id: true, status: true },
  });
  if (!tech) throw new ApiError(404, 'NO_PROFILE', 'Mechanic profile not found');
  if (tech.status !== 'APPROVED') throw new ApiError(403, 'NOT_APPROVED', 'Your mechanic account is not approved yet.');
  return tech;
}

// ===========================================================================
// CUSTOMER
// ===========================================================================

/**
 * POST /api/jobs
 * Creates an emergency job and dispatches it immediately. No date, no slot.
 */
export const createEmergencyJob = async (req: AuthRequest, res: Response) => {
  try {
    const {
      categoryId, packageId, addressId,
      vehicleType, vehicleBrand, vehicleModel, vehicleFuelType, vehicleRegistrationNumber, userVehicleId,
      issueDescription, landmark, customerNotes,
      jobLat, jobLng, jobAddressText,
      payment_method,
    } = req.body || {};

    if (!categoryId || !packageId || !addressId) {
      throw new ApiError(400, 'MISSING_FIELDS', 'categoryId, packageId and addressId are required.');
    }
    if (!vehicleType || !vehicleBrand || !vehicleModel) {
      throw new ApiError(400, 'MISSING_VEHICLE', 'vehicleType, vehicleBrand and vehicleModel are required.');
    }
    if (vehicleType !== 'CAR' && vehicleType !== 'BIKE') {
      throw new ApiError(400, 'BAD_VEHICLE_TYPE', 'vehicleType must be CAR or BIKE.');
    }
    // Reject any attempt to schedule. Being explicit beats silently ignoring
    // the field, which would let a stale client believe it booked a slot.
    if (req.body?.scheduledDate || req.body?.timeSlotId) {
      throw new ApiError(
        400, 'NOT_SCHEDULABLE',
        'Emergency jobs are dispatched instantly and cannot carry a date or time slot.'
      );
    }

    const userId = req.user!.userId;

    // One live emergency job per customer. Two simultaneous breakdowns for one
    // person is not a real scenario, but a double-tapped button is -- and each
    // duplicate would ring every mechanic in the city a second time.
    const existing = await prisma.serviceBooking.findFirst({
      where: { userId, isEmergency: true, status: { in: ACTIVE_JOB_STATUSES } },
      select: { id: true, bookingNumber: true, status: true },
    });
    if (existing) {
      throw new ApiError(
        409, 'JOB_IN_PROGRESS',
        `You already have an active emergency request (#${existing.bookingNumber}).`
      );
    }

    const job = await prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({ where: { id: addressId, userId } });
      if (!address) throw new ApiError(404, 'ADDRESS_NOT_FOUND', 'Address not found.');
      if (!(await isPincodeServiceable(address.pincode))) {
        throw new ApiError(400, 'NOT_SERVICEABLE', `Sorry, we don't currently service pincode ${address.pincode}.`);
      }

      const category = await tx.serviceCategory.findUnique({ where: { id: categoryId } });
      if (!category || category.status !== 'Active') throw new ApiError(404, 'CATEGORY_NOT_FOUND', 'Service not found.');
      if (category.vehicleType !== vehicleType) {
        throw new ApiError(400, 'VEHICLE_MISMATCH', 'This service does not apply to the selected vehicle type.');
      }

      const pkg = await tx.servicePackage.findUnique({ where: { id: packageId } });
      if (!pkg || !pkg.isActive || pkg.categoryId !== categoryId) {
        throw new ApiError(404, 'PACKAGE_NOT_FOUND', 'Service package not found.');
      }

      if (userVehicleId) {
        const owned = await tx.userVehicle.findFirst({ where: { id: userVehicleId, userId } });
        if (!owned) throw new ApiError(404, 'VEHICLE_NOT_FOUND', 'Vehicle not found in your garage.');
      }

      // Precise pin if the customer dropped one, address centroid otherwise.
      const lat = typeof jobLat === 'number' && Number.isFinite(jobLat) ? jobLat : address.lat;
      const lng = typeof jobLng === 'number' && Number.isFinite(jobLng) ? jobLng : address.lng;
      if (lat == null || lng == null) {
        throw new ApiError(
          400, 'NO_COORDINATES',
          'We need your location to send a mechanic. Please pick your spot on the map.'
        );
      }

      const estimatedCost = pkg.discountPrice ?? pkg.price;

      return tx.serviceBooking.create({
        data: {
          bookingNumber: generateBookingNumber(),
          userId,
          isEmergency: true,
          userVehicleId: userVehicleId || null,
          vehicleType: vehicleType as VehicleType,
          vehicleBrand,
          vehicleModel,
          vehicleFuelType: vehicleFuelType || null,
          vehicleRegistrationNumber: vehicleRegistrationNumber || null,
          categoryId,
          packageId,
          addressId,
          // Explicitly null -- an emergency job holds no slot capacity.
          scheduledDate: null,
          timeSlotId: null,
          jobLat: lat,
          jobLng: lng,
          jobAddressText: jobAddressText || null,
          landmark: landmark || null,
          customerNotes: customerNotes || null,
          issueDescription: issueDescription || null,
          status: 'PENDING_ADMIN_ASSIGNMENT',
          estimatedCost,
          finalAmount: estimatedCost,
          payment: { create: pendingPaymentCreateInput(payment_method, estimatedCost) },
          statusHistory: { create: [{ status: 'PENDING_ADMIN_ASSIGNMENT', changedByUserId: userId, note: 'Emergency request created' }] },
        },
        include: JOB_INCLUDE,
      });
    });

    console.log(`[job] created emergency job=${job.bookingNumber} user=${userId}`);

    // No automatic dispatch any more -- an admin manually assigns the nearest
    // available mechanic from the live-ops queue (see jobAdmin.controller.ts's
    // adminAssign).
    await notifyUser(
      userId,
      'Booking received',
      'Your service request has been received successfully. Our team is assigning the nearest available mechanic for your request.',
      { bookingId: job.id },
      { type: NOTIFY.JOB_SEARCHING }
    );
    await notifyAdmins('New emergency job', `Job #${job.bookingNumber} needs a mechanic assigned.`, { bookingId: job.id });
    broadcastBookingStatus(job);

    res.status(201).json({ job: serializeJob(job, 'CUSTOMER') });
  } catch (err) {
    fail(res, err, 'createEmergencyJob');
  }
};

/** GET /api/jobs/active — the caller's current live emergency job, if any. */
export const getMyActiveJob = async (req: AuthRequest, res: Response) => {
  try {
    const job = await prisma.serviceBooking.findFirst({
      where: { userId: req.user!.userId, isEmergency: true, status: { in: ACTIVE_JOB_STATUSES } },
      include: JOB_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json({ job: job ? serializeJob(job, 'CUSTOMER') : null });
  } catch (err) {
    fail(res, err, 'getMyActiveJob');
  }
};

/** GET /api/jobs/:id */
export const getJob = async (req: AuthRequest, res: Response) => {
  try {
    const { job, viewer } = await loadJobFor(req, String(req.params.id));
    res.status(200).json({ job: serializeJob(job, viewer) });
  } catch (err) {
    fail(res, err, 'getJob');
  }
};

/**
 * GET /api/jobs/:id/otp?purpose=START|COMPLETION
 * Customer-only. This is the endpoint that hands the code to the person who is
 * supposed to read it aloud.
 */
export const getJobOtpForCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const bookingId = String(req.params.id);
    const purpose = String(req.query.purpose || 'START').toUpperCase();
    if (purpose !== 'START' && purpose !== 'COMPLETION') {
      throw new ApiError(400, 'BAD_PURPOSE', 'purpose must be START or COMPLETION.');
    }

    const { job, viewer } = await loadJobFor(req, bookingId);
    if (viewer !== 'CUSTOMER') {
      // Deliberately 403 rather than a silent empty response: a mechanic
      // hitting this is either a bug or an attack, and both deserve to be loud.
      throw new ApiError(403, 'CUSTOMER_ONLY', 'Only the customer can view this code.');
    }

    // Codes exist only at the moment they authorise something.
    const expected = purpose === 'START' ? 'ARRIVED' : 'WORK_STARTED';
    if (job.status !== expected) {
      throw new ApiError(
        409, 'NOT_YET',
        purpose === 'START'
          ? 'Your start code appears once the mechanic arrives.'
          : 'Your completion code appears once the mechanic finishes the work.'
      );
    }

    const otp = await getOrIssueCustomerOtp(bookingId, purpose);
    res.status(200).json({ purpose, code: otp.code, expiresAt: otp.expiresAt });
  } catch (err) {
    fail(res, err, 'getJobOtpForCustomer');
  }
};

/** POST /api/jobs/:id/cancel */
export const cancelJob = async (req: AuthRequest, res: Response) => {
  try {
    const bookingId = String(req.params.id);
    const { reason } = req.body || {};
    const { job, viewer } = await loadJobFor(req, bookingId);
    if (viewer !== 'CUSTOMER' && viewer !== 'ADMIN') {
      throw new ApiError(403, 'FORBIDDEN', 'Only the customer can cancel this job.');
    }
    // Once a mechanic is physically working on the vehicle, cancellation is a
    // support conversation, not a button.
    if (job.status === 'WORK_STARTED') {
      throw new ApiError(409, 'WORK_IN_PROGRESS', 'Work has already started. Please speak to your mechanic or contact support.');
    }

    const { booking } = await transitionJob({
      bookingId,
      to: 'CANCELLED',
      actorUserId: req.user!.userId,
      note: reason || 'Cancelled by customer',
      data: { cancelReason: reason || null, dispatchEndedAt: new Date() },
    });

    await closeOpenOffers(bookingId, 'CANCELLED');
    forgetJobTracking(bookingId);

    if (job.technician) {
      await notifyUser(
        job.technician.userId,
        'Job cancelled',
        `Job #${booking.bookingNumber} was cancelled by the customer.`,
        { bookingId },
        { type: NOTIFY.JOB_CANCELLED }
      );
    }

    res.status(200).json({ job: serializeJob({ ...job, ...booking } as JobRow, viewer) });
  } catch (err) {
    fail(res, err, 'cancelJob');
  }
};

/** GET /api/jobs/:id/trail — breadcrumb history for the map. */
export const getJobTrailHandler = async (req: AuthRequest, res: Response) => {
  try {
    const bookingId = String(req.params.id);
    await loadJobFor(req, bookingId);
    const trail = await getJobTrail(bookingId, Math.min(Number(req.query.limit) || 500, 2000));
    res.status(200).json({ trail });
  } catch (err) {
    fail(res, err, 'getJobTrail');
  }
};

/** POST /api/jobs/:id/rating */
export const rateJob = async (req: AuthRequest, res: Response) => {
  try {
    const bookingId = String(req.params.id);
    const { rating, comment } = req.body || {};
    const numeric = Number(rating);
    if (!Number.isInteger(numeric) || numeric < 1 || numeric > 5) {
      throw new ApiError(400, 'BAD_RATING', 'rating must be a whole number from 1 to 5.');
    }

    const { job, viewer } = await loadJobFor(req, bookingId);
    if (viewer !== 'CUSTOMER') throw new ApiError(403, 'CUSTOMER_ONLY', 'Only the customer can rate this job.');
    if (job.status !== 'COMPLETED') throw new ApiError(409, 'NOT_COMPLETED', 'You can only rate a completed job.');
    if (!job.technicianId) throw new ApiError(409, 'NO_MECHANIC', 'This job had no mechanic to rate.');
    if (job.review) throw new ApiError(409, 'ALREADY_RATED', 'You have already rated this job.');

    const review = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceReview.create({
        data: {
          bookingId,
          userId: req.user!.userId,
          technicianId: job.technicianId!,
          rating: numeric,
          comment: comment || null,
          ...(req.file ? { imageData: req.file.buffer, imageMimeType: req.file.mimetype } : {}),
        },
      });

      await tx.serviceBooking.update({ where: { id: bookingId }, data: { ratedAt: new Date() } });

      // Denormalized averages, recomputed from the aggregate rather than
      // incrementally, so a deleted or edited review can never leave them drifted.
      const techAgg = await tx.serviceReview.aggregate({
        where: { technicianId: job.technicianId! },
        _avg: { rating: true },
      });
      await tx.serviceTechnician.update({
        where: { id: job.technicianId! },
        data: { rating: techAgg._avg.rating ?? numeric },
      });

      const pkgAgg = await tx.serviceReview.aggregate({
        where: { booking: { packageId: job.packageId } },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await tx.servicePackage.update({
        where: { id: job.packageId },
        data: { rating: pkgAgg._avg.rating ?? numeric, reviewCount: pkgAgg._count.rating },
      });

      return created;
    });

    emitToJob(bookingId, SERVER_EVENTS.JOB_TIMELINE, {
      bookingId,
      steps: buildTimeline({ ...job, ratedAt: new Date() } as unknown as Record<string, unknown>),
    });

    res.status(201).json({ review: { id: review.id, rating: review.rating, comment: review.comment } });
  } catch (err) {
    fail(res, err, 'rateJob');
  }
};

/** POST /api/jobs/:id/call */
export const callCounterparty = async (req: AuthRequest, res: Response) => {
  try {
    const bookingId = String(req.params.id);
    const { viewer } = await loadJobFor(req, bookingId);
    if (viewer === 'ADMIN') throw new ApiError(400, 'NOT_A_PARTY', 'Admins are not a party to this call.');

    const result = await placeMaskedCall({
      bookingId,
      callerRole: viewer,
      callerUserId: req.user!.userId,
    });
    res.status(200).json(result);
  } catch (err) {
    fail(res, err, 'callCounterparty');
  }
};

/**
 * POST /api/jobs/call-status — Exotel status webhook.
 * Unauthenticated by necessity (the provider has no bearer token), so it is
 * verified by shared secret and treats its body as untrusted.
 */
export const callStatusWebhook = async (req: AuthRequest, res: Response) => {
  try {
    const secret = env.EXOTEL_API_TOKEN;
    const provided = String(req.query.token || '');
    // Constant-time so the endpoint doesn't leak the secret through timing.
    const ok =
      secret.length > 0 &&
      provided.length === secret.length &&
      crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
    if (!ok) return res.status(401).json({ error: 'Unauthorized' });

    const sid = String(req.body?.CallSid || req.query.CallSid || '');
    const status = String(req.body?.Status || req.query.Status || '');
    const duration = Number(req.body?.ConversationDuration || req.query.ConversationDuration) || undefined;
    if (sid && status) await recordCallStatus(sid, status, duration);

    // Always 200 -- a provider that gets a non-2xx will retry the same event
    // for hours.
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[job] callStatusWebhook failed:', err);
    res.status(200).json({ ok: true });
  }
};

// ===========================================================================
// MECHANIC
// ===========================================================================

/** GET /api/jobs/offers — this mechanic's live offers. */
export const getMyOffers = async (req: AuthRequest, res: Response) => {
  try {
    const tech = await requireMechanic(req);
    const offers = await prisma.jobDispatchOffer.findMany({
      where: { technicianId: tech.id, status: 'OFFERED', expiresAt: { gt: new Date() } },
      orderBy: { offeredAt: 'desc' },
      include: {
        booking: {
          include: { category: true, package: true, address: true },
        },
      },
    });

    res.status(200).json({
      offers: offers
        // A job that moved on while this mechanic's app was backgrounded is
        // not an offer any more, regardless of what the offer row still says.
        .filter((o) => o.booking.status === 'MECHANIC_ASSIGNED')
        .map((o) => ({
          offerId: o.id,
          bookingId: o.bookingId,
          bookingNumber: o.booking.bookingNumber,
          wave: o.wave,
          distanceKm: o.distanceKm,
          etaSeconds: o.etaSeconds,
          expiresAt: o.expiresAt,
          expiresInSeconds: Math.max(0, Math.round((o.expiresAt.getTime() - Date.now()) / 1000)),
          category: o.booking.category.name,
          packageName: o.booking.package.name,
          estimatedCost: o.booking.estimatedCost,
          vehicle: {
            type: o.booking.vehicleType,
            brand: o.booking.vehicleBrand,
            model: o.booking.vehicleModel,
            registrationNumber: o.booking.vehicleRegistrationNumber,
          },
          issueDescription: o.booking.issueDescription,
          // Area only until accepted -- see dispatch.service.ts.
          area: [o.booking.address.city, o.booking.address.pincode].filter(Boolean).join(' '),
        })),
    });
  } catch (err) {
    fail(res, err, 'getMyOffers');
  }
};

/** POST /api/jobs/:id/accept */
export const acceptJob = async (req: AuthRequest, res: Response) => {
  try {
    const tech = await requireMechanic(req);
    const bookingId = String(req.params.id);
    await acceptOffer(bookingId, tech.id, req.user!.userId);

    const job = await prisma.serviceBooking.findUniqueOrThrow({ where: { id: bookingId }, include: JOB_INCLUDE });
    res.status(200).json({ job: serializeJob(job, 'TECHNICIAN') });
  } catch (err) {
    fail(res, err, 'acceptJob');
  }
};

/** POST /api/jobs/:id/decline */
export const declineJob = async (req: AuthRequest, res: Response) => {
  try {
    const tech = await requireMechanic(req);
    await declineOffer(String(req.params.id), tech.id, req.body?.reason);
    res.status(200).json({ ok: true });
  } catch (err) {
    fail(res, err, 'declineJob');
  }
};

/**
 * Shared implementation for the two simple mechanic-driven transitions.
 * ARRIVED additionally issues the start OTP, because the customer's code must
 * be on their screen by the time the mechanic is standing next to them.
 */
async function mechanicTransition(
  req: AuthRequest,
  res: Response,
  to: Extract<BookingStatus, 'MECHANIC_ON_THE_WAY' | 'ARRIVED'>
) {
  const tech = await requireMechanic(req);
  const bookingId = String(req.params.id);

  const owned = await prisma.serviceBooking.findFirst({
    where: { id: bookingId, technicianId: tech.id },
    select: { id: true, status: true, userId: true, bookingNumber: true },
  });
  if (!owned) throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found or not assigned to you.');

  const { booking } = await transitionJob({
    bookingId,
    to,
    expectedFrom: owned.status,
    actorUserId: req.user!.userId,
  });

  if (to === 'MECHANIC_ON_THE_WAY') {
    await notifyUser(owned.userId, 'Mechanic on the way', STATUS_MESSAGE.MECHANIC_ON_THE_WAY, { bookingId }, { type: NOTIFY.JOB_EN_ROUTE });
  } else {
    await notifyUser(owned.userId, 'Mechanic arrived', STATUS_MESSAGE.ARRIVED, { bookingId }, { type: NOTIFY.JOB_ARRIVED });
    // Issue the start code now -- notifying the customer with the code in the
    // secure data payload only. issueJobOtp handles all of that.
    await issueJobOtp(bookingId, 'START', req.user!.userId);
    await notifyUser(
      req.user!.userId,
      'Start code required',
      'Ask the customer for their 6-digit start code to begin work.',
      { bookingId },
      { type: NOTIFY.JOB_START_OTP_REQUIRED }
    );
  }

  const job = await prisma.serviceBooking.findUniqueOrThrow({ where: { id: bookingId }, include: JOB_INCLUDE });
  res.status(200).json({ job: serializeJob(job, 'TECHNICIAN') });
  void booking;
}

/** POST /api/jobs/:id/en-route */
export const markEnRoute = async (req: AuthRequest, res: Response) => {
  try {
    await mechanicTransition(req, res, 'MECHANIC_ON_THE_WAY');
  } catch (err) {
    fail(res, err, 'markEnRoute');
  }
};

/** POST /api/jobs/:id/arrived */
export const markArrived = async (req: AuthRequest, res: Response) => {
  try {
    await mechanicTransition(req, res, 'ARRIVED');
  } catch (err) {
    fail(res, err, 'markArrived');
  }
};

/**
 * POST /api/jobs/:id/start  { otp }
 * The start gate. OTP consumption and the status transition share one
 * transaction -- see jobOtp.service.ts for why that matters.
 */
export const startWork = async (req: AuthRequest, res: Response) => {
  try {
    const tech = await requireMechanic(req);
    const bookingId = String(req.params.id);
    const { otp } = req.body || {};

    const owned = await prisma.serviceBooking.findFirst({
      where: { id: bookingId, technicianId: tech.id },
      select: { id: true, status: true, userId: true, bookingNumber: true },
    });
    if (!owned) throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found or not assigned to you.');
    if (owned.status !== 'ARRIVED') {
      throw new ApiError(409, 'NOT_ARRIVED', 'Mark yourself as arrived before starting work.');
    }

    const { booking } = await prisma.$transaction(async (tx) => {
      await verifyAndConsumeOtp(tx, bookingId, 'START', otp);
      return transitionJob({
        tx,
        bookingId,
        to: 'WORK_STARTED',
        expectedFrom: 'ARRIVED',
        actorUserId: req.user!.userId,
        otpVerified: true,
        note: 'Start OTP verified by customer',
        data: {
          startOtpVerifiedAt: new Date(),
          verifiedByCustomer: true,
        },
      });
    });

    console.log(`[job] ${booking.bookingNumber} WORK_STARTED (start OTP verified) tech=${tech.id}`);

    await notifyUser(owned.userId, 'Work started', STATUS_MESSAGE.WORK_STARTED, { bookingId }, { type: NOTIFY.JOB_WORK_STARTED });

    const job = await prisma.serviceBooking.findUniqueOrThrow({ where: { id: bookingId }, include: JOB_INCLUDE });
    res.status(200).json({ job: serializeJob(job, 'TECHNICIAN') });
  } catch (err) {
    fail(res, err, 'startWork');
  }
};

/**
 * POST /api/jobs/:id/request-completion
 * The mechanic signals they are finished; this issues the completion code to
 * the customer. Separate from /complete so the customer has the code in hand
 * before the mechanic is asked to type it.
 */
export const requestCompletion = async (req: AuthRequest, res: Response) => {
  try {
    const tech = await requireMechanic(req);
    const bookingId = String(req.params.id);

    const owned = await prisma.serviceBooking.findFirst({
      where: { id: bookingId, technicianId: tech.id },
      select: { id: true, status: true },
    });
    if (!owned) throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found or not assigned to you.');
    if (owned.status !== 'WORK_STARTED') {
      throw new ApiError(409, 'NOT_IN_PROGRESS', 'You can only request completion while work is in progress.');
    }

    const issued = await issueJobOtp(bookingId, 'COMPLETION', req.user!.userId);
    await notifyUser(
      req.user!.userId,
      'Completion code required',
      'Ask the customer for their 6-digit completion code.',
      { bookingId },
      { type: NOTIFY.JOB_COMPLETION_OTP_REQUIRED }
    );

    // The code itself is never in this response -- the mechanic is the one who
    // has to be told it by the customer.
    res.status(200).json({ message: 'Completion code sent to the customer.', expiresAt: issued.expiresAt });
  } catch (err) {
    fail(res, err, 'requestCompletion');
  }
};

/** POST /api/jobs/:id/complete  { otp } */
export const completeJob = async (req: AuthRequest, res: Response) => {
  try {
    const tech = await requireMechanic(req);
    const bookingId = String(req.params.id);
    const { otp } = req.body || {};

    const owned = await prisma.serviceBooking.findFirst({
      where: { id: bookingId, technicianId: tech.id },
      select: { id: true, status: true, userId: true, bookingNumber: true, finalAmount: true },
    });
    if (!owned) throw new ApiError(404, 'JOB_NOT_FOUND', 'Job not found or not assigned to you.');
    if (owned.status !== 'WORK_STARTED') {
      throw new ApiError(409, 'NOT_IN_PROGRESS', 'This job is not in progress.');
    }

    const { booking } = await prisma.$transaction(async (tx) => {
      await verifyAndConsumeOtp(tx, bookingId, 'COMPLETION', otp);

      const result = await transitionJob({
        tx,
        bookingId,
        to: 'COMPLETED',
        expectedFrom: 'WORK_STARTED',
        actorUserId: req.user!.userId,
        otpVerified: true,
        note: 'Completion OTP verified by customer',
        data: {
          completionOtpVerifiedAt: new Date(),
          // COD: the money changes hands at completion, so this is the moment
          // payment completes. When a gateway exists, this moves to its webhook.
          paymentCompletedAt: new Date(),
          // Clear the legacy plaintext column if this row still carries one.
          completionOtp: null,
          completionOtpGeneratedAt: null,
        },
      });

      // Credit the mechanic and settle payment inside the same transaction as
      // the transition. Previously these were separate writes, which meant a
      // failure between them could complete a job without paying anyone.
      // creditServiceCompletion resolves the platform/mechanic commission
      // split instead of paying the mechanic the full finalAmount -- see
      // services/commission.service.ts.
      await creditServiceCompletion(tx, result.booking, tech.id);
      await tx.payment.updateMany({
        where: { serviceBookingId: bookingId, status: { not: 'SUCCESS' } },
        data: { status: 'SUCCESS' },
      });
      await tx.serviceInvoice.upsert({
        where: { bookingId },
        update: {},
        create: {
          bookingId,
          invoiceNumber: `INV-${result.booking.bookingNumber}`,
          subtotal: result.booking.estimatedCost,
          additionalCost: result.booking.additionalCost,
          totalAmount: result.booking.finalAmount,
        },
      });

      return result;
    });

    forgetJobTracking(bookingId);
    await closeOpenOffers(bookingId, 'CANCELLED');

    console.log(`[job] ${booking.bookingNumber} COMPLETED (completion OTP verified) tech=${tech.id}`);

    await notifyUser(owned.userId, 'Service complete', STATUS_MESSAGE.COMPLETED, { bookingId }, { type: NOTIFY.JOB_COMPLETED });
    await notifyUser(
      owned.userId,
      'How did it go?',
      'Rate your mechanic and help other drivers.',
      { bookingId },
      { type: NOTIFY.JOB_RATING_REMINDER }
    );
    await notifyUser(
      req.user!.userId,
      'Payment recorded',
      `₹${owned.finalAmount} has been credited to your wallet for job #${owned.bookingNumber}.`,
      { bookingId },
      { type: NOTIFY.PAYMENT_STATUS }
    );

    const job = await prisma.serviceBooking.findUniqueOrThrow({ where: { id: bookingId }, include: JOB_INCLUDE });
    res.status(200).json({ job: serializeJob(job, 'TECHNICIAN') });
  } catch (err) {
    fail(res, err, 'completeJob');
  }
};

/**
 * POST /api/jobs/:id/photos  (multipart: file, type)
 * Work-progress photos. Every image is stamped with job, mechanic, time and
 * (where the device supplied it) place.
 */
const PHOTO_TYPES = new Set(['ISSUE', 'BEFORE', 'DURING', 'AFTER', 'ADDITIONAL_WORK', 'FEEDBACK']);

export const uploadJobPhoto = async (req: AuthRequest, res: Response) => {
  try {
    const bookingId = String(req.params.id);
    if (!req.file) throw new ApiError(400, 'NO_FILE', 'No file uploaded.');

    const type = String(req.body?.type || '').toUpperCase();
    if (!PHOTO_TYPES.has(type)) {
      throw new ApiError(400, 'BAD_TYPE', `type must be one of ${[...PHOTO_TYPES].join(', ')}.`);
    }

    const { job, viewer } = await loadJobFor(req, bookingId);
    if (viewer === 'ADMIN') throw new ApiError(403, 'FORBIDDEN', 'Admins cannot attach work photos.');
    if (viewer === 'TECHNICIAN' && job.technicianId == null) {
      throw new ApiError(403, 'FORBIDDEN', 'You do not own this job.');
    }

    const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

    // Dedupe a retried upload rather than storing the same megabytes twice.
    const duplicate = await prisma.serviceImage.findFirst({
      where: { bookingId, sha256, type },
      select: { id: true, type: true, createdAt: true },
    });
    if (duplicate) {
      return res.status(200).json({ image: { ...duplicate, deduplicated: true } });
    }

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    const capturedAt = req.body?.capturedAt ? new Date(String(req.body.capturedAt)) : new Date();

    const image = await prisma.serviceImage.create({
      data: {
        bookingId,
        fileData: req.file.buffer,
        mimeType: req.file.mimetype,
        type,
        uploadedByRole: viewer === 'TECHNICIAN' ? 'TECHNICIAN' : 'CUSTOMER',
        uploadedByUserId: req.user!.userId,
        capturedAt: Number.isNaN(capturedAt.getTime()) ? new Date() : capturedAt,
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        sha256,
        sizeBytes: req.file.size,
      },
      select: { id: true, type: true, uploadedByRole: true, capturedAt: true, createdAt: true },
    });

    emitToJob(bookingId, SERVER_EVENTS.JOB_PHOTO, {
      bookingId,
      imageId: image.id,
      type: image.type,
      uploadedByRole: image.uploadedByRole,
      capturedAt: image.capturedAt?.toISOString() ?? null,
    });

    res.status(201).json({ image });
  } catch (err) {
    fail(res, err, 'uploadJobPhoto');
  }
};

/** GET /api/jobs/:id/photos — metadata only; bytes come from the existing file route. */
export const listJobPhotos = async (req: AuthRequest, res: Response) => {
  try {
    const bookingId = String(req.params.id);
    await loadJobFor(req, bookingId);
    const images = await prisma.serviceImage.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, type: true, uploadedByRole: true, uploadedByUserId: true,
        capturedAt: true, lat: true, lng: true, sizeBytes: true, mimeType: true, createdAt: true,
      },
    });
    res.status(200).json({ images });
  } catch (err) {
    fail(res, err, 'listJobPhotos');
  }
};

/**
 * POST /api/jobs/:id/location — HTTP fallback for the socket batch.
 * Used when the socket is down (a background task on Android can outlive the
 * socket connection), so tracking survives even without realtime.
 */
export const postLocationBatch = async (req: AuthRequest, res: Response) => {
  try {
    const tech = await requireMechanic(req);
    const bookingId = String(req.params.id);
    const pings: PingInput[] = Array.isArray(req.body?.pings)
      ? req.body.pings
      : req.body?.lat != null
        ? [req.body as PingInput]
        : [];

    if (pings.length === 0) throw new ApiError(400, 'NO_PINGS', 'Provide pings[] or a single lat/lng.');
    if (pings.length > 300) throw new ApiError(413, 'BATCH_TOO_LARGE', 'Send at most 300 pings per request.');

    const result = await ingestPings(bookingId, tech.id, pings);
    res.status(200).json(result);
  } catch (err) {
    fail(res, err, 'postLocationBatch');
  }
};
