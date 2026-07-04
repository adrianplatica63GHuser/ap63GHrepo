/**
 * /api/metadata/[principalObjectId]/tags
 *
 * GET    — list all tags for the entity  → { tags: string[] }
 * POST   — add a tag                    → body { tag: string } → { tags: string[] }
 * DELETE — remove a tag                 → body { tag: string } → { tags: string[] }
 */

import { NextResponse } from "next/server";
import { listEntityTags, addEntityTag, removeEntityTag } from "@/lib/metadata/queries";

type Ctx = { params: Promise<{ principalObjectId: string }> };

export async function GET(
  _req: Request,
  { params }: Ctx,
) {
  const { principalObjectId } = await params;
  const tags = await listEntityTags(principalObjectId);
  return NextResponse.json({ tags });
}

export async function POST(
  req: Request,
  { params }: Ctx,
) {
  const { principalObjectId } = await params;
  const body = (await req.json()) as { tag?: string };
  const tag = body.tag?.trim();
  if (!tag) {
    return NextResponse.json({ error: "tag is required" }, { status: 400 });
  }
  const tags = await addEntityTag(principalObjectId, tag);
  return NextResponse.json({ tags });
}

export async function DELETE(
  req: Request,
  { params }: Ctx,
) {
  const { principalObjectId } = await params;
  const body = (await req.json()) as { tag?: string };
  const tag = body.tag?.trim();
  if (!tag) {
    return NextResponse.json({ error: "tag is required" }, { status: 400 });
  }
  const tags = await removeEntityTag(principalObjectId, tag);
  return NextResponse.json({ tags });
}
