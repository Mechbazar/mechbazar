import prisma from '../config/prisma';
import { env } from '../config/env';
import { sweepExpiredAssignments } from '../services/dispatch.service';
import { sweepExpiredOtps } from '../services/jobOtp.service';
import { sweepOldPings } from '../services/tracking.service';
import { reconcileStalePendingPayments } from '../services/payment.service';
import { generateScheduledSettlements } from '../services/settlement.service';
import { sweepScheduledNotifications } from '../services/broadcast.service';
import { retryFailedNotificationDeliveries } from '../utils/notify';

// Background maintenance.
//
// The design rule this enforces: nothing may depend on an in-process timer
// surviving. Timers are an optimisation for latency; these sweeps are the
// correctness guarantee. A redeploy, a crash, or an OOM kill mid-flight must
// leave nothing permanently stuck.
//
// Cadences are chosen against what each sweep protects:
//
//  * ASSIGNMENT (10s) -- a customer is watching a spinner. This is the one
//    that must be fast, and it is cheap: an indexed query plus whatever it
//    finds. This is the real "60 second countdown" enforcement -- an
//    unanswered MECHANIC_ASSIGNED booking is flipped back to REJECTED here,
//    not by any client-side timer.
//  * MECHANIC PRESENCE (60s) -- a phone that died still shows as "online" in
//    the admin's assign-a-mechanic picker.
//  * RETENTION (hourly) -- deleting old breadcrumbs and spent OTPs. Deliberately
//    the slowest and the only one that issues DELETEs at volume.
//  * PAYMENT RECONCILE (5m) -- catches a Razorpay payment whose webhook never
//    arrived. Not latency-sensitive (the webhook is the fast path; this is
//    only the fallback), and each tick is a no-op API call unless Razorpay is
//    actually configured -- see services/payment.service.ts.

const DISPATCH_SWEEP_MS = 10_000;
const PRESENCE_SWEEP_MS = 60_000;
const RETENTION_SWEEP_MS = 60 * 60_000;
const PAYMENT_RECONCILE_SWEEP_MS = 5 * 60_000;
// Cycle granularity is DAILY at its shortest, so an hourly check is more
// than fine-grained enough -- a settlement generated an hour "late" is not a
// correctness issue, only ever a delay (see settlement.service.ts).
const SETTLEMENT_GENERATION_SWEEP_MS = 60 * 60_000;
// SCHEDULED NOTIFICATION (60s) -- an admin picked a specific send time; a
// minute of slop is unnoticeable, and it's a cheap indexed query
// (status/sendAt) unless something is actually due.
const SCHEDULED_NOTIFICATION_SWEEP_MS = 60_000;
// DELIVERY RETRY (5m) -- rides out a transient Expo/FCM outage; not
// latency-sensitive (push delivery already isn't instant), and each retried
// notification makes its own HTTP call to Expo/FCM, so this stays
// infrequent even though its own DB query is cheap.
const DELIVERY_RETRY_SWEEP_MS = 5 * 60_000;

const timers: NodeJS.Timeout[] = [];

/**
 * Wraps a sweep so a failure logs and the interval survives. An unhandled
 * rejection inside setInterval would otherwise silently kill the schedule and
 * take the correctness guarantee with it.
 */
function schedule(name: string, everyMs: number, fn: () => Promise<unknown>) {
  let running = false;
  const timer = setInterval(async () => {
    // Skip rather than overlap: a slow sweep must not stack up behind itself
    // and turn a transient DB slowdown into a connection-pool exhaustion.
    if (running) {
      console.warn(`[sweeper] ${name} still running, skipping this tick`);
      return;
    }
    running = true;
    try {
      await fn();
    } catch (err) {
      console.error(`[sweeper] ${name} failed:`, err);
    } finally {
      running = false;
    }
  }, everyMs);
  timer.unref?.();
  timers.push(timer);
}

export function startSweepers(): void {
  schedule('assignment', DISPATCH_SWEEP_MS, async () => {
    const { expired } = await sweepExpiredAssignments();
    if (expired) {
      console.log(`[sweeper] assignment: expired=${expired}`);
    }
  });

  schedule('presence', PRESENCE_SWEEP_MS, async () => {
    // A mechanic whose GPS has been silent for well past the dispatch
    // staleness window is not "online" in any useful sense. Marking them
    // offline keeps the admin supply count honest and stops the mechanic
    // being surprised by an offer their app never showed them.
    const cutoff = new Date(Date.now() - env.DISPATCH_STALE_LOCATION_SECONDS * 3 * 1000);
    const { count } = await prisma.serviceTechnician.updateMany({
      where: {
        isOnline: true,
        // A mechanic actively on a job is left alone even if their GPS drops:
        // forcing them offline mid-job would strip them from the ops view at
        // the exact moment ops most needs to see them.
        bookings: { none: { status: { in: ['MECHANIC_ACCEPTED', 'MECHANIC_ON_THE_WAY', 'ARRIVED', 'WORK_STARTED'] } } },
        OR: [{ lastLocationAt: { lt: cutoff } }, { lastLocationAt: null }],
      },
      data: { isOnline: false },
    });
    if (count > 0) console.log(`[sweeper] presence: marked ${count} stale mechanic(s) offline`);
  });

  schedule('retention', RETENTION_SWEEP_MS, async () => {
    const [pings, otps] = await Promise.all([sweepOldPings(), sweepExpiredOtps()]);
    if (pings || otps) console.log(`[sweeper] retention: pruned ${pings} ping(s), ${otps} otp(s)`);
  });

  schedule('payment-reconcile', PAYMENT_RECONCILE_SWEEP_MS, async () => {
    const outcomes = await reconcileStalePendingPayments();
    const resolved = outcomes.filter((o) => o.result !== 'still-pending');
    if (resolved.length > 0) {
      console.log(`[sweeper] payment-reconcile: resolved ${resolved.length} stale payment(s)`, resolved);
    }
  });

  schedule('settlement-generation', SETTLEMENT_GENERATION_SWEEP_MS, async () => {
    const result = await generateScheduledSettlements();
    if (result.vendors || result.riders || result.technicians) {
      console.log(`[sweeper] settlement-generation: vendors=${result.vendors} riders=${result.riders} technicians=${result.technicians}`);
    }
  });

  schedule('scheduled-notifications', SCHEDULED_NOTIFICATION_SWEEP_MS, async () => {
    const { sent, failed } = await sweepScheduledNotifications();
    if (sent || failed) {
      console.log(`[sweeper] scheduled-notifications: sent=${sent} failed=${failed}`);
    }
  });

  schedule('delivery-retry', DELIVERY_RETRY_SWEEP_MS, async () => {
    const { retried, recovered } = await retryFailedNotificationDeliveries();
    if (retried) {
      console.log(`[sweeper] delivery-retry: retried=${retried} recovered=${recovered}`);
    }
  });

  console.log(
    `[sweeper] started (assignment ${DISPATCH_SWEEP_MS / 1000}s, presence ${PRESENCE_SWEEP_MS / 1000}s, retention ${RETENTION_SWEEP_MS / 60000}m, payment-reconcile ${PAYMENT_RECONCILE_SWEEP_MS / 60000}m, settlement-generation ${SETTLEMENT_GENERATION_SWEEP_MS / 60000}m, scheduled-notifications ${SCHEDULED_NOTIFICATION_SWEEP_MS / 1000}s, delivery-retry ${DELIVERY_RETRY_SWEEP_MS / 60000}m)`
  );
}

export function stopSweepers(): void {
  for (const timer of timers) clearInterval(timer);
  timers.length = 0;
  console.log('[sweeper] stopped');
}
