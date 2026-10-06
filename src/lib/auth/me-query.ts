/**
 * „Who is signed in, and what may they see?" — the browser's one question, and
 * the rule that keeps its answer from outliving the session.   (Slice #37.01)
 *
 * The sidebar asks `/api/auth/me` for the signed-in account's name and whether
 * it has the whole application (Slice #38.21: `fullAccess`, no role), and shows
 * an account without it only the dashboard and the four lists.
 * Until this slice the question lived inside `sidebar-nav.tsx`, and two things
 * about it hid both sections from an administrator who had signed out and back
 * in (Adrian, 2026-09-26):
 *
 * ⚠️ **A 401 IS NOT A ROLE.** `fetchMe()` used to turn any answer that was not
 * ok into `{ role: "user" }`. React Query cached that as a successful answer,
 * fresh for five minutes, and — because nothing had failed — never retried it.
 * One 401 or 500 at the moment of sign-in was therefore believed as a demotion
 * until the page was reloaded. An answer that is not ok now THROWS: the query
 * is in error, holds no role, and is retried like any other failed request.
 * While the role is unknown the sidebar shows neither administration section,
 * which is what an unknown answer has always shown on a fresh load.
 *
 * ⚠️ **A SESSION'S CACHE ENDS WITH THE SESSION.** Neither „Ieșire" nor the login
 * form cleared the query cache, so signing out and in within one document handed
 * the next account the previous one's role, lists and records, fresh for as long
 * as each query's `staleTime` said. `clearSessionCache()` empties the WHOLE
 * cache — not just `["auth-me"]` — on sign-out and again after a successful
 * sign-in; `clearRecentlyViewed()` does the same for „RECENTE".
 *
 * Only the sidebar reads `["auth-me"]`. The two other places that ask whether
 * the reader has full access — `associate-person-view.tsx` and
 * `no-roles-for-type-note.tsx` — ask the server, through `canConfigureRoles()`,
 * and deliberately not through a second `queryFn` under this key.
 *
 * `src/__tests__/auth-session-cache.test.tsx` holds all of this, red on the
 * code before this slice.
 */

import type { QueryClient } from "@tanstack/react-query";

/** What `GET /api/auth/me` answers with a 200. */
export type Me = {
  username: string;
  /** `hasFullAccess` on the server (Slice #38.21): the whole application, or the four lists. */
  fullAccess: boolean;
  /** Ciprian's UAT box: no real Supabase session, so no „Ieșire". */
  uatMode?: boolean;
};

export const AUTH_ME_QUERY_KEY = ["auth-me"] as const;

/** The sidebar re-reads the role in the background after this long. */
export const AUTH_ME_STALE_TIME_MS = 5 * 60 * 1000;

/** `/api/auth/me` did not tell us who is signed in. Never a role. */
export class MeUnavailableError extends Error {
  constructor(readonly status: number) {
    super(`GET /api/auth/me answered ${status}; the signed-in role is unknown`);
    this.name = "MeUnavailableError";
  }
}

export async function fetchMe(): Promise<Me> {
  const res = await fetch("/api/auth/me");
  if (!res.ok) throw new MeUnavailableError(res.status);
  const body = (await res.json()) as Partial<Me> | null;
  // A 200 that does not say whether the account has the whole application is no
  // more an answer than a 401.
  if (!body || typeof body.fullAccess !== "boolean") throw new MeUnavailableError(res.status);
  return {
    username: typeof body.username === "string" ? body.username : "",
    fullAccess: body.fullAccess,
    ...(body.uatMode === true ? { uatMode: true } : {}),
  };
}

/**
 * Forget everything the browser cached for the account that was signed in:
 * its role, and every list and record its screens fetched. Called by „Ieșire"
 * and by a successful sign-in, before either navigates.
 */
export function clearSessionCache(queryClient: QueryClient): void {
  queryClient.clear();
}
