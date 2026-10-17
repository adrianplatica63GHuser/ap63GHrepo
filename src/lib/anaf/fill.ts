/**
 * What „Completează din ANAF" would change, field by field, and the change applied.                 (Slice #39.64)
 *
 * The rule (the header's Ask first 1, as recommended): a field that is empty is filled; a field that already holds a
 * different value is shown old → new and taken only when the user ticks it. A field ANAF leaves empty is never
 * offered — ANAF saying nothing is not a reason to blank what the archive has. Nothing here saves: the form's values
 * change, and „Salvează" is still the user's.
 *
 * Pure — the form and the parties step both use it.
 */
import type { AnafCompany } from "./company";

export const ANAF_FIELDS = [
  "name",
  "tradeRegisterNumber",
  "phone",
  "judicialPersonTypeId",
  "streetLine",
  "postalCode",
  "locality",
  "county",
  "country",
] as const;
export type AnafField = (typeof ANAF_FIELDS)[number];

/** The values the change is about — the form's, or the parties step's, flattened. */
export type AnafTarget = Record<AnafField, string>;

export type AnafRow = {
  field: AnafField;
  /** What the record holds now ("" = empty). */
  current: string;
  /** What ANAF says. */
  proposed: string;
  /** `fill`: the record's field is empty — taken by default. `replace`: it differs — taken only when ticked. */
  kind: "fill" | "replace";
};

/** ANAF's values in the target's shape; `typeId` is the proposed „Tip", already resolved to the list's id. */
export function anafTarget(company: AnafCompany, typeId: string | null): AnafTarget {
  return {
    name: company.name,
    tradeRegisterNumber: company.tradeRegisterNumber,
    phone: company.phone,
    judicialPersonTypeId: typeId ?? "",
    streetLine: company.address.streetLine,
    postalCode: company.address.postalCode,
    locality: company.address.locality,
    county: company.address.county,
    country: company.address.country,
  };
}

/** Compared as a person would read them: case, spacing and ş/ș aside. */
function same(a: string, b: string): boolean {
  const n = (s: string) => s.normalize("NFC").replace(/ş/g, "ș").replace(/ţ/g, "ț").replace(/\s+/g, " ").trim().toLowerCase();
  return n(a) === n(b);
}

export function anafRows(current: AnafTarget, proposed: AnafTarget): AnafRow[] {
  const rows: AnafRow[] = [];
  for (const field of ANAF_FIELDS) {
    const p = proposed[field].trim();
    if (!p) continue;
    const c = current[field].trim();
    if (c && same(c, p)) continue;
    rows.push({ field, current: c, proposed: p, kind: c ? "replace" : "fill" });
  }
  return rows;
}

/** The fields taken by default: every `fill`, no `replace`. */
export function defaultTaken(rows: readonly AnafRow[]): Set<AnafField> {
  return new Set(rows.filter((r) => r.kind === "fill").map((r) => r.field));
}

/** `current` with the taken rows' ANAF values put in. */
export function applyAnafRows(current: AnafTarget, rows: readonly AnafRow[], taken: ReadonlySet<AnafField>): AnafTarget {
  const out = { ...current };
  for (const r of rows) if (taken.has(r.field)) out[r.field] = r.proposed;
  return out;
}

/** dd.MM.yyyy for an ISO date. */
function dmy(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

/**
 * The dated line an inactive company's „Note" gets (Ask first 2, as recommended — no new column). Romanian, because
 * it is a value in the record, not a screen string.
 */
export function inactiveNoteLine(company: AnafCompany, today: string): string | null {
  if (company.inactiveSince === null) return null;
  const since = company.inactiveSince ? ` din ${dmy(company.inactiveSince)}` : "";
  return `ANAF ${dmy(today)}: inactivă fiscal${since}.`;
}

/**
 * `notes` with `line` on a line of its own after it — unless it is there already, or the whole would pass `max`
 * characters („Note" holds 300). Returns null when it does not fit, so the screen can say so rather than cut.
 */
export function appendNoteLine(notes: string, line: string, max = 300): string | null {
  const base = notes.trimEnd();
  if (base.split("\n").some((l) => l.trim() === line)) return base;
  const next = base ? `${base}\n${line}` : line;
  return next.length <= max ? next : null;
}
