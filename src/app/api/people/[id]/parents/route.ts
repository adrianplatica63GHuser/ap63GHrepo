/**
 * POST /api/people/[id]/parents  (Slice #38.29)
 *
 * Links a person to the holder `[id]` as the holder's father or mother:
 * body `{ parentId, kind: "FATHER" | "MOTHER" }`. The role is found by
 * `lookup_person_role.parent_kind`, never by name (src/lib/persons/parent-roles.ts),
 * and the parent holds it, so the holder's „Corelate" tile reads „Tată" /
 * „Mamă" and the parent's reads „Fiu" / „Fiică".
 *
 * 204 linked (or already linked); 400 a malformed body or the parent is the
 * holder; 409 PARENT_ROLE_MISSING when no role carries that kind.
 */
import { z } from "zod/v4";
import type { NextRequest } from "next/server";
import { roleNotOfferedToResponse, unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { linkParent, ParentRoleMissingError } from "@/lib/persons/parent-roles";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  parentId: z.string().uuid(),
  kind:     z.enum(["FATHER", "MOTHER"]),
});

export async function POST(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON body" }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  if (parsed.data.parentId === id) {
    return Response.json({ error: "A person cannot be their own parent.", code: "PARENT_IS_HOLDER" }, { status: 400 });
  }
  try {
    await linkParent(id, parsed.data.parentId, parsed.data.kind);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof ParentRoleMissingError) {
      return Response.json(
        { error: `No person role is marked ${err.kind} (migration_095).`, code: "PARENT_ROLE_MISSING", kind: err.kind },
        { status: 409 },
      );
    }
    const refusal = roleNotOfferedToResponse(err);
    if (refusal) return refusal;
    return unexpectedError(err, "POST /api/people/[id]/parents");
  }
}
