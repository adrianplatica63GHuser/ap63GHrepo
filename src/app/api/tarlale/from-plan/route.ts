/**
 * POST /api/tarlale/from-plan — a plan parcelar the user confirmed: its tarla found or created, its parcels kept,
 * the plan linked.                                                                    (Slice #39.69, migration_113)
 *
 * { documentId, indicativ, locality, county, parcels: [{ parcela, areaSqm, use }] } — full access only, as every
 * write to reference data (FU-002). Called by the import's tarla step after „Creează" or „Leagă"; nothing the plan
 * read is written before that press (D-12). See src/lib/tarla/plan-queries.ts.
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { requireFullAccess } from "@/lib/auth/current-role";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { TARLA_PLAN_MAX_PARCELS } from "@/lib/tarla/plan-read";
import { applyTarlaPlan, TarlaPlanDocumentMissing } from "@/lib/tarla/plan-queries";

export const dynamic = "force-dynamic";

const text = z
  .string()
  .nullish()
  .transform((v) => (v == null || v.trim() === "" ? null : v.replace(/\s+/g, " ").trim()));

const bodySchema = z.object({
  documentId: z.string().uuid(),
  indicativ: z.string().trim().min(1, "required").max(40),
  locality: text,
  county: text,
  parcels: z
    .array(
      z.object({
        parcela: z.string().trim().min(1).max(40),
        areaSqm: z.number().positive().max(1e12).nullable(),
        use: text,
      }),
    )
    .max(TARLA_PLAN_MAX_PARCELS),
});

export async function POST(request: NextRequest): Promise<Response> {
  const denied = await requireFullAccess();
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    return Response.json(await applyTarlaPlan(parsed.data));
  } catch (err) {
    if (err instanceof TarlaPlanDocumentMissing) return Response.json({ error: "Document not found" }, { status: 404 });
    return unexpectedError(err, "POST /api/tarlale/from-plan");
  }
}
