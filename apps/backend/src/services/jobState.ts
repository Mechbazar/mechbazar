import { BookingStatus, Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { emitToJob, emitToAdmins } from '../realtime/gateway';
import { SERVER_EVENTS, JobStatusEvent, JobTimelineStep } from '../realtime/events';

// The emergency job state machine, and the single place a status transition is
// allowed to happen.
//
// Every transition in this system goes through `transitionJob`. That is what
// makes the following true, all of which were previously enforced ad hoc in
// each controller (or not at all):
//
//  * a transition is atomic and idempotent -- it claims the row conditionally
//    on the status it was read at, so a retried mobile request cannot run the
//    same transition twice;
//  * the denormalized timeline column and the append-only history row are
//    written in the same transaction as the status, so they can never drift;
//  * the realtime broadcast happens only after the transaction commits, so no
//    client can ever observe a status that was later rolled back.

// ---------------------------------------------------------------------------
// Legal transitions
// ---------------------------------------------------------------------------

/**
 * Allowed next states per current state, for the emergency flow. Anything not
 * listed is rejected with 409.
 *
 * CANCELLED is reachable from every non-terminal state and is therefore added
 * programmatically below rather than repeated eleven times.
 */
const BASE_TRANSITIONS: Partial<Record<BookingStatus, BookingStatus[]>> = {
  PENDING: ['SEARCHING', 'MECHANIC_ASSIGNED'],
  // Dispatch either finds someone, exhausts its waves, or is superseded by an
  // admin assigning manually.
  SEARCHING: ['MECHANIC_ACCEPTED', 'NO_MECHANIC_FOUND', 'MECHANIC_ASSIGNED'],
  // A job nobody took can be re-dispatched (customer retry) or hand-assigned.
  NO_MECHANIC_FOUND: ['SEARCHING', 'MECHANIC_ASSIGNED'],
  // The scheduled-booking path and admin manual assignment both land here.
  MECHANIC_ASSIGNED: ['MECHANIC_ACCEPTED', 'REJECTED', 'SEARCHING'],
  MECHANIC_ACCEPTED: ['MECHANIC_ON_THE_WAY'],
  MECHANIC_ON_THE_WAY: ['ARRIVED'],
  // WORK_STARTED is only reachable by verifying the START OTP -- there is no
  // other caller, admin included (see forceTransition's guard).
  ARRIVED: ['WORK_STARTED'],
  // COMPLETED is only reachable by verifying the COMPLETION OTP.
  WORK_STARTED: ['COMPLETED'],
  // A mechanic declining a job they already owned goes back into dispatch.
  REJECTED: ['SEARCHING', 'MECHANIC_ASSIGNED'],
  CONFIRMED: ['MECHANIC_ASSIGNED', 'SEARCHING'],
};

export const TERMINAL_STATUSES: BookingStatus[] = ['COMPLETED', 'CANCELLED'];

/** Statuses in which a mechanic is actively engaged and GPS should be flowing. */
export const LIVE_TRACKING_STATUSES: BookingStatus[] = [
  'MECHANIC_ACCEPTED', 'MECHANIC_ON_THE_WAY', 'ARRIVED', 'WORK_STARTED',
];

/** Statuses that count as "this job is still open" for dispatch/ops purposes. */
export const ACTIVE_JOB_STATUSES: BookingStatus[] = [
  'PENDING', 'CONFIRMED', 'SEARCHING', 'MECHANIC_ASSIGNED',
  'MECHANIC_ACCEPTED', 'MECHANIC_ON_THE_WAY', 'ARRIVED', 'WORK_STARTED',
];

/**
 * The two transitions the OTP gate owns. Nothing else -- not an admin, not a
 * support agent -- may produce them, because reaching them by any other route
 * would mean a job records `verifiedByCustomer` semantics it never earned.
 */
const OTP_GATED: BookingStatus[] = ['WORK_STARTED', 'COMPLETED'];

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (to === 'CANCELLED') return !TERMINAL_STATUSES.includes(from);
  return (BASE_TRANSITIONS[from] || []).includes(to);
}

// ---------------------------------------------------------------------------
// Copy + timeline
// ---------------------------------------------------------------------------

/** Customer-facing one-liner per status. Single source, so every channel agrees. */
export const STATUS_MESSAGE: Record<BookingStatus, string> = {
  PENDING: 'We have your request.',
  CONFIRMED: 'Your request is confirmed.',
  SEARCHING: 'Searching for a mechanic near you…',
  MECHANIC_ASSIGNED: 'A mechanic has been assigned to you.',
  MECHANIC_ACCEPTED: 'Your mechanic accepted the job.',
  MECHANIC_ON_THE_WAY: 'Your mechanic is on the way.',
  ARRIVED: 'Your mechanic has arrived.',
  WORK_STARTED: 'Work has started on your vehicle.',
  COMPLETED: 'Your service is complete.',
  CANCELLED: 'This job was cancelled.',
  REJECTED: 'Your mechanic became unavailable. Finding another…',
  NO_MECHANIC_FOUND: 'No mechanic is available right now.',
};

/** The customer-facing progress labels from the spec, in order. */
const TIMELINE_SPEC: { key: string; label: string; field: string }[] = [
  { key: 'REQUESTED', label: 'Requested', field: 'createdAt' },
  { key: 'MECHANIC_NOTIFIED', label: 'Mechanic Notified', field: 'dispatchStartedAt' },
  { key: 'ACCEPTED', label: 'Accepted', field: 'acceptedAt' },
  { key: 'TRAVELLING', label: 'Travelling', field: 'enRouteAt' },
  { key: 'ARRIVED', label: 'Arrived', field: 'arrivedAt' },
  { key: 'START_OTP_VERIFIED', label: 'Start OTP Verified', field: 'startOtpVerifiedAt' },
  { key: 'REPAIR_STARTED', label: 'Repair Started', field: 'startedAt' },
  { key: 'REPAIR_COMPLETED', label: 'Repair Completed', field: 'completedAt' },
  { key: 'COMPLETION_OTP_VERIFIED', label: 'Completion OTP Verified', field: 'completionOtpVerifiedAt' },
  { key: 'PAYMENT_COMPLETED', label: 'Payment Completed', field: 'paymentCompletedAt' },
  { key: 'CUSTOMER_RATED', label: 'Customer Rated', field: 'ratedAt' },
];

type TimelineSource = Record<string, unknown>;

export function buildTimeline(booking: TimelineSource): JobTimelineStep[] {
  return TIMELINE_SPEC.map(({ key, label, field }) => {
    const raw = booking[field];
    const at = raw instanceof Date ? raw.toISOString() : typeof raw === 'string' ? raw : null;
    return { key, label, at, done: !!at };
  });
}

/**
 * Which timeline column a given status stamps. Written inside the transition
 * transaction; `??` semantics mean the first arrival wins, so a transient
 * bounce back and forth can't rewrite history.
 */
const STATUS_TIMESTAMP_FIELD: Partial<Record<BookingStatus, string>> = {
  SEARCHING: 'dispatchStartedAt',
  MECHANIC_ACCEPTED: 'acceptedAt',
  MECHANIC_ON_THE_WAY: 'enRouteAt',
  ARRIVED: 'arrivedAt',
  WORK_STARTED: 'startedAt',
  COMPLETED: 'completedAt',
};

// ---------------------------------------------------------------------------
// Transition
// ---------------------------------------------------------------------------

export class JobTransitionError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface TransitionOptions {
  bookingId: string;
  to: BookingStatus;
  /** Guard: only apply if the row is still in this status. Omit to read-then-claim. */
  expectedFrom?: BookingStatus;
  actorUserId?: string | null;
  note?: string;
  /**
   * Extra columns to set atomically with the status. Unchecked (raw scalar)
   * input rather than the relation-shaped variant, because callers legitimately
   * need to set foreign keys directly -- `technicianId` on an admin assignment,
   * for instance -- and this runs through `updateMany`, which takes the
   * unchecked shape anyway.
   */
  data?: Prisma.ServiceBookingUncheckedUpdateManyInput;
  /**
   * Set by the OTP verification path only. Without it, a transition into
   * WORK_STARTED or COMPLETED is refused -- see OTP_GATED.
   */
  otpVerified?: boolean;
  /**
   * Admin override. Permits an OTP-gated transition without an OTP (a stuck
   * job, a customer who left) but records it as such and deliberately does not
   * set verifiedByCustomer.
   */
  adminOverride?: boolean;
  /** Run inside a caller-provided transaction instead of opening a new one. */
  tx?: Prisma.TransactionClient;
}

export interface TransitionResult {
  booking: Prisma.ServiceBookingGetPayload<{ include: { technician: { include: { user: true } } } }>;
  previousStatus: BookingStatus;
}

/**
 * Atomically move a job to a new status. Returns the updated booking, or
 * throws JobTransitionError with an HTTP status the controller can pass
 * straight through.
 */
export async function transitionJob(opts: TransitionOptions): Promise<TransitionResult> {
  const run = async (tx: Prisma.TransactionClient): Promise<TransitionResult> => {
    const current = await tx.serviceBooking.findUnique({
      where: { id: opts.bookingId },
      select: { id: true, status: true, bookingNumber: true },
    });
    if (!current) throw new JobTransitionError(404, 'JOB_NOT_FOUND', 'Job not found');

    const from = current.status;

    if (opts.expectedFrom && from !== opts.expectedFrom) {
      throw new JobTransitionError(
        409, 'STATUS_CHANGED',
        `Job is ${from}, expected ${opts.expectedFrom}. Refresh and retry.`
      );
    }

    // A repeat of a transition that already landed is success, not an error.
    // Mobile clients retry aggressively on flaky networks and this is the
    // difference between "OTP accepted" and a spurious red banner in the
    // customer's face while the mechanic stands there.
    if (from === opts.to) {
      const unchanged = await tx.serviceBooking.findUniqueOrThrow({
        where: { id: opts.bookingId },
        include: { technician: { include: { user: true } } },
      });
      return { booking: unchanged, previousStatus: from };
    }

    if (!canTransition(from, opts.to)) {
      throw new JobTransitionError(409, 'ILLEGAL_TRANSITION', `Cannot move a job from ${from} to ${opts.to}`);
    }

    if (OTP_GATED.includes(opts.to) && !opts.otpVerified && !opts.adminOverride) {
      throw new JobTransitionError(
        403, 'OTP_REQUIRED',
        `Moving to ${opts.to} requires a verified ${opts.to === 'WORK_STARTED' ? 'start' : 'completion'} OTP.`
      );
    }

    const timestampField = STATUS_TIMESTAMP_FIELD[opts.to];

    // Conditional claim: the WHERE re-checks the status under Postgres's row
    // lock at UPDATE time, not against the value read above. This is what makes
    // concurrent duplicate requests safe -- exactly one of them gets count 1.
    const claim = await tx.serviceBooking.updateMany({
      where: { id: opts.bookingId, status: from },
      data: {
        status: opts.to,
        ...(timestampField ? { [timestampField]: new Date() } : {}),
        ...opts.data,
      },
    });
    if (claim.count === 0) {
      throw new JobTransitionError(409, 'CONCURRENT_UPDATE', 'This job was updated by someone else. Refresh and retry.');
    }

    await tx.bookingStatusHistory.create({
      data: {
        bookingId: opts.bookingId,
        status: opts.to,
        note: opts.adminOverride ? `[admin override] ${opts.note || ''}`.trim() : opts.note || null,
        changedByUserId: opts.actorUserId || null,
      },
    });

    const booking = await tx.serviceBooking.findUniqueOrThrow({
      where: { id: opts.bookingId },
      include: { technician: { include: { user: true } } },
    });

    return { booking, previousStatus: from };
  };

  const result = opts.tx ? await run(opts.tx) : await prisma.$transaction(run);

  // Broadcast only after commit. Emitting from inside the transaction would
  // let clients observe a status that a later rollback erased.
  if (result.previousStatus !== result.booking.status) {
    broadcastJobStatus(result);
  }
  return result;
}

export function broadcastJobStatus(result: TransitionResult): void {
  const { booking, previousStatus } = result;

  const payload: JobStatusEvent = {
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    previousStatus,
    at: new Date().toISOString(),
    message: STATUS_MESSAGE[booking.status],
    technician: booking.technician
      ? {
          id: booking.technician.id,
          name: booking.technician.user?.name ?? null,
          rating: booking.technician.rating,
          totalJobs: booking.technician.totalJobs,
          // Auth-gated endpoint, not a public URL -- clients fetch it with
          // their own bearer token, same as every other private image here.
          photoUrl: `/api/services/bookings/${booking.id}/technician-photo`,
        }
      : null,
  };

  emitToJob(booking.id, SERVER_EVENTS.JOB_STATUS, payload);
  emitToJob(booking.id, SERVER_EVENTS.JOB_TIMELINE, {
    bookingId: booking.id,
    steps: buildTimeline(booking as unknown as TimelineSource),
  });
  emitToAdmins(SERVER_EVENTS.ADMIN_JOB_UPDATE, {
    bookingId: booking.id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    technicianId: booking.technicianId,
    isEmergency: booking.isEmergency,
    at: payload.at,
  });
}
