/**
 * /api/admin/doc-type-person-roles/[id]
 *
 * DELETE — remove an association by its UUID
 */

import type { NextRequest } from "next/server";
import { unexpectedError } from "@/lib/api/errors";
import { deleteDocTypePersonRole } from "@/lib/admin/doc-type-person-roles/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(
  _req: NextRequest,
  ctx: Ctx,
): Promise<Response> {
  const { id } = await ctx.params;

  try {
    const deleted = await deleteDocTypePersonRole(id);
    if (!deleted) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, `DELETE /api/admin/doc-type-person-roles/${id}`);
  }
}
