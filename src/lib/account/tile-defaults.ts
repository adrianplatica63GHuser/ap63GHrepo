/**
 * The user's own default tiles, stored.                           (Slice #38.41)
 *
 * One row per (user, kind) in `user_tile_default` (migration_101). The user is
 * whoever the session resolves to; the route asks, this module does not.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { userTileDefault } from "@/db/schema";
import { isTileDefaultKind, type TileDefaultKind } from "@/lib/ui/tile-defaults";

export async function listTileDefaults(userId: string): Promise<Partial<Record<TileDefaultKind, string[]>>> {
  const rows = await db.select().from(userTileDefault).where(eq(userTileDefault.userId, userId));
  const out: Partial<Record<TileDefaultKind, string[]>> = {};
  for (const r of rows) {
    if (!isTileDefaultKind(r.kind) || !Array.isArray(r.tiles)) continue;
    out[r.kind] = (r.tiles as unknown[]).filter((x): x is string => typeof x === "string");
  }
  return out;
}

export async function saveTileDefaults(userId: string, kind: TileDefaultKind, tiles: string[]): Promise<void> {
  await db
    .insert(userTileDefault)
    .values({ userId, kind, tiles, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [userTileDefault.userId, userTileDefault.kind],
      set: { tiles, updatedAt: new Date() },
    });
}

/** „Revino la implicit": the row goes, and the registry's defaults stand again. */
export async function clearTileDefaults(userId: string, kind: TileDefaultKind): Promise<void> {
  await db.delete(userTileDefault).where(and(eq(userTileDefault.userId, userId), eq(userTileDefault.kind, kind)));
}
