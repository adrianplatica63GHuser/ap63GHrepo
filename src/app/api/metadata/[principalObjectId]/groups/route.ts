/**
 * /api/metadata/[principalObjectId]/groups
 *
 * GET  — available groups for this entity (not yet joined, same target type)
 *        → { groups: AvailableGroup[] }
 * POST — add entity to a group
 *        → body { groupId: string } → { ok: boolean, error?: string }
 */

import { NextResponse } from "next/server";
import { listAvailableGroups, addEntityToGroup } from "@/lib/metadata/membership";

type Ctx = { params: Promise<{ principalObjectId: string }> };

export async function GET(
  _req: Request,
  { params }: Ctx,
) {
  const { principalObjectId } = await params;
  const groups = await listAvailableGroups(principalObjectId);
  return NextResponse.json({ groups });
}

export async function POST(
  req: Request,
  { params }: Ctx,
) {
  const { principalObjectId } = await params;
  const body = (await req.json()) as { groupId?: string };
  const { groupId } = body;
  if (!groupId) {
    return NextResponse.json({ error: "groupId is required" }, { status: 400 });
  }
  const result = await addEntityToGroup(principalObjectId, groupId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
