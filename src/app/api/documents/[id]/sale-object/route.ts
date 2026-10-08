/**
 * /api/documents/[id]/sale-object                                (Slice #38.49)
 *
 * GET → `{ text }`: what the contract de vânzare sells, composed from its
 * properties, its parties and „Scop vânzare" (`?scop=` — the screen's value,
 * saved or not; absent, the stored one). 404 when there is no such document.
 * Read-only: the screen writes the text into „Descrierea obiectului".
 */
import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { composeSaleObjectFor } from "@/lib/documents/sale-object-queries";

type Ctx = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const scop = req.nextUrl.searchParams.get("scop");
  try {
    const text = await composeSaleObjectFor(id, req.nextUrl.searchParams.has("scop") ? scop || null : undefined);
    if (text === null) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ text });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents/[id]/sale-object");
  }
}
