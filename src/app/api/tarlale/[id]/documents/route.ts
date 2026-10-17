/**
 * GET /api/tarlale/[id]/documents — the documents of one tarla's properties, each once.     (Slice #39.67)
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { unexpectedError } from "@/lib/api/errors";
import { listTarlaDocuments } from "@/lib/tarla/queries";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    return Response.json({ items: await listTarlaDocuments(id) });
  } catch (err) {
    return unexpectedError(err, "GET /api/tarlale/[id]/documents");
  }
}
