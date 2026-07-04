/**
 * /api/metadata/[principalObjectId]/stamps
 *
 * GET  — available stamps for this entity (not yet applied)
 *        → { stamps: AvailableStamp[] }
 * POST — apply a stamp to the entity
 *        → body { stampId: string } → { ok: boolean, error?: string }
 */

import { NextResponse } from "next/server";
import { listAvailableStamps, addStampToEntity } from "@/lib/metadata/membership";

type Ctx = { params: Promise<{ principalObjectId: string }> };

export async function GET(
  _req: Request,
  { params }: Ctx,
) {
  const { principalObjectId } = await params;
  const stamps = await listAvailableStamps(principalObjectId);
  return NextResponse.json({ stamps });
}

export async function POST(
  req: Request,
  { params }: Ctx,
) {
  const { principalObjectId } = await params;
  const body = (await req.json()) as { stampId?: string };
  const { stampId } = body;
  if (!stampId) {
    return NextResponse.json({ error: "stampId is required" }, { status: 400 });
  }
  const result = await addStampToEntity(principalObjectId, stampId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
