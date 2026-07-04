/**
 * /api/metadata/[principalObjectId]/cross-refs/[crossRefId]
 *
 * DELETE — remove a cross-reference.
 *          Only the entity that created the link (source) may delete it.
 *          → { ok: boolean; error?: string }
 */

import { NextResponse } from "next/server";
import { removeCrossRef } from "@/lib/metadata/cross-ref";

type Ctx = { params: Promise<{ principalObjectId: string; crossRefId: string }> };

export async function DELETE(
  _req: Request,
  { params }: Ctx,
) {
  const { principalObjectId, crossRefId } = await params;

  const result = await removeCrossRef(crossRefId, principalObjectId);

  if (!result.ok) {
    const status = result.error?.includes("not found") ? 404 : 403;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true });
}
