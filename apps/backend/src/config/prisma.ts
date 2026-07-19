import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const RETRY_DELAY_MS = 3000;

/**
 * Blocks server startup until the DB is reachable, retrying forever with a
 * fixed backoff instead of crashing the process -- a transient DB outage
 * (container still booting, network blip) shouldn't take the whole API down.
 */
export async function connectDatabase(maxAttempts = Infinity): Promise<void> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      await prisma.$queryRaw`SELECT 1`;
      console.log('[db] Connected to database');
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[db] Connection attempt ${attempt} failed: ${message}`);
      if (attempt >= maxAttempts) throw error;
      console.error(`[db] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export default prisma;
