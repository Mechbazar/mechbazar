import prisma from '../config/prisma';
import { env, MASKED_CALLING_ENABLED } from '../config/env';

// Number masking / privacy-preserving voice.
//
// The product rule is that a customer and a mechanic can talk without either
// learning the other's phone number, and only during the window in which they
// have business with each other. This module is the ONLY place in the backend
// that can reach a raw phone number for that purpose, and it never returns one
// to a client.
//
// How masking actually works (Exotel "Connect" API, which is the standard
// Indian carrier-grade option): the server asks Exotel to bridge two legs. Leg
// one rings the caller's own handset; when they answer, Exotel dials leg two
// and bridges them. Neither leg ever sees the other party's MSISDN -- both see
// the platform's virtual number (EXOTEL_CALLER_ID). The client is never told
// anything except "your phone is about to ring".
//
// IMPORTANT -- what happens without credentials: the feature reports itself
// unavailable (503). There is deliberately NO fallback to `tel:` with a real
// number. A fallback like that silently converts a privacy feature into a
// privacy breach the first time a config value is missing, which is exactly
// when nobody is watching. Configure Exotel, or the button stays disabled.

export class CallError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * The window in which contact between customer and mechanic is permitted.
 * Before acceptance there is no counterparty yet; after completion the
 * relationship is over and further contact is a harassment vector, so the
 * channel closes. Support remains reachable through the normal ticket path in
 * both cases.
 */
export const CONTACT_OPEN_STATUSES = new Set([
  'MECHANIC_ACCEPTED', 'MECHANIC_ON_THE_WAY', 'ARRIVED', 'WORK_STARTED',
]);

export interface CallTarget {
  bookingId: string;
  /** Who is pressing the button. */
  callerRole: 'CUSTOMER' | 'TECHNICIAN';
  callerUserId: string;
}

export interface CallResult {
  callSessionId: string;
  /**
   * What the app should display. There is no number here on purpose: with
   * Exotel Connect the platform calls the user, the user does not dial out.
   */
  mode: 'CALLBACK';
  message: string;
  /** The platform's virtual number, so the app can tell the user what to expect. */
  virtualNumber: string;
}

/**
 * Places a masked call between the two parties of a job.
 *
 * Every attempt writes a CallSession row before any provider call is made, so
 * an abusive pattern is visible in the data even when the provider leg fails.
 */
export async function placeMaskedCall(target: CallTarget): Promise<CallResult> {
  const booking = await prisma.serviceBooking.findUnique({
    where: { id: target.bookingId },
    select: {
      id: true, status: true, bookingNumber: true, userId: true, technicianId: true,
      user: { select: { phone: true } },
      technician: { select: { userId: true, user: { select: { phone: true } } } },
    },
  });
  if (!booking) throw new CallError(404, 'JOB_NOT_FOUND', 'Job not found');

  if (!CONTACT_OPEN_STATUSES.has(booking.status)) {
    throw new CallError(
      403, 'CONTACT_CLOSED',
      booking.status === 'COMPLETED' || booking.status === 'CANCELLED'
        ? 'This job is closed. Contact support if you still need help.'
        : 'Calling opens once a mechanic accepts the job.'
    );
  }
  if (!booking.technicianId || !booking.technician) {
    throw new CallError(409, 'NO_COUNTERPARTY', 'No mechanic is assigned to this job yet.');
  }

  // Authorization: only the two parties to this job, and only in their own
  // direction.
  const isCustomer = booking.userId === target.callerUserId;
  const isMechanic = booking.technician.userId === target.callerUserId;
  if ((target.callerRole === 'CUSTOMER' && !isCustomer) || (target.callerRole === 'TECHNICIAN' && !isMechanic)) {
    throw new CallError(403, 'FORBIDDEN', 'You are not a party to this job.');
  }

  const fromPhone = target.callerRole === 'CUSTOMER' ? booking.user.phone : booking.technician.user.phone;
  const toPhone = target.callerRole === 'CUSTOMER' ? booking.technician.user.phone : booking.user.phone;
  if (!fromPhone || !toPhone) {
    throw new CallError(409, 'NO_PHONE', 'One of the parties has no reachable number on file.');
  }

  const session = await prisma.callSession.create({
    data: {
      bookingId: booking.id,
      initiatedByUserId: target.callerUserId,
      fromRole: target.callerRole,
      provider: MASKED_CALLING_ENABLED ? 'EXOTEL' : 'DIRECT_FALLBACK',
      virtualNumber: env.EXOTEL_CALLER_ID || null,
      status: 'INITIATED',
    },
    select: { id: true },
  });

  if (!MASKED_CALLING_ENABLED) {
    await prisma.callSession.update({
      where: { id: session.id },
      data: { status: 'FAILED', failureReason: 'MASKING_NOT_CONFIGURED', endedAt: new Date() },
    });
    throw new CallError(
      503, 'CALLING_UNAVAILABLE',
      'In-app calling is not available right now. Use chat, or contact support.'
    );
  }

  try {
    const sid = await exotelConnect(fromPhone, toPhone, booking.bookingNumber);
    await prisma.callSession.update({
      where: { id: session.id },
      data: { status: 'RINGING', providerCallSid: sid },
    });

    // Numbers are logged as last-4 only. A full MSISDN in an application log
    // is the same leak this module exists to prevent, just via a different
    // channel.
    console.log(
      `[call] job=${booking.bookingNumber} ${target.callerRole} -> counterparty ` +
        `(…${fromPhone.slice(-4)} -> …${toPhone.slice(-4)}) sid=${sid}`
    );

    return {
      callSessionId: session.id,
      mode: 'CALLBACK',
      message: 'Connecting… your phone will ring in a moment.',
      virtualNumber: env.EXOTEL_CALLER_ID,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await prisma.callSession.update({
      where: { id: session.id },
      data: { status: 'FAILED', failureReason: reason.slice(0, 200), endedAt: new Date() },
    });
    console.error(`[call] provider failure for job=${booking.bookingNumber}:`, reason);
    throw new CallError(502, 'CALL_FAILED', 'Could not place the call. Please try again or use chat.');
  }
}

/**
 * Exotel Connect: bridges two legs through the platform's virtual number.
 * Returns the provider call SID.
 */
async function exotelConnect(from: string, to: string, reference: string): Promise<string> {
  const url =
    `https://${env.EXOTEL_API_KEY}:${env.EXOTEL_API_TOKEN}@${env.EXOTEL_SUBDOMAIN}` +
    `/v1/Accounts/${env.EXOTEL_SID}/Calls/connect.json`;

  const body = new URLSearchParams({
    From: from,
    To: to,
    CallerId: env.EXOTEL_CALLER_ID,
    CallType: 'trans',
    // Correlates the provider's own CDR with our CallSession row when
    // reconciling billing or investigating a dispute.
    CustomField: reference,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Exotel HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data: any = await res.json();
  const sid = data?.Call?.Sid;
  if (!sid) throw new Error('Exotel response contained no call SID');
  return sid;
}

/**
 * Provider status callback. Exotel POSTs here as the call progresses so the
 * CallSession row ends up with a real outcome and duration rather than being
 * stuck at RINGING forever.
 */
export async function recordCallStatus(
  providerCallSid: string,
  status: string,
  durationSec?: number
): Promise<void> {
  const normalized = status.toUpperCase();
  const mapped =
    normalized === 'COMPLETED' ? 'COMPLETED'
    : normalized === 'IN-PROGRESS' || normalized === 'ANSWERED' ? 'ANSWERED'
    : normalized === 'FAILED' || normalized === 'NO-ANSWER' || normalized === 'BUSY' ? 'FAILED'
    : 'RINGING';

  await prisma.callSession.updateMany({
    where: { providerCallSid },
    data: {
      status: mapped,
      durationSec: durationSec ?? undefined,
      ...(mapped === 'COMPLETED' || mapped === 'FAILED' ? { endedAt: new Date() } : {}),
      ...(mapped === 'FAILED' ? { failureReason: normalized } : {}),
    },
  });
}

/**
 * Whether the in-app call button should be shown, and why not when it
 * shouldn't. Returned as part of the job payload so every client renders the
 * same rule instead of each reimplementing it.
 */
export function contactAvailability(status: string, hasTechnician: boolean) {
  if (!hasTechnician) {
    return { canCall: false, canChat: false, reason: 'No mechanic assigned yet.' };
  }
  if (!CONTACT_OPEN_STATUSES.has(status)) {
    return {
      canCall: false,
      canChat: false,
      reason: status === 'COMPLETED' || status === 'CANCELLED'
        ? 'This job is closed. Contact support if you need help.'
        : 'Contact opens once the mechanic accepts.',
    };
  }
  return {
    canCall: MASKED_CALLING_ENABLED,
    canChat: true,
    reason: MASKED_CALLING_ENABLED ? null : 'In-app calling is temporarily unavailable. Use chat.',
  };
}
