/**
 * The other windows of this browser are told when a record changes.
 *                                                              (Slice #37.21)
 *
 * A record now opens easily in a second tab (every row is a real link), so a
 * window must not go on showing what another window has since changed. After a
 * successful write — a save, an association or dissociation, a delete — the
 * window that made it posts `{ method, path }` on a `BroadcastChannel`. Every
 * other window of the same browser then:
 *   - refetches its lists and association tiles (TanStack Query), and
 *   - if it shows that record: reloads it when nothing is unsaved, or says so
 *     with „Reîncarcă" when something is — never reloading under the user's
 *     hands. A deleted record says so and offers the list.
 *
 * WHY THE WRITES ARE ANNOUNCED AT `fetch`, NOT AT EACH CALL SITE. The writes
 * that change a record live in dozens of components (four forms, nine
 * association tiles, their associate screens, the parties panel, the pages
 * panel, the import dialogs), about half of them on a bare `fetch`. One wrapper
 * around `window.fetch` sees every one of them and cannot be forgotten by the
 * next component; a helper each caller must remember to call would be.
 *
 * NOT BETWEEN MACHINES OR USERS. A BroadcastChannel stays inside one browser
 * profile. Another machine is protected by the save's version check
 * (`@/lib/versioning/base-version`), not refreshed.
 *
 * PURE — the message shape and the matching; the React half is
 * `src/components/providers/record-sync-provider.tsx`.
 */

export const RECORD_CHANNEL = "ga40-records-v1";

/** What a window posts after a successful write under /api/. */
export interface RecordChange {
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  /** The request's path, no query string: `/api/people/<id>`, `/api/documents/<id>/persons`. */
  path: string;
}

const WRITES = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * The change to announce for a finished request, or null. Only a successful
 * write to this application's own `/api/` is announced — never a read, a
 * failure, or a request to another origin (the maps, the auth service).
 */
export function changeOf(method: string | undefined, url: string, origin: string, ok: boolean): RecordChange | null {
  const m = (method ?? "GET").toUpperCase();
  if (!ok || !WRITES.has(m)) return null;
  let u: URL;
  try {
    u = new URL(url, origin);
  } catch {
    return null;
  }
  if (u.origin !== origin || !u.pathname.startsWith("/api/")) return null;
  return { method: m as RecordChange["method"], path: u.pathname };
}

/**
 * What a change means for the record at `recordPath` (its own PATCH/DELETE
 * route, `/api/people/<id>`): it was saved, it was deleted, or neither — a
 * write to its associations or pages is not a change of its fields, and the
 * refetch of the lists already shows it.
 */
export function effectOn(recordPath: string, change: RecordChange): "saved" | "deleted" | null {
  if (change.path !== recordPath) return null;
  if (change.method === "DELETE") return "deleted";
  if (change.method === "PATCH" || change.method === "PUT") return "saved";
  return null;
}

/**
 * The queries a change refetches: all of them but the version lists. A form's
 * version list must move only with its own saves — refetching it under a form
 * with unsaved edits would put another window's version number on the header
 * over this window's values.
 */
export function refetchesAfterChange(queryKey: readonly unknown[]): boolean {
  return !/version/i.test(String(queryKey[0] ?? ""));
}
