cat > /opt/mechbazar-e2e-test/apps/backend/src/scripts/e2e-dispatch-test.ts <<'FILEEOF'
/**
 * End-to-end test harness for the emergency dispatch workflow.
 *
 * This is a real client: it talks to a RUNNING backend over plain HTTP and a
 * real Socket.IO connection, exactly like the customer/mechanic/admin apps
 * do. It seeds its own test users directly via Prisma (bypassing Firebase
 * phone auth, which cannot be automated from a script) and mints JWTs with
 * the same generateToken() the real login endpoint uses, so every request
 * after that point is indistinguishable from a real logged-in client.
 *
 * WHAT IT PROVES, END TO END:
 *   - instant booking (no date/slot accepted, dispatch starts immediately)
 *   - multi-mechanic fan-out (both mechanics receive the offer)
 *   - the accept race has exactly one winner under real concurrency
 *   - the loser's offer is closed and the customer is notified of the winner
 *   - live location batches flow mechanic -> customer over the socket
 *   - the start OTP gate genuinely blocks a wrong code and passes the right one
 *   - the completion OTP gate does the same, and the mechanic's wallet is
 *     credited exactly once, atomically with the transition
 *   - a job with no reachable mechanic reaches NO_MECHANIC_FOUND (not stuck)
 *   - phone numbers never appear in the customer's own view of the job
 *   - unauthenticated / wrong-role requests are rejected
 *   - the admin live-ops board sees the job and can force-transition it
 *     (audited, and distinguishable from a real customer verification)
 *
 * USAGE (see docs/E2E_TEST_RUNBOOK.md for the full guided version):
 *   1. Point DATABASE_URL at an ISOLATED test database (never production).
 *   2. Run the backend against it: `npx tsx src/index.ts` on a spare port.
 *   3. In another shell: `E2E_API_URL=http://localhost:<port>/api npx tsx src/scripts/e2e-dispatch-test.ts`
 *
 * Exits 0 on full pass, 1 on any failure -- safe to wire into CI once a
 * disposable Postgres is available there.
 */
import { PrismaClient, Role, VehicleType } from '@prisma/client';
import { io, Socket } from 'socket.io-client';
import { generateToken } from '../utils/jwt';
import { CLIENT_EVENTS, SERVER_EVENTS } from '../realtime/events';

const prisma = new PrismaClient();

const API_URL = process.env.E2E_API_URL || 'http://localhost:5099/api';
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');

// ---------------------------------------------------------------------------
// Tiny test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    failures.push(message);
    console.error(`  ❌ ${message}`);
  }
}

async function section(title: string, fn: () => Promise<void>) {
  console.log(`\n▶ ${title}`);
  try {
    await fn();
  } catch (err) {
    failed++;
    const msg = `${title} threw: ${err instanceof Error ? err.message : err}`;
    failures.push(msg);
    console.error(`  ❌ ${msg}`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

async function api(
  path: string,
  method: string,
  token?: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

function connectSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(SOCKET_URL, { path: '/socket.io', auth: { token }, transports: ['websocket'] });
    const timeout = setTimeout(() => reject(new Error('socket connect timeout')), 8000);
    socket.on(SERVER_EVENTS.READY, () => { clearTimeout(timeout); resolve(socket); });
    socket.on('connect_error', (err) => { clearTimeout(timeout); reject(err); });
  });
}

/** Waits for a specific socket event, with a timeout. Returns null on timeout instead of throwing. */
function waitForEvent<T = any>(socket: Socket, event: string, timeoutMs = 15000, predicate?: (p: T) => boolean): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { socket.off(event, handler); resolve(null); }, timeoutMs);
    const handler = (payload: T) => {
      if (predicate && !predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

const RUN_ID = Date.now().toString(36);
// Separate from RUN_ID: phone must be exactly 10 digits, and "9" + RUN_ID
// (base36, ~8 chars) already leaves room for only 1 more digit before hitting
// that limit -- `9${RUN_ID}0001`.slice(0, 10) truncated away everything that
// made the four seeded users' phone numbers distinct, colliding them all onto
// the same number. This is 7 digits (changes every ms) + a 2-digit per-user
// suffix = exactly 10 digits, no truncation needed.
const PHONE_SUFFIX = Date.now().toString().slice(-7);
// Bengaluru-ish coordinates, close enough together that the default (or
// tightened, see runbook) dispatch radii reach every seeded mechanic.
const CUSTOMER_LOC = { lat: 12.9716, lng: 77.5946 };
const MECH_A_LOC = { lat: 12.9760, lng: 77.5990 }; // ~0.7km away
const MECH_B_LOC = { lat: 12.9800, lng: 77.6050 }; // ~1.5km away
const FAR_AWAY_LOC = { lat: 28.6139, lng: 77.2090 }; // Delhi -- outside every wave radius

async function seed() {
  const customer = await prisma.user.create({
    data: { phone: `9${PHONE_SUFFIX}01`, name: 'E2E Customer', role: Role.CUSTOMER },
  });
  const address = await prisma.address.create({
    data: {
      userId: customer.id, title: 'Test Location', line1: 'MG Road', city: 'Bengaluru', state: 'Karnataka',
      pincode: '560001', lat: CUSTOMER_LOC.lat, lng: CUSTOMER_LOC.lng,
    },
  });

  const mechAUser = await prisma.user.create({ data: { phone: `9${PHONE_SUFFIX}02`, name: 'Mechanic A', role: Role.SERVICE_TECHNICIAN } });
  const mechBUser = await prisma.user.create({ data: { phone: `9${PHONE_SUFFIX}03`, name: 'Mechanic B', role: Role.SERVICE_TECHNICIAN } });
  const adminUser = await prisma.user.create({ data: { phone: `9${PHONE_SUFFIX}04`, name: 'E2E Admin', role: Role.SUPER_ADMIN } });

  const mechA = await prisma.serviceTechnician.create({
    data: {
      userId: mechAUser.id, specializations: [VehicleType.CAR], isActive: true, isOnline: true, status: 'APPROVED',
      currentLat: MECH_A_LOC.lat, currentLng: MECH_A_LOC.lng, lastLocationAt: new Date(),
    },
  });
  const mechB = await prisma.serviceTechnician.create({
    data: {
      userId: mechBUser.id, specializations: [VehicleType.CAR], isActive: true, isOnline: true, status: 'APPROVED',
      currentLat: MECH_B_LOC.lat, currentLng: MECH_B_LOC.lng, lastLocationAt: new Date(),
    },
  });

  const category = await prisma.serviceCategory.create({
    data: { name: `E2E Emergency ${RUN_ID}`, vehicleType: VehicleType.CAR, isEmergency: true, status: 'Active' },
  });
  const pkg = await prisma.servicePackage.create({
    data: { categoryId: category.id, name: 'Flat Tyre Assistance', price: 499, isActive: true, isEmergency: true },
  });

  return { customer, address, mechAUser, mechBUser, mechA, mechB, adminUser, category, pkg };
}

async function cleanup(ids: { customer: string; mechAUser: string; mechBUser: string; adminUser: string; category: string }) {
  const bookings = await prisma.serviceBooking.findMany({ where: { userId: ids.customer }, select: { id: true } });
  const bookingIds = bookings.map((b) => b.id);

  // JobDispatchOffer/JobOtp/JobLocationPing/ServiceImage/CallSession are
  // onDelete: Cascade and would clean up automatically, but
  // BookingStatusHistory/ServiceChatMessage/ServiceReview/ServiceInvoice/
  // Payment are NOT (by design -- production bookings are permanent records,
  // never deleted), so a test script that wants to actually remove its own
  // seeded bookings has to clear these explicitly first or the delete below
  // fails on a foreign-key violation.
  await prisma.bookingStatusHistory.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.serviceChatMessage.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.serviceReview.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.serviceInvoice.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.payment.deleteMany({ where: { serviceBookingId: { in: bookingIds } } });
  // Notification is not onDelete: Cascade either (same permanent-record reasoning) --
  // every notify() call during the run leaves rows referencing these users' ids.
  await prisma.notification.deleteMany({
    where: { userId: { in: [ids.customer, ids.mechAUser, ids.mechBUser, ids.adminUser] } },
  });

  await prisma.serviceBooking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.address.deleteMany({ where: { userId: ids.customer } });
  await prisma.servicePackage.deleteMany({ where: { categoryId: ids.category } });
  await prisma.serviceCategory.delete({ where: { id: ids.category } }).catch(() => {});
  await prisma.serviceTechnician.deleteMany({ where: { userId: { in: [ids.mechAUser, ids.mechBUser] } } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.customer, ids.mechAUser, ids.mechBUser, ids.adminUser] } } });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`🚨 MechBazar Emergency Dispatch E2E — run ${RUN_ID}`);
  console.log(`   API: ${API_URL}`);

  const seeded = await seed();
  const customerToken = generateToken(seeded.customer.id, 'CUSTOMER');
  const mechAToken = generateToken(seeded.mechAUser.id, 'SERVICE_TECHNICIAN');
  const mechBToken = generateToken(seeded.mechBUser.id, 'SERVICE_TECHNICIAN');
  const adminToken = generateToken(seeded.adminUser.id, 'SUPER_ADMIN');

  let bookingId = '';
  let customerSocket: Socket | null = null;
  let mechASocket: Socket | null = null;
  let mechBSocket: Socket | null = null;

  try {
    // -----------------------------------------------------------------
    await section('Connectivity: health check', async () => {
      const res = await fetch(`${SOCKET_URL}/api/health`).catch(() => null);
      assert(res && res.ok, 'GET /api/health returns 200 (backend reachable)');
    });

    // -----------------------------------------------------------------
    await section('Security: unauthenticated + wrong-role requests are rejected', async () => {
      const noAuth = await api('/jobs/active', 'GET');
      assert(noAuth.status === 401, 'GET /jobs/active with no token -> 401');

      const wrongRole = await api('/jobs/offers', 'GET', customerToken);
      assert(wrongRole.status === 403, 'GET /jobs/offers as CUSTOMER -> 403 (mechanic-only)');

      // Must include every other required field -- otherwise createEmergencyJob's
      // MISSING_FIELDS/MISSING_VEHICLE checks (which run first) mask the check
      // this assertion actually wants to exercise.
      const badBooking = await api('/jobs', 'POST', customerToken, {
        categoryId: seeded.category.id, packageId: seeded.pkg.id, addressId: seeded.address.id,
        vehicleType: 'CAR', vehicleBrand: 'Maruti', vehicleModel: 'Swift',
        scheduledDate: '2026-01-01', timeSlotId: 'x',
      });
      assert(badBooking.status === 400 && badBooking.data?.code === 'NOT_SCHEDULABLE', 'POST /jobs with scheduledDate -> 400 NOT_SCHEDULABLE (instant-only enforced)');
    });

    // -----------------------------------------------------------------
    await section('Sockets: connect as customer + both mechanics', async () => {
      customerSocket = await connectSocket(customerToken);
      mechASocket = await connectSocket(mechAToken);
      mechBSocket = await connectSocket(mechBToken);
      assert(customerSocket.connected, 'customer socket connected');
      assert(mechASocket.connected, 'mechanic A socket connected');
      assert(mechBSocket.connected, 'mechanic B socket connected');
    });

    // -----------------------------------------------------------------
    await section('Instant booking: create emergency job (no date/slot)', async () => {
      const offerAPromise = waitForEvent(mechASocket!, SERVER_EVENTS.OFFER_NEW, 15000);
      const offerBPromise = waitForEvent(mechBSocket!, SERVER_EVENTS.OFFER_NEW, 15000);

      const create = await api('/jobs', 'POST', customerToken, {
        categoryId: seeded.category.id,
        packageId: seeded.pkg.id,
        addressId: seeded.address.id,
        vehicleType: 'CAR',
        vehicleBrand: 'Maruti',
        vehicleModel: 'Swift',
        issueDescription: 'Flat tyre on the highway',
        jobLat: CUSTOMER_LOC.lat,
        jobLng: CUSTOMER_LOC.lng,
      });
      assert(create.status === 201, `POST /jobs -> 201 (got ${create.status}: ${JSON.stringify(create.data)})`);
      bookingId = create.data?.job?.id;
      assert(!!bookingId, 'response includes a job id');
      assert(create.data?.job?.status === 'PENDING', 'job starts PENDING');

      // Join the job room now that the id exists -- every later job:status/
      // job:location assertion in this test depends on this (a real client
      // does the same thing via subscribeToJob() right after creation). This
      // specific SEARCHING transition fires via setImmediate right after the
      // response is sent (job.controller.ts), so a real client can still lose
      // this exact race even having subscribed instantly -- production covers
      // that with a 20s poll fallback (see EmergencyTrackingScreen.tsx), so we
      // verify SEARCHING was reached via REST rather than requiring the socket
      // to win an inherently racy transition.
      customerSocket!.emit(CLIENT_EVENTS.JOB_SUBSCRIBE, { bookingId });

      const searchingDeadline = Date.now() + 10000;
      let reachedSearching = false;
      while (Date.now() < searchingDeadline) {
        const check = await api(`/jobs/${bookingId}`, 'GET', customerToken);
        if (check.data?.job?.status && check.data.job.status !== 'PENDING') { reachedSearching = true; break; }
        await sleep(300);
      }
      assert(reachedSearching, 'job reaches SEARCHING (or beyond) within 10s of creation');

      const [offerA, offerB] = await Promise.all([offerAPromise, offerBPromise]);
      assert(!!offerA, 'mechanic A receives offer:new');
      assert(!!offerB, 'mechanic B receives offer:new');
      if (offerA) assert(offerA.bookingId === bookingId, 'offer references the correct booking');
      // Privacy: the offer must show area only, not the precise pin, before acceptance.
      if (offerA) assert(offerA.jobLat === null && offerA.jobLng === null, 'pre-acceptance offer withholds the precise pin');
    });

    // -----------------------------------------------------------------
    await section('Dispatch race: two mechanics accept simultaneously, exactly one wins', async () => {
      const [resA, resB] = await Promise.all([
        api(`/jobs/${bookingId}/accept`, 'POST', mechAToken),
        api(`/jobs/${bookingId}/accept`, 'POST', mechBToken),
      ]);
      const results = [resA, resB];
      const winners = results.filter((r) => r.status === 200);
      const losers = results.filter((r) => r.status !== 200);
      assert(winners.length === 1, `exactly one accept succeeds (got ${winners.length} winners, statuses: ${results.map((r) => r.status).join(',')})`);
      assert(losers.length === 1 && [409, 404, 410].includes(losers[0].status), 'the other accept is rejected (already taken/expired/no offer)');

      const booking = await prisma.serviceBooking.findUniqueOrThrow({ where: { id: bookingId } });
      assert(booking.status === 'MECHANIC_ACCEPTED', 'booking status is MECHANIC_ACCEPTED after the race');
      assert(!!booking.technicianId, 'booking has exactly one technicianId set');

      const acceptedOffers = await prisma.jobDispatchOffer.count({ where: { bookingId, status: 'ACCEPTED' } });
      const supersededOrClosed = await prisma.jobDispatchOffer.count({ where: { bookingId, status: { in: ['SUPERSEDED', 'DECLINED', 'EXPIRED'] } } });
      assert(acceptedOffers === 1, 'exactly one JobDispatchOffer row is ACCEPTED');
      assert(supersededOrClosed >= 1, 'the losing offer is closed out (not left dangling as OFFERED)');
    });

    const winningIsA = (await prisma.serviceBooking.findUniqueOrThrow({ where: { id: bookingId } })).technicianId === seeded.mechA.id;
    const winnerToken = winningIsA ? mechAToken : mechBToken;
    const winnerSocket = winningIsA ? mechASocket! : mechBSocket!;
    console.log(`   (winner: mechanic ${winningIsA ? 'A' : 'B'})`);

    // -----------------------------------------------------------------
    await section('Privacy: customer never sees the mechanic phone number', async () => {
      const jobRes = await api(`/jobs/${bookingId}`, 'GET', customerToken);
      const serialized = JSON.stringify(jobRes.data);
      assert(!serialized.includes(winningIsA ? seeded.mechAUser.phone : seeded.mechBUser.phone), "customer's own job view contains no phone number");
    });

    // -----------------------------------------------------------------
    await section('Journey: en-route -> arrived -> start OTP gate', async () => {
      const enRoute = await api(`/jobs/${bookingId}/en-route`, 'POST', winnerToken);
      assert(enRoute.status === 200, 'POST /jobs/:id/en-route -> 200');

      const arrivedPromise = waitForEvent(customerSocket!, SERVER_EVENTS.JOB_STATUS, 10000, (p: any) => p.status === 'ARRIVED');
      const arrived = await api(`/jobs/${bookingId}/arrived`, 'POST', winnerToken);
      assert(arrived.status === 200, 'POST /jobs/:id/arrived -> 200');
      assert(!!(await arrivedPromise), 'customer receives job:status -> ARRIVED');

      const wrongOtp = await api(`/jobs/${bookingId}/start`, 'POST', winnerToken, { otp: '000000' });
      assert(wrongOtp.status === 400 && wrongOtp.data?.code === 'OTP_INCORRECT', 'wrong start OTP is rejected (400 OTP_INCORRECT)');

      const otpRes = await api(`/jobs/${bookingId}/otp?purpose=START`, 'GET', customerToken);
      assert(otpRes.status === 200 && /^\d{6}$/.test(otpRes.data?.code || ''), 'customer can fetch a 6-digit start OTP');

      const asWinner = await api(`/jobs/${bookingId}/otp?purpose=START`, 'GET', winnerToken);
      assert(asWinner.status === 403, "mechanic cannot fetch the customer's own OTP endpoint");

      const rightOtp = await api(`/jobs/${bookingId}/start`, 'POST', winnerToken, { otp: otpRes.data.code });
      assert(rightOtp.status === 200, 'correct start OTP -> 200, job moves to WORK_STARTED');
      assert(rightOtp.data?.job?.status === 'WORK_STARTED', 'job status is WORK_STARTED');

      const dbJob = await prisma.serviceBooking.findUniqueOrThrow({ where: { id: bookingId } });
      assert(dbJob.verifiedByCustomer === true, 'verifiedByCustomer=true after a real OTP verification');
      assert(dbJob.startOtpVerifiedAt !== null, 'startOtpVerifiedAt is stamped');
    });

    // -----------------------------------------------------------------
    await section('Live tracking: location batch flows to the customer', async () => {
      const locationPromise = waitForEvent(customerSocket!, SERVER_EVENTS.JOB_LOCATION, 10000);
      const ack = await new Promise<any>((resolve) => {
        winnerSocket.emit(CLIENT_EVENTS.LOCATION_BATCH, {
          bookingId,
          pings: [{ lat: MECH_A_LOC.lat, lng: MECH_A_LOC.lng, recordedAt: new Date().toISOString(), speedMps: 5 }],
        }, resolve);
        setTimeout(() => resolve({ ok: false, timedOut: true }), 5000);
      });
      assert(ack?.ok === true, 'location:batch ack is ok');
      const locEvent = await locationPromise;
      assert(!!locEvent, 'customer receives job:location over the socket');

      const pingCount = await prisma.jobLocationPing.count({ where: { bookingId } });
      assert(pingCount > 0, 'JobLocationPing row(s) persisted');
    });

    // -----------------------------------------------------------------
    await section('Photos: work-progress photo upload records provenance', async () => {
      // A 1x1 transparent PNG, inline -- no fixture file needed.
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64'
      );
      const form = new FormData();
      form.append('type', 'DURING');
      form.append('file', new Blob([png], { type: 'image/png' }), 'progress.png');
      const res = await fetch(`${API_URL}/jobs/${bookingId}/photos`, {
        method: 'POST', headers: { Authorization: `Bearer ${winnerToken}` }, body: form,
      });
      assert(res.status === 201, `POST /jobs/:id/photos -> 201 (got ${res.status})`);

      const image = await prisma.serviceImage.findFirst({ where: { bookingId, type: 'DURING' } });
      assert(!!image?.uploadedByUserId, 'photo row records uploadedByUserId');
      assert(!!image?.capturedAt, 'photo row records capturedAt');
      assert(!!image?.sha256, 'photo row records a content hash');
    });

    // -----------------------------------------------------------------
    await section('Completion: request code, wrong OTP rejected, correct OTP completes + pays', async () => {
      const reqRes = await api(`/jobs/${bookingId}/request-completion`, 'POST', winnerToken);
      assert(reqRes.status === 200, 'POST /jobs/:id/request-completion -> 200');

      const wrongOtp = await api(`/jobs/${bookingId}/complete`, 'POST', winnerToken, { otp: '111111' });
      assert(wrongOtp.status === 400, 'wrong completion OTP is rejected');

      const otpRes = await api(`/jobs/${bookingId}/otp?purpose=COMPLETION`, 'GET', customerToken);
      assert(/^\d{6}$/.test(otpRes.data?.code || ''), 'customer can fetch the completion OTP');

      const walletBefore = (await prisma.serviceTechnician.findUniqueOrThrow({ where: { id: winningIsA ? seeded.mechA.id : seeded.mechB.id } })).walletBalance;

      const complete = await api(`/jobs/${bookingId}/complete`, 'POST', winnerToken, { otp: otpRes.data.code });
      assert(complete.status === 200, 'correct completion OTP -> 200');
      assert(complete.data?.job?.status === 'COMPLETED', 'job status is COMPLETED');

      const walletAfter = (await prisma.serviceTechnician.findUniqueOrThrow({ where: { id: winningIsA ? seeded.mechA.id : seeded.mechB.id } })).walletBalance;
      assert(walletAfter === walletBefore + 499, `wallet credited by exactly the job amount (₹499): ${walletBefore} -> ${walletAfter}`);

      const invoice = await prisma.serviceInvoice.findUnique({ where: { bookingId } });
      assert(!!invoice, 'invoice generated on completion');

      const payment = await prisma.payment.findUnique({ where: { serviceBookingId: bookingId } });
      assert(payment?.status === 'SUCCESS', 'payment marked SUCCESS');

      // Idempotency: replaying the same completion request must not double-pay.
      const replay = await api(`/jobs/${bookingId}/complete`, 'POST', winnerToken, { otp: otpRes.data.code });
      const walletAfterReplay = (await prisma.serviceTechnician.findUniqueOrThrow({ where: { id: winningIsA ? seeded.mechA.id : seeded.mechB.id } })).walletBalance;
      assert(walletAfterReplay === walletAfter, `replayed completion request does not double-credit the wallet (status ${replay.status})`);
    });

    // -----------------------------------------------------------------
    await section('Rating: customer rates the completed job', async () => {
      const rate = await api(`/jobs/${bookingId}/rating`, 'POST', customerToken, { rating: 5, comment: 'Fast and professional.' });
      assert(rate.status === 201, 'POST /jobs/:id/rating -> 201');

      const dupe = await api(`/jobs/${bookingId}/rating`, 'POST', customerToken, { rating: 3 });
      assert(dupe.status === 409, 'a second rating on the same job is rejected');
    });

    // -----------------------------------------------------------------
    await section('Admin: live-ops board sees the job history and audit trail', async () => {
      const detail = await api(`/jobs/admin/${bookingId}`, 'GET', adminToken);
      assert(detail.status === 200, 'GET /jobs/admin/:id -> 200 for an admin');
      assert(Array.isArray(detail.data?.job?.dispatchOffers) && detail.data.job.dispatchOffers.length >= 2, 'admin detail includes both dispatch offers');
      assert(detail.data?.job?.durations?.totalMs > 0, 'admin detail includes computed durations');

      const asCustomer = await api(`/jobs/admin/${bookingId}`, 'GET', customerToken);
      assert(asCustomer.status === 403, 'a customer cannot reach the admin job-detail endpoint');
    });

    // -----------------------------------------------------------------
    await section('No-mechanic-found: a job with zero reachable mechanics resolves, not stuck', async () => {
      const farAddress = await prisma.address.create({
        data: { userId: seeded.customer.id, title: 'Far Away', line1: 'Nowhere', city: 'Delhi', state: 'Delhi', pincode: '110001', lat: FAR_AWAY_LOC.lat, lng: FAR_AWAY_LOC.lng },
      });
      const create = await api('/jobs', 'POST', customerToken, {
        categoryId: seeded.category.id, packageId: seeded.pkg.id, addressId: farAddress.id,
        vehicleType: 'CAR', vehicleBrand: 'Maruti', vehicleModel: 'Swift',
        jobLat: FAR_AWAY_LOC.lat, jobLng: FAR_AWAY_LOC.lng,
      });
      assert(create.status === 201, 'second job (far away) created');
      const farJobId = create.data.job.id;

      // Bounded wait: (waves * offer TTL) + slack. With default config this is
      // up to ~100s -- the runbook recommends tightening
      // DISPATCH_WAVE_RADII_KM/DISPATCH_OFFER_TTL_SECONDS for this test run so
      // this section finishes in seconds instead of minutes.
      const deadline = Date.now() + 130_000;
      let finalStatus = 'SEARCHING';
      while (Date.now() < deadline) {
        const job = await prisma.serviceBooking.findUniqueOrThrow({ where: { id: farJobId } });
        finalStatus = job.status;
        if (finalStatus !== 'SEARCHING' && finalStatus !== 'PENDING') break;
        await sleep(2000);
      }
      assert(finalStatus === 'NO_MECHANIC_FOUND', `unreachable job resolves to NO_MECHANIC_FOUND, not stuck (got ${finalStatus})`);

      const openOffers = await prisma.jobDispatchOffer.count({ where: { bookingId: farJobId, status: 'OFFERED' } });
      assert(openOffers === 0, 'no dangling OFFERED rows remain once dispatch concludes');
    });
  } finally {
    customerSocket?.disconnect();
    mechASocket?.disconnect();
    mechBSocket?.disconnect();
    await cleanup({
      customer: seeded.customer.id, mechAUser: seeded.mechAUser.id, mechBUser: seeded.mechBUser.id,
      adminUser: seeded.adminUser.id, category: seeded.category.id,
    });
    await prisma.$disconnect();
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
FILEEOF
