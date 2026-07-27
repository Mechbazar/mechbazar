import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { jobService, getSocket, CLIENT_EVENTS } from '@mechbazar/shared';

// Live GPS sharing for an active emergency job.
//
// Requirement: share GPS every 3-5s while an active job exists, stop
// automatically on completion, survive backgrounding, and recover from an
// offline gap. This is what makes that true:
//
//  * `startLocationUpdatesAsync` (not `watchPositionAsync`) is a background
//    task registered with the OS, not a JS interval -- it keeps firing even
//    if the app is backgrounded or the JS thread is suspended, which a plain
//    setInterval loop cannot do on either platform.
//  * The task handler buffers fixes into memory and flushes them as a BATCH
//    over the socket (falling back to one HTTP POST if the socket is down),
//    rather than one network call per fix. A dropped connection just grows
//    the buffer; the next successful flush sends everything that queued up,
//    so a tunnel or a dead signal produces a gap-filled trail on reconnect
//    instead of silently losing minutes of track.
//  * `stopTracking()` is called from exactly one place: the job-status effect
//    in EmergencyJobScreen, keyed off LIVE_TRACKING_STATUSES. There is no
//    separate "stop on complete" special case to forget -- leaving that
//    status set is what stops it, for every terminal status uniformly.

const TASK_NAME = 'mechbazar-job-location-task';
const FLUSH_INTERVAL_MS = 4000; // matches TRACKING_PING_INTERVAL_SECONDS default
const MAX_BUFFER = 200; // ~13 minutes of backlog at one fix/4s -- generous but bounded

let activeBookingId: string | null = null;
let buffer: Array<{
  lat: number; lng: number; accuracyM?: number; headingDeg?: number; speedMps?: number; recordedAt: string;
}> = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

TaskManager.defineTask(TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[jobLocation] background task error:', error);
    return;
  }
  const { locations } = (data as { locations: Location.LocationObject[] }) || { locations: [] };
  if (!activeBookingId || !locations?.length) return;

  for (const loc of locations) {
    buffer.push({
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracyM: loc.coords.accuracy ?? undefined,
      headingDeg: loc.coords.heading ?? undefined,
      speedMps: loc.coords.speed ?? undefined,
      recordedAt: new Date(loc.timestamp).toISOString(),
    });
  }
  // Cap the buffer so a very long offline stretch can't grow it unbounded;
  // oldest-first drop keeps the most recent (most relevant) positions.
  if (buffer.length > MAX_BUFFER) {
    buffer = buffer.slice(buffer.length - MAX_BUFFER);
  }
});

async function flush(): Promise<void> {
  if (!activeBookingId || buffer.length === 0) return;
  const bookingId = activeBookingId;
  const pings = buffer;
  buffer = [];

  try {
    const socket = await getSocket();
    if (socket.connected) {
      const ack = await new Promise<{ ok: boolean }>((resolve) => {
        // A missed ack (socket dies mid-flight) must not lose the batch --
        // fall through to the HTTP path rather than hanging forever.
        const timeout = setTimeout(() => resolve({ ok: false }), 5000);
        socket.emit(CLIENT_EVENTS.LOCATION_BATCH, { bookingId, pings }, (res: { ok: boolean }) => {
          clearTimeout(timeout);
          resolve(res);
        });
      });
      if (ack.ok) return;
    }
  } catch (err) {
    console.log('[jobLocation] socket flush failed, falling back to HTTP:', err);
  }

  // HTTP fallback -- covers a socket that's reconnecting or was never
  // established (e.g. the OS restarted the background task after the app
  // process itself was killed, per Android's task-restart limitations).
  const ok = await jobService.postLocationBatch(bookingId, pings);
  if (!ok) {
    // Re-queue for the next flush rather than dropping silently -- capped by
    // MAX_BUFFER same as the live path above.
    buffer = [...pings, ...buffer].slice(-MAX_BUFFER);
  }
}

/** Requests both permission tiers, in the order the OS expects (fg then bg). */
export async function requestTrackingPermissions(): Promise<{ granted: boolean; backgroundGranted: boolean }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return { granted: false, backgroundGranted: false };

  const bg = await Location.requestBackgroundPermissionsAsync();
  // Foreground-only is still usable (tracking works while the app is open),
  // it just won't survive backgrounding -- the caller decides whether to warn.
  return { granted: true, backgroundGranted: bg.status === 'granted' };
}

/** Starts sharing GPS for this job. Idempotent -- switching jobs restarts cleanly. */
export async function startTracking(bookingId: string): Promise<boolean> {
  if (activeBookingId === bookingId) return true;
  await stopTracking();

  const perms = await requestTrackingPermissions();
  if (!perms.granted) return false;

  activeBookingId = bookingId;
  buffer = [];

  await Location.startLocationUpdatesAsync(TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: FLUSH_INTERVAL_MS,
    distanceInterval: 0, // time-based, not distance-based -- a stopped mechanic still needs regular pings
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'Sharing your location',
      notificationBody: 'MechBazar is sharing your location with the customer for this job.',
    },
  });

  flushTimer = setInterval(() => { flush().catch((err) => console.error('[jobLocation] flush error:', err)); }, FLUSH_INTERVAL_MS);
  console.log(`[jobLocation] started tracking for job=${bookingId}`);
  return true;
}

/** Stops sharing GPS. Flushes any buffered fixes first so the last few seconds aren't lost. */
export async function stopTracking(): Promise<void> {
  if (!activeBookingId) return;
  const bookingId = activeBookingId;

  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  await flush();
  activeBookingId = null;

  try {
    const registered = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
    if (registered) await Location.stopLocationUpdatesAsync(TASK_NAME);
  } catch (err) {
    console.error('[jobLocation] stop error:', err);
  }
  console.log(`[jobLocation] stopped tracking for job=${bookingId}`);
}

export function isTracking(): boolean {
  return activeBookingId !== null;
}
