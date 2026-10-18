/**
 * The Properties list's filter bar, as SQL                                                       (Slice #39.61)
 *
 * One condition per filtered field, ANDed; within a checklist the values OR, „(necompletat)" (`_none`) meaning the
 * field is empty. The columns are the ones `listProperties` joins — `lookup_tarla`, `property_address`, and the
 * two value lists — and both of its queries join them all, because both share one `where`. Slice #39.82 kept only
 * the columns Adrian named (`./list-filters`); the county, group, cadastral number and CF conditions went with
 * their filters.
 *
 * NO DATABASE — the schema's tables only, so `property-list-filter-sql.test.ts` renders the conditions with
 * `PgDialect` and asserts the statement and its parameters, as `document-custom-field-filter.test.ts` does.
 */
import { sql, type SQL } from "drizzle-orm";
import { contains, oneOf, textValue } from "@/lib/list/filter-sql";
import { property, propertyAddress } from "@/db/schema";
import type { FilterState } from "@/lib/list/filter-bar";

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
    } else if (f.kind === "range") {
      const col = key === "surfaceAreaMp" ? property.surfaceAreaMp : key === "calculatedAreaMp" ? property.calculatedAreaMp : null;
      if (!col) continue;
      if (f.from !== null) out.push(sql`${col} >= ${f.from}`);
      if (f.to !== null) out.push(sql`${col} <= ${f.to}`);
    } else if (f.kind === "text") {
      if (key === "parcela") out.push(contains(property.parcela, f.text));
    }
  }
  return out;
}
