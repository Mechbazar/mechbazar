import dotenv from 'dotenv';

dotenv.config();

// Firebase credentials are always required now that phone auth is Firebase-only
// (utils/otp.ts). Without them, config/firebase.ts logs an error and continues
// with an uninitialized app, and every phone login/registration then fails at
// request time with a generic "Invalid or expired verification token". Failing
// fast at boot turns that into an immediate, diagnosable startup error.
const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
] as const;

function fail(message: string): never {
  console.error(`\n[FATAL] ${message}\n`);
  process.exit(1);
}

const missing = REQUIRED_VARS.filter((key) => !process.env[key] || process.env[key]?.trim() === '');
if (missing.length > 0) {
  fail(
    `Missing required environment variable(s): ${missing.join(', ')}.\n` +
      `Copy apps/backend/.env.example to apps/backend/.env and fill these in before starting the server.`
  );
}

// Weak or known-default secrets are rejected outright in production: a JWT
// here authenticates every role including SUPER_ADMIN, so a guessable secret
// is a full platform compromise, not a hardening nit.
const WEAK_JWT_SECRETS = ['supersecretkey123', 'secret', 'changeme', 'jwt_secret', 'mechbazar'];
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET as string;
  if (WEAK_JWT_SECRETS.includes(secret.toLowerCase())) {
    fail('JWT_SECRET is a known default/placeholder value. Set a real, random secret before running in production.');
  }
  // Warnings, not fail(), for the two checks below: both describe a
  // configuration that is weaker than it should be but still functional, and
  // refusing to boot on them would take a running production deployment
  // offline on its next restart. They are tracked as required manual actions.
  if (secret.length < 32) {
    console.error(
      `[SECURITY] JWT_SECRET is only ${secret.length} characters. Rotate it to at least 32 random ` +
        `characters (\`openssl rand -base64 48\`). A short secret is brute-forceable offline, and a ` +
        `forged token authenticates as any role including SUPER_ADMIN.`
    );
  }
  if (!process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ALLOWED_ORIGINS.trim() === '') {
    console.error(
      '[SECURITY] CORS_ALLOWED_ORIGINS is not set, so the API answers cross-origin requests from ' +
        'ANY website. Set a comma-separated allowlist ' +
        '(e.g. https://mechbazar.com,https://admin.mechbazar.com,https://vendor.mechbazar.com).'
    );
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5001,
  DATABASE_URL: process.env.DATABASE_URL as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  REDIS_URL: process.env.REDIS_URL || '',
  // Optional -- server-side Google Maps Platform key (services/geocoding.service.ts).
  // Distinct from apps/mobile's EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: that one ships in a
  // public client bundle and must be referrer/package restricted; this one never
  // leaves the server. Not in REQUIRED_VARS -- nothing depends on it yet, so a
  // missing key degrades only the geocoding endpoints (503), not the whole API.
  GOOGLE_MAPS_SERVER_API_KEY: process.env.GOOGLE_MAPS_SERVER_API_KEY || '',
  GOOGLE_MAPS_TIMEOUT_MS: Number(process.env.GOOGLE_MAPS_TIMEOUT_MS) || 5000,
  VERSION: process.env.npm_package_version || '1.0.0',

  // ---- Emergency dispatch ----
  // Comma-separated radii, in km, one per fan-out wave. Wave N offers the job
  // to every eligible mechanic inside radius N who was not already offered it.
  DISPATCH_WAVE_RADII_KM: (process.env.DISPATCH_WAVE_RADII_KM || '5,10,20')
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v > 0),
  // How long a mechanic has to answer one offer before it expires and the next
  // wave goes out. Short on purpose: this is a breakdown, and an unanswered
  // phone must cost the customer seconds, not minutes.
  DISPATCH_OFFER_TTL_SECONDS: Number(process.env.DISPATCH_OFFER_TTL_SECONDS) || 30,
  // Cap on how many mechanics a single wave may ring at once. Bounds both push
  // spend and the size of the accept race.
  DISPATCH_MAX_PER_WAVE: Number(process.env.DISPATCH_MAX_PER_WAVE) || 8,
  // A mechanic whose last GPS ping is older than this is not dispatchable,
  // regardless of their isOnline flag -- see ServiceTechnician.lastLocationAt.
  DISPATCH_STALE_LOCATION_SECONDS: Number(process.env.DISPATCH_STALE_LOCATION_SECONDS) || 300,
  // Concurrent emergency jobs one mechanic may hold. 1 by default: a breakdown
  // is not a queueable delivery.
  DISPATCH_MAX_CONCURRENT_JOBS: Number(process.env.DISPATCH_MAX_CONCURRENT_JOBS) || 1,

  // ---- Job OTP ----
  JOB_OTP_TTL_SECONDS: Number(process.env.JOB_OTP_TTL_SECONDS) || 900,
  JOB_OTP_MAX_ATTEMPTS: Number(process.env.JOB_OTP_MAX_ATTEMPTS) || 5,
  // 32-byte key material for encrypting OTP codes at rest. Optional: when
  // unset, utils/crypto.ts derives a key from JWT_SECRET via HKDF so the
  // feature works on an existing deployment without new secrets being
  // provisioned first. Setting it explicitly is preferred, because then
  // rotating JWT_SECRET does not invalidate in-flight OTPs.
  JOB_OTP_SECRET: process.env.JOB_OTP_SECRET || '',

  // ---- Live tracking ----
  // Target ping cadence pushed down to the mechanic app, which uses it as its
  // location-watch interval. Server-driven so cadence can be tuned per
  // environment without shipping a new build.
  TRACKING_PING_INTERVAL_SECONDS: Number(process.env.TRACKING_PING_INTERVAL_SECONDS) || 4,
  // Pings closer together than this (after an offline flush, say) are stored
  // but do not trigger a route/ETA recalculation.
  TRACKING_ROUTE_REFRESH_SECONDS: Number(process.env.TRACKING_ROUTE_REFRESH_SECONDS) || 25,
  // Movement below this is GPS jitter, not travel; it is excluded from the
  // distance-travelled rollup so a parked phone doesn't accrue kilometres.
  TRACKING_MIN_MOVE_METERS: Number(process.env.TRACKING_MIN_MOVE_METERS) || 15,
  // Ping breadcrumbs are pruned this long after a job reaches a terminal
  // state. The derived rollups (distance, duration) are permanent.
  TRACKING_PING_RETENTION_DAYS: Number(process.env.TRACKING_PING_RETENTION_DAYS) || 30,

  // ---- Masked calling (Exotel) ----
  // All four must be present for masked calling to be active. When they are
  // not, call.service.ts reports the feature as unavailable rather than
  // falling back to exposing real numbers -- see its module comment.
  EXOTEL_SID: process.env.EXOTEL_SID || '',
  EXOTEL_API_KEY: process.env.EXOTEL_API_KEY || '',
  EXOTEL_API_TOKEN: process.env.EXOTEL_API_TOKEN || '',
  EXOTEL_CALLER_ID: process.env.EXOTEL_CALLER_ID || '',
  EXOTEL_SUBDOMAIN: process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com',

  // ---- Transactional email (Resend) ----
  // Only RESEND_API_KEY gates sending -- see services/email.service.ts. When
  // unset, every send resolves to an EmailLog row with status SKIPPED instead
  // of throwing; the order/verify-email/reset-password flow that triggered it
  // still completes normally (verify-email/reset-password fall back to
  // Firebase's own send -- see utils/firebasePassword.ts).
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  // "Name <address>" or a bare address. Must be a verified sender/domain in
  // the Resend dashboard, or every send is rejected regardless of the API key.
  EMAIL_FROM: process.env.EMAIL_FROM || 'MechBazar <orders@mechbazar.com>',
  // Optional -- signing secret for Resend's delivery-tracking webhook
  // (routes/email.routes.ts). Resend Dashboard -> Webhooks -> create one
  // pointed at POST /api/email/webhook, subscribed to email.delivered and
  // email.bounced. Without it the webhook route responds 200 but does not
  // process the payload (an unverified webhook cannot be trusted to update
  // EmailLog rows).
  RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET || '',
};

export const isEmailConfigured = (): boolean => Boolean(env.RESEND_API_KEY);

if (!isEmailConfigured()) {
  console.warn('[WARN] RESEND_API_KEY not set -- transactional email (order confirmations, verify-email, password reset) will fall back to degraded/Firebase-only delivery. See services/email.service.ts and utils/firebasePassword.ts.');
}

if (!env.GOOGLE_MAPS_SERVER_API_KEY) {
  console.warn('[WARN] GOOGLE_MAPS_SERVER_API_KEY not set -- /api/geocode/* will return 503 (degraded); rest of the API is unaffected.');
  console.warn('[WARN] Live-tracking ETA/route will fall back to straight-line distance and an average-speed estimate.');
}

// A zero-wave configuration would silently disable emergency dispatch: jobs
// would be created SEARCHING and never offered to anyone. Fail fast instead.
if (env.DISPATCH_WAVE_RADII_KM.length === 0) {
  fail('DISPATCH_WAVE_RADII_KM parsed to an empty list. Set a comma-separated list of positive radii in km, e.g. "5,10,20".');
}

if (!env.JOB_OTP_SECRET && env.NODE_ENV === 'production') {
  console.error(
    '[SECURITY] JOB_OTP_SECRET is not set; job OTP codes are being encrypted with a key derived from ' +
      'JWT_SECRET. This works, but rotating JWT_SECRET will make every in-flight OTP undecryptable. ' +
      'Set JOB_OTP_SECRET to an independent random value (`openssl rand -base64 32`).'
  );
}

export const MASKED_CALLING_ENABLED = !!(
  env.EXOTEL_SID &&
  env.EXOTEL_API_KEY &&
  env.EXOTEL_API_TOKEN &&
  env.EXOTEL_CALLER_ID
);

if (!MASKED_CALLING_ENABLED) {
  console.warn(
    '[WARN] Exotel credentials incomplete -- masked calling is disabled. ' +
      'POST /api/jobs/:id/call will return 503. Phone numbers are never exposed as a fallback.'
  );
}
