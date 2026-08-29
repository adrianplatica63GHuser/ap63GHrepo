/**
 * An identity-card type can never hold a form — ON THE SERVER. (Slice #32.07)
 *
 * WHY THIS EXISTS
 * ---------------
 * Until this slice the rule was stated five times and enforced nowhere. Every
 * copy of the identity-card test was CLIENT-side and none of them sat on a
 * write path: they disabled an `<option>`, filtered a list, dropped a queued
 * step. `doc-type-engine.tsx`'s save at the foot of the file is not gated by
 * the `refusalFor` two hundred lines above it, and `PUT /api/admin/value-lists/
 * document-types/[id]` never consulted the row's identity at all.
 *
 * So the screens were already right and the archive was already wrong, which is
 * the state a client-side rule always ends in. `lookup_document_type` held a
 * row keyed CARTE_DE_IDENTITATE_DOUA_EXEMPLARE, named „Carte de identitate
 * (două exemplare)", carrying a 24-field form: two complete identity records
 * including two CNPs, as freely editable form fields, on a type Distilare
 * Tipizate was at the same moment REFUSING to give a form to.
 *
 * WHY IT IS A REFUSAL AND NOT A FILTER
 * ------------------------------------
 * A filter that silently dropped the fields would report a save that wrote
 * nothing — the same failure `setDocumentTypeTemplateFields`' own comment
 * refuses about the 404 case. The write answers 400 with a named reason and the
 * screen says it in Romanian.
 *
 * ⚠️ **THE RENAME HALF IS NOT AN EXTRA, IT IS THE DOOR THIS ROW MOST LIKELY
 * CAME THROUGH.** A guard on the fields write alone does not stop a type that
 * already HAS a form being RENAMED into an identity card, and the value-lists
 * PUT carries `name` and `templateFields` in one payload. Without it the guard
 * is a lock on a door with the window open beside it.
 *
 * Pure module — no DB, no React, no next/*. Unit-tested in
 * src/__tests__/id-card-type-single-source.test.ts.
 */

import { documentTypeIsIdCard } from "@/lib/import/id-card";

/**
 * Which half of the write is refused, and therefore which half the user is
 * asked to undo.
 *
 *  - `form`   — this type IS an identity card (or is being created as one).
 *               The form is the change; there is no version of it that is
 *               allowed, so the remedy is to save no fields.
 *  - `rename` — this type already CARRIED a form and was not an identity card.
 *               The NAME is the change, and the remedy the message names is one
 *               the user can actually carry out: clear the form first.
 */
export type IdCardFormRefusal = "form" | "rename";

/**
 * The `code` each refusal travels under.
 *
 * ⚠️ **ONE SPELLING ACROSS BOTH DOORS, and it does not match the value-lists
 * module's own SCREAMING_CASE convention.** `failures.ts` reads `SAME_VALUE`,
 * `AMBIGUOUS_VALUE` and `DUPLICATE`; the template-fields route reads
 * `template_changed` and `too_many_fields`. This refusal crosses BOTH doors, so
 * one of the two conventions had to give, and the alternative — the same
 * refusal spelled two ways on two wires — is exactly the kind of thing this
 * slice exists to stop. Constants rather than literals so the four routes and
 * the four screens that read them cannot drift apart.
 */
export const ID_CARD_FORM_CODE   = "id_card_form";
export const ID_CARD_RENAME_CODE = "id_card_rename";

export function idCardRefusalCode(refusal: IdCardFormRefusal): string {
  return refusal === "rename" ? ID_CARD_RENAME_CODE : ID_CARD_FORM_CODE;
}

/** A row's identity plus whether the form it carries is non-empty. */
export type IdCardFormState = {
  key?: string | null;
  name?: string | null;
  /** `documentTypeHasForm(templateFields)` — parsed, not `Array.length > 0`. */
  hasForm: boolean;
};

/**
 * Would this write leave an identity-card type carrying a form?
 *
 * @param before the stored row, or `null` for a CREATE.
 * @param after  the row as the write would leave it.
 *
 * ⚠️ **THE QUESTION IS ABOUT THE RESULT, NOT ABOUT THE PAYLOAD**, which is what
 * makes one function answer all three doors. The template-fields PUT changes
 * only the fields; the value-lists PUT can change the name, the fields or both;
 * the POST creates both at once. Each door computes `after` for itself and asks
 * the same thing.
 *
 * @param writesTheForm does this write set `template_fields` at all? A write
 *        that leaves the column exactly as it found it cannot be what put a
 *        form on an identity-card type, and refusing it locks an administrator
 *        out of the ONE edit Reference Data's name-only form can make. See the
 *        body for the round that measured that.
 *
 *        ⚠️ **It is read only when `before` is non-null AND already wrong**, so
 *        on a CREATE it never fires whatever is passed. Said here rather than
 *        left for a reader to work out, because `createDocumentTypeRow` passes
 *        a real expression for it and a future reader "tightening" that
 *        expression would be changing nothing.
 */
export function idCardFormRefusal(
  before: IdCardFormState | null,
  after: IdCardFormState,
  writesTheForm: boolean,
): IdCardFormRefusal | null {
  if (!after.hasForm) return null;
  if (!documentTypeIsIdCard(after)) return null;

  // The write would leave an identity-card type carrying a form.
  //
  // ⚠️ **A WRITE THAT TOUCHES NEITHER HALF OF AN ALREADY-WRONG PAIR IS NOT
  // REFUSED, AND AN ADVERSARIAL ROUND IS WHY.** The first draft refused it, on
  // the reasoning that `before` being just as wrong as `after` does not make
  // `after` right. Measured against the actual screen, that reasoning ends in
  // #26.02's unfixable message: `LIST_META["document-types"].fields` is
  // `[{ key: "name" }]` and nothing else, so Reference Data's edit form sends
  // `{ name }` and NOTHING about the form. On a row that is already a card
  // carrying a form — the state this whole slice exists because the archive is
  // in, and the state of every database migration_073 has not reached yet —
  // fixing a typo in the name was answered "save it with no fields", on a form
  // whose only input is the name. The remedy the message names cannot be
  // carried out on the screen showing it, which is the definition of the loop
  // the user cannot leave.
  //
  // So the rule is: a write is refused when it PUTS the form there or ADDS to
  // it. A write that leaves `template_fields` exactly as it found it is not
  // what made the row wrong, and the row is repaired by migration_073 and by
  // the form editor — which is the one screen that CAN clear a form, and which
  // stays open because clearing it makes `after.hasForm` false on the first
  // line above.
  //
  // ⚠️ **It does not weaken the two writes that matter.** The template-fields
  // PUT always writes the column, so it passes `true` unconditionally and is
  // refused exactly as before. The rename half below is untouched: a type that
  // was NOT a card is being made one, so `alreadyWrong` is false whatever the
  // payload says about the form.
  //
  // ⚠️ **AND THE KEY HAS TO BE UNCHANGED TOO, which a LATER round caught the
  // carve-out quietly cancelling.** The same round that added this also made
  // `updateValue` judge `after.key` from the payload, because `.set(values)` is
  // over whatever object it is handed and `key` is a real column — so a direct
  // caller can move a row ONTO the canonical identity-card key. Without this
  // term, `{ key: "CARTE_IDENTITATE" }` with no `templateFields` on a row that
  // is already a card-by-name carrying a form is "neither half changed", is
  // excused, and lands the 24-field form on the key `getPersonIdCardLink` and
  // every carve-out in the codebase match. The carve-out is untouched by it:
  // Reference Data's edit form sends `name` and cannot express a key, and
  // `updateValue` defaults `after.key` to the stored one.
  const alreadyWrong = before !== null && before.hasForm && documentTypeIsIdCard(before);
  // ⚠️ **AN ABSENT `after.key` IS NOT A CHANGED ONE.** All three doors default
  // it to the stored key today, so this is a landmine rather than a live bug —
  // but a fourth door describing a name-only write by simply omitting `key`
  // would otherwise be refused with "save it with no fields", on a screen that
  // has none, which is the loop the carve-out above exists to prevent.
  const keyUnchanged =
    before !== null && (after.key === undefined || (after.key ?? null) === (before.key ?? null));
  if (alreadyWrong && !writesTheForm && keyUnchanged) return null;

  // Name the half that is the CHANGE, because that is the half the user can
  // undo. A row that already carried a form and was not a card is being
  // renamed INTO one; everything else is the form being added to a card.
  if (before !== null && before.hasForm && !documentTypeIsIdCard(before)) return "rename";
  return "form";
}

/**
 * The refusal as an Error, for the two doors that are a QUERY rather than a
 * route.
 *
 * ⚠️ **Thrown from the query layer rather than checked in the route, and the
 * reason is `ai-interpret`.** Until Slice #29.06 it called `createValue`
 * directly, bypassing the route, its Zod schema and HTTP — a shape this
 * codebase has already been bitten by once. A guard that lives in the route is
 * a guard the next direct caller does not have.
 *
 * ⚠️ **Recognised by `name`, not by `instanceof`.** The routes and the queries
 * are bundled separately by Next; a duplicated module identity would make
 * `instanceof` answer false and turn a named 400 into a 500, silently, on the
 * one path this slice exists for.
 */
export class IdCardFormRefusedError extends Error {
  constructor(readonly refusal: IdCardFormRefusal) {
    super(`id-card type may not hold a form (${refusal})`);
    this.name = "IdCardFormRefusedError";
  }
}

export function asIdCardFormRefusal(err: unknown): IdCardFormRefusal | null {
  if (err instanceof Error && err.name === "IdCardFormRefusedError") {
    const refusal = (err as { refusal?: unknown }).refusal;
    return refusal === "rename" ? "rename" : "form";
  }
  return null;
}
