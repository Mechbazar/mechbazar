import prisma from '../config/prisma';
import { env } from '../config/env';
import { haversineKm } from './geocoding.service';
import { emitToTechnician, isTechnicianOnSocket } from '../realtime/gateway';
import { SERVER_EVENTS, OfferEvent, OfferClosedEvent } from '../realtime/events';
import { sendExpoPush } from '../utils/expoPush';
import { sendFcmPush } from '../utils/fcmPush';
import { resolvePushDevices } from '../utils/pushDevice';
import { notifyUser, notifyAdmins, NOTIFY } from '../utils/notify';
import { transitionJob, JobTransitionError, ACTIVE_JOB_STATUSES } from './jobState';
import type { DispatchOfferStatus } from '@prisma/client';

// Single-mechanic assignment/offer engine.
//
// There is no automatic matching any more -- an admin always picks exactly
// one mechanic (service.controller.ts's assignTechnician for scheduled
// bookings, jobAdmin.controller.ts's adminAssign for emergency jobs). This
// module's only job is running that one offer's accept/reject/expiry
// lifecycle: notify the mechanic, let them accept or decline within the
// countdown window (ServiceBooking.assignmentExpiresAt), and if they don't
// respond in time, return the booking to the admin queue (REJECTED) for a
// fresh pick. No candidate ranking, no wave fan-out, no "no mechanic found"
// terminal state -- an admin always has another mechanic to try.
//
// The JobDispatchOffer table/accept-decline lifecycle is reused as-is from
// the old wave-dispatch engine (so is the mechanic app's OfferInboxScreen +
// its countdown UI) -- it already modeled exactly what a single timed offer
// needs, it just used to receive N simultaneous candidates instead of one.

export class DispatchError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * Admin picked `technicianId` for `bookingId`, expiring at `expiresAt`
 * (ServiceBooking.assignmentExpiresAt, set by the caller in the same
 * transitionJob call that moved the booking to MECHANIC_ASSIGNED). Creates
 * the offer row and notifies that one mechanic. Does not touch the booking's
 * own status/technicianId -- the caller already did that.
 */
export async function createSingleOffer(bookingId: string, technicianId: string, expiresAt: Date): Promise<void> {
  const [booking, technician] = await Promise.all([
    prisma.serviceBooking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { category: true, package: true, address: true, user: { select: { name: true } } },
    }),
    prisma.serviceTechnician.findUniqueOrThrow({ where: { id: technicianId } }),
  ]);

  const lat = booking.jobLat ?? booking.address.lat;
  const lng = booking.jobLng ?? booking.address.lng;
  const distanceKm =
    lat != null && lng != null && technician.currentLat != null && technician.currentLng != null
      ? Number(haversineKm(lat, lng, technician.currentLat, technician.currentLng).toFixed(3))
      : null;

  const offer = await prisma.jobDispatchOffer.upsert({
    where: { bookingId_technicianId: { bookingId, technicianId } },
    create: { bookingId, technicianId, wave: 1, status: 'OFFERED' as DispatchOfferStatus, distanceKm, expiresAt },
    update: { status: 'OFFERED' as DispatchOfferStatus, distanceKm, expiresAt, respondedAt: null, offeredAt: new Date(), declineReason: null },
  });

  const channels: string[] = [];
  const payload: OfferEvent = {
    offerId: offer.id,
    bookingId,
    bookingNumber: booking.bookingNumber,
    wave: 1,
    distanceKm: offer.distanceKm,
    etaSeconds: null,
    expiresAt: offer.expiresAt.toISOString(),
    expiresInSeconds: Math.max(0, Math.round((offer.expiresAt.getTime() - Date.now()) / 1000)),
    category: booking.category.name,
    packageName: booking.package.name,
    estimatedCost: booking.estimatedCost,
    vehicle: {
      type: booking.vehicleType,
      brand: booking.vehicleBrand,
      model: booking.vehicleModel,
      registrationNumber: booking.vehicleRegistrationNumber,
    },
    issueDescription: booking.issueDescription,
    // Area only. The exact pin and the customer's name/contact route are
    // withheld until this mechanic actually accepts.
    area: [booking.address.city, booking.address.pincode].filter(Boolean).join(' '),
    jobLat: null,
    jobLng: null,
  };

  if (await isTechnicianOnSocket(technicianId)) {
    emitToTechnician(technicianId, SERVER_EVENTS.OFFER_NEW, payload);
    channels.push('SOCKET');
  }

  const distanceText = offer.distanceKm != null ? `${offer.distanceKm.toFixed(1)} km` : 'nearby';
  const pushBody = `Customer: ${booking.user.name || 'Customer'}\nService: ${booking.package.name}\nDistance: ${distanceText}\nTap to Accept`;
  const offerPushData = { type: NOTIFY.OFFER_NEW, bookingId, offerId: offer.id, expiresAt: offer.expiresAt.toISOString() };

  // Every device this mechanic has registered (PushDevice rows if any exist,
  // else their single legacy ServiceTechnician.expoPushToken) -- see
  // utils/pushDevice.ts. Distinct from notifyUser's own device resolution
  // below since this send must never be persisted (see the socketOnly call
  // right after this).
  const devices = await resolvePushDevices(technician.userId, { expo: technician.expoPushToken });
  const sentPlatforms = new Set<string>();
  for (const device of devices) {
    if (device.platform === 'FCM') {
      await sendFcmPush(device.token, 'New Service Request', pushBody, offerPushData);
      sentPlatforms.add('FCM_PUSH');
    } else {
      await sendExpoPush(device.token, 'New Service Request', pushBody, offerPushData);
      sentPlatforms.add('EXPO_PUSH');
    }
  }
  channels.push(...sentPlatforms);

  await notifyUser(technician.userId, 'New Service Request', pushBody, { bookingId, offerId: offer.id }, { type: NOTIFY.OFFER_NEW, socketOnly: true });

  await prisma.jobDispatchOffer.update({ where: { id: offer.id }, data: { notifiedVia: channels } });

  if (channels.length === 0) {
    console.warn(`[dispatch] offer ${offer.id} to tech ${technicianId} had no delivery channel`);
  }
  console.log(`[dispatch] ${booking.bookingNumber} offered to tech=${technicianId}`);
}

/**
 * A mechanic accepts their offer. Admin only ever offers one job to one
 * mechanic at a time, so this can't race another mechanic the way the old
 * wave engine's accept could -- but the conditional UPDATE stays anyway,
 * since it's what makes a retried/duplicated accept request safe.
 */
export async function acceptOffer(bookingId: string, technicianId: string, actorUserId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const offer = await tx.jobDispatchOffer.findUnique({
      where: { bookingId_technicianId: { bookingId, technicianId } },
    });
    if (!offer) throw new DispatchError(404, 'NO_OFFER', 'You have no offer for this job.');
    if (offer.status !== 'OFFERED') {
      throw new DispatchError(
        409,
        offer.status === 'ACCEPTED' ? 'ALREADY_YOURS' : 'OFFER_CLOSED',
        offer.status === 'ACCEPTED' ? 'You already accepted this job.' : 'This offer is no longer open.'
      );
    }
    if (offer.expiresAt.getTime() < Date.now()) {
      await tx.jobDispatchOffer.update({
        where: { id: offer.id },
        data: { status: 'EXPIRED', respondedAt: new Date() },
      });
      throw new DispatchError(410, 'OFFER_EXPIRED', 'This offer expired.');
    }

    const activeElsewhere = await tx.serviceBooking.count({
      where: { technicianId, status: { in: ACTIVE_JOB_STATUSES }, id: { not: bookingId } },
    });
    if (activeElsewhere >= env.DISPATCH_MAX_CONCURRENT_JOBS) {
      throw new DispatchError(409, 'AT_CAPACITY', 'Finish your current job before accepting another.');
    }

    // `technicianId: null` in the WHERE still makes this a compare-and-swap,
    // guarding against a duplicated accept request rather than a competing
    // mechanic (there is only ever one candidate now).
    const claim = await tx.serviceBooking.updateMany({
      where: { id: bookingId, status: 'MECHANIC_ASSIGNED', technicianId: null },
      data: { technicianId, assignmentExpiresAt: null },
    });
    if (claim.count === 0) {
      throw new DispatchError(409, 'ALREADY_TAKEN', 'This offer is no longer available.');
    }

    await tx.jobDispatchOffer.update({
      where: { id: offer.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });

    const { booking } = await transitionJob({
      tx,
      bookingId,
      to: 'MECHANIC_ACCEPTED',
      expectedFrom: 'MECHANIC_ASSIGNED',
      actorUserId,
      note: offer.distanceKm != null ? `Accepted at ${offer.distanceKm.toFixed(1)} km` : 'Accepted',
    });

    return { booking, offer };
  });

  const { booking } = result;
  await notifyUser(
    booking.userId,
    'Mechanic accepted',
    `${booking.technician?.user?.name || 'Your mechanic'} has been assigned and accepted your request.`,
    { bookingId },
    { type: NOTIFY.JOB_ACCEPTED }
  );

  console.log(`[dispatch] ${booking.bookingNumber} ACCEPTED by tech=${technicianId}`);
  return booking;
}

/** A mechanic declines. The booking returns to the admin queue -- no auto-reassignment. */
export async function declineOffer(bookingId: string, technicianId: string, reason?: string) {
  const offer = await prisma.jobDispatchOffer.findUnique({
    where: { bookingId_technicianId: { bookingId, technicianId } },
  });
  if (!offer) throw new DispatchError(404, 'NO_OFFER', 'You have no offer for this job.');
  if (offer.status !== 'OFFERED') {
    // Declining an already-closed offer is not an error worth surfacing to a
    // mechanic who is driving.
    return offer;
  }

  const updated = await prisma.jobDispatchOffer.update({
    where: { id: offer.id },
    data: { status: 'DECLINED', respondedAt: new Date(), declineReason: reason || null },
  });

  emitToTechnician(technicianId, SERVER_EVENTS.OFFER_CLOSED, {
    offerId: offer.id, bookingId, reason: 'DECLINED',
  } satisfies OfferClosedEvent);

  try {
    const { booking } = await transitionJob({
      bookingId,
      to: 'REJECTED',
      expectedFrom: 'MECHANIC_ASSIGNED',
      note: reason ? `Declined by mechanic: ${reason}` : 'Declined by mechanic',
      data: { assignmentExpiresAt: null },
    });
    await notifyAdmins('Booking needs reassignment', `Job #${booking.bookingNumber} was declined and needs to be reassigned.`, { bookingId });
  } catch (err) {
    // Booking already moved on (cancelled, admin force-transitioned) --
    // nothing to do.
    if (!(err instanceof JobTransitionError)) throw err;
  }

  return updated;
}

/** Closes every still-open offer on a job (accepted elsewhere, cancelled, concluded). */
export async function closeOpenOffers(
  bookingId: string,
  reason: Extract<DispatchOfferStatus, 'CANCELLED' | 'SUPERSEDED' | 'EXPIRED'>
): Promise<number> {
  const open = await prisma.jobDispatchOffer.findMany({
    where: { bookingId, status: 'OFFERED' },
    select: { id: true, technicianId: true },
  });
  if (open.length === 0) return 0;

  await prisma.jobDispatchOffer.updateMany({
    where: { id: { in: open.map((o) => o.id) } },
    data: { status: reason, respondedAt: new Date() },
  });

  for (const offer of open) {
    emitToTechnician(offer.technicianId, SERVER_EVENTS.OFFER_CLOSED, {
      offerId: offer.id, bookingId, reason,
    });
  }
  return open.length;
}

/**
 * Sweeper entry point (called every 10s by jobs/sweeper.ts). Independent of
 * any in-process timer -- this is the actual "60 second countdown" guarantee,
 * not an optimisation. Flips any MECHANIC_ASSIGNED booking whose
 * assignmentExpiresAt has passed back to REJECTED (admin queue), for both the
 * scheduled and emergency flows uniformly.
 */
export async function sweepExpiredAssignments(): Promise<{ expired: number }> {
  const stale = await prisma.serviceBooking.findMany({
    where: { status: 'MECHANIC_ASSIGNED', assignmentExpiresAt: { lt: new Date() } },
    select: { id: true, isEmergency: true, technicianId: true },
    take: 200,
  });

  let expired = 0;
  for (const job of stale) {
    try {
      // Emergency jobs hold their candidate on an open offer -- technicianId
      // stays null on the booking itself until accept. Scheduled bookings
      // write technicianId directly at assign time, so it has to be cleared
      // here the same way rejectBookingJob clears it on an explicit reject.
      let notifyTechnicianId = job.technicianId;
      if (job.isEmergency) {
        const openOffer = await prisma.jobDispatchOffer.findFirst({
          where: { bookingId: job.id, status: 'OFFERED' },
          select: { technicianId: true },
        });
        notifyTechnicianId = openOffer?.technicianId ?? null;
        await closeOpenOffers(job.id, 'EXPIRED');
      }

      const { booking } = await transitionJob({
        bookingId: job.id,
        to: 'REJECTED',
        expectedFrom: 'MECHANIC_ASSIGNED',
        note: 'Mechanic did not respond in time',
        data: { assignmentExpiresAt: null, ...(job.isEmergency ? {} : { technicianId: null }) },
      });
      expired += 1;

      if (notifyTechnicianId) {
        const tech = await prisma.serviceTechnician.findUnique({ where: { id: notifyTechnicianId }, select: { userId: true } });
        if (tech) {
          await notifyUser(
            tech.userId,
            'Assignment expired',
            `You did not respond in time to booking #${booking.bookingNumber}. It has been returned to the queue.`,
            { bookingId: job.id }
          );
        }
      }
      await notifyAdmins('Assignment expired', `Booking #${booking.bookingNumber} was not accepted in time and needs to be reassigned.`, { bookingId: job.id });
    } catch (err) {
      if (err instanceof JobTransitionError) {
        console.log(`[dispatch] sweepExpiredAssignments skipped ${job.id}: ${err.code}`);
      } else {
        console.error(`[dispatch] sweepExpiredAssignments failed for ${job.id}:`, err);
      }
    }
  }

  return { expired };
}

// A scheduled booking still sitting in PENDING_ADMIN_ASSIGNMENT this long
// means no admin has picked a mechanic at all yet -- the UI's own copy
// ("Usually assigned within 10-15 minutes") sets the customer's expectation,
// so 15 minutes past that is a real SLA miss, not routine variance. Rather
// than leave the customer staring at a spinner indefinitely, the booking is
// cancelled and they're told to try again, same as if they'd tapped Cancel
// themselves (identical transaction shape to service.controller.ts's
// cancelBooking, just system-initiated). Emergency jobs are excluded --
// they need faster human dispatch attention than a 15-minute window
// implies, and auto-cancelling a breakdown request with no fallback offered
// is a worse outcome than leaving it queued.
const AUTO_CANCEL_UNASSIGNED_MS = 15 * 60_000;

export async function sweepUnassignedBookings(): Promise<{ cancelled: number }> {
  const cutoff = new Date(Date.now() - AUTO_CANCEL_UNASSIGNED_MS);
  const stale = await prisma.serviceBooking.findMany({
    where: { status: 'PENDING_ADMIN_ASSIGNMENT', isEmergency: false, createdAt: { lt: cutoff } },
    select: { id: true, bookingNumber: true, userId: true },
    take: 200,
  });

  let cancelled = 0;
  for (const job of stale) {
    try {
      const reason = 'No mechanic was assigned within 15 minutes';
      await prisma.$transaction(async (tx) => {
        await tx.serviceBooking.update({
          where: { id: job.id },
          data: { status: 'CANCELLED', cancelReason: reason },
        });
        await tx.bookingStatusHistory.create({
          data: { bookingId: job.id, status: 'CANCELLED', note: `Auto-cancelled: ${reason.toLowerCase()}` },
        });
      });
      cancelled += 1;
      await notifyUser(
        job.userId,
        'Booking cancelled',
        `We couldn't assign a mechanic to booking #${job.bookingNumber} in time, so it was cancelled. Please book again and we'll get right on it.`,
        { bookingId: job.id }
      );
      await notifyAdmins(
        'Booking auto-cancelled',
        `Booking #${job.bookingNumber} was auto-cancelled -- no mechanic was assigned within 15 minutes.`,
        { bookingId: job.id }
      );
    } catch (err) {
      console.error(`[dispatch] sweepUnassignedBookings failed for ${job.id}:`, err);
    }
  }

  return { cancelled };
}
