/**
 * The Documents list's request, read the same way by its route and by its checklist's counts.     (Slice #39.63)
 *
 * The parameters `GET /api/documents` has always read (`documentTypeIds`, groups, metadata, `expiringSoon`, the custom
 * field), then the shared bar's (`parseDocumentFilters`). Moved out of the route so `/api/documents/filter-values`
 * counts over exactly the list on screen.
 */
import { documentListQuerySchema, type DocumentListQuery } from "@/lib/documents/validation";
import { parseDocumentFilters } from "@/lib/documents/list-filters";
import type { FilterState } from "@/lib/list/filter-bar";

export type DocumentListRequest =
  | { ok: true; query: DocumentListQuery & { filters?: FilterState } }
  | { ok: false; error: ReturnType<typeof documentListQuerySchema.safeParse>["error"] };

export function parseDocumentListRequest(url: URL): DocumentListRequest {
  // Parse ?documentTypeIds=<uuid>,<uuid> (comma-separated).
  // Key absent → undefined (show all).  Key present but empty → [] (show nothing).
  const idsRaw = url.searchParams.get("documentTypeIds");
  const idsArr: string[] | undefined =
    idsRaw === null
      ? undefined
      : idsRaw === ""
      ? []
      : idsRaw.split(",").filter(Boolean);

  // Parse ?groupCodes=DOC-AA,DOC-AB (comma-separated).
  // Key absent → undefined (no group filter). Key present but empty → [] (no-group only).
  const gcRaw = url.searchParams.get("groupCodes");
  const groupCodes: string[] | undefined =
    gcRaw === null ? undefined : gcRaw === "" ? [] : gcRaw.split(",").filter(Boolean);

  // Parse ?includeUngrouped=false (only relevant when groupCodes is non-empty).
  const iuRaw = url.searchParams.get("includeUngrouped");
  const includeUngrouped: boolean | undefined =
    iuRaw === null ? undefined : iuRaw !== "false";

  const parsed = documentListQuerySchema.safeParse({
    q:               url.searchParams.get("q")            ?? undefined,
    documentTypeIds: idsArr,
    limit:           url.searchParams.get("limit")         ?? undefined,
    offset:          url.searchParams.get("offset")        ?? undefined,
    groupCodes,
    includeUngrouped,
    // Slice #20.06: metadata filters.
    importance:      url.searchParams.get("importance")    ?? undefined,
    relevance:       url.searchParams.get("relevance")     ?? undefined,
    expiringSoon:    url.searchParams.get("expiringSoon")  ?? undefined,
    // Slice #34.10 — the custom-field filter. Both halves or neither; the
    // schema and `listDocument` state that rule, this only forwards them.
    customFieldKey:   url.searchParams.get("customFieldKey")   ?? undefined,
    customFieldValue: url.searchParams.get("customFieldValue") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error };
  // Slice #39.63: the bar's fields, whitelisted — none set, none passed, so the call is the one it was.
  const filters = parseDocumentFilters(url.searchParams);
  return { ok: true, query: Object.keys(filters).length > 0 ? { ...parsed.data, filters } : parsed.data };
}
