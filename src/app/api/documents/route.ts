/**
 * /api/documents
 *
 * GET  — list with search + type filter + pagination
 * POST — create a Document record
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { createDocument, listDocument } from "@/lib/documents/queries";
import {
  documentCreateSchema,
  documentListQuerySchema,
} from "@/lib/documents/validation";

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);

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
    q:               url.searchParams.get("q")      ?? undefined,
    documentTypeIds: idsArr,
    limit:           url.searchParams.get("limit")  ?? undefined,
    offset:          url.searchParams.get("offset") ?? undefined,
    groupCodes,
    includeUngrouped,
  });

  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const { items, total } = await listDocument(parsed.data);
    return Response.json({
      items,
      total,
      limit:  parsed.data.limit,
      offset: parsed.data.offset,
    });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = documentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const result = await createDocument(parsed.data);
    return Response.json(result, { status: 201 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/documents");
  }
}
