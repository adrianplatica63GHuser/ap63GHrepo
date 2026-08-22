/**
 * How a run of ten to twenty sample reads paces itself against the limiter.
 *                                                              (Slice #29.09)
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * `checkOcrRateLimit` allows `OCR_MAX_REQUESTS` per `OCR_WINDOW_MS` per user
 * and `POST /api/admin/doc-type-engine/read-sample` asks it on every call, so a
 * folder of twenty samples meets a 429 on the eleventh — guaranteed, not
 * occasionally. A run that raced the limiter would lose those samples, and a
 * lost sample is the worst bug this slice could ship, because the denominator
 * IS the answer: „14 din 20 de mostre citite" is an honest screen and a bare
 * 70% over an unknown N is not.
 *
 * ⚠️ **THE POLICY IS PURE AND THE LOOP IS NOT, DELIBERATELY.** Everything here
 * is arithmetic over timestamps that the caller supplies, so the pacing can be
 * asserted against fixtures rather than against a clock. The `await` that
 * actually sleeps, and the `fetch` it wraps, live in the client module.
 *
 * ⚠️ **THE TWO NUMBERS ARE IMPORTED, NOT RETYPED.** A client that believed the
 * window was 60 s while the server had moved to 30 would pace into a wall and
 * report a run of failures as a run of readings. `OCR_WINDOW_MS` and
 * `OCR_MAX_REQUESTS` are exported from the limiter itself for this one reason;
 * importing them pulls no behaviour into the client bundle, only two numbers.
 *
 * ⚠️ **PACING IS A COURTESY, `Retry-After` IS THE FACT.** The limiter is
 * in-memory per Node process and its bucket is shared with `ai-interpret`,
 * `scan-image`, `parse-text` and `extract-id-card` — so the user's own import in
 * another tab spends from the same ten, and on more than one server instance
 * this client's model of the window is a guess. The run therefore does BOTH:
 * it self-paces so a 429 is rare, and it honours `Retry-After` and retries
 * when one happens anyway. A run that only did the first would still lose
 * samples; a run that only did the second would pay a stall on every eleventh.
 */

import { OCR_MAX_REQUESTS, OCR_WINDOW_MS } from "@/lib/rate-limit/ocr";

export { OCR_MAX_REQUESTS, OCR_WINDOW_MS };

/**
 * A little under the true window.
 *
 * The server drops timestamps strictly older than `now - WINDOW_MS`, and the
 * client's clock, the request's flight time and the server's own `Date.now()`
 * are three different instants. Waiting exactly the window lands on the
 * boundary and 429s about as often as it succeeds.
 *
 * ⚠️ **THREE SECONDS, NOT ONE, AND AN ADVERSARIAL ROUND MEASURED WHY.** The
 * client dates a slot from when IT began the fetch; the server dates it from
 * when the request ARRIVED. Uniform flight time cancels out, but the first
 * sample of a run does not: a fourteen-page scan against a cold function took
 * eight seconds to arrive, which shifted the server's window eight seconds
 * later than the client's model of it and produced a 429 on the eleventh
 * sample. The retry recovers the sample either way — this only decides whether
 * the common case pays a stall — but the claim in the header below had to
 * become "rare" rather than "never", and the number had to move with it.
 */
const SAFETY_MS = 3_000;

/**
 * How long to wait before starting the next read, given when the recent ones
 * STARTED.
 *
 * Starts, not finishes: the limiter records a request when it arrives, so a
 * call that took forty seconds still only occupies the slot it began in.
 * Returns 0 when there is capacity now.
 */
export function msUntilNextSlot(recentStartsMs: readonly number[], nowMs: number): number {
  const windowStart = nowMs - OCR_WINDOW_MS;
  const inWindow = recentStartsMs.filter((t) => t > windowStart).sort((a, b) => a - b);
  if (inWindow.length < OCR_MAX_REQUESTS) return 0;
  // The oldest request still inside the window is the one whose expiry frees a
  // slot — the same arithmetic `checkOcrRateLimit` uses to compute Retry-After.
  const oldest = inWindow[inWindow.length - OCR_MAX_REQUESTS];
  // ⚠️ **CLAMPED AT BOTH ENDS, and the upper clamp is not theoretical.**
  // `Date.now()` is not monotonic — an NTP step, a laptop resuming, a user
  // changing the clock — and a start recorded before a backward step sits in
  // the future. An adversarial round produced an eleven-minute wait from a
  // ten-minute jump, shown on screen as "waiting for a slot", with no cap
  // anywhere on this path while `retryAfterMs` beside it had one. No wait for a
  // slot can honestly exceed one window plus the safety margin, because that is
  // how long a slot takes to free.
  const wait = oldest + OCR_WINDOW_MS + SAFETY_MS - nowMs;
  return Math.min(OCR_WINDOW_MS + SAFETY_MS, Math.max(0, wait));
}

/** Nobody waits longer than this for one slot, whatever a header claims. */
export const MAX_RETRY_AFTER_MS = 120_000;

/**
 * `Retry-After` in milliseconds, defensively.
 *
 * The route sets it from `retryAfterSeconds`, an integer, so the HTTP-date form
 * is not expected — but a proxy may rewrite it and a `NaN` here would become an
 * instant retry loop against a limiter that is still refusing. An unreadable or
 * absent header falls back to one window, which is the answer that is never
 * wrong for longer than it has to be.
 */
export function retryAfterMs(header: string | null | undefined): number {
  // ⚠️ **The guard that actually does the work is `seconds <= 0`, and a round
  // proved it.** The blank-header lines below were added believing `" "` became
  // a one-second retry; it does not — `Number(" ")` is 0, which `<= 0` already
  // catches. They are kept for legibility, because `Number("")` being 0 rather
  // than NaN is the kind of thing a later reader "simplifies" back into a bug,
  // and the comment says plainly that they are not the load-bearing line.
  const raw = header?.trim();
  if (!raw) return OCR_WINDOW_MS;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return OCR_WINDOW_MS;
  return Math.min(MAX_RETRY_AFTER_MS, Math.ceil(seconds * 1000) + SAFETY_MS);
}

/**
 * How many times one sample is re-offered after a 429 before it is recorded as
 * unread.
 *
 * Two, not "until it works": a limiter that is still refusing after two paced
 * waits is being spent by something else, and a run that retried for ever would
 * hang with no Cancel and no count. A sample that exhausts these is `read:
 * false` with reason `rateLimited` — which keeps it in the "picked but not
 * read" line on screen instead of quietly out of the arithmetic.
 */
export const MAX_RATE_LIMIT_RETRIES = 2;

/**
 * What the screen must be able to say before the reads are paid for.
 *
 * The whole point is that it is computable in advance: `count` reads at
 * `OCR_MAX_REQUESTS` per window take at least this long, so a user picking
 * twenty samples is told it will take about two minutes rather than discovering
 * it. Deliberately a floor and not an estimate — the model call itself takes
 * seconds per sample on top, and a number that claimed to include that would be
 * the confident-output-never-measured failure this codebase keeps recording.
 */
export function minimumRunMs(count: number): number {
  if (!Number.isFinite(count) || count <= OCR_MAX_REQUESTS) return 0;
  const fullWindows = Math.floor((count - 1) / OCR_MAX_REQUESTS);
  return fullWindows * OCR_WINDOW_MS;
}
