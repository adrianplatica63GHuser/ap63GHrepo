/**
 * /api/metadata/[principalObjectId]/cross-refs
 *
 * GET  — list all cross-references (both directions) for this entity
 *        → { crossRefs: CrossRefItem[] }
 *
 * POST — add a new cross-reference
 *        → body { targetCode: string; note?: string }
 *        → { ok: boolean; error?: string }
 *
 * Lookup flow for POST:
 *   1. Resolve targetCode → target principal_object_id via lookupEntityByCode
 *   2. Validate it's a different entity
 *   3. Insert the row
 */

import { NextResponse } from "next/server";
import { listCrossRefs, addCrossRef, lookupEntityByCode } from "@/lib/metadata/cross-ref";

type Ctx = { params: Promise<{ principalObjectId: string }> };

export async function GET(
  _req: Request,
  { params }: Ctx,
) {
  const { principalObjectId } = await params;
  const crossRefs = await listCrossRefs(principalObjectId);
  return NextResponse.json({ crossRefs });
}

export async function POST(
  req: Request,
  { params }: Ctx,
) {
  const { principalObjectId } = await params;

  const body = (await req.json()) as { targetCode?: string; note?: string };
  const { targetCode, note } = body;

  if (!targetCode?.trim()) {
    return NextResponse.json({ error: "targetCode is required" }, { status: 400 });
  }

  // Resolve the target entity by its code
  const target = await lookupEntityByCode(targetCode.trim());
  if (!target) {
    return NextResponse.json({ error: `No entity found with code "${targetCode.toUpperCase()}"` }, { status: 404 });
  }

  const result = await addCrossRef(
    principalObjectId,
    target.principalObjectId,
    note ?? null,
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }

  return NextResponse.json({ ok: true, targetCode: target.code, targetName: target.displayName });
}
