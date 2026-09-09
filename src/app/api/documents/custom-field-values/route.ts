/**
 * /api/documents/custom-field-values
 *
 * GET — the values one `custom_fields` key actually holds, with counts.
 *                                                              (Slice #34.10)
 *
 * WHAT THIS IS FOR
 * ----------------
 * The documents list's custom-field filter. D-01 settled that CONTRACT_VANZARE
 * gets one union form plus one hand-written field carrying the flavour, with
 * Adrian's own five descriptions as its values — and that answer is only half
 * an answer while the values can be captured and never grouped by.
 *
 * ⚠️ **A SEPARATE ENDPOINT RATHER THAN A FREE-TEXT BOX, AND THE WORKING
 * CONTRACT IS WHY.** "Minimise human effort — compute and storage are cheap"
 * applies to a filter as much as to a script: a text input beside a key is a
 * control you can only use if you already know, byte for byte and diacritic for
 * diacritic, which of the five descriptions was typed. The archive knows.
 *
 * ⚠️ **NOT FOLDED INTO `GET /api/documents`.** The two answer different
 * questions and change at different rates: the list is re-fetched on every
 * keystroke of the search box and on every page turn, while the set of values a
 * field holds changes only when documents are written. Returning them together
 * would recompute a `GROUP BY` over the whole table on each of those, and would
 * make the value list disappear the moment the filter it populates narrows the
 * result to one row — the list would then only ever offer the value already
 * chosen.
 *
 * ⚠️ **SCOPED BY `documentTypeIds`, deliberately.** A custom field's key
 * belongs to the type whose template defines it, so the values worth offering
 * are the ones held by documents of the types on screen. The parameter follows
 * `GET /api/documents`'s own convention exactly — absent means every type,
 * present-but-empty means nothing is selected — so the two cannot disagree
 * about what the user is looking at.
 */

import type { NextRequest } from "next/server";
import { z } from "zod/v4";

import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { listDocumentCustomFieldValues } from "@/lib/documents/queries";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  // The same bounds `documentListQuerySchema` puts on the filter this feeds:
  // one rule about what a custom-field key is, not two.
  key: z.string().trim().min(1).max(64),
  documentTypeIds: z.array(z.string().uuid()).optional(),
});

export async function GET(request: NextRequest): Promise<Response> {
  const url = new URL(request.url);

  // ⚠️ **The three-state parse `GET /api/documents` uses, copied term for
  // term** — key absent → `undefined` (every type), key present but empty →
  // `[]` (nothing selected, so no values), otherwise the list. A `?? undefined`
  // shorthand would collapse the middle case into the first and offer values
  // off the whole archive on a screen showing no rows at all.
  const idsRaw = url.searchParams.get("documentTypeIds");
  const documentTypeIds: string[] | undefined =
    idsRaw === null ? undefined : idsRaw === "" ? [] : idsRaw.split(",").filter(Boolean);

  const parsed = querySchema.safeParse({
    key: url.searchParams.get("key") ?? undefined,
    documentTypeIds,
  });
  if (!parsed.success) return zodErrorToResponse(parsed.error);

  try {
    const items = await listDocumentCustomFieldValues(parsed.data);
    return Response.json({ items, total: items.length });
  } catch (err) {
    return unexpectedError(err, "GET /api/documents/custom-field-values");
  }
}
