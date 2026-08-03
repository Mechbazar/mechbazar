import { Request, Response } from 'express';
import { env } from '../config/env';
import { isDatabaseHealthy } from '../config/prisma';

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

  res.status(dbHealthy ? 200 : 503).json({
    status: dbHealthy ? 'ok' : 'degraded',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    version: env.VERSION,
    environment: env.NODE_ENV,
    dependencies: {
      database: dbHealthy ? 'up' : 'down',
    },
  });
};
