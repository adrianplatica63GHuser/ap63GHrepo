/**
 * /api/documents/filter-values                                                                   (Slice #39.63)
 *
 * GET ?field=institution&<the list's parameters and filters> — each institution with how many documents of the list
 * it issued, counted over the list on screen: { items: [{ id, label, count }] }.
 */
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { isDocumentFacetField } from "@/lib/documents/list-filters";
import { parseDocumentListRequest } from "@/lib/documents/list-request";
import { listDocumentFilterValues } from "@/lib/documents/list-filter-values";
import { getTimeFrameSettings } from "@/lib/time-frames/queries";
import { getDays } from "@/lib/time-frames/config";

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const field = url.searchParams.get("field") ?? "";
  if (!isDocumentFacetField(field)) {
    return Response.json({ error: `Unknown filter field: ${field.slice(0, 40)}` }, { status: 400 });
  }
  const parsed = parseDocumentListRequest(url);
  if (!parsed.ok) return zodErrorToResponse(parsed.error!);
  try {
    const tf = await getTimeFrameSettings();
    const items = await listDocumentFilterValues(field, parsed.query, getDays(tf, "documents_expiring_soon"));
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents/filter-values");
  }
}
