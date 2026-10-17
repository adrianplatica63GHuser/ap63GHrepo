/**
 * GET /api/tarlale/[id]/parcels — the parcels the tarla's plans drew.          (Slice #39.69, migration_113)
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { unexpectedError } from "@/lib/api/errors";
import { listTarlaParcels } from "@/lib/tarla/plan-queries";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    return Response.json({ items: await listTarlaParcels(id) });
  } catch (err) {
    return unexpectedError(err, "GET /api/tarlale/[id]/parcels");
  }
}
