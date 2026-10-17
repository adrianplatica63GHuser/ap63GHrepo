/**
 * A list's filter bar, as SQL — the pieces every list's conditions are built from.        (Slices #39.61, #39.62)
 *
 * NO DATABASE — drizzle's builders only, so each list's conditions render with `PgDialect` in jest.
 */
import { ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { NONE_VALUE, type FacetValue } from "@/lib/list/filter-bar";

/** A text column as a checklist reads it: trimmed, and empty as NULL — so „" and „ " are „(necompletat)". */
export function textValue(col: AnyPgColumn | SQL): SQL {
  return sql`nullif(trim(${col}), '')`;
}

/** `col` one of `ids`, or — with `_none` among them — empty. Undefined when `ids` asks for nothing. */
export function oneOf(col: SQL | AnyPgColumn, ids: readonly string[]): SQL | undefined {
  const values = ids.filter((id) => id !== NONE_VALUE);
  const c = sql`${col}`;
  const parts: SQL[] = [];
  if (values.length > 0) parts.push(inArray(c, values));
  if (ids.includes(NONE_VALUE)) parts.push(sql`${c} IS NULL`);
  return parts.length === 0 ? undefined : parts.length === 1 ? parts[0] : or(...parts);
}

/** „contains": ILIKE, with %, _ and \ escaped so they match themselves. */
export function contains(col: SQL | AnyPgColumn, text: string): SQL {
  return ilike(col, `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
}

/** A facet query's rows — `id` NULL for „(necompletat)" — as the checklist's values. */
export function facetValues(rows: readonly { id: string | null; label: string | null; n: number | string }[]): FacetValue[] {
  return rows.map((r) => ({ id: r.id ?? NONE_VALUE, label: r.id === null ? null : r.label, count: Number(r.n) }));
}
