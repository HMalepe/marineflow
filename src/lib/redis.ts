import { Redis } from 'ioredis';
import { env } from '../config.js';
import { logger } from './logger.js';

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createRedis(): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  client.on('error', (err: Error) => logger.error({ err }, 'redis_error'));
  return client;
}

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export async function redisPing(): Promise<boolean> {
  try {
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

const BOT_SESSION_TTL_SEC = 30 * 60;

/** Track an active WhatsApp bot conversation session (refreshed on each inbound). */
export async function touchBotSession(salonId: string, waId: string): Promise<void> {
  try {
    await redis.set(`session:${salonId}:${waId}`, '1', 'EX', BOT_SESSION_TTL_SEC);
  } catch {
    // non-blocking
  }
}

/** Count Redis keys matching `session:*` — active bot sessions platform-wide. */
export async function getActiveSessionCount(): Promise<number> {
  try {
    let cursor = '0';
    let count = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', 'session:*', 'COUNT', 200);
      cursor = nextCursor;
      count += keys.length;
    } while (cursor !== '0');
    return count;
  } catch {
    return 0;
  }
}
