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
