/**
 * /api/judicial-persons
 *
 * GET  — list with search + pagination (server-side)
 * POST — create a Judicial Person
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import {
  createJudicialPerson,
  listJudicialPersons,
} from "@/lib/judicial-persons/queries";
import {
  judicialListQuerySchema,
  judicialPersonCreateSchema,
} from "@/lib/judicial-persons/validation";

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const parsed = judicialListQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const { items, total } = await listJudicialPersons(parsed.data);
    return Response.json({
      items,
      total,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
  } catch (err) {
    return unexpectedError(err, "GET /api/judicial-persons");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = judicialPersonCreateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const result = await createJudicialPerson(parsed.data);
    return Response.json(result, { status: 201 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/judicial-persons");
  }
}
