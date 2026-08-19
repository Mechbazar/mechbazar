import { createClient, type RedisClientType } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import { MemoryStore, type Store, type Options as RateLimitOptions } from 'express-rate-limit';
import { env } from './env';

// Shared client for rate-limiter state only. REDIS_URL stays optional here
// exactly like it is for the Socket.IO adapter in realtime/gateway.ts -- and
// for the same reason: this backend has already been burned once by treating
// Redis as load-bearing (OTPs were moved off it onto Postgres's PhoneOtp
// table after it proved unreliable in the old serverless prod environment;
// see this var's doc comment in env.ts). Unset means every limiter below
// keeps using its own in-memory store, i.e. today's behaviour, unchanged.
let client: RedisClientType | undefined;

function getClient(): RedisClientType | undefined {
  if (!env.REDIS_URL) return undefined;
  if (client) return client;
  client = createClient({
    url: env.REDIS_URL,
    socket: { connectTimeout: 3000, reconnectStrategy: (retries) => Math.min(retries * 200, 5000) },
  });
  client.on('error', (err) => console.error('[redis] rate-limit client error:', err.message));
  client.connect().catch((err) => {
    console.error(
      '[redis] rate-limit client failed to connect -- limiters staying in-memory:',
      err instanceof Error ? err.message : err
    );
  });
  return client;
}

// Route modules construct their rate limiters (and thus their stores) at
// import time, which happens well before an async Redis connection can
// possibly resolve. So readiness has to be checked per-request rather than
// once at construction: this wraps a RedisStore and a private MemoryStore,
// using Redis (shared across backend instances) whenever the client is
// actually connected, and quietly falling back to the in-memory store
// otherwise -- on every call, not just at startup, so a client that connects
// late (or drops and reconnects) is picked up automatically.
class FallbackStore implements Store {
  private readonly redisStore: RedisStore;
  private readonly memoryStore = new MemoryStore();
  private readonly isRedisReady: () => boolean;

  constructor(redisStore: RedisStore, isRedisReady: () => boolean) {
    this.redisStore = redisStore;
    this.isRedisReady = isRedisReady;
  }

  init(options: RateLimitOptions): void {
    this.redisStore.init(options);
    this.memoryStore.init(options);
  }

  async increment(key: string) {
    if (this.isRedisReady()) {
      try {
        return await this.redisStore.increment(key);
      } catch (err) {
        console.error(
          '[redis] rate-limit increment failed, using in-memory for this request:',
          err instanceof Error ? err.message : err
        );
      }
    }
    return this.memoryStore.increment(key);
  }

  async decrement(key: string): Promise<void> {
    if (this.isRedisReady()) {
      try {
        await this.redisStore.decrement(key);
        return;
      } catch {
        // fall through to the in-memory store below
      }
    }
    await this.memoryStore.decrement(key);
  }

  async resetKey(key: string): Promise<void> {
    if (this.isRedisReady()) {
      try {
        await this.redisStore.resetKey(key);
      } catch {
        // best-effort; the in-memory reset below still happens
      }
    }
    await this.memoryStore.resetKey(key);
  }
}

// One store per limiter -- express-rate-limit requires each limiter to own
// an unshared store instance, and each needs its own key prefix so their
// counters in Redis don't collide. When REDIS_URL is unset this returns a
// plain MemoryStore, identical to express-rate-limit's own default.
export function redisBackedStore(prefix: string): Store {
  const c = getClient();
  if (!c) return new MemoryStore();
  const redisStore = new RedisStore({
    prefix: `rl:${prefix}:`,
    sendCommand: (...args: string[]) => c.sendCommand(args),
  });
  // RedisStore's constructor eagerly kicks off loading its Lua scripts
  // (incrementScriptSha/getScriptSha) against Redis, regardless of whether
  // this limiter is ever hit or REDIS_URL is even reachable. FallbackStore
  // below only ever calls into redisStore.increment() when c.isReady is
  // true, so a rejection here is never actually consumed through that path
  // -- without this, every one of these stores (one per limiter, all
  // constructed at route-module load time) throws an unhandled promise
  // rejection the moment Redis is unreachable.
  redisStore.incrementScriptSha.catch(() => {});
  redisStore.getScriptSha.catch(() => {});
  return new FallbackStore(redisStore, () => c.isReady);
}
