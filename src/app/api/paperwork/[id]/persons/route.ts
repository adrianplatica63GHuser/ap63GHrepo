/**
 * /api/paperwork/[id]/persons
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { listPaperworkPersons, associatePersonsToPaperwork } from "@/lib/paperwork/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try { return Response.json({ items: await listPaperworkPersons(id) }); }
  catch (err) { return unexpectedError(err, "GET /api/paperwork/[id]/persons"); }
}

const bodySchema = z.object({
  personIds: z.array(z.string().uuid()).min(1),
  // Optional role for Certificat de Moștenitor party links.
  // 'DEFUNCT' | 'MOSTENITOR' — null / absent for general associations.
  quality: z.string().optional(),
});

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    await associatePersonsToPaperwork(id, parsed.data.personIds, parsed.data.quality ?? null);
    return new Response(null, { status: 204 });
  } catch (err) { return unexpectedError(err, "POST /api/paperwork/[id]/persons"); }
}
Paperwork(id, parsed.data.personIds, parsed.data.quality ?? null);
    return new Response(null, { status: 204 });
  } catch (err) { return unexpectedError(err, "POST /api/paperwork/[id]/persons"); }
}
