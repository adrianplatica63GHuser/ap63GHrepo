/**
 * /api/properties/[id]/persons
 *
 * GET  — list persons currently associated with this property
 * POST — associate one or more persons { personIds: string[] }
 */

import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import {
  unexpectedError,
  zodErrorToResponse,
} from "@/lib/api/errors";
import {
  associatePersonsToProperty,
  listPropertyPersons,
} from "@/lib/properties/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const items = await listPropertyPersons(id);
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/properties/[id]/persons");
  }
}

const associateBodySchema = z.object({
  personIds: z.array(z.string().uuid()).min(1),
});

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = associateBodySchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    await associatePersonsToProperty(id, parsed.data.personIds);
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "POST /api/properties/[id]/persons");
  }
}
