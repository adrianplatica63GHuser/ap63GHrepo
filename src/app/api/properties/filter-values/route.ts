/**
 * /api/properties/filter-values                                                                  (Slice #39.61)
 *
 * GET ?field=<checklist>&q=<search>&<the list's filters> — the values one of the Properties list's checklists
 * offers, each with how many properties of the list hold it, counted with the search and every other filter applied:
 *   { items: [{ id, label, count }] }   („(necompletat)" is id `_none`, label null)
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { listPropertyFilterValues } from "@/lib/properties/queries";
import { isPropertyFacetField, parsePropertyFilters } from "@/lib/properties/list-filters";

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const field = url.searchParams.get("field") ?? "";
  if (!isPropertyFacetField(field)) {
    return Response.json({ error: `Unknown filter field: ${field.slice(0, 40)}` }, { status: 400 });
  }
  try {
    const items = await listPropertyFilterValues(field, {
      q:       url.searchParams.get("q") ?? undefined,
      filters: parsePropertyFilters(url.searchParams),
    });
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/properties/filter-values");
  }
}
