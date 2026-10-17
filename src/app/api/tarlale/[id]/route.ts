/**
 * GET /api/tarlale/[id] — one tarla with its outline. PUT — save its page.          (Slice #39.67, migration_112)
 *
 * PUT { indicativ, locality, county, descriere, notes, corners } — full access only, as every write to reference
 * data (FU-002). The row goes through Reference Data's own door (`writeTarlaRow`), so a code already held in this
 * locality is refused the same way, with the same named code; `corners` replaces the outline (omitted: kept).
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { requireFullAccess } from "@/lib/auth/current-role";
import { pgErrorCode, pgErrorConstraint, unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { cornerInputSchema } from "@/lib/properties/validation";
import { TARLA_CODE_TAKEN_CODE, TARLA_CODE_UNIQUE_INDEX, asTarlaCodeTaken } from "@/lib/properties/tarla-code-guard";
import { getTarla, updateTarla } from "@/lib/tarla/queries";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();

const text = z
  .string()
  .nullish()
  .transform((v) => (v === undefined ? undefined : v === null || v.trim() === "" ? null : v.trim()));

const bodySchema = z.object({
  indicativ: z.string().trim().min(1, "required"),
  locality: text,
  county: text,
  descriere: text,
  notes: text,
  corners: z.array(cornerInputSchema).optional(),
});

export async function GET(_request: NextRequest, { params }: Ctx): Promise<Response> {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const tarla = await getTarla(id);
    if (!tarla) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ tarla });
  } catch (err) {
    return unexpectedError(err, "GET /api/tarlale/[id]");
  }
}

export async function PUT(request: NextRequest, { params }: Ctx): Promise<Response> {
  const denied = await requireFullAccess();
  if (denied) return denied;
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return Response.json({ error: "Not found" }, { status: 404 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    const tarla = await updateTarla(id, parsed.data);
    if (!tarla) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ tarla });
  } catch (err) {
    const taken = asTarlaCodeTaken(err);
    if (taken !== null) {
      return Response.json(
        {
          error: `A tarla code that folds to this one already exists in this locality: "${taken.takenBy}".`,
          code: TARLA_CODE_TAKEN_CODE,
          takenBy: taken.takenBy,
        },
        { status: 400 },
      );
    }
    if (pgErrorCode(err) === "23505" && pgErrorConstraint(err) === TARLA_CODE_UNIQUE_INDEX) {
      return Response.json(
        { error: "A tarla code that folds to this one already exists in this locality.", code: TARLA_CODE_TAKEN_CODE },
        { status: 400 },
      );
    }
    return unexpectedError(err, "PUT /api/tarlale/[id]");
  }
}
