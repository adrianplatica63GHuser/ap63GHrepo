/**
 * /api/properties/[id]/versions  (Slice #18.02)
 *
 * GET — list every saved version of a property, oldest (version 0) first.
 *       Each item carries the full snapshot for that version; the client
 *       derives label colours and per-field highlights by diffing adjacent
 *       snapshots (see form-schema.ts).
 */

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { listPropertyVersions } from "@/lib/properties/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const items = await listPropertyVersions(id);
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/properties/[id]/versions");
  }
}
