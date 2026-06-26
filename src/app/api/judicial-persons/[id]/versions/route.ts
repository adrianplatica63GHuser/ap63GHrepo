/**
 * /api/judicial-persons/[id]/versions  (Slice #18.05)
 *
 * GET — list every saved version of a judicial person, oldest (version 0)
 *       first. Each item carries the full snapshot for that version; the
 *       client derives label colours and per-field highlights by diffing
 *       adjacent snapshots (see judicial-persons/_components/form-schema.ts).
 *
 * Reuses the type-agnostic listPersonVersions (the person_version table is
 * shared across both subtypes).
 */

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { listPersonVersions } from "@/lib/persons/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  try {
    const items = await listPersonVersions(id);
    return Response.json({ items });
  } catch (err) {
    return unexpectedError(err, "GET /api/judicial-persons/[id]/versions");
  }
}
