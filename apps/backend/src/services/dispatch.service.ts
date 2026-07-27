import { Prisma, BookingStatus, DispatchOfferStatus } from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { haversineKm } from './geocoding.service';
import { estimateRouteOffline } from './routing.service';
import { emitToJob, emitToTechnician, emitToAdmins, isTechnicianOnSocket } from '../realtime/gateway';
import { SERVER_EVENTS, OfferEvent, JobDispatchEvent } from '../realtime/events';
import { sendExpoPush } from '../utils/expoPush';
import { notifyUser, notifyAdmins, NOTIFY } from '../utils/notify';
import { transitionJob, JobTransitionError, ACTIVE_JOB_STATUSES } from './jobState';

// The dispatch engine.
//
// Model: waves. Wave 1 offers the job to every eligible mechanic within the
// first configured radius; if nobody accepts before the offers expire, wave 2
// goes out to a larger radius, and so on. Within a wave every mechanic is rung
// simultaneously and the first to accept wins -- a broadcast auction, not a
// sequential hand-off. That is the right shape for an emergency: sequential
// offers multiply the customer's wait by the number of mechanics who happen to
// be ignoring their phone.
//
// The three properties that matter, and where each is enforced:
//
//  1. EXACTLY ONE mechanic can win. `acceptOffer` claims the booking with a
//     conditional UPDATE (`status = SEARCHING AND technicianId IS NULL`).
//     Postgres serialises the row lock, so of N concurrent accepts exactly one
//     sees count 1; the rest get 409 and their offers are marked SUPERSEDED.
//     There is no advisory lock, no Redis mutex, and no read-then-write window.
//
//  2. NO DUPLICATE OFFERS. `@@unique([bookingId, technicianId])` plus
//     `skipDuplicates` on the wave insert. A wave that partially fails can be
//     retried verbatim.
//
//  3. NO ORPHANED JOBS. Every wave schedules its own follow-up, and a periodic
//     sweeper (jobs/sweeper.ts) independently re-checks every SEARCHING job.
//     If the in-process timer is lost -- a redeploy mid-dispatch, a crash --
//     the sweeper picks the job up within one tick. The timer is an
//     optimisation; the sweeper is the guarantee.

const OFFER_TTL_MS = env.DISPATCH_OFFER_TTL_SECONDS * 1000;

/** In-process timers, keyed by bookingId. Best-effort only -- see note 3. */
const waveTimers = new Map<string, NodeJS.Timeout>();

function clearWaveTimer(bookingId: string): void {
  const timer = waveTimers.get(bookingId);
  if (timer) {
    clearTimeout(timer);
    waveTimers.delete(bookingId);
  }
}

function scheduleWaveAdvance(bookingId: string, delayMs: number): void {
  clearWaveTimer(bookingId);
  const timer = setTimeout(() => {
    waveTimers.delete(bookingId);
    advanceDispatch(bookingId).catch((err) =>
      console.error(`[dispatch] wave advance failed for ${bookingId}:`, err)
    );
  }, delayMs);
  // Don't hold the event loop open during a graceful shutdown; the sweeper on
  // the next boot will pick up anything left mid-flight.
  timer.unref?.();
  waveTimers.set(bookingId, timer);
}

// ---------------------------------------------------------------------------
// Candidate selection
// ---------------------------------------------------------------------------

export interface Candidate {
  id: string;
  userId: string;
  expoPushToken: string | null;
  distanceKm: number;
  etaSeconds: number;
  rating: number;
  currentLat: number;
  currentLng: number;
}

/**
 * Eligible mechanics for a job, nearest first.
 *
 * Filtering happens in two stages on purpose. Stage one is a bounding-box
 * query the database can serve from an index; stage two is exact Haversine in
 * application code over that (small) result set. Doing the distance maths in
 * SQL without PostGIS would mean a sequential scan over every mechanic row on
 * every dispatch tick.
 */
export async function findCandidates(
  bookingId: string,
  vehicleType: 'CAR' | 'BIKE',
  lat: number,
  lng: number,
  radiusKm: number
): Promise<Candidate[]> {
  const staleBefore = new Date(Date.now() - env.DISPATCH_STALE_LOCATION_SECONDS * 1000);

  // 1 degree of latitude is ~111 km everywhere; longitude shrinks with
  // latitude, hence the cos() correction. Generous by construction -- this box
  // only has to be a superset of the true circle.
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));

  const rows = await prisma.serviceTechnician.findMany({
    where: {
      isOnline: true,
      isActive: true,
      status: 'APPROVED',
      specializations: { has: vehicleType },
      lastLocationAt: { gte: staleBefore },
      currentLat: { gte: lat - latDelta, lte: lat + latDelta },
      currentLng: { gte: lng - lngDelta, lte: lng + lngDelta },
      // Never re-offer a job to a mechanic who already saw it -- whether they
      // declined it, let it expire, or are being rung right now in this wave.
      dispatchOffers: { none: { bookingId } },
      // Capacity. An emergency job is not queueable: a mechanic already
      // committed to a live job must not be pulled towards a second one.
      bookings: { none: { status: { in: ACTIVE_JOB_STATUSES }, id: { not: bookingId } } },
    },
    select: {
      id: true, userId: true, expoPushToken: true, rating: true,
      currentLat: true, currentLng: true,
    },
    // Bounded so a pathological configuration (500 km radius) can't pull the
    // entire mechanic table into memory.
    take: 200,
  });

  const candidates = rows
    .filter((t) => t.currentLat != null && t.currentLng != null)
    .map((t) => {
      const distanceKm = haversineKm(lat, lng, t.currentLat!, t.currentLng!);
      return {
        id: t.id,
        userId: t.userId,
        expoPushToken: t.expoPushToken,
        rating: t.rating,
        currentLat: t.currentLat!,
        currentLng: t.currentLng!,
        distanceKm,
        etaSeconds: estimateRouteOffline({ lat: t.currentLat!, lng: t.currentLng! }, { lat, lng }).etaSeconds,
      };
    })
    .filter((c) => c.distanceKm <= radiusKm);

  // Nearest first, rating as the tiebreak. Deliberately NOT a weighted blend:
  // on a breakdown, arrival time dominates, and a scoring function that can
  // send a 4.9-star mechanic from 8 km away instead of a 4.5-star one from
  // 1 km is optimising the wrong thing.
  candidates.sort((a, b) => (a.distanceKm - b.distanceKm) || (b.rating - a.rating));

  return candidates.slice(0, env.DISPATCH_MAX_PER_WAVE);
}

// ---------------------------------------------------------------------------
// Starting and advancing dispatch
// ---------------------------------------------------------------------------

/**
 * Kick off dispatch for a freshly created emergency job. Moves it to SEARCHING
 * and fires wave 1. Safe to call more than once -- a job already SEARCHING is
 * left alone.
 */
export async function startDispatch(bookingId: string): Promise<void> {
  const booking = await prisma.serviceBooking.findUnique({
    where: { id: bookingId },
    select: { id: true, status: true, isEmergency: true },
  });
  if (!booking) return;
  if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED' && booking.status !== 'NO_MECHANIC_FOUND' && booking.status !== 'REJECTED') {
    return;
  }

  try {
    await transitionJob({
      bookingId,
      to: 'SEARCHING',
      expectedFrom: booking.status,
      note: 'Emergency dispatch started',
      data: { dispatchWave: 0, dispatchEndedAt: null },
    });
  } catch (err) {
    if (err instanceof JobTransitionError) {
      // Someone got there first (admin assigned, customer cancelled). Nothing
      // to dispatch.
      console.log(`[dispatch] start skipped for ${bookingId}: ${err.code}`);
      return;
    }
    throw err;
  }

  await advanceDispatch(bookingId);
}

/**
 * Run the next wave for a job, or conclude dispatch if the waves are
 * exhausted. Idempotent and safe to call concurrently: the wave counter is
 * incremented with a conditional UPDATE, so two simultaneous callers cannot
 * both run wave N.
 */
export async function advanceDispatch(bookingId: string): Promise<void> {
  const booking = await prisma.serviceBooking.findUnique({
    where: { id: bookingId },
    include: { category: true, package: true, address: true },
  });
  if (!booking) return;

  if (booking.status !== 'SEARCHING') {
    // Job was accepted, cancelled or hand-assigned while the timer was
    // pending. Close out anything still open and stop.
    clearWaveTimer(bookingId);
    await closeOpenOffers(bookingId, 'CANCELLED');
    return;
  }

  // Expire the previous wave's unanswered offers before opening the next one,
  // so a mechanic can never hold two live offers for the same job.
  await expireOffersForBooking(bookingId);

  const waves = env.DISPATCH_WAVE_RADII_KM;
  const nextWave = booking.dispatchWave + 1;

  const lat = booking.jobLat ?? booking.address.lat;
  const lng = booking.jobLng ?? booking.address.lng;

  if (lat == null || lng == null) {
    // Cannot rank anyone without a position. This is an ops problem, not a
    // customer problem -- surface it rather than silently searching forever.
    console.error(`[dispatch] job ${booking.bookingNumber} has no coordinates; escalating to ops`);
    await concludeNoMechanic(bookingId, 'Job has no usable coordinates');
    return;
  }

  if (nextWave > waves.length) {
    await concludeNoMechanic(bookingId, `All ${waves.length} dispatch waves exhausted`);
    return;
  }

  const radiusKm = waves[nextWave - 1];

  // Claim this wave. If another caller already advanced past it, stop.
  const claim = await prisma.serviceBooking.updateMany({
    where: { id: bookingId, status: 'SEARCHING', dispatchWave: booking.dispatchWave },
    data: { dispatchWave: nextWave, dispatchRadiusKm: radiusKm },
  });
  if (claim.count === 0) {
    console.log(`[dispatch] wave ${nextWave} for ${booking.bookingNumber} already claimed elsewhere`);
    return;
  }

  const candidates = await findCandidates(bookingId, booking.vehicleType, lat, lng, radiusKm);
  const expiresAt = new Date(Date.now() + OFFER_TTL_MS);

  if (candidates.length === 0) {
    console.log(`[dispatch] ${booking.bookingNumber} wave ${nextWave} (${radiusKm}km): no candidates`);
    await broadcastDispatchProgress(bookingId, nextWave, radiusKm, 0, null);
    // Nothing to wait for -- go straight to the next radius instead of
    // burning the full offer TTL on an empty wave.
    if (nextWave >= waves.length) {
      await concludeNoMechanic(bookingId, 'No mechanics available in any radius');
    } else {
      await advanceDispatch(bookingId);
    }
    return;
  }

  await prisma.jobDispatchOffer.createMany({
    data: candidates.map((c) => ({
      bookingId,
      technicianId: c.id,
      wave: nextWave,
      status: 'OFFERED' as DispatchOfferStatus,
      distanceKm: Number(c.distanceKm.toFixed(3)),
      etaSeconds: c.etaSeconds,
      expiresAt,
    })),
    // The unique constraint makes a retried wave a no-op rather than an error.
    skipDuplicates: true,
  });

  const offers = await prisma.jobDispatchOffer.findMany({
    where: { bookingId, wave: nextWave, status: 'OFFERED' },
    select: { id: true, technicianId: true, distanceKm: true, etaSeconds: true, expiresAt: true },
  });

  const candidateById = new Map(candidates.map((c) => [c.id, c]));

  await Promise.all(
    offers.map(async (offer) => {
      const candidate = candidateById.get(offer.technicianId);
      const channels: string[] = [];

      const payload: OfferEvent = {
        offerId: offer.id,
        bookingId,
        bookingNumber: booking.bookingNumber,
        wave: nextWave,
        distanceKm: offer.distanceKm,
        etaSeconds: offer.etaSeconds,
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
        // Area only. The exact pin, the customer's name and any contact route
        // are withheld until this mechanic actually wins the job -- otherwise
        // every mechanic in a 20 km radius harvests the address of every
        // breakdown in the city just by staying online.
        area: [booking.address.city, booking.address.pincode].filter(Boolean).join(' '),
        jobLat: null,
        jobLng: null,
      };

      if (await isTechnicianOnSocket(offer.technicianId)) {
        emitToTechnician(offer.technicianId, SERVER_EVENTS.OFFER_NEW, payload);
        channels.push('SOCKET');
      }

      if (candidate?.expoPushToken) {
        await sendExpoPush(
          candidate.expoPushToken,
          '🚨 Emergency job nearby',
          `${booking.category.name} · ${offer.distanceKm?.toFixed(1)} km away · ₹${booking.estimatedCost}`,
          { type: NOTIFY.OFFER_NEW, bookingId, offerId: offer.id, expiresAt: offer.expiresAt.toISOString() }
        );
        channels.push('EXPO_PUSH');
      }

      if (candidate) {
        await notifyUser(
          candidate.userId,
          'Emergency job nearby',
          `${booking.category.name} · ${offer.distanceKm?.toFixed(1)} km away`,
          { bookingId, offerId: offer.id },
          { type: NOTIFY.OFFER_NEW, socketOnly: true }
        );
      }

      await prisma.jobDispatchOffer.update({
        where: { id: offer.id },
        data: { notifiedVia: channels },
      });

      if (channels.length === 0) {
        // Offered to a mechanic we had no live route to. Worth a log line --
        // it looks identical to "ignored the job" in the data otherwise.
        console.warn(`[dispatch] offer ${offer.id} to tech ${offer.technicianId} had no delivery channel`);
      }
    })
  );

  console.log(
    `[dispatch] ${booking.bookingNumber} wave ${nextWave} (${radiusKm}km): offered to ${offers.length} mechanic(s)`
  );

  await broadcastDispatchProgress(bookingId, nextWave, radiusKm, offers.length, expiresAt);

  // Advance shortly after this wave's offers lapse. The small grace period
  // stops a mechanic tapping Accept at T-0 from racing the expiry sweep.
  scheduleWaveAdvance(bookingId, OFFER_TTL_MS + 1500);
}

async function broadcastDispatchProgress(
  bookingId: string,
  wave: number,
  radiusKm: number | null,
  notified: number,
  expiresAt: Date | null
): Promise<void> {
  const totalNotified = await prisma.jobDispatchOffer.count({ where: { bookingId } });
  const payload: JobDispatchEvent = {
    bookingId,
    wave,
    radiusKm,
    mechanicsNotified: notified,
    totalNotified,
    expiresInSeconds: expiresAt ? Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 1000)) : null,
    exhausted: false,
  };
  emitToJob(bookingId, SERVER_EVENTS.JOB_DISPATCH, payload);
}

async function concludeNoMechanic(bookingId: string, reason: string): Promise<void> {
  clearWaveTimer(bookingId);
  await closeOpenOffers(bookingId, 'EXPIRED');

  try {
    const { booking } = await transitionJob({
      bookingId,
      to: 'NO_MECHANIC_FOUND',
      expectedFrom: 'SEARCHING',
      note: reason,
      data: { dispatchEndedAt: new Date() },
    });

    emitToJob(bookingId, SERVER_EVENTS.JOB_DISPATCH, {
      bookingId, wave: booking.dispatchWave, radiusKm: booking.dispatchRadiusKm,
      mechanicsNotified: 0,
      totalNotified: await prisma.jobDispatchOffer.count({ where: { bookingId } }),
      expiresInSeconds: null, exhausted: true,
    } satisfies JobDispatchEvent);

    await notifyUser(
      booking.userId,
      'No mechanic available',
      'We could not reach a mechanic near you right now. Our team has been alerted — you can retry or wait for us to call.',
      { bookingId },
      { type: NOTIFY.JOB_NO_MECHANIC }
    );
    // A stranded customer is an ops escalation, not a dead end.
    await notifyAdmins(
      '🚨 Emergency job unfilled',
      `Job #${booking.bookingNumber} found no mechanic (${reason}). Manual assignment needed.`,
      { bookingId },
      { type: NOTIFY.JOB_NO_MECHANIC }
    );

    console.warn(`[dispatch] ${booking.bookingNumber} UNFILLED: ${reason}`);
  } catch (err) {
    if (!(err instanceof JobTransitionError)) throw err;
  }
}

// ---------------------------------------------------------------------------
// Accept / decline
// ---------------------------------------------------------------------------

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
 * A mechanic accepts an offer. This is the race: N mechanics may call this
 * simultaneously for the same job and exactly one must win.
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

    // Re-check capacity inside the transaction. Between the wave being built
    // and this accept landing, the mechanic may have won a different job.
    const activeElsewhere = await tx.serviceBooking.count({
      where: { technicianId, status: { in: ACTIVE_JOB_STATUSES }, id: { not: bookingId } },
    });
    if (activeElsewhere >= env.DISPATCH_MAX_CONCURRENT_JOBS) {
      throw new DispatchError(409, 'AT_CAPACITY', 'Finish your current job before accepting another.');
    }

    // ---- The claim. ----
    // `technicianId: null` in the WHERE is what makes this a compare-and-swap
    // rather than a last-writer-wins update: it can only match a job nobody
    // owns. Postgres serialises concurrent UPDATEs on the same row, so of N
    // simultaneous accepts exactly one observes count === 1.
    const claim = await tx.serviceBooking.updateMany({
      where: { id: bookingId, status: 'SEARCHING', technicianId: null },
      data: { technicianId, dispatchEndedAt: new Date() },
    });
    if (claim.count === 0) {
      throw new DispatchError(409, 'ALREADY_TAKEN', 'Another mechanic accepted this job first.');
    }

    await tx.jobDispatchOffer.update({
      where: { id: offer.id },
      data: { status: 'ACCEPTED', respondedAt: new Date() },
    });

    // Everyone else in this auction loses, atomically with the win.
    await tx.jobDispatchOffer.updateMany({
      where: { bookingId, status: 'OFFERED', technicianId: { not: technicianId } },
      data: { status: 'SUPERSEDED', respondedAt: new Date() },
    });

    const { booking } = await transitionJob({
      tx,
      bookingId,
      to: 'MECHANIC_ACCEPTED',
      expectedFrom: 'SEARCHING',
      actorUserId,
      note: `Accepted from wave ${offer.wave} at ${offer.distanceKm?.toFixed(1)} km`,
      data: { dispatchRadiusKm: offer.distanceKm },
    });

    return { booking, offer };
  });

  clearWaveTimer(bookingId);

  // Tell the losers, so their offer cards disappear instead of counting down
  // to an expiry that will never come.
  const superseded = await prisma.jobDispatchOffer.findMany({
    where: { bookingId, status: 'SUPERSEDED' },
    select: { id: true, technicianId: true },
  });
  for (const lost of superseded) {
    emitToTechnician(lost.technicianId, SERVER_EVENTS.OFFER_CLOSED, {
      offerId: lost.id, bookingId, reason: 'SUPERSEDED',
    });
  }

  const { booking } = result;
  await notifyUser(
    booking.userId,
    'Mechanic found',
    `${booking.technician?.user?.name || 'Your mechanic'} accepted your request and will head over now.`,
    { bookingId },
    { type: NOTIFY.JOB_ACCEPTED }
  );
  emitToAdmins(SERVER_EVENTS.ADMIN_JOB_UPDATE, {
    bookingId, status: 'MECHANIC_ACCEPTED', technicianId, at: new Date().toISOString(),
  });

  console.log(`[dispatch] ${booking.bookingNumber} ACCEPTED by tech=${technicianId} wave=${result.offer.wave}`);
  return booking;
}

/** A mechanic declines. The wave continues for everyone else. */
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
  });

  // If that was the last open offer in this wave, don't make the customer wait
  // out the remaining TTL for a wave nobody is left to answer.
  const stillOpen = await prisma.jobDispatchOffer.count({ where: { bookingId, status: 'OFFERED' } });
  if (stillOpen === 0) {
    const booking = await prisma.serviceBooking.findUnique({ where: { id: bookingId }, select: { status: true } });
    if (booking?.status === 'SEARCHING') {
      await advanceDispatch(bookingId);
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

/** Marks this job's lapsed offers EXPIRED and notifies the mechanics holding them. */
export async function expireOffersForBooking(bookingId: string): Promise<number> {
  const lapsed = await prisma.jobDispatchOffer.findMany({
    where: { bookingId, status: 'OFFERED', expiresAt: { lt: new Date() } },
    select: { id: true, technicianId: true },
  });
  if (lapsed.length === 0) return 0;

  await prisma.jobDispatchOffer.updateMany({
    where: { id: { in: lapsed.map((o) => o.id) } },
    data: { status: 'EXPIRED', respondedAt: new Date() },
  });

  for (const offer of lapsed) {
    emitToTechnician(offer.technicianId, SERVER_EVENTS.OFFER_CLOSED, {
      offerId: offer.id, bookingId, reason: 'EXPIRED',
    });
  }
  return lapsed.length;
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
 * Sweeper entry point. Independent of the in-process timers, so a job whose
 * timer was lost to a redeploy still advances. Returns counters for the
 * ops log.
 */
export async function sweepDispatch(): Promise<{ expired: number; advanced: number; stuck: number }> {
  let expired = 0;
  let advanced = 0;
  let stuck = 0;

  // 1. Close every lapsed offer platform-wide in one statement.
  const lapsed = await prisma.jobDispatchOffer.findMany({
    where: { status: 'OFFERED', expiresAt: { lt: new Date() } },
    select: { id: true, bookingId: true, technicianId: true },
    take: 500,
  });
  if (lapsed.length > 0) {
    await prisma.jobDispatchOffer.updateMany({
      where: { id: { in: lapsed.map((o) => o.id) } },
      data: { status: 'EXPIRED', respondedAt: new Date() },
    });
    expired = lapsed.length;
    for (const offer of lapsed) {
      emitToTechnician(offer.technicianId, SERVER_EVENTS.OFFER_CLOSED, {
        offerId: offer.id, bookingId: offer.bookingId, reason: 'EXPIRED',
      });
    }
  }

  // 2. Any SEARCHING job with no open offers left needs its next wave. This is
  //    the safety net that makes the in-process timers optional.
  const searching = await prisma.serviceBooking.findMany({
    where: { status: 'SEARCHING' },
    select: { id: true, bookingNumber: true, dispatchStartedAt: true },
    take: 200,
  });

  for (const job of searching) {
    const openCount = await prisma.jobDispatchOffer.count({
      where: { bookingId: job.id, status: 'OFFERED' },
    });
    if (openCount > 0) continue;

    if (waveTimers.has(job.id)) continue;

    stuck += 1;
    try {
      await advanceDispatch(job.id);
      advanced += 1;
    } catch (err) {
      console.error(`[dispatch] sweeper failed to advance ${job.bookingNumber}:`, err);
    }
  }

  return { expired, advanced, stuck };
}

/** Called on shutdown so pending timers don't fire against a closing pool. */
export function stopDispatchTimers(): void {
  for (const timer of waveTimers.values()) clearTimeout(timer);
  waveTimers.clear();
}
