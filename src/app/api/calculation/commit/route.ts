/**
 * POST /api/calculation/commit   (Slice #18.10.diviz, extended #20.09; rebuilt #38.25)
 *
 * Body: {
 *   text: string;                                   // the three-section file
 *   order: number[];                                // order[k] = the file index of the owner in slice k
 *   road: { corner: number; side: "next" | "previous" };
 *   groupDescription: string;
 *   roadNickname?: string;                          // default „Drum comun"
 * }
 *
 * „Creează proprietățile" (#38.25). The server recomputes from the file and the
 * three choices — never from polygons in the body — and then, in one pass:
 *   1. one Property per owner (nickname = the owner's name as written, the
 *      computed area as its surface, every corner that is one of the parcel's
 *      keeping that corner's number from the file);
 *   2. the common Road as a Property, always;
 *   3. a new PROPERTY-target Group holding all of them;
 *   4. a calculation_run (algorithm_type 'SIDE_ROAD') with the file, the
 *      choices and the figures, and its calculation_run_output rows;
 *   5. provenance 'ALGORITHM' on every created property, through
 *      setInitialProvenance, each call with its own .catch().
 * What it decides is `planSideRoadCommit` (src/lib/calculation/commit-plan.ts),
 * held by its own suite; this file only writes.
 *
 * Properties are NOT created in a single DB transaction (createProperty/Group
 * each open their own); on the happy path this is fine, and a partial failure
 * surfaces a clear error so the operator can retry. Runtime: Node.js.
 */

export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { RoadRejected } from "@/lib/calculation/compute";
import { CommitRequestInvalid, planSideRoadCommit, SIDE_ROAD_ALGORITHM } from "@/lib/calculation/commit-plan";
import { createCalculationRun } from "@/lib/calculation/runs";
import { DivisionError } from "@/lib/calculation/geometry";
import { FileRejected } from "@/lib/calculation/parse";
import { createGroup, updateGroup } from "@/lib/groups/queries";
import { createProperty } from "@/lib/properties/queries";
import { setInitialProvenance } from "@/lib/metadata/queries";
import { getCurrentUserEmail } from "@/lib/auth/current-user";
import { inferProvenance } from "@/lib/metadata/provenance-rules";
import { requireFullAccess } from "@/lib/auth/current-role";

export async function POST(request: NextRequest): Promise<Response> {
  // Full access only (superuser-only until #38.21) — FU-222, Slice #37.03: its only screen is „Calcul" (/admin/calculation).
  const denied = await requireFullAccess();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  let plan;
  try {
    plan = planSideRoadCommit(body);
  } catch (err) {
    if (err instanceof FileRejected) return Response.json({ problems: err.problems }, { status: 400 });
    if (err instanceof RoadRejected) return Response.json({ refusal: err.refusal }, { status: 400 });
    if (err instanceof CommitRequestInvalid || err instanceof DivisionError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    return unexpectedError(err, "POST /api/calculation/commit (plan)");
  }

  // Resolve the current user for audit trail.
  let createdBy: string | null = null;
  try {
    createdBy = await getCurrentUserEmail();
  } catch {
    // Non-fatal — provenance fields just stay null.
  }

  try {
    const memberIds: string[] = [];
    const createdProperties: { id: string; code: string; nickname: string | null }[] = [];
    const runOutputs: { principalObjectId: string; outputRole: string }[] = [];

    for (const planned of plan.properties) {
      const full = await createProperty(
        { nickname: planned.nickname, surfaceAreaMp: planned.surfaceAreaMp, corners: planned.corners },
        createdBy,
      );
      memberIds.push(full.property.id);
      createdProperties.push({ id: full.property.id, code: full.property.code, nickname: full.property.nickname });
      runOutputs.push({ principalObjectId: full.property.principalObjectId, outputRole: planned.role });
    }

    const group = await createGroup({
      targetType:  "PROPERTY",
      description: plan.inputParams.options.groupDescription,
    });
    await updateGroup(group.id, { memberIds });

    const run = await createCalculationRun({
      algorithmType: SIDE_ROAD_ALGORITHM,
      inputParams:   plan.inputParams,
      stepsLog:      plan.computation,
      resultGroupId: group.id,
      outputs:       runOutputs,
      createdBy,
    });

    // Slice #34.07: through `setInitialProvenance`, each call guarded. Everything
    // above is committed by now — N properties, a group and the run — so a
    // metadata write that fails must not turn that into a 500 with no ids; the
    // guarantee belongs to the caller that has already committed, which is why
    // the `.catch()` is here and not only inside the callee.
    const calculationProvenance = inferProvenance("CALCULATION");
    if (calculationProvenance) {
      await Promise.all(
        runOutputs.map((o) =>
          setInitialProvenance(o.principalObjectId, calculationProvenance, createdBy).catch(() => {
            // Best-effort — never at the cost of the 201 below.
          }),
        ),
      );
    }

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
