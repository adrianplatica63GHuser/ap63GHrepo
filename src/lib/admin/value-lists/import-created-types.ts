/**
 * Which document types „Creat la import" go, and which are held back.
 *                                                                (Slice #38.52)
 *
 * Adrian: the document types whose status reads „Creat la import" are to be
 * removed. `origin` is write-once (origin-status.ts) and there is no
 * „reviewed" action, so such a row says „Creat la import" for as long as it
 * exists — deleting it is the only way to clear the word.
 *
 * THE SELECTION IS THE STATUS'S OWN RULE, `documentTypeStatus(row) ===
 * "aiScanned"` (status.ts) — origin IMPORT and no form. An imported type that
 * has since been given a form reads „Completat AI", not „Creat la import", and
 * is not touched: somebody finished it.
 *
 * A TYPE THAT IS USED IS HELD BACK, never deleted and never merged here. The
 * header's go-ahead is for the unused ones only; a used one is named in the
 * handover with the type it would merge into, for Adrian to rule on with
 * „Unește". A type whose usage is UNKNOWN (absent from the count) is held as
 * well — the safe direction. `deleteValue` re-checks under a row lock anyway,
 * so a document created between this plan and the delete still wins.
 *
 * PURE — `import-created-types.test.ts` covers it; the script
 * `scripts/remove-import-created-types.ts` and the run on ga40db use it.
 */

import { documentTypeStatus } from "@/lib/documents/status";

/** The fields of a document-type row this needs, as `listValues` returns them. */
export interface DocumentTypeRow {
  id: string;
  name: string;
  key?: string | null;
  origin?: unknown;
  templateFields?: unknown;
}

export interface HeldType<T> {
  row: T;
  /** „folosit de N"; `null` when the count did not name the row. */
  usedBy: number | null;
}

export interface ImportCreatedPlan<T> {
  /** Created by an import, no form, used by nothing: deleted. */
  remove: T[];
  /** Created by an import, no form, but used (or of unknown use): kept. */
  hold: HeldType<T>[];
}

/** Does the row's status read „Creat la import"? */
export function isImportCreatedType(row: DocumentTypeRow): boolean {
  return documentTypeStatus({ origin: row.origin, templateFields: row.templateFields }) === "aiScanned";
}

/**
 * Splits the „Creat la import" types into those to delete and those to hold.
 * `usage` is `countUsage("document-types")`: id → „folosit de N".
 * Every other row is in neither list.
 */
export function planImportCreatedRemoval<T extends DocumentTypeRow>(
  rows: readonly T[],
  usage: Readonly<Record<string, number>>,
): ImportCreatedPlan<T> {
  const plan: ImportCreatedPlan<T> = { remove: [], hold: [] };
  for (const row of rows) {
    if (!isImportCreatedType(row)) continue;
    const usedBy = Object.prototype.hasOwnProperty.call(usage, row.id) ? usage[row.id] : null;
    if (usedBy === 0) plan.remove.push(row);
    else plan.hold.push({ row, usedBy });
  }
  const byName = (a: DocumentTypeRow, b: DocumentTypeRow) => a.name.localeCompare(b.name, "ro");
  plan.remove.sort(byName);
  plan.hold.sort((a, b) => byName(a.row, b.row));
  return plan;
}

/** One line per row, for the dry run and the log: `Name [KEY] — folosit de N`. */
export function describeType(row: DocumentTypeRow, usedBy: number | null): string {
  const key = row.key ? ` [${row.key}]` : "";
  return `${row.name}${key} — folosit de ${usedBy === null ? "?" : usedBy}`;
}
