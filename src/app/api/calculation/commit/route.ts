/**
 * POST /api/calculation/commit   (Slice #18.10.diviz)
 *
 * Body: {
 *   text: string;                 // the same 4-section file text
 *   groupDescription: string;     // description for the new group
 *   includeRoad?: boolean;        // also create the common road as a property
 *   roadNickname?: string;        // nickname for the road property
 * }
 *
 * Re-computes the subdivision server-side (authoritative geometry), then in one
 * pass:
 *   1. creates one Property per owner (nickname = owner name, corners set,
 *      surface area = the owner's computed area);
 *   2. optionally creates the common Road as a Property;
 *   3. creates a new PROPERTY-target Group and assigns every created property
 *      to it.
 *
 * Properties are NOT created in a single DB transaction (createProperty/Group
 * each open their own); on the happy path this is fine, and a partial failure
 * surfaces a clear error so the operator can retry. Runtime: Node.js.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { computeDivisionFromFile } from "@/lib/calculation/compute";
import { DivisionError } from "@/lib/calculation/geometry";
import { ParseError } from "@/lib/calculation/parse";
import { createGroup, updateGroup } from "@/lib/groups/queries";
import { createProperty } from "@/lib/properties/queries";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    text,
    groupDescription,
    includeRoad,
    roadNickname,
  } = body as {
    text?: unknown;
    groupDescription?: unknown;
    includeRoad?: unknown;
    roadNickname?: unknown;
  };

  if (typeof text !== "string" || text.trim().length === 0) {
    return Response.json({ error: "No file text provided" }, { status: 400 });
  }
  if (typeof groupDescription !== "string" || groupDescription.trim().length === 0) {
    return Response.json({ error: "A group description is required" }, { status: 400 });
  }

  let computation;
  try {
    computation = computeDivisionFromFile(text);
  } catch (err) {
    if (err instanceof ParseError || err instanceof DivisionError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return unexpectedError(err, "POST /api/calculation/commit (compute)");
  }

  try {
    const memberIds: string[] = [];
    const createdProperties: { id: string; code: string; nickname: string | null }[] = [];

    // One property per owner.
    for (const owner of computation.owners) {
      const full = await createProperty({
        nickname: owner.name,
        surfaceAreaMp: round2(owner.computedArea),
        corners: owner.corners.map((c) => ({
          lat: c.lat,
          lon: c.lon,
          originalIndex: null,
        })),
      });
      memberIds.push(full.property.id);
      createdProperties.push({
        id: full.property.id,
        code: full.property.code,
        nickname: full.property.nickname,
      });
    }

    // Optional common road property.
    if (includeRoad && computation.road.corners.length >= 3) {
      const nick =
        typeof roadNickname === "string" && roadNickname.trim().length > 0
          ? roadNickname.trim()
          : "Drum comun";
      const full = await createProperty({
        nickname: nick,
        surfaceAreaMp: round2(computation.road.area),
        corners: computation.road.corners.map((c) => ({
          lat: c.lat,
          lon: c.lon,
          originalIndex: null,
        })),
      });
      memberIds.push(full.property.id);
      createdProperties.push({
        id: full.property.id,
        code: full.property.code,
        nickname: full.property.nickname,
      });
    }

    // New group + membership.
    const group = await createGroup({
      targetType: "PROPERTY",
      description: groupDescription.trim().slice(0, 500),
    });
    await updateGroup(group.id, { memberIds });

    return Response.json(
      {
        groupId: group.id,
        groupCode: group.code,
        properties: createdProperties,
      },
      { status: 201 },
    );
  } catch (err) {
    return unexpectedError(err, "POST /api/calculation/commit");
  }
}
