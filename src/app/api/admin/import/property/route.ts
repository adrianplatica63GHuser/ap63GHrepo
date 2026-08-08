/**
 * POST /api/admin/import/property   (Slice #26.07)
 *
 * The import's ONE way to obtain the Property a property subfolder belongs to.
 * Every rule about matching, confirming and creating lives in
 * `src/lib/properties/import-property.ts`; this route is the boundary — parse,
 * identify the user, call it, map the outcome onto a status code.
 *
 * ⚠️ **`POST /api/properties` is still there and still creates unconditionally.**
 * That is the Add-New form's route and it is not this one's business: a user
 * looking at a deed may record a parcel the system has never heard of, and may
 * leave a field blank while doing it. This route may not — it exists to be
 * matched against by the same folder next month, which is why `tarlaSola` and
 * `parcela` are both required here and neither is there.
 *
 * Every outcome is a 200 with an `outcome` discriminant, including the two that
 * write nothing. They are states of the world the screen has to describe, not
 * failures of the request: `needs-confirmation` is the normal path for a
 * re-imported archive, and rendering it from a 409 handler would put the
 * ordinary case in the error branch.
 */

import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { dbErrorToResponse, unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { getCurrentUserEmail } from "@/lib/auth/current-user";
import { cornerInputSchema } from "@/lib/properties/validation";
import {
  ImportPropertyInputError,
  ensurePropertyForFolder,
} from "@/lib/properties/import-property";

export const runtime = "nodejs";

const bodySchema = z.object({
  /**
   * As written on disk. `perToSlash` is applied server-side, deliberately: a
   * client that decoded it would be a second place the decision "what gets
   * written" is made, and the two would be free to disagree by a slash.
   */
  tarlaSola: z.string().min(1),
  parcela: z.string().min(1),
  nickname: z.string().nullish(),
  corners: z.array(cornerInputSchema).default([]),
  confirm: z
    .object({
      existingId: z.string().uuid(),
      addCorners: z.boolean(),
    })
    .optional(),
});

export async function POST(request: NextRequest): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return zodErrorToResponse(parsed.error);

  try {
    const updatedBy = await getCurrentUserEmail();
    const result = await ensurePropertyForFolder(parsed.data, updatedBy);
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ImportPropertyInputError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/admin/import/property");
  }
}
