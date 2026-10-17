/**
 * The Properties list's filter bar, as SQL                                                       (Slice #39.61)
 *
 * One condition per filtered field, ANDed; within a checklist the values OR, „(necompletat)" (`_none`) meaning the
 * field is empty. The columns are the ones `listProperties` joins — `lookup_tarla`, `property_address`, and the
 * two value lists — and both of its queries join them all, because both share one `where`.
 *
 * NO DATABASE — the schema's tables only, so `property-list-filter-sql.test.ts` renders the conditions with
 * `PgDialect` and asserts the statement and its parameters, as `document-custom-field-filter.test.ts` does.
 */
import { or, sql, type SQL } from "drizzle-orm";
import { contains, oneOf, textValue } from "@/lib/list/filter-sql";
import { groupMember, groups, property, propertyAddress } from "@/db/schema";
import { NONE_VALUE, type FilterState } from "@/lib/list/filter-bar";

/** The property is in one of the PROPERTY groups whose codes are `ids`, or — with `_none` — in none. */
export function inGroups(ids: readonly string[]): SQL | undefined {
  const codes = ids.filter((id) => id !== NONE_VALUE);
  const parts: SQL[] = [];
  // The literal `property.principal_object_id`: inside a correlated sql`` subquery `${property.x}` renders
  // unqualified and resolves to the subquery's own table (see the group filter in `listProperties`).
  if (codes.length > 0) {
    parts.push(sql`EXISTS (
      SELECT 1 FROM ${groupMember} gm_fb
      JOIN ${groups} g_fb ON g_fb.id = gm_fb.group_id
      WHERE gm_fb.principal_object_id = property.principal_object_id
        AND g_fb.target_type = 'PROPERTY'
        AND g_fb.code = ANY(ARRAY[${sql.join(codes.map((c) => sql`${c}`), sql`, `)}]::text[])
    )`);
  }
  if (ids.includes(NONE_VALUE)) {
    parts.push(sql`NOT EXISTS (
      SELECT 1 FROM ${groupMember} gm_fn
      JOIN ${groups} g_fn ON g_fn.id = gm_fn.group_id
      WHERE gm_fn.principal_object_id = property.principal_object_id
        AND g_fn.target_type = 'PROPERTY'
    )`);
  }
  return parts.length === 0 ? undefined : parts.length === 1 ? parts[0] : or(...parts);
}

/** The bar's filters as SQL conditions, one per field. */
export function propertyFilterConditions(filters: FilterState): SQL[] {
  const out: SQL[] = [];
  const push = (c: SQL | undefined) => {
    if (c) out.push(c);
  };
  for (const [key, f] of Object.entries(filters)) {
    if (f.kind === "values") {
      if (key === "propertyType") push(oneOf(property.propertyTypeId, f.ids));
      else if (key === "useCategory") push(oneOf(property.useCategoryId, f.ids));
      else if (key === "tarla") push(oneOf(property.tarlaId, f.ids));
      else if (key === "locality") push(oneOf(textValue(propertyAddress.locality), f.ids));
      else if (key === "county") push(oneOf(textValue(propertyAddress.county), f.ids));
      else if (key === "group") push(inGroups(f.ids));
    } else if (f.kind === "range") {
      const col = key === "surfaceAreaMp" ? property.surfaceAreaMp : key === "calculatedAreaMp" ? property.calculatedAreaMp : null;
      if (!col) continue;
      if (f.from !== null) out.push(sql`${col} >= ${f.from}`);
      if (f.to !== null) out.push(sql`${col} <= ${f.to}`);
    } else if (f.kind === "text") {
      const col =
        key === "cadastralNumber" ? property.cadastralNumber :
        key === "carteFunciara"   ? property.carteFunciara :
        key === "parcela"         ? property.parcela : null;
      if (col) out.push(contains(col, f.text));
    }
  }
  return out;
}

