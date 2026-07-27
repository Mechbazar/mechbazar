import prisma from '../config/prisma';
import { env } from '../config/env';
import { sweepDispatch, stopDispatchTimers } from '../services/dispatch.service';
import { sweepExpiredOtps } from '../services/jobOtp.service';
import { sweepOldPings } from '../services/tracking.service';

// Background maintenance for the dispatch subsystem.
//
// The design rule this enforces: nothing in the emergency flow may depend on
// an in-process timer surviving. Timers are an optimisation for latency; these
// sweeps are the correctness guarantee. A redeploy, a crash, or an OOM kill in
// the middle of a dispatch must leave nothing permanently stuck.
//
// Cadences are chosen against what each sweep protects:
//
//  * DISPATCH (10s) -- a customer is watching a spinner. This is the one that
//    must be fast, and it is cheap: two indexed queries plus whatever it finds.
//  * MECHANIC PRESENCE (60s) -- a phone that died still shows as "online" and
//    would keep absorbing offers. findCandidates already filters on
//    lastLocationAt, so this is belt-and-braces for the admin supply view.
//  * RETENTION (hourly) -- deleting old breadcrumbs and spent OTPs. Deliberately
//    the slowest and the only one that issues DELETEs at volume.

const DISPATCH_SWEEP_MS = 10_000;
const PRESENCE_SWEEP_MS = 60_000;
const RETENTION_SWEEP_MS = 60 * 60_000;

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
  schedule('dispatch', DISPATCH_SWEEP_MS, async () => {
    const { expired, advanced, stuck } = await sweepDispatch();
    if (expired || advanced || stuck) {
      console.log(`[sweeper] dispatch: expired=${expired} advanced=${advanced} stuck=${stuck}`);
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

  console.log(
    `[sweeper] started (dispatch ${DISPATCH_SWEEP_MS / 1000}s, presence ${PRESENCE_SWEEP_MS / 1000}s, retention ${RETENTION_SWEEP_MS / 60000}m)`
  );
}

export function stopSweepers(): void {
  for (const timer of timers) clearInterval(timer);
  timers.length = 0;
  stopDispatchTimers();
  console.log('[sweeper] stopped');
}
