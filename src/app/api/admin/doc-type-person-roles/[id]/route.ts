/**
 * /api/admin/doc-type-person-roles/[id]
 *
 * DELETE — remove an association by its UUID
 * PATCH  — { holdsShare: boolean }: whether the role, on this document type,
 *          holds a share in the property (Slice #37.59, migration_091)
 */

import { z } from "zod/v4";
import { requireSuperuser } from "@/lib/auth/current-role";
import type { NextRequest } from "next/server";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import {
  deleteDocTypePersonRole,
  setDocTypePersonRoleHoldsShare,
} from "@/lib/admin/doc-type-person-roles/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(
  _req: NextRequest,
  ctx: Ctx,
): Promise<Response> {
  // Superuser only — FU-002, Slice #36.20 (src/lib/auth/current-role.ts).
  const denied = await requireSuperuser();
  if (denied) return denied;

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

const patchSchema = z.object({ holdsShare: z.boolean() });

export async function PATCH(
  req: NextRequest,
  ctx: Ctx,
): Promise<Response> {
  // Superuser only, as DELETE above.
  const denied = await requireSuperuser();
  if (denied) return denied;

  const { id } = await ctx.params;

  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);

  try {
    const ok = await setDocTypePersonRoleHoldsShare(id, parsed.data.holdsShare);
    if (!ok) return Response.json({ error: "Not found" }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (err) {
    return unexpectedError(err, `PATCH /api/admin/doc-type-person-roles/${id}`);
  }
}
