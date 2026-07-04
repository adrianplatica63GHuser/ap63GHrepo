/**
 * /api/metadata/[principalObjectId]/groups/[groupId]
 *
 * DELETE — remove entity from a group → { ok: boolean }
 */

import { NextResponse } from "next/server";
import { removeEntityFromGroup } from "@/lib/metadata/membership";

type Ctx = { params: Promise<{ principalObjectId: string; groupId: string }> };

export async function DELETE(
  _req: Request,
  { params }: Ctx,
) {
  const { principalObjectId, groupId } = await params;
  const result = await removeEntityFromGroup(principalObjectId, groupId);
  return NextResponse.json({ ok: result.ok });
}
