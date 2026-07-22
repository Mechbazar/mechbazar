import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 3000,
    reconnectStrategy: () => false,
  },
});

let redisAvailable = false;

redisClient.on('error', (err) => {
  redisAvailable = false;
  console.error('[redis] Client error:', err.message || err);
});

export const connectRedis = async () => {
  try {
    await redisClient.connect();
    redisAvailable = true;
    console.log('[redis] Connected');
  } catch (error) {
    redisAvailable = false;
    console.error('[redis] Failed to connect (continuing without cache):', error instanceof Error ? error.message : error);
  }
};

export const disconnectRedis = async () => {
  if (redisAvailable) {
    await redisClient.quit().catch(() => undefined);
  }
};

export const isRedisHealthy = () => redisAvailable;

export default redisClient;
