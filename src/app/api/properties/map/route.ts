/**
 * GET /api/properties/map
 *
 * Lean geometry feed for the map view. Returns all non-deleted properties
 * with their ordered corners — no address or audit fields.
 *
 * Response 200:
 *   { items: Array<{ id, code, nickname, corners: [{lat,lon}] }> }
 */

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { property, propertyCorner } from "@/db/schema";
import { unexpectedError } from "@/lib/api/errors";

export async function GET(): Promise<Response> {
  try {
    // Fetch all non-deleted properties + their corners in two queries.
    const [properties, corners] = await Promise.all([
      db
        .select({
          id:       property.id,
          code:     property.code,
          nickname: property.nickname,
        })
        .from(property)
        .where(isNull(property.deletedAt))
        .orderBy(property.code),

      db
        .select({
          propertyId: propertyCorner.propertyId,
          sequenceNo: propertyCorner.sequenceNo,
          lat:        propertyCorner.lat,
          lon:        propertyCorner.lon,
        })
        .from(propertyCorner)
        .innerJoin(property, and(
          eq(propertyCorner.propertyId, property.id),
          isNull(property.deletedAt),
        ))
        .orderBy(propertyCorner.propertyId, propertyCorner.sequenceNo),
    ]);

    // Group corners by propertyId.
    const cornerMap = new Map<string, { lat: number; lon: number }[]>();
    for (const c of corners) {
      const arr = cornerMap.get(c.propertyId) ?? [];
      arr.push({ lat: c.lat, lon: c.lon });
      cornerMap.set(c.propertyId, arr);
    }

    const items = properties.map((p) => ({
      id:       p.id,
      code:     p.code,
      nickname: p.nickname,
      corners:  cornerMap.get(p.id) ?? [],
    }));

    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/properties/map");
  }
}
