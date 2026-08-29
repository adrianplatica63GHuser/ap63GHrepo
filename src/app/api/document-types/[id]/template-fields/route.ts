/**
 * PUT /api/document-types/[id]/template-fields   (Slice #26.11)
 *
 * Saves a document type's custom form — the `template_fields` JSON array on
 * `lookup_document_type`. It is what the AI-Discovery review step calls when
 * the user accepts the fields that were found, and it is the only thing this
 * slice needed to build: every step after it already exists, because a type's
 * form is data. `buildExtractSystemPrompt` builds the extraction prompt from
 * this column, `runAiInterpret` writes the answers into `document.custom_fields`
 * on every subsequent import, and `document-form.tsx` renders the fields
 * dynamically from `parseTemplateFields`.
 *
 * WHY IT IS NOT THE VALUE-LISTS PUT
 * ---------------------------------
 * `PUT /api/admin/value-lists/document-types/[id]` can already write this
 * column, and it is the wrong door for two reasons. It is a FULL-ROW replace
 * whose schema requires `name` and defaults `sortOrder` to 0, so saving a form
 * through it would re-sort the admin list for any caller that did not resend
 * the sort order — a data change nobody asked for, caused by a save that
 * looked unrelated. And it lives under /api/admin, while this action belongs
 * to a business user standing on a document page.
 *
 * THE 409
 * -------
 * The client sends `knownKeys`: the keys it believed the type already had when
 * it drew the review list. If the stored template has moved on since — another
 * tab, another session, the admin screen — the merge the user reviewed was
 * computed against a template that no longer exists, and writing it would drop
 * whatever arrived in between. That is answered with 409 plus the CURRENT
 * fields, so the caller can re-run the merge and show the user the real list
 * rather than silently losing a field. `template_fields` has no version column
 * and needs none: the key list IS the state being replaced.
 *
 * THE IDENTITY-CARD REFUSAL
 * -------------------------
 * Slice #32.07. This is one of the three server doors that can put a row into
 * `template_fields`, and the only rule about which types may hold one lived in
 * five client-side copies, none of them on a write path. The refusal is a named
 * 400 — see `@/lib/documents/id-card-form-guard` for why a refusal and not a
 * silent filter, and for the rename half the other two doors carry.
 *
 * Auth: the middleware requires a session for everything outside /api/auth, so
 * an unauthenticated PUT never reaches this handler.
 */

import type { NextRequest } from "next/server";
import { z } from "zod/v4";
import { unexpectedError, zodErrorToResponse } from "@/lib/api/errors";
import { documentTemplateFieldSchema } from "@/lib/admin/value-lists/validation";
import {
  getDocumentTypeForTemplateEdit,
  setDocumentTypeTemplateFields,
} from "@/lib/documents/queries";
import {
  MAX_TEMPLATE_FIELDS,
  mergeAcceptedFields,
} from "@/lib/documents/discover-to-template";
import type { DocumentTemplateField } from "@/lib/documents/template-fields";
import { idCardFormRefusal, idCardRefusalCode } from "@/lib/documents/id-card-form-guard";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

// The ceiling lives in the pure module so the review dialog can stop the user
// before the click, using the same number this rejects them with after it.

const bodySchema = z.object({
  /**
   * The keys the caller believed were already stored. An empty array is a
   * real, meaningful value ("I reviewed a type with no form yet"), which is
   * why this is required rather than optional-with-a-default — an omitted
   * `knownKeys` would otherwise read as "the type is empty" and skip the
   * check exactly when the caller is an older client that does not know it
   * exists.
   */
  knownKeys: z.array(z.string()),
  /** The rows the user accepted — WITHOUT the fields already on the type. */
  fields:    z.array(documentTemplateFieldSchema),
});

export async function PUT(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return zodErrorToResponse(parsed.error);
  }

  try {
    const current = await getDocumentTypeForTemplateEdit(id);
    if (!current) {
      return Response.json({ error: "Document type not found" }, { status: 404 });
    }

    // ── An identity card can never hold a form ────────────────────────────
    // (Slice #32.07.) The row is already in hand and already carries `key` and
    // `name`; until this slice both were read and neither was used.
    //
    // ⚠️ **AHEAD OF THE 409, AND THAT ORDER IS THE WHOLE POINT.** A stale
    // `knownKeys` on an identity-card type would otherwise be answered with
    // "the form changed while you were reviewing — check the list and press
    // Save again", over a Save that can never succeed. That is #26.02's
    // unfixable-message failure rebuilt: a loop the user cannot leave, because
    // the remedy the message names does not address the reason for the refusal.
    // The identity of the type does not depend on how fresh the caller's view
    // of the fields is, so it is decided first.
    //
    // ⚠️ **`current.fields.length > 0` is the second term, and it is not
    // redundant.** This route is ADDITIVE — it cannot clear a template — so a
    // PUT of `fields: []` against a card type that already wrongly holds a form
    // would otherwise write the merge back unchanged and report 200 over a form
    // that is still there. Refusing says what is true: that type must not carry
    // this form, and no press of this button will remove it (the data migration
    // in ga40prj does).
    //
    // The name and the key are the STORED ones on both sides of the question,
    // because this door cannot rename — so `idCardFormRefusal` can only ever
    // answer `form` here, and the `rename` half it also knows about belongs to
    // the two value-lists doors.
    const identity = { key: current.key, name: current.name };
    const refusal = idCardFormRefusal(
      { ...identity, hasForm: current.fields.length > 0 },
      { ...identity, hasForm: parsed.data.fields.length > 0 || current.fields.length > 0 },
      // ⚠️ **`true`, UNCONDITIONALLY.** This route always writes the column —
      // that is the whole of what it does — so it is never the "a write that
      // leaves `template_fields` as it found it" case the guard carves out for
      // Reference Data's name-only edit form. A card type that already wrongly
      // holds a form is still refused here, which is what stops this door
      // reporting 200 over a merge that changed nothing and removed nothing.
      true,
    );
    if (refusal !== null) {
      return Response.json(
        {
          error:
            "This document type is an identity card. Its data is captured by the import's " +
            "identity-card step as Person records, so it may not hold a form.",
          code: idCardRefusalCode(refusal),
        },
        { status: 400 },
      );
    }

    // ── Optimistic concurrency ────────────────────────────────────────────
    // Compared as an ORDERED list, not as sets: order is what the form renders
    // and what the prompt lists, so a reordering is a change the reviewer did
    // not see either.
    const currentKeys = current.fields.map((f) => f.key);
    const sameKeys =
      currentKeys.length === parsed.data.knownKeys.length &&
      currentKeys.every((k, i) => k === parsed.data.knownKeys[i]);
    if (!sameKeys) {
      return Response.json(
        {
          error: "The form for this document type changed while it was being reviewed.",
          code:  "template_changed",
          fields: current.fields,
        },
        { status: 409 },
      );
    }

    // mergeAcceptedFields keeps every existing field, appends the accepted
    // ones, sanitises both sides and renumbers `order` — so nothing here has
    // to trust the caller's ordering, and a field the caller sent twice
    // collapses to one rather than shadowing itself in `custom_fields`.
    const merged = mergeAcceptedFields(
      current.fields,
      parsed.data.fields as DocumentTemplateField[],
    );

    if (merged.length > MAX_TEMPLATE_FIELDS) {
      // `max` and `would` travel as data, not baked into the sentence: the
      // caller is a Romanian-facing dialog and must build its own message.
      return Response.json(
        {
          error: `A document type may hold at most ${MAX_TEMPLATE_FIELDS} custom fields (this would be ${merged.length}).`,
          code:  "too_many_fields",
          max:   MAX_TEMPLATE_FIELDS,
          would: merged.length,
        },
        { status: 400 },
      );
    }

    const saved = await setDocumentTypeTemplateFields(id, merged);
    if (!saved) {
      // Between the read and the write the type was deleted. Reporting
      // success here would leave the user believing a form exists on a type
      // that no longer appears in any dropdown.
      return Response.json({ error: "Document type not found" }, { status: 404 });
    }

    return Response.json(saved);
  } catch (err) {
    return unexpectedError(err, `PUT /api/document-types/${id}/template-fields`);
  }
}
