/**
 * /api/metadata/[principalObjectId]/stamps/[stampId]
 *
 * DELETE — remove a stamp from the entity → { ok: boolean }
 */

import { NextResponse } from "next/server";
import { removeStampFromEntity } from "@/lib/metadata/membership";

type Ctx = { params: Promise<{ principalObjectId: string; stampId: string }> };

export async function DELETE(
  _req: Request,
  { params }: Ctx,
) {
  const { principalObjectId, stampId } = await params;
  const result = await removeStampFromEntity(principalObjectId, stampId);
  return NextResponse.json({ ok: result.ok });
}
