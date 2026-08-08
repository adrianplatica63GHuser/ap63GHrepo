/**
 * POST /api/admin/import/property-plan   (Slice #26.07)
 *
 * What the run WOULD do to the Properties, before it does any of it. Reads
 * only — no lock, no write, no side effect of any kind — so the confirmation
 * screen can put every question on one page and the user can still walk away.
 *
 * A POST rather than a GET because the input is a list of up to five folders
 * with their parsed corner counts, and a query string carrying `||`-separated
 * folder names is a URL nobody can debug. Nothing is created by calling it.
 */

import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { dbErrorToResponse, unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { planPropertyFolders } from "@/lib/properties/import-property";
import { cadastralKey } from "@/lib/properties/cadastral-identity";
import { MAX_PROPERTY_FOLDERS } from "@/lib/import/structure-rules";

export const runtime = "nodejs";

const bodySchema = z.object({
  /**
   * `MAX_PROPERTY_FOLDERS` and not a number written here — STR-02 already
   * refuses a sixth folder, and a second limit written as a literal is a second
   * thing to change when Adrian raises the first one.
   */
  folders: z
    .array(
      z.object({
        folderName: z.string().min(1),
        // ⚠️ The WRITE route's gate, not a length. Without any check this
        // route plans `action: "create"` for a folder with no identifiers and
        // the write route then refuses the same input with an English 400,
        // mid-loop, after earlier folders have been written — two schemas for
        // one contract, which is how a promise and a refusal end up on the same
        // screen. `.min(1)` was the first attempt and was not the same gate:
        // the write route asks `hasCadastralIdentity`, which folds whitespace
        // away, so `"  "` passed here and was refused there.
        tarlaSola: z.string().refine((v) => cadastralKey(v) !== ""),
        parcela: z.string().refine((v) => cadastralKey(v) !== ""),
        offeredCornerCount: z.number().int().min(0),
      }),
    )
    .max(MAX_PROPERTY_FOLDERS),
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
    const plans = await planPropertyFolders(parsed.data.folders);
    return Response.json({ plans }, { status: 200 });
  } catch (err) {
    const dbResponse = dbErrorToResponse(err);
    if (dbResponse) return dbResponse;
    return unexpectedError(err, "POST /api/admin/import/property-plan");
  }
}
