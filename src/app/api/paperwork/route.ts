/**
 * /api/paperwork
 *
 * GET  — list with search + type filter + pagination
 * POST — create a Paperwork record
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { createPaperwork, listPaperwork } from "@/lib/paperwork/queries";
import {
  PAPERWORK_TYPES,
  paperworkCreateSchema,
  paperworkListQuerySchema,
  type PaperworkType,
} from "@/lib/paperwork/validation";

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);

  // Parse ?types=ACT_ADJUDECARE,CONTRACT_VANZARE (comma-separated).
  // Key absent → undefined (show all).  Key present but empty → [] (show nothing).
  const typesRaw = url.searchParams.get("types");
  const typesArr: PaperworkType[] | undefined =
    typesRaw === null
      ? undefined
      : typesRaw === ""
      ? []
      : (typesRaw
          .split(",")
          .filter((t): t is PaperworkType =>
            (PAPERWORK_TYPES as readonly string[]).includes(t),
          ));

  const parsed = paperworkListQuerySchema.safeParse({
    q:      url.searchParams.get("q")      ?? undefined,
    types:  typesArr,
    limit:  url.searchParams.get("limit")  ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const { items, total } = await listPaperwork(parsed.data);
    return Response.json({
      items,
      total,
      limit:  parsed.data.limit,
      offset: parsed.data.offset,
    });
  } catch (err) {
    return unexpectedError(err, "GET /api/paperwork");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = paperworkCreateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const result = await createPaperwork(parsed.data);
    return Response.json(result, { status: 201 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/paperwork");
  }
}
