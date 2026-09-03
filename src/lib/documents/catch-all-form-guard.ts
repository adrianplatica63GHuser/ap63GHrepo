/**
 * The catch-all document type can never hold a form — ON THE SERVER.
 *                                                                (Slice #32.19)
 *
 * WHY THIS EXISTS
 * ---------------
 * Finding S-02. DocTypeEngine has refused to build a form for the unclassified
 * catch-all since #29.09 — `typeMayHoldAForm` in `src/lib/import/discover-run.ts`
 * — and that function has exactly one screen behind it. Reference Data's own
 * guard, `idCardFormRefusal`, covers identity-card types only, so the Form button
 * was drawn on the NECLASIFICAT row and a form saved there was accepted. What
 * Reference Data does with the catch-all today is leave it out of the "only those
 * awaiting a form" filter, which is a different thing entirely: it is a statement
 * about a backlog, not a refusal to write.
 *
 * The reason the refusal exists is `discover-run.ts`'s, quoted rather than
 * restated so the two cannot drift: "NECLASIFICAT holds documents whose type is
 * WRONG, not documents whose type is unfinished. A form distilled from whatever
 * happened to be unclassifiable would be written onto the row every unrecognised
 * document in the archive shares."
 *
 * WHY IT GRANDFATHERS
 * -------------------
 * ⚠️ **A GUARD ADDED WITHOUT A CARVE-OUT LOCKS THE OWNER OUT OF THEIR OWN ROW.**
 * No seed and no migration has ever written `template_fields` onto the catch-all
 * (migration_072 lands every row with it NULL), so a form there can only have
 * been saved by hand through the door this guard closes — which is precisely the
 * archive most likely to have one. Refusing every touch would strand that row:
 * the only screen that can CLEAR a form is the form editor, and it saves through
 * the same PUT. Deleting the form on migration would destroy work without asking.
 *
 * So the rule is the one `id-card-form-guard.ts` arrived at by an adversarial
 * round, with one term added: a write is refused when it PUTS a form on the
 * catch-all, or changes one that is there to anything other than a SMALLER form.
 * A write that leaves the fields exactly as it found them — the name-only edit
 * Reference Data's list form sends — goes through, and so does one that removes
 * fields or clears them altogether. Whoever saved a form there can take it off,
 * a field at a time or all at once; nobody can add to it, and nobody can swap
 * its contents for a different form of the same length.
 *
 * WHY IT IS A REFUSAL AND NOT A FILTER
 * ------------------------------------
 * Same answer as the identity-card guard, one door over: a filter that silently
 * dropped the fields would report a save that wrote nothing. The write answers
 * 400 with a named `code` and the screens say it in Romanian.
 *
 * WHICH DOORS IT SITS ON — ALL THREE, AND AN ADVERSARIAL ROUND IS WHY
 * ------------------------------------------------------------------
 * `createValue`, `updateValue`, and `PUT /api/document-types/[id]/template-fields`.
 *
 * The first draft left the third door out, on the reasoning that it is
 * DocTypeEngine's and the discovery dialog's and is "already refused upstream by
 * `typeMayHoldAForm`". That is false as a statement about the WRITE, and the
 * round that measured it is worth recording: `typeMayHoldAForm` is consulted by
 * the discovery run and by the DocTypeEngine screen, never by the route, which
 * imports `idCardFormRefusal` and nothing else. So the two guards would have
 * disagreed about the same row in opposite directions — Reference Data hiding
 * its Form button and refusing the write while DocTypeEngine offered it and
 * accepted it. That divergence IS finding S-02, rebuilt one door over.
 *
 * ⚠️ **WHAT IS STILL WIDER HERE THAN UPSTREAM, STATED RATHER THAN HIDDEN.**
 * `typeMayHoldAForm` identifies the catch-all by the row's ID, resolved through
 * `catchAllType` from the key `UNCLASSIFIED`. `documentTypeIsCatchAll` reads the
 * row's own key AND name, so it also covers the second row an archive can hold
 * keyed `NECLASIFICAT` and any row named "Neclasificat" or "Unclassified".
 * DocTypeEngine's picker asks both questions since this slice, so the screen and
 * the route agree; the IMPORT's own discovery loop (`typeAwaitsForm`, and
 * `shouldDiscoverType` beneath it) still asks only the narrow one, so a run over
 * such a row can still spend a billed read and then be refused at the save.
 * Closing that means widening `typeMayHoldAForm`'s input to carry the row's key
 * and name, which changes `typeAwaitsForm` and its six import call sites and
 * their tests — the import's gate, not Reference Data's. It is in the handover.
 *
 * ⚠️ **AND THE RENAME HALF IS NOT AN EXTRA HERE EITHER.** The value-lists PUT
 * carries `name` and `templateFields` in one payload, so a guard on the fields
 * alone would not stop a type that already HAS a form being renamed to
 * "Neclasificat" — a lock on a door with the window open beside it.
 *
 * Pure module — no DB, no React, no next/*. Unit-tested in
 * src/__tests__/catch-all-form-guard.test.ts.
 */

import { documentTypeIsCatchAll } from "@/lib/documents/document-type-match";

/**
 * Which half of the write is refused, and therefore which half the user is
 * asked to undo.
 *
 *  - `form`   — this type IS the catch-all (or is being created as one). The
 *               form is the change; there is no version of it that is allowed.
 *  - `rename` — this type already CARRIED a form and was not the catch-all. The
 *               NAME (or the key) is the change, and the remedy the message
 *               names is one the user can carry out: clear the form first.
 */
export type CatchAllFormRefusal = "form" | "rename";

/**
 * The `code` each refusal travels under.
 *
 * snake_case, matching `ID_CARD_FORM_CODE` / `ID_CARD_RENAME_CODE` rather than
 * the value-lists module's SCREAMING_CASE, for the reason stated there: this
 * refusal crosses two of the same doors that one does, and one refusal spelled
 * two ways on two wires is what those constants exist to stop.
 */
export const CATCH_ALL_FORM_CODE   = "catch_all_form";
export const CATCH_ALL_RENAME_CODE = "catch_all_rename";

export function catchAllRefusalCode(refusal: CatchAllFormRefusal): string {
  return refusal === "rename" ? CATCH_ALL_RENAME_CODE : CATCH_ALL_FORM_CODE;
}

/**
 * A row's identity plus HOW MANY fields the form it carries has.
 *
 * ⚠️ **A count, where `IdCardFormState` carries a boolean, and the difference is
 * the grandfather clause.** "Does this write add to the form" cannot be answered
 * by two booleans: a row with three fields and a row with four are both
 * `hasForm: true`. The count comes from `parseTemplateFields(...).length`, never
 * from `Array.isArray(raw) && raw.length` — `documentTypeHasForm`'s header
 * explains why the raw jsonb is the wrong thing to measure.
 */
export type CatchAllFormState = {
  key?: string | null;
  name?: string | null;
  /** `parseTemplateFields(templateFields).length` — parsed, not raw. */
  fieldCount: number;
};

/**
 * Would this write leave the catch-all type carrying a form it did not already
 * carry, or a bigger one?
 *
 * @param before the stored row, or `null` for a CREATE.
 * @param after  the row as the write would leave it.
 * @param writesTheForm does this write set `template_fields` at all? Read only
 *        when `before` is non-null and already wrong, exactly as in
 *        `idCardFormRefusal` — on a CREATE it never fires whatever is passed.
 */
export function catchAllFormRefusal(
  before: CatchAllFormState | null,
  after: CatchAllFormState,
  writesTheForm: boolean,
): CatchAllFormRefusal | null {
  // Clearing a form is always allowed, on any row. This is the line that makes
  // the grandfathered row repairable, and it is first for that reason.
  if (after.fieldCount <= 0) return null;
  if (!documentTypeIsCatchAll(after)) return null;

  const alreadyWrong =
    before !== null && before.fieldCount > 0 && documentTypeIsCatchAll(before);

  // ⚠️ **THE KEY HAS TO BE UNCHANGED TOO** — the same hole the identity-card
  // guard's own comment records. `updateValue` is `.set(values)` over whatever
  // object a direct caller hands it and `key` is a real column, so without this
  // term a payload of `{ key: "UNCLASSIFIED" }` with no `templateFields`, aimed
  // at an ordinary row that already carries a form, reads as "neither half
  // changed" and lands that form on the archive's catch-all key. An ABSENT
  // `after.key` is not a changed one: both doors default it to the stored
  // key, and a fourth door describing a name-only write by omitting `key`
  // must not be answered "save it with no fields" on a screen that has none.
  const keyUnchanged =
    before !== null && (after.key === undefined || (after.key ?? null) === (before.key ?? null));

  // ⚠️ **THE GRANDFATHER CLAUSE, AND AN ADVERSARIAL ROUND NARROWED IT.** A row
  // that is already the catch-all and already carries a form may be written to,
  // but only in the direction of removing the form. That covers the two things
  // its owner needs: the name-only edit Reference Data's list form sends
  // (`writesTheForm` false, so the count cannot have moved), and shrinking the
  // form — which, through the first line of this function, includes deleting
  // the lot.
  //
  // The first draft asked only whether the form GREW. Measured against the
  // screen that actually saves, that is not the rule it reads as: the form
  // editor sends the whole set, so deleting four fields and adding four
  // different ones in one save is `4 → 4`, which a "did it grow" test accepts.
  // "A form can be saved on the catch-all document type from Reference Data" —
  // S-02's own sentence — would have stayed true, with only its LENGTH frozen.
  // So the test is strict: on an already-wrong row a write that touches the
  // column is allowed only if it leaves fewer fields than it found.
  //
  // `before !== null` leads, because this expression is evaluated before
  // `alreadyWrong` is consulted and a null dereference here would be a 500 on
  // the CREATE path.
  const reducesTheForm =
    before !== null && after.fieldCount < before.fieldCount;
  // ⚠️ **`!writesTheForm` IS NOT ENOUGH ON ITS OWN, and a later round tightened
  // it.** The flag is the CALLER's claim that it is not touching the column; the
  // counts are what the write would leave. All three live doors default
  // `after.fieldCount` from the stored row, so the two cannot disagree today —
  // but this guard lives in the query layer precisely for the next DIRECT
  // caller, and the same argument produced the `keyUnchanged` term two blocks
  // up. A caller saying "I am not writing the form" while handing over a bigger
  // one is exactly the shape that should not be waved through.
  const leavesTheFormAlone =
    !writesTheForm && before !== null && after.fieldCount <= before.fieldCount;
  if (alreadyWrong && (leavesTheFormAlone || reducesTheForm) && keyUnchanged) return null;

  // Name the half that is the CHANGE, because that is the half the user can
  // undo. A row that already carried a form and was not the catch-all is being
  // renamed INTO it; everything else is a form being put on the catch-all.
  if (before !== null && before.fieldCount > 0 && !documentTypeIsCatchAll(before)) {
    return "rename";
  }
  return "form";
}

/**
 * The refusal as an Error, for the two doors that are a QUERY rather than a
 * route.
 *
 * Thrown from the query layer for `IdCardFormRefusedError`'s reason: a guard
 * that lives in the route is a guard the next direct caller does not have.
 * Recognised by `name` rather than by `instanceof`, for its other reason: the
 * routes and the queries are bundled separately by Next, and a duplicated module
 * identity would turn a named 400 into a 500 on the one path this exists for.
 */
export class CatchAllFormRefusedError extends Error {
  constructor(readonly refusal: CatchAllFormRefusal) {
    super(`the catch-all document type may not hold a form (${refusal})`);
    this.name = "CatchAllFormRefusedError";
  }
}

export function asCatchAllFormRefusal(err: unknown): CatchAllFormRefusal | null {
  if (err instanceof Error && err.name === "CatchAllFormRefusedError") {
    const refusal = (err as { refusal?: unknown }).refusal;
    return refusal === "rename" ? "rename" : "form";
  }
  return null;
}
