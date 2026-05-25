import { redis } from './redis.js';
import { logger } from './logger.js';

const DEFAULT_TTL = 60; // seconds

/**
 * Generic cache-aside pattern using Redis.
 * TTL in seconds (default 60s).
 */
export async function cached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = DEFAULT_TTL,
): Promise<T> {
  try {
    const hit = await redis.get(key);
    if (hit !== null) {
      return JSON.parse(hit) as T;
    }
  } catch (err) {
    logger.warn({ err, key }, 'cache_read_error');
  }

  const data = await fetcher();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    logger.warn({ err, key }, 'cache_write_error');
  }

  return data;
}

/**
 * Invalidate a specific cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  await redis.del(key).catch(() => {});
}

/**
 * Invalidate all cache keys matching a pattern.
 * Uses SCAN to avoid blocking Redis.
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}

// ─── Domain-specific cache keys ──────────────────────────────────────

export function salonServicesKey(salonId: string) {
  return `cache:services:${salonId}`;
}

export function salonSlotsKey(salonId: string, date: string, serviceId: string) {
  return `cache:slots:${salonId}:${date}:${serviceId}`;
}

export function salonStaffKey(salonId: string) {
  return `cache:staff:${salonId}`;
}

export function salonBusinessHoursKey(salonId: string) {
  return `cache:hours:${salonId}`;
}
