/**
 * GET /api/properties/map
 *
 * Lean geometry feed for the map view. Returns all non-deleted properties
 * with their ordered corners — no address or audit fields.
 *
 * Response 200:
 *   {
 *     items: Array<{ id, code, nickname, corners: [{lat,lon}], groupCodes: string[] }>,
 *     allGroupCodes: string[]   // every PROPERTY-target group code (panel list)
 *   }
 */

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { property, propertyCorner } from "@/db/schema";
import { unexpectedError } from "@/lib/api/errors";
import {
  listPropertyGroupCodes,
  listPropertyGroupMemberships,
} from "@/lib/groups/queries";

export async function GET(): Promise<Response> {
  try {
    // Fetch all non-deleted properties + their corners + group filter data.
    const [properties, corners, memberships, allGroupCodes] = await Promise.all([
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

      // (propertyId, group code) pairs — only PROPERTY-target groups.
      listPropertyGroupMemberships(),

      // Every PROPERTY-target group code — the panel's checkbox list.
      listPropertyGroupCodes(),
    ]);

    // Group corners by propertyId.
    const cornerMap = new Map<string, { lat: number; lon: number }[]>();
    for (const c of corners) {
      const arr = cornerMap.get(c.propertyId) ?? [];
      arr.push({ lat: c.lat, lon: c.lon });
      cornerMap.set(c.propertyId, arr);
    }

    // Group the membership codes by propertyId (sorted for stable display).
    const groupCodesMap = new Map<string, string[]>();
    for (const m of memberships) {
      const arr = groupCodesMap.get(m.propertyId) ?? [];
      arr.push(m.code);
      groupCodesMap.set(m.propertyId, arr);
    }

    const items = properties.map((p) => ({
      id:         p.id,
      code:       p.code,
      nickname:   p.nickname,
      corners:    cornerMap.get(p.id) ?? [],
      groupCodes: (groupCodesMap.get(p.id) ?? []).sort(),
    }));

    return Response.json({ items, allGroupCodes });
  } catch (err) {
    return unexpectedError(err, "GET /api/properties/map");
  }
}
