/**
 * /api/judicial-persons/filter-values                                                                      (Slice #39.62)
 *
 * GET ?field=<checklist>&q=<search>&<the list's filters> — the values one of the juridical persons list's checklists
 * offers, each with how many persons of the list hold it: { items: [{ id, label, count }] }.
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { isPersonFacetField, parsePersonFilters } from "@/lib/persons/list-filters";
import { listPersonFilterValues } from "@/lib/persons/list-filter-values";

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const field = url.searchParams.get("field") ?? "";
  if (!isPersonFacetField("JUDICIAL", field)) {
    return Response.json({ error: `Unknown filter field: ${field.slice(0, 40)}` }, { status: 400 });
  }
  try {
    const items = await listPersonFilterValues("JUDICIAL", field, {
      q:       url.searchParams.get("q") ?? undefined,
      filters: parsePersonFilters("JUDICIAL", url.searchParams),
    });
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/judicial-persons/filter-values");
  }
}
