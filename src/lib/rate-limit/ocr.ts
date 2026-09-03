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
 * That list was two routes out of date before #29.09 added the last two: the
 * ai-interpret route has called this since it was written and was never named
 * here. It matters more than a stale comment usually does, because the bucket
 * below is SHARED across every route on the list — a DocTypeEngine run and the
 * user's own import in another tab spend from the same allowance, and a reader
 * working out why a run paused needs the list to be complete.
 *
 * ⚠️ **THE ALLOWANCE DEPENDS ON THE CALLER'S ROLE (Slice #29.09a).** A
 * superuser gets `OCR_MAX_REQUESTS_BY_ROLE.superuser` per window; everyone else
 * gets `OCR_MAX_REQUESTS_BY_ROLE.user`. The bucket is still keyed by user id
 * alone — a role is a property of the user, not a second dimension of the key —
 * so the two never mix. Anonymous callers (no session) share a single
 * "anonymous" bucket at the lower allowance; they cannot reach these routes in
 * practice because the middleware redirects unauthenticated requests to
 * /login, but the guard is here for defence-in-depth.
 *
 * ⚠️ **THIS MODULE STAYS FREE OF SERVER-ONLY IMPORTS.** `sample-read-pacing.ts`
 * imports the numbers below into the BROWSER so the DocTypeEngine client paces
 * against the same arithmetic the server enforces. Resolving the caller's role
 * is `@/lib/auth/current-role`'s job and happens in the route; this file is
 * told the answer. A `db` import here would put drizzle and a connection string
 * in the client bundle.
 *
 * This is intentionally kept simple: in-memory, no Redis, no persistent state.
 * It resets on every server restart, which is fine for a small single-server
 * deployment.
 *
 * ⚠️ **The map is never trimmed, and the sentence that said it was has gone.**
 * It claimed "the map never grows beyond the active user count because each
 * cleanup() call trims stale entries" — there is no `cleanup()` in this file or
 * anywhere else in the tree, and no key is ever deleted. What IS bounded is
 * each key's array, which is filtered to the window on every call. So the map
 * holds one entry per user id seen since the process started: three, on this
 * deployment. If that ever stops being true, this is the line to come back to.
 */

import { isAppRole, type AppRole } from "@/lib/auth/roles";

/**
 * ⚠️ **Exported since Slice #29.09, and the export is the point.** DocTypeEngine
 * reads ten to twenty samples in one run, which is at or over what this allows
 * in one window, so its client PACES itself against these numbers rather than
 * racing them (`src/lib/import/sample-read-pacing.ts`). A client carrying its
 * own copy would pace against a window this file had since changed and report a
 * run of refusals as a run of readings — and the count of samples actually read
 * is the answer that run produces. One place, not two.
 */
export const OCR_WINDOW_MS = 60_000; // 1 minute

/**
 * Requests per window, per user, by role.
 *
 * ⚠️ **Twenty for a superuser is not generosity, it is the size of the job.**
 * A DocTypeEngine run reads up to twenty samples and then spends one more
 * request clustering them, and every admin screen — import, DocTypeEngine,
 * id-card extraction — is superuser-only by `src/app/admin/layout.tsx` and, as
 * of #29.09a, by the routes themselves.
 *
 * ⚠️ **Five for everyone else, and a sweep of the callers says which routes
 * that actually touches.** Of the six on the list above, `read-sample`,
 * `cluster` and `extract-id-card` are superuser-only. `scan-image` and
 * `parse-text` are both reached by `app/properties/_components/add-property-
 * dialog.tsx`, which **slice #32.20 gave an entry point on the Properties
 * list** — until then it was an orphan nothing imported, and this paragraph
 * said so. `parse-text` is additionally reached from the admin import wizard.
 *
 * ⚠️ **So an ordinary user now meets this number on two screens, not one, and
 * they share the bucket.** It is no longer only `ai-interpret` from the
 * document form: an Add Property run that photographs a coordinate table, or
 * imports a folder of `.txt` files, spends from the same five a minute — and
 * the folder path posts one `parse-text` per file, so a folder of six spends
 * the whole window on its first five and the sixth fails. That is a real limit on a
 * real screen, and #32.20 was scoped to expose the four paths without
 * rebuilding any of them, so it is recorded here rather than raised: if the
 * folder path is taken forward, its allowance is the first thing to revisit.
 *
 * ⚠️ **A `Record<AppRole, …>` on purpose.** When the next role arrives, this
 * fails to compile until it has an allowance, rather than defaulting one in
 * silently. The rename from the old scalar `OCR_MAX_REQUESTS` was for the same
 * reason: every reader of the old number had to be visited, and the compiler
 * did the visiting.
 */
export const OCR_MAX_REQUESTS_BY_ROLE: Readonly<Record<AppRole, number>> = {
  superuser: 20,
  user: 5,
};

/** The smallest allowance any role has — what an unrecognised caller gets. */
const LOWEST_ALLOWANCE = Math.min(...Object.values(OCR_MAX_REQUESTS_BY_ROLE));

/**
 * The allowance for one role.
 *
 * ⚠️ **THE FALLBACK IS THE WHOLE POINT OF THIS FUNCTION EXISTING, AND AN
 * ADVERSARIAL ROUND FOUND OUT WHY.** The first draft was
 * `return OCR_MAX_REQUESTS_BY_ROLE[role]` and nothing else, on the reasoning
 * that `AppRole` makes an unknown role impossible. It does not: the role comes
 * out of Postgres, and `ALTER TYPE app_user_role ADD VALUE 'auditor'` in a
 * migration that does not also edit `src/db/schema/index.ts` leaves the build
 * green and hands this function a string with no entry. The result would have
 * been `undefined` — and `timestamps.length >= undefined` is **false**, so that
 * account would have had UNMETERED access to every Anthropic-billed route in
 * the product. The one place in this slice that failed open, in the file whose
 * header says fail closed. `getCurrentAppUser()` narrows with `isAppRole()`
 * before it gets here; this is the second lock on the same door.
 *
 * ⚠️ The parameter is `unknown`, not `AppRole | string`. A later round pointed
 * out that `AppRole | string` collapses to plain `string` in TypeScript, so it
 * silently gave up the compile-time check the `Record` above exists to provide
 * while looking like it kept it. `unknown` forces the narrowing below, and
 * `checkOcrRateLimit` keeps the strict `AppRole` its callers can be held to.
 */
export function ocrMaxRequests(role: unknown): number {
  if (!isAppRole(role)) return LOWEST_ALLOWANCE;
  return OCR_MAX_REQUESTS_BY_ROLE[role];
}

const WINDOW_MS = OCR_WINDOW_MS;

/**
 * Timestamps (Date.now()) of recent requests, keyed by userId.
 * Module-level singleton — survives across requests in the same Node.js process.
 */
const buckets = new Map<string, number[]>();

/**
 * Check whether `userId`, acting with `role`, has capacity for one more request.
 *
 * - If allowed: records the request and returns { allowed: true }.
 * - If denied:  returns { allowed: false, retryAfterSeconds } so the caller
 *   can set the Retry-After HTTP header.
 *
 * ⚠️ **A refused request is NOT recorded.** Everything downstream depends on
 * this — `sample-read-run.ts` states it too — because a limiter that charged
 * for refusals would push the slot that frees capacity further away on every
 * retry and never let a paced run back in.
 *
 * Thread-safety note: Node.js is single-threaded; there is no race condition
 * on the Map mutation.
 */
export function checkOcrRateLimit(
  userId: string,
  role: AppRole,
): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const maxRequests = ocrMaxRequests(role);
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Retrieve (or initialise) this user's timestamp list.
  let timestamps = buckets.get(userId) ?? [];

  // Drop timestamps older than the window.
  timestamps = timestamps.filter((t) => t > windowStart);

  if (timestamps.length >= maxRequests) {
    // ⚠️ **The slot that frees capacity is the `maxRequests`-th from the END,
    // not the oldest in the window.** Those were the same request while every
    // user had the same allowance and a full bucket held exactly `MAX` entries.
    // They stop being the same the moment a bucket can hold MORE than the
    // current allowance — a superuser demoted to user mid-window has up to
    // twenty timestamps and an allowance of five, and answering with the oldest
    // of the twenty would promise a slot that is fifteen requests away from
    // being free. `msUntilNextSlot` in sample-read-pacing.ts has always used
    // this form; now both do.
    const oldestThatMatters = timestamps[timestamps.length - maxRequests];
    const retryAfterMs = oldestThatMatters + WINDOW_MS - now;
    buckets.set(userId, timestamps);
    return {
      allowed: false,
      // ⚠️ **`Math.max(1, …)` IS UNREACHABLE BY CONSTRUCTION, AND IT STAYS.**
      // The filter above keeps `t > windowStart` STRICTLY, so every surviving
      // timestamp satisfies `t + WINDOW_MS - now > 0`, and `Math.ceil` of any
      // positive is already at least 1 — a round measured it and the clamp
      // never fires. It is here for the reader who later "simplifies" that
      // filter to `>=`, which makes `Retry-After: 0` reachable and turns a
      // paced client into an instant-retry loop against a limiter still saying
      // no. Same treatment, and the same reason, as the blank-header lines in
      // `retryAfterMs` (sample-read-pacing.ts).
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  // Record this request and persist.
  timestamps.push(now);
  buckets.set(userId, timestamps);

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * ⚠️ **There is deliberately no reset export.** The buckets are a module-level
 * singleton, so a suite does need isolation between cases — but it gets that by
 * using a DIFFERENT USER ID per case, because the bucket is keyed by user and
 * always has been. A `__resetForTests()` would have been a production export
 * that empties every user's allowance, shipped in a module the client bundle
 * imports, to solve a problem the key already solves.
 */
