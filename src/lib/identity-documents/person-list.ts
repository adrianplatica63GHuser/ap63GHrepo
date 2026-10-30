/**
 * A person's identity documents, as „Acte de identitate" lists them.     (Slice 40.85)
 *
 * The person's tile that held a card's values (natural_person's id_* columns) became the list of the identity
 * documents the person holds, of any kind: each a document of its own since 40.82, with its own screen since 40.83.
 * This module is the list's order and its words; the read is `listPersonIdentityDocuments`
 * (src/lib/identity-documents/queries.ts).
 *
 * THE CURRENT ONE (Ask first 2): the one valid today — „Valabil până la" today or later — with the latest issue date;
 * when none is, the latest issued. It comes first; the others follow, latest issued first, then by code.
 *
 * PURE — no React, no DB. Safe to import from a client component.
 */
import { identityValidity, type ValidityStatus } from "./form";
import { isIdentityKind, type IdentityKind } from "./kinds";

export type PersonIdentityDocument = {
  id: string;
  code: string;
  kind: IdentityKind;
  /** The type's name, and its short name where it has one („CI", „CI vechi"). */
  typeName: string;
  typeShortName: string | null;
  nrDocument: string | null;
  /** The issue date („Data eliberării" / „Data emiterii"), yyyy-mm-dd. */
  dateDocument: string | null;
  /** „Valabil până la", yyyy-mm-dd; a tip vechi has none. */
  dateValidUntil: string | null;
  /** The issuer's name — the juridical person on the document. */
  issuerName: string | null;
};

export type PersonIdentityRow = PersonIdentityDocument & {
  status: ValidityStatus;
  current: boolean;
};

/** A raw row → a document of the list, or null when its type is not (or no longer) an identity type. */
export function personIdentityDocumentOf(row: {
  id: string;
  code: string;
  identityKind: string | null;
  typeName: string | null;
  typeShortName: string | null;
  nrDocument: string | null;
  dateDocument: string | null;
  dateValidUntil: string | null;
  issuerName: string | null;
}): PersonIdentityDocument | null {
  if (!isIdentityKind(row.identityKind)) return null;
  return {
    id: row.id,
    code: row.code,
    kind: row.identityKind,
    typeName: row.typeName ?? "",
    typeShortName: row.typeShortName?.trim() || null,
    nrDocument: row.nrDocument?.trim() || null,
    dateDocument: row.dateDocument ?? null,
    dateValidUntil: row.dateValidUntil ?? null,
    issuerName: row.issuerName?.trim() || null,
  };
}

/** Latest issued first; on the same date, by code (a total order — two documents of one day keep their places). */
function byIssueDesc(a: PersonIdentityDocument, b: PersonIdentityDocument): number {
  const byDate = (b.dateDocument ?? "").localeCompare(a.dateDocument ?? "");
  return byDate !== 0 ? byDate : a.code.localeCompare(b.code);
}

function validToday(d: PersonIdentityDocument, today: Date): boolean {
  const s = identityValidity(d.dateValidUntil, today, 0);
  return s !== null && s.kind !== "expired";
}

/** The list in its order, each with its status and the current one marked. One row per document. */
export function orderPersonIdentityDocuments(
  docs: readonly PersonIdentityDocument[],
  today: Date,
  soonDays: number,
): PersonIdentityRow[] {
  const seen = new Set<string>();
  const unique = docs.filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)));
  const sorted = [...unique].sort(byIssueDesc);
  const current = sorted.find((d) => validToday(d, today)) ?? sorted[0] ?? null;
  const ordered = current ? [current, ...sorted.filter((d) => d !== current)] : sorted;
  return ordered.map((d) => ({ ...d, status: identityValidity(d.dateValidUntil, today, soonDays), current: d === current }));
}

/** The kind's short label on the list: the type's short name, else its name. */
export function personIdentityLabel(d: Pick<PersonIdentityDocument, "typeName" | "typeShortName">): string {
  return d.typeShortName ?? d.typeName;
}

/** A document number as compared: letters upper-cased, spaces and the „nr." / „seria" words gone. */
export function identityNumberKey(nr: string | null | undefined): string {
  return (nr ?? "")
    .toLocaleUpperCase("ro-RO")
    .replace(/\b(SERIA|SERIE|NR|NUMĂRUL|NUMARUL)\b\.?/g, "")
    .replace(/[^0-9A-Z]/g, "");
}

/**
 * Of a person's identity documents, the one a deed's quoted number names, else the current one.  (Ask first 4)
 * The deed's number is shown and matched against the person's documents; it is never stored on the person.
 */
export function identityDocumentForQuote(
  rows: readonly PersonIdentityRow[],
  quoted: string | null | undefined,
): PersonIdentityRow | null {
  const key = identityNumberKey(quoted);
  if (key) {
    const named = rows.find((r) => identityNumberKey(r.nrDocument) === key);
    if (named) return named;
  }
  return rows.find((r) => r.current) ?? null;
}
