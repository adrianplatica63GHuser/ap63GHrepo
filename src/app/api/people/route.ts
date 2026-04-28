/**
 * /api/people
 *
 * GET  — list with search + pagination (server-side)
 * POST — create a Natural Person
 */

import type { NextRequest } from "next/server";
import {
  dbErrorToResponse,
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import { createNaturalPerson, listPersons } from "@/lib/persons/queries";
import {
  listQuerySchema,
  naturalPersonCreateSchema,
} from "@/lib/persons/validation";

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const { items, total } = await listPersons(parsed.data);
    return Response.json({
      items,
      total,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });
  } catch (err) {
    return unexpectedError(err, "GET /api/people");
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = naturalPersonCreateSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const result = await createNaturalPerson(parsed.data);
    return Response.json(result, { status: 201 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/people");
  }
}
