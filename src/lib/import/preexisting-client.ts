/**
 * Client-side helper for the Pre-existing stage's one question.
 * (Slice #26.08)
 *
 * The wizard's only route to `/api/admin/import/preexisting`. A separate module
 * rather than a `fetch` inside `runWalk` for the reason
 * `corner-source-client.ts` gives: the wizard is already the longest file in
 * the import path, and a network shape spelled out inside a 200-line callback
 * is a network shape nobody tests.
 *
 * ⚠️ **IT NEVER THROWS AND IT NEVER RETURNS A PARTIAL ANSWER.** Everything that
 * can go wrong — the route down, the session expired, a body that will not
 * parse, the archive unreachable — collapses to `{ ok: false }`, and the stage
 * renders that as "we could not ask", with a retry and an explicit way past.
 *
 * The alternative shapes were both rejected:
 *
 *  - THROWING would put this failure on the same footing as a failed walk,
 *    whose banner says the folder could not be read and sends the user back to
 *    the previous list. Nothing is wrong with the folder here.
 *  - AN EMPTY MATCH LIST is the dangerous one. It renders as a green "the
 *    archive holds none of these" over a request that never arrived, and the
 *    user then imports a folder they were told was entirely new. That is the
 *    confident-output failure this codebase records after #26.00, in the one
 *    stage whose entire output is a claim about something the user cannot see.
 *
 * Pure fetch wrapper — no React, safe to import from any client component. It
 * does NOT import the server-side lookup, only the shared types.
 */

import type { PreexistingCandidate, PreexistingMatch } from "./preexisting-check";

export type PreexistingLookup =
  | { ok: true; matches: PreexistingMatch[] }
  | { ok: false };

/**
 * Ask the archive about every entry in one request.
 *
 * ⚠️ **ONE REQUEST, not one per file.** ~760 round trips would take minutes and
 * would give the stage a partial-answer state it must not have — see the
 * module header. The body is a few hundred kilobytes of names and integers.
 *
 * `candidates` may legitimately be empty (a chosen folder the walk found
 * nothing importable in). The call is skipped rather than sent, because an
 * empty question has a known answer and a route that has to special-case an
 * empty array is a route with an untested branch.
 */
export async function lookupPreexisting(
  candidates: readonly PreexistingCandidate[],
): Promise<PreexistingLookup> {
  if (candidates.length === 0) return { ok: true, matches: [] };

  try {
    const res = await fetch("/api/admin/import/preexisting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates }),
    });
    // The expired-Supabase-session tell (CLAUDE.md): the middleware redirects
    // to /sign-in and fetch follows it into a cheerful 200 of HTML. Treated as
    // a failure like any other — the stage's own copy tells the user to try
    // again, and a signed-out user will be sent to sign in by the next write
    // they attempt anyway.
    if (res.redirected || !res.ok) return { ok: false };

    const body = (await res.json()) as { matches?: unknown };
    if (!Array.isArray(body.matches)) return { ok: false };
    return { ok: true, matches: body.matches as PreexistingMatch[] };
  } catch {
    return { ok: false };
  }
}
