import { JobOtpPurpose, Prisma } from '@prisma/client';
import prisma from '../config/prisma';
import { env } from '../config/env';
import { encryptOtpCode, decryptOtpCode, generateOtpCode, timingSafeEqualStr } from '../utils/jobCrypto';
import { emitToJob } from '../realtime/gateway';
import { SERVER_EVENTS } from '../realtime/events';
import { notifyUser, NOTIFY } from '../utils/notify';

// Start and completion OTPs.
//
// The threat this defends against is a mechanic marking work started or
// completed without the customer being present and agreeing -- which is both a
// billing dispute and, for "work started", a consent question about someone
// touching a stranger's vehicle. The code is therefore issued TO THE CUSTOMER
// and entered BY THE MECHANIC; it never travels in the direction the mechanic
// could fake.
//
// Properties:
//  * codes are AES-GCM encrypted at rest (utils/jobCrypto.ts), never plaintext;
//  * single-use -- `consumedAt` is set inside the same transaction as the
//    status transition, so a replayed request cannot re-run the transition;
//  * attempt-limited, and the limit is enforced with an atomic increment so
//    concurrent guesses cannot both slip under the cap;
//  * expiring, with a fresh code obtainable at any time (which invalidates the
//    previous one);
//  * never present in any response, push title/body, or log line reachable by
//    the mechanic.

export class OtpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface IssuedOtp {
  purpose: JobOtpPurpose;
  expiresAt: Date;
  /** Plaintext. Only ever returned into a response addressed to the customer. */
  code: string;
}

/**
 * Issues (or re-issues) an OTP for a job. Any previous unconsumed code for the
 * same purpose is invalidated, so exactly one code is live at a time and a
 * customer reading an old SMS/notification can't accidentally authorise
 * something.
 */
export async function issueJobOtp(
  bookingId: string,
  purpose: JobOtpPurpose,
  createdByUserId?: string
): Promise<IssuedOtp> {
  const booking = await prisma.serviceBooking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, bookingNumber: true, status: true },
  });
  if (!booking) throw new OtpError(404, 'JOB_NOT_FOUND', 'Job not found');

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + env.JOB_OTP_TTL_SECONDS * 1000);

  await prisma.$transaction(async (tx) => {
    // Retire the previous live code. Marked consumed rather than deleted so
    // the audit trail keeps every code that was ever issued for this job.
    await tx.jobOtp.updateMany({
      where: { bookingId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await tx.jobOtp.create({
      data: {
        bookingId,
        purpose,
        codeEnc: encryptOtpCode(code),
        maxAttempts: env.JOB_OTP_MAX_ATTEMPTS,
        expiresAt,
        createdByUserId: createdByUserId || null,
      },
    });
  });

  const isStart = purpose === 'START';

  // The code goes to the customer only, and only in the data payload -- never
  // in title/body, which render on a lock screen and would let anyone holding
  // the phone read the code without unlocking it. That would defeat the entire
  // point of requiring the customer to say it out loud.
  await notifyUser(
    booking.userId,
    isStart ? 'Start code ready' : 'Completion code ready',
    isStart
      ? 'Your mechanic has arrived. Open the app and share your 6-digit start code.'
      : 'Work is finished. Open the app and share your 6-digit completion code.',
    { bookingId },
    {
      type: isStart ? NOTIFY.JOB_START_OTP : NOTIFY.JOB_COMPLETION_OTP,
      secureData: { otp: code, purpose, expiresAt: expiresAt.toISOString() },
    }
  );

  // Room-level event carries no code -- the mechanic is in this room too. The
  // customer's own copy arrives via the per-user notification above.
  emitToJob(bookingId, SERVER_EVENTS.JOB_OTP, {
    bookingId,
    purpose,
    expiresAt: expiresAt.toISOString(),
  });

  console.log(`[otp] issued ${purpose} for job=${booking.bookingNumber} ttl=${env.JOB_OTP_TTL_SECONDS}s`);

  return { purpose, expiresAt, code };
}

/**
 * Returns the live code for a job, for the customer's own screen. The caller
 * MUST have already established that the requester owns the booking.
 * Auto-issues one if none is live, so the customer's OTP screen can never be
 * empty at the moment they need to read a number out.
 */
export async function getOrIssueCustomerOtp(bookingId: string, purpose: JobOtpPurpose): Promise<IssuedOtp> {
  const live = await prisma.jobOtp.findFirst({
    where: { bookingId, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (live) {
    const code = decryptOtpCode(live.codeEnc);
    // Undecryptable means the key changed under us. Issue a fresh code rather
    // than showing the customer nothing.
    if (code) return { purpose, expiresAt: live.expiresAt, code };
    console.error(`[otp] undecryptable code ${live.id}; reissuing`);
  }

  return issueJobOtp(bookingId, purpose);
}

export interface VerifyResult {
  ok: true;
  otpId: string;
}

/**
 * Verifies a submitted code and consumes it, INSIDE the caller's transaction.
 *
 * Taking `tx` is deliberate: consumption and the status transition it
 * authorises must commit or roll back together. If they were separate
 * transactions, a failure between them would either burn a code without
 * starting the job (mechanic stuck, customer must re-read a new code) or start
 * the job on a code that stays reusable.
 */
export async function verifyAndConsumeOtp(
  tx: Prisma.TransactionClient,
  bookingId: string,
  purpose: JobOtpPurpose,
  submitted: string
): Promise<VerifyResult> {
  const normalized = String(submitted || '').replace(/\D/g, '');
  if (normalized.length !== 6) {
    throw new OtpError(400, 'OTP_MALFORMED', 'Enter the 6-digit code from the customer.');
  }

  const otp = await tx.jobOtp.findFirst({
    where: { bookingId, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) {
    throw new OtpError(400, 'OTP_NOT_ISSUED', 'No code has been issued for this step yet. Ask the customer to generate one.');
  }
  if (otp.expiresAt.getTime() < Date.now()) {
    throw new OtpError(410, 'OTP_EXPIRED', 'That code has expired. Ask the customer for a fresh one.');
  }
  if (otp.attempts >= otp.maxAttempts) {
    throw new OtpError(429, 'OTP_LOCKED', 'Too many incorrect attempts. Ask the customer to generate a new code.');
  }

  // Increment BEFORE comparing, and conditionally on the attempt count we just
  // read. Two concurrent guesses therefore cannot both pass the cap check and
  // both get a free attempt -- one of them loses the compare-and-swap and is
  // told to retry.
  const bumped = await tx.jobOtp.updateMany({
    where: { id: otp.id, attempts: otp.attempts, consumedAt: null },
    data: { attempts: { increment: 1 } },
  });
  if (bumped.count === 0) {
    throw new OtpError(409, 'OTP_CONCURRENT', 'Another verification is in progress. Try again.');
  }

  const expected = decryptOtpCode(otp.codeEnc);
  if (!expected) {
    console.error(`[otp] undecryptable code ${otp.id} during verification`);
    throw new OtpError(500, 'OTP_UNREADABLE', 'This code could not be validated. Ask the customer to generate a new one.');
  }

  if (!timingSafeEqualStr(expected, normalized)) {
    const remaining = Math.max(0, otp.maxAttempts - (otp.attempts + 1));
    throw new OtpError(
      400, 'OTP_INCORRECT',
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Incorrect code. Ask the customer to generate a new one.'
    );
  }

  // Consume, guarded on it still being unconsumed. A replayed request that
  // reaches here concurrently loses this swap and is rejected rather than
  // authorising the transition twice.
  const consumed = await tx.jobOtp.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) {
    throw new OtpError(409, 'OTP_ALREADY_USED', 'This code has already been used.');
  }

  return { ok: true, otpId: otp.id };
}

/**
 * Retention sweep. Consumed and expired codes are pruned once they are old
 * enough to be useless for dispute resolution -- there is no reason to keep
 * ciphertext of six-digit codes indefinitely.
 */
export async function sweepExpiredOtps(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const { count } = await prisma.jobOtp.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  return count;
}
