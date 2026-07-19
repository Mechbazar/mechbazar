import dotenv from 'dotenv';

dotenv.config();

const REQUIRED_VARS = ['DATABASE_URL', 'DIRECT_URL', 'JWT_SECRET'] as const;

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
  DIRECT_URL: process.env.DIRECT_URL as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  REDIS_URL: process.env.REDIS_URL || '',
  ALLOW_DEV_OTP_BYPASS: process.env.ALLOW_DEV_OTP_BYPASS === 'true',
  IS_VERCEL: !!process.env.VERCEL,
  VERSION: process.env.npm_package_version || '1.0.0',
};
