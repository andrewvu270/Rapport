/**
 * Simple in-memory sliding-window rate limiter.
 * NOTE: resets on server restart and does not share state across instances.
 * For multi-instance prod, replace with Upstash Redis.
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

/**
 * Returns true if the request is allowed, false if rate-limited.
 * @param key      Unique key (e.g. userId + endpoint)
 * @param limit    Max requests per window
 * @param windowMs Window size in milliseconds
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;

  entry.count++;
  return true;
}
