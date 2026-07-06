/**
 * POST /api/calculation/commit   (Slice #18.10.diviz, extended Slice #20.09)
 *
 * Body: {
 *   text: string;                 // the same 5-section file text
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
 *   3. creates a new PROPERTY-target Group and assigns every created property;
 *   4. (Slice #20.09) records a calculation_run + calculation_run_output rows
 *      for provenance tracking;
 *   5. (Slice #20.09) sets entity_metadata.provenance = 'ALGORITHM' on every
 *      created property so they are discoverable from the metadata tab.
 *
 * Properties are NOT created in a single DB transaction (createProperty/Group
 * each open their own); on the happy path this is fine, and a partial failure
 * surfaces a clear error so the operator can retry. Runtime: Node.js.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { computeDivisionFromFile } from "@/lib/calculation/compute";
import { createCalculationRun } from "@/lib/calculation/runs";
import { DivisionError } from "@/lib/calculation/geometry";
import { ParseError } from "@/lib/calculation/parse";
import { createGroup, updateGroup } from "@/lib/groups/queries";
import { createProperty } from "@/lib/properties/queries";
import { patchEntityMetadata } from "@/lib/metadata/queries";
import { createServerClient } from "@/lib/supabase/server";

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

  // Resolve the current user for audit trail.
  let createdBy: string | null = null;
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    createdBy = user?.email ?? null;
  } catch {
    // Non-fatal — provenance fields just stay null.
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

    // Track principalObjectId + role for calculation_run_output rows.
    const runOutputs: { principalObjectId: string; outputRole: string }[] = [];

    // One property per owner.
    for (const owner of computation.owners) {
      const full = await createProperty(
        {
          nickname: owner.name,
          surfaceAreaMp: round2(owner.computedArea),
          corners: owner.corners.map((c) => ({
            lat: c.lat,
            lon: c.lon,
            originalIndex: null,
          })),
        },
        createdBy,
      );
      memberIds.push(full.property.id);
      createdProperties.push({
        id:       full.property.id,
        code:     full.property.code,
        nickname: full.property.nickname,
      });
      runOutputs.push({
        principalObjectId: full.property.principalObjectId,
        outputRole:        "OWNER_PARCEL",
      });
    }

    // Optional common road property.
    const resolvedRoadNickname =
      typeof roadNickname === "string" && roadNickname.trim().length > 0
        ? roadNickname.trim()
        : "Drum comun";

    if (includeRoad && computation.road.corners.length >= 3) {
      const full = await createProperty(
        {
          nickname: resolvedRoadNickname,
          surfaceAreaMp: round2(computation.road.area),
          corners: computation.road.corners.map((c) => ({
            lat: c.lat,
            lon: c.lon,
            originalIndex: null,
          })),
        },
        createdBy,
      );
      memberIds.push(full.property.id);
      createdProperties.push({
        id:       full.property.id,
        code:     full.property.code,
        nickname: full.property.nickname,
      });
      runOutputs.push({
        principalObjectId: full.property.principalObjectId,
        outputRole:        "ROAD_PARCEL",
      });
    }

    // New group + membership.
    const group = await createGroup({
      targetType:  "PROPERTY",
      description: groupDescription.trim().slice(0, 500),
    });
    await updateGroup(group.id, { memberIds });

    // Slice #20.09: record the calculation run for provenance tracking.
    const run = await createCalculationRun({
      inputText:    text,
      inputOptions: {
        groupDescription: groupDescription.trim(),
        includeRoad:      Boolean(includeRoad),
        roadNickname:     resolvedRoadNickname,
      },
      computation,
      resultGroupId: group.id,
      outputs:       runOutputs,
      createdBy,
    });

    // Slice #20.09: set provenance = 'ALGORITHM' on every created property's
    // entity_metadata row (upsert — creates the row if it doesn't exist yet).
    await Promise.all(
      runOutputs.map((o) =>
        patchEntityMetadata(
          o.principalObjectId,
          { field: "provenance", value: "ALGORITHM" },
          createdBy,
        ),
      ),
    );

    return Response.json(
      {
        groupId:    group.id,
        groupCode:  group.code,
        runId:      run.id,
        runCode:    run.code,
        properties: createdProperties,
      },
      { status: 201 },
    );
  } catch (err) {
    return unexpectedError(err, "POST /api/calculation/commit");
  }
}
