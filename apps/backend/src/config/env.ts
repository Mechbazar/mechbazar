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

if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET === 'supersecretkey123') {
  fail('JWT_SECRET is still set to the local development default. Set a real secret before running in production.');
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
};

if (!env.GOOGLE_MAPS_SERVER_API_KEY) {
  console.warn('[WARN] GOOGLE_MAPS_SERVER_API_KEY not set -- /api/geocode/* will return 503 (degraded); rest of the API is unaffected.');
}
