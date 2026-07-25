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
import { provenanceFromRequestBody } from "@/lib/metadata/provenance";
import { setInitialProvenance } from "@/lib/metadata/queries";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);

  // Parse ?groupCodes=JPERS-AA,JPERS-AB (comma-separated).
  const gcRaw = url.searchParams.get("groupCodes");
  const groupCodes: string[] | undefined =
    gcRaw === null ? undefined : gcRaw === "" ? [] : gcRaw.split(",").filter(Boolean);

  // Parse ?includeUngrouped=false
  const iuRaw = url.searchParams.get("includeUngrouped");
  const includeUngrouped: boolean | undefined =
    iuRaw === null ? undefined : iuRaw !== "false";

  const parsed = judicialListQuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    groupCodes,
    includeUngrouped,
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
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    const result = await createJudicialPerson(parsed.data, user?.email ?? null);

    // Slice #21.07.Import — record how this entity entered the system.
    // Import paths pass the value their provenance rule inferred (or the one
    // the user picked when no rule applies); the "Add new" forms pass MANUAL.
    // Absent/unknown -> no provenance recorded, as before this slice.
    const provenance = provenanceFromRequestBody(body);
    if (provenance) {
      await setInitialProvenance(result.person.principalObjectId, provenance, user?.email ?? null);
    }
    return Response.json(result, { status: 201 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/judicial-persons");
  }
}
