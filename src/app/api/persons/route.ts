/**
 * /api/persons
 *
 * GET — combined Natural + Judicial list, with search + type filter +
 * pagination. Backs the unified /persons list page (Slice #15.09).
 *
 * Read-only: creation still goes through /api/people (Natural) and
 * /api/judicial-persons (Judicial) — there is no unified create flow.
 */

import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { listAllPersons } from "@/lib/persons/queries";
import { allPersonsListQuerySchema } from "@/lib/persons/validation";

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);

  // Parse ?personTypes=NATURAL,JUDICIAL (comma-separated).
  // Key absent → undefined (show both). Key present but empty → [] (show nothing).
  const typesRaw = url.searchParams.get("personTypes");
  const typesArr: string[] | undefined =
    typesRaw === null
      ? undefined
      : typesRaw === ""
      ? []
      : typesRaw.split(",").filter(Boolean);

  const parsed = allPersonsListQuerySchema.safeParse({
    q:      url.searchParams.get("q")      ?? undefined,
    types:  typesArr,
    limit:  url.searchParams.get("limit")  ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
  });

  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const { items, total } = await listAllPersons(parsed.data);
    return Response.json({
      items,
      total,
      limit:  parsed.data.limit,
      offset: parsed.data.offset,
    });
  } catch (err) {
    return unexpectedError(err, "GET /api/persons");
  }
}
