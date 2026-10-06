/**
 * src/lib/rate-limit/ocr.ts
 *
 * Simple in-memory sliding-window rate limiter for the OCR / Anthropic routes:
 *   POST /api/properties/scan-image
 *   POST /api/properties/parse-text
 *   POST /api/admin/import/extract-id-card
 *   POST /api/documents/[id]/ai-interpret              (extract AND discover)
 *   POST /api/admin/doc-type-engine/read-sample        (Slice #29.09)
 *   POST /api/admin/doc-type-engine/cluster            (Slice #29.09)
 *
 * The bucket below is SHARED across every route on the list — a DocTypeEngine
 * run and the user's own import in another tab spend from the same allowance,
 * and a reader working out why a run paused needs the list to be complete.
 *
 * ⚠️ **ONE ALLOWANCE FOR EVERY ACCOUNT (Slice #38.21).** From #29.09a to #38.21
 * the allowance depended on the caller's role — twenty a minute for a superuser,
 * five for everyone else. Since #38.21 there is one kind of user, and every
 * account has what the superuser had: `OCR_MAX_REQUESTS` per window. The bucket
 * is keyed by user id alone. Anonymous callers (no session) share a single
 * "anonymous" bucket; they cannot reach these routes in practice because the
 * middleware redirects unauthenticated requests to /login, but the guard is
 * here for defence-in-depth.
 *
 * ⚠️ **THIS MODULE STAYS FREE OF SERVER-ONLY IMPORTS.** `sample-read-pacing.ts`
 * imports the numbers below into the BROWSER so the DocTypeEngine client paces
 * against the same arithmetic the server enforces. A `db` import here would put
 * drizzle and a connection string in the client bundle.
 *
 * This is intentionally kept simple: in-memory, no Redis, no persistent state.
 * It resets on every server restart, which is fine for a small single-server
 * deployment.
 *
 * ⚠️ **The map is never trimmed.** No key is ever deleted; what IS bounded is
 * each key's array, which is filtered to the window on every call. So the map
 * holds one entry per user id seen since the process started: a handful, on
 * this deployment. If that ever stops being true, this is the line to come back
 * to.
 */

/**
 * ⚠️ **Exported since Slice #29.09, and the export is the point.** DocTypeEngine
 * reads ten to twenty samples in one run, which is at or over what this allows
 * in one window, so its client PACES itself against these numbers rather than
 * racing them (`src/lib/import/sample-read-pacing.ts`). One place, not two.
 */
export const OCR_WINDOW_MS = 60_000; // 1 minute

/**
 * Requests per window, per user — every account's (Slice #38.21).
 *
 * ⚠️ **Twenty is not generosity, it is the size of the job.** A DocTypeEngine
 * run reads up to twenty samples and then spends one more request clustering
 * them; the client paces the twenty-first into the next window.
 */
export const OCR_MAX_REQUESTS = 20;

const buckets = new Map<string, number[]>();

/**
 * Charge one request to `userId`'s bucket, or refuse it.
 *
 * A refused request is not charged. `retryAfterSeconds` is measured from the
 * slot that actually frees capacity — the oldest of the last
 * `OCR_MAX_REQUESTS` — and is never 0.
 */
export function checkOcrRateLimit(userId: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const maxRequests = OCR_MAX_REQUESTS;
  const now = Date.now();
  const windowStart = now - OCR_WINDOW_MS;

  let timestamps = buckets.get(userId) ?? [];
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= maxRequests) {
    const oldestThatMatters = timestamps[timestamps.length - maxRequests];
    const retryAfterMs = oldestThatMatters + OCR_WINDOW_MS - now;
    buckets.set(userId, timestamps);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  timestamps.push(now);
  buckets.set(userId, timestamps);

  return { allowed: true, retryAfterSeconds: 0 };
}
