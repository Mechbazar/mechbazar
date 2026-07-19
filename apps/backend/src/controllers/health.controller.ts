import { Request, Response } from 'express';
import { env } from '../config/env';
import { isDatabaseHealthy } from '../config/prisma';
import { isRedisHealthy } from '../config/redis';

const startedAt = Date.now();

export const getHealth = (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    version: env.VERSION,
    environment: env.NODE_ENV,
  });
};

export const getStatus = async (_req: Request, res: Response) => {
  const dbHealthy = await isDatabaseHealthy();
  const redisHealthy = isRedisHealthy();
  const healthy = dbHealthy; // Redis is a best-effort cache, not required for readiness

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    version: env.VERSION,
    environment: env.NODE_ENV,
    dependencies: {
      database: dbHealthy ? 'up' : 'down',
      redis: redisHealthy ? 'up' : 'down',
    },
  });
};
