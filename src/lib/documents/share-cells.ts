/**
 * Whether a Document's „Persoane" row draws the three share values —
 * „Cotă-parte", „Suprafață echivalentă (mp)" and „Mod de deținere" — and
 * whether they can be edited there.                              (Slice #37.59)
 *
 * Pure, so the client tile, the write routes and the tests read one rule:
 *
 *   - a link with NO role keeps the cells, editable: its role is unknown, and
 *     a share may be what it is waiting for;
 *   - a role that HOLDS a share on this document's type (`holds_share`,
 *     migration_091) keeps them, editable;
 *   - a role that holds none and stores NOTHING draws no cells — the row is a
 *     name and a role;
 *   - a role that holds none but already STORES a value shows it, READ-ONLY,
 *     with a hint: nothing stored is hidden, and nothing new is written
 *     (the routes refuse it — `share-not-held.ts`).
 */

export type ShareCells = "edit" | "readonly" | "none";

export interface ShareRow {
  personRoleId:    string | null;
  holdsShare:      boolean;
  cotaParte:       number | null;
  cotaSuprafataMp: number | null;
  cotaMod:         string | null;
}

/** Any of the three values set. */
export function storesShare(row: Pick<ShareRow, "cotaParte" | "cotaSuprafataMp" | "cotaMod">): boolean {
  return row.cotaParte !== null || row.cotaSuprafataMp !== null || row.cotaMod !== null;
}

export function shareCells(row: ShareRow): ShareCells {
  if (row.personRoleId === null || row.holdsShare) return "edit";
  return storesShare(row) ? "readonly" : "none";
}
