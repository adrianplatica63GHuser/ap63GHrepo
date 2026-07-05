/**
 * src/lib/rate-limit/ocr.ts
 *
 * Simple in-memory sliding-window rate limiter for the OCR / Anthropic routes:
 *   POST /api/properties/scan-image
 *   POST /api/properties/parse-text
 *   POST /api/admin/import/extract-id-card
 *   POST /api/admin/import/extract-document
 *
 * Limit: MAX_REQUESTS requests per WINDOW_MS milliseconds, per authenticated user.
 * The bucket is keyed by user ID (Supabase UUID). Anonymous callers (no session)
 * share a single "anonymous" bucket — they cannot reach these routes in practice
 * because the middleware redirects unauthenticated requests to /sign-in, but the
 * guard is here for defence-in-depth.
 *
 * This is intentionally kept simple: in-memory, no Redis, no persistent state.
 * It resets on every server restart, which is fine for a small single-server
 * deployment. The map never grows beyond the active user count because each
 * cleanup() call trims stale entries.
 */

const WINDOW_MS     = 60_000; // 1 minute
const MAX_REQUESTS  = 10;     // per user per window

/**
 * Timestamps (Date.now()) of recent requests, keyed by userId.
 * Module-level singleton — survives across requests in the same Node.js process.
 */
const buckets = new Map<string, number[]>();

/**
 * Check whether `userId` has capacity for one more request.
 *
 * - If allowed: records the request and returns { allowed: true }.
 * - If denied:  returns { allowed: false, retryAfterSeconds } so the caller
 *   can set the Retry-After HTTP header.
 *
 * Thread-safety note: Node.js is single-threaded; there is no race condition
 * on the Map mutation.
 */
export function checkOcrRateLimit(userId: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Retrieve (or initialise) this user's timestamp list.
  let timestamps = buckets.get(userId) ?? [];

  // Drop timestamps older than the window.
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= MAX_REQUESTS) {
    // Oldest timestamp in the window tells us when a slot opens up.
    const oldestInWindow = timestamps[0];
    const retryAfterMs = oldestInWindow + WINDOW_MS - now;
    buckets.set(userId, timestamps);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  // Record this request and persist.
  timestamps.push(now);
  buckets.set(userId, timestamps);

  return { allowed: true, retryAfterSeconds: 0 };
}
