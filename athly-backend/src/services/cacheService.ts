import redisClient from '../lib/redisClient.js';

export const ONE_HOUR_SECONDS = 3600;

/**
 * Retrieves a cached value by key.
 * Returns `null` on cache miss or if Redis is unavailable.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await redisClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error('[Cache] getCached error — bypassing cache:', (err as Error).message);
    return null;
  }
}

/**
 * Stores a value in Redis as JSON with a TTL in seconds.
 * Silently swallows errors so a Redis outage never breaks the caller.
 */
export async function setCached<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error('[Cache] setCached error — result not cached:', (err as Error).message);
  }
}
