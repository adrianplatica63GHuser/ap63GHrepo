/**
 * /api/tags
 *
 * GET   — returns all distinct tags with usage counts
 *         → { tags: { tag: string; count: number }[] }
 *
 * PATCH — rename a tag globally (also acts as merge when the target already exists)
 *         body: { from: string; to: string }
 *         → { tags: { tag: string; count: number }[] }
 */

import { NextResponse } from "next/server";
import { listAllTags, renameTag } from "@/lib/metadata/queries";

export async function GET() {
  const tags = await listAllTags();
  return NextResponse.json({ tags });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as { from?: string; to?: string };
  const from = body.from?.trim();
  const to   = body.to?.trim();

  if (!from || !to) {
    return NextResponse.json(
      { error: "Both 'from' and 'to' are required" },
      { status: 400 },
    );
  }

  const tags = await renameTag(from, to);
  return NextResponse.json({ tags });
}
