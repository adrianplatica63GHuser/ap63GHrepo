/**
 * The wire shape of a refused delete — shared by the route that sends it and
 * the dialog that reads it.                                    (Slice #29.05)
 *
 * ⚠️ **TYPE-ONLY imports from `./dependents`, deliberately.** That module
 * imports the Drizzle schema, and this one is imported by a `"use client"`
 * component. `import type` is erased at compile time, so the shape crosses the
 * boundary and the tables do not.
 *
 * ⚠️ **The body carries i18n KEYS and numbers, never a sentence.** Romanian is
 * the version that matters and the server has no locale: a message built here
 * would be English text on the one screen that must never show any. What the
 * client receives is `{ labelKey: "documents", count: 3 }` and what it renders
 * comes from `messages/ro-RO.json` → `valueList.dependents.classes.documents`.
 */

import type { DependentCount, DependentsReport } from "./dependents";

/** The `code` on a 409 from DELETE .../[list]/[id]. */
export const IN_USE = "IN_USE";

export type InUseBody = {
  error: string;
  code: typeof IN_USE;
  total: number;
  dependents: DependentCount[];
  /** Configuration that goes with the row when it is deleted. Never blocks. */
  removedWithRow: DependentCount[];
  /** i18n keys under `valueList.dependents.notes` — what the count cannot see. */
  notes: string[];
};

/**
 * 409, not 400: the request is well formed and the row is deletable — just not
 * yet. A 400 would say the caller made a mistake, and a client cannot tell it
 * apart from the validation 400 the same route already returns.
 */
export function inUseResponse(report: DependentsReport): Response {
  const body: InUseBody = {
    error: "Reference data value is in use",
    code: IN_USE,
    total: report.total,
    dependents: report.dependents,
    removedWithRow: report.removedWithRow,
    notes: report.notes,
  };
  return Response.json(body, { status: 409 });
}

/**
 * Is this parsed JSON a refusal? Written as a narrowing guard rather than a
 * status-code test at the call site, because the client has to survive a body
 * it did not expect — a proxy's HTML error page parses to nothing useful, and
 * a dialog that then reads `.dependents.map` would blank the screen instead of
 * showing the failure.
 */
export function isInUseBody(value: unknown): value is InUseBody {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Partial<InUseBody>;
  const counts = (list: unknown): boolean =>
    Array.isArray(list) &&
    list.every(
      (d) =>
        typeof d === "object" &&
        d !== null &&
        typeof (d as DependentCount).labelKey === "string" &&
        typeof (d as DependentCount).count === "number",
    );
  return (
    b.code === IN_USE &&
    typeof b.total === "number" &&
    counts(b.dependents) &&
    counts(b.removedWithRow) &&
    Array.isArray(b.notes) &&
    b.notes.every((n) => typeof n === "string")
  );
}

/**
 * Is this path segment a uuid?
 *
 * Here rather than in a route because all three of them need it and the fourth
 * will too. Without it a segment like `abc` reaches Postgres inside
 * `id = 'abc'`, comes back as SQLSTATE 22P02, misses every branch of
 * `dbErrorToResponse` and surfaces as a 500 — for a request whose only fault
 * is naming a row that cannot exist.
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
