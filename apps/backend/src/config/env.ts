import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_VARS = ['DATABASE_URL', 'JWT_SECRET'] as const;

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

// OTP_PROVIDER=PRODUCTION verifies phone OTPs via Firebase (utils/otp.ts) --
// without these three set, every phone/OTP login and registration silently
// fails at request time with a generic "Invalid or expired OTP token" (see
// config/firebase.ts, which catches the missing-credentials case at import
// time and continues with an uninitialized app). Failing fast at boot instead
// turns that into an immediate, diagnosable startup error.
if (process.env.OTP_PROVIDER === 'PRODUCTION') {
  const missingFirebase = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'].filter(
    (key) => !process.env[key] || process.env[key]?.trim() === ''
  );
  if (missingFirebase.length > 0) {
    fail(
      `OTP_PROVIDER=PRODUCTION requires Firebase credentials: missing ${missingFirebase.join(', ')}.\n` +
        `Set these or switch OTP_PROVIDER back to TEST.`
    );
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 5001,
  DATABASE_URL: process.env.DATABASE_URL as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  REDIS_URL: process.env.REDIS_URL || '',
  ALLOW_DEV_OTP_BYPASS: process.env.ALLOW_DEV_OTP_BYPASS === 'true',
  VERSION: process.env.npm_package_version || '1.0.0',
};
