/**
 * PUT /api/admin/property-type-uses                                                       (Slice #39.66, migration_111)
 *
 * { propertyTypeId, useCategoryId, allowed } — allow one use for one type, or stop allowing it. 204 either way, and
 * either way twice is the same as once. Full access only, as every write to reference data (FU-002).
 *
 * Stopping a use changes no property: a property that already holds it keeps it, and its form says the use is not one
 * the type allows (src/lib/properties/type-uses.ts → useNotAllowed).
 */
import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { requireFullAccess } from "@/lib/auth/current-role";
import { pgErrorCode, unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { setTypeUseAllowed } from "@/lib/properties/type-uses-queries";

export const dynamic = "force-dynamic";

const schema = z.object({
  propertyTypeId: z.string().uuid(),
  useCategoryId: z.string().uuid(),
  allowed: z.boolean(),
});

export async function PUT(request: NextRequest): Promise<Response> {
  const denied = await requireFullAccess();
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return zodErrorToResponse(parsed.error);
  try {
    await setTypeUseAllowed(
      { propertyTypeId: parsed.data.propertyTypeId, useCategoryId: parsed.data.useCategoryId },
      parsed.data.allowed,
    );
    return new Response(null, { status: 204 });
  } catch (err) {
    // A type or use deleted meanwhile: the foreign key refuses the pair.
    if (pgErrorCode(err) === "23503") return Response.json({ error: "Type or use not found", code: "NOT_FOUND" }, { status: 404 });
    return unexpectedError(err, "PUT /api/admin/property-type-uses");
  }
}
