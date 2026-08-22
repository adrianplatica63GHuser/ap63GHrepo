/**
 * src/lib/rate-limit/ocr.ts
 *
 * Simple in-memory sliding-window rate limiter for the OCR / Anthropic routes:
 *   POST /api/properties/scan-image
 *   POST /api/properties/parse-text
 *   POST /api/admin/import/extract-id-card
 *   POST /api/documents/[id]/ai-interpret              (extract AND discover)
 *   POST /api/admin/doc-type-engine/read-sample        (Slice #29.09)
 *
 * That list was two routes out of date before #29.09 added the last one: the
 * ai-interpret route has called this since it was written and was never named
 * here. It matters more than a stale comment usually does, because the bucket
 * below is SHARED across every route on the list — a DocTypeEngine run and the
 * user's own import in another tab spend from the same ten per minute, and a
 * reader working out why a run paused needs the list to be complete.
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

/**
 * ⚠️ **Exported since Slice #29.09, and the export is the point.** DocTypeEngine
 * reads ten to twenty samples in one run, which is more calls than this allows
 * in one window, so its client PACES itself against these two numbers rather
 * than racing them (`src/lib/import/sample-read-pacing.ts`). A client carrying
 * its own copy would pace against a window this file had since changed and
 * report a run of refusals as a run of readings — and the count of samples
 * actually read is the answer that run produces. Two numbers, one place.
 */
export const OCR_WINDOW_MS    = 60_000; // 1 minute
export const OCR_MAX_REQUESTS = 10;     // per user per window

const WINDOW_MS     = OCR_WINDOW_MS;
const MAX_REQUESTS  = OCR_MAX_REQUESTS;

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
