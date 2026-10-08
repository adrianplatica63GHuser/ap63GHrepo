/**
 * /api/account/tile-defaults                                      (Slice #38.41)
 *
 * GET    — the signed-in user's own default tiles: `{ items: { <kind>: string[] } }`.
 * PUT    — `{ kind, tiles }`: save one kind's set (at least one tile).
 * DELETE — `?kind=`: „Revino la implicit" — the row goes, the built-in set stands.
 *
 * Everyone's own, read and written for themselves alone: the user is the
 * session's, never a parameter.
 */

import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { getCurrentUser } from "@/lib/auth/current-user";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { clearTileDefaults, listTileDefaults, saveTileDefaults } from "@/lib/account/tile-defaults";
import { TILE_DEFAULT_KINDS, isTileDefaultKind } from "@/lib/ui/tile-defaults";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  kind: z.enum(TILE_DEFAULT_KINDS),
  tiles: z.array(z.string().min(1).max(100)).min(1).max(50),
});

async function userId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

export async function GET(): Promise<Response> {
  const id = await userId();
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json({ items: await listTileDefaults(id) });
  } catch (err) {
    return unexpectedError(err, "GET /api/account/tile-defaults");
  }
}

export async function PUT(request: NextRequest): Promise<Response> {
  const id = await userId();
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(raw);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    await saveTileDefaults(id, parsed.data.kind, [...new Set(parsed.data.tiles)]);
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "PUT /api/account/tile-defaults");
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const id = await userId();
  if (!id) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const kind = request.nextUrl.searchParams.get("kind") ?? "";
  if (!isTileDefaultKind(kind)) return Response.json({ error: "Unknown kind" }, { status: 400 });
  try {
    await clearTileDefaults(id, kind);
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, "DELETE /api/account/tile-defaults");
  }
}
