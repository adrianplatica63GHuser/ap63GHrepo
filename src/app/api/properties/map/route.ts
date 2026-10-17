/**
 * GET /api/properties/map
 *
 * Lean geometry feed for the map view. Returns all non-deleted properties
 * with their ordered corners — no address or audit fields.
 *
 * Response 200:
 *   {
 *     items: Array<{ id, code, nickname, tarlaId, corners: [{lat,lon}], groupCodes: string[] }>,
 *     allGroupCodes: string[],  // every PROPERTY-target group code (panel list)
 *     tarlale: Array<{ id, indicativ, locality, corners: [{lat,lon}] }>   // Slice #39.68: the „Tarlale" layer
 *   }
 *
 * Slice #39.68: each property's tarla, and every tarla with its own (drawn) corners — the browser draws each
 * tarla's outline from these (src/lib/geo/tarla-outline.ts): the drawn corners, else the hull of its properties'.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lookupTarla, property, propertyCorner, tarlaCorner } from "@/db/schema";
import { unexpectedError } from "@/lib/api/errors";
import {
  listPropertyGroupCodes,
  listPropertyGroupMemberships,
} from "@/lib/groups/queries";

export async function GET(): Promise<Response> {
  try {
    // Fetch all non-deleted properties + their corners + group filter data.
    const [properties, corners, memberships, allGroupCodes, tarlaRows, tarlaCorners] = await Promise.all([
      db
        .select({
          id:       property.id,
          code:     property.code,
          nickname: property.nickname,
          tarlaId:  property.tarlaId,
        })
        .from(property)
        .orderBy(property.code),

      db
        .select({
          propertyId: propertyCorner.propertyId,
          sequenceNo: propertyCorner.sequenceNo,
          lat:        propertyCorner.lat,
          lon:        propertyCorner.lon,
        })
        .from(propertyCorner)
        .innerJoin(property, eq(propertyCorner.propertyId, property.id))
        .orderBy(propertyCorner.propertyId, propertyCorner.sequenceNo),

      // (propertyId, group code) pairs — only PROPERTY-target groups.
      listPropertyGroupMemberships(),

      // Every PROPERTY-target group code — the panel's checkbox list.
      listPropertyGroupCodes(),

      db
        .select({ id: lookupTarla.id, indicativ: lookupTarla.indicativ, locality: lookupTarla.locality })
        .from(lookupTarla)
        .orderBy(lookupTarla.indicativ, lookupTarla.id),

      db
        .select({ tarlaId: tarlaCorner.tarlaId, lat: tarlaCorner.lat, lon: tarlaCorner.lon })
        .from(tarlaCorner)
        .orderBy(tarlaCorner.tarlaId, tarlaCorner.sequenceNo),
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
      tarlaId:    p.tarlaId,
      corners:    cornerMap.get(p.id) ?? [],
      groupCodes: (groupCodesMap.get(p.id) ?? []).sort(),
    }));

    const tarlaCornerMap = new Map<string, { lat: number; lon: number }[]>();
    for (const c of tarlaCorners) {
      const arr = tarlaCornerMap.get(c.tarlaId) ?? [];
      arr.push({ lat: c.lat, lon: c.lon });
      tarlaCornerMap.set(c.tarlaId, arr);
    }
    const tarlale = tarlaRows.map((t) => ({ ...t, corners: tarlaCornerMap.get(t.id) ?? [] }));

    return Response.json({ items, allGroupCodes, tarlale });
  } catch (err) {
    return unexpectedError(err, "GET /api/properties/map");
  }
}
