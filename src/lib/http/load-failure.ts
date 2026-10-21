/**
 * Why a list did not load — from what its query threw.                                             (Slice 40.16)
 *
 * Adrian, 2026-10-21: „when I opened a principal object form: the links tile cannot load its items; Failed to load!".
 * Each kind's list in „Legături" (`RelatedTile`) said only that it failed. Its fetchers throw `new Error("HTTP <status>")`
 * on a non-2xx answer — nine of them, one shape — so the status is read back from that message, and the reason is
 * chosen from it (`shared.relatedLoad.reasons.*`), never from the server's own text:
 *   - `signedOut`  — 401;
 *   - `forbidden`  — 403;
 *   - `notFound`   — 404. The record or the route was not found; when every form says it, the server has lost its
 *                    routes (measured in 40.15 on the test runner's `next dev`), and the sentence says what to do;
 *   - `database`   — 500 or 503: the server could not read the database;
 *   - `network`    — no answer: the fetch itself failed (`TypeError`);
 *   - `unreadable` — an answer that is not JSON (`SyntaxError`), typically the login page a redirect led to;
 *   - `other`      — any other status, named.
 *
 * PURE — `related-load-error.test.tsx`.
 */

export type LoadFailure = "signedOut" | "forbidden" | "notFound" | "database" | "network" | "unreadable" | "other";

/** The status in a fetcher's `HTTP <status>` error, or null when the error is not one. */
export function statusOfError(err: unknown): number | null {
  if (!(err instanceof Error)) return null;
  const m = /^HTTP (\d{3})$/.exec(err.message.trim());
  return m ? Number(m[1]) : null;
}

export function loadFailure(err: unknown): { failure: LoadFailure; status: number | null } {
  const status = statusOfError(err);
  if (status === null) {
    if (err instanceof SyntaxError) return { failure: "unreadable", status: null };
    return { failure: "network", status: null };
  }
  if (status === 401) return { failure: "signedOut", status };
  if (status === 403) return { failure: "forbidden", status };
  if (status === 404) return { failure: "notFound", status };
  if (status === 500 || status === 503) return { failure: "database", status };
  return { failure: "other", status };
}
