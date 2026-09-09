/**
 * The two decisions the ID-card review dialog makes about a value it did not
 * read off the card.                                            (Slice #34.13)
 *
 * Both were inline expressions in `id-card-person-dialog.tsx`, and both were
 * wrong in the same way: a control showed one thing and the submit wrote
 * another. Pulled out here so they can be asserted without rendering a dialog
 * that opens with three fetches — and so the RULE is one sentence in one place
 * rather than a condition repeated at a control and at a write.
 *
 * ⚠️ **Not merged into `id-card.ts`, deliberately.** That module answers "what
 * does this card put on the Document" and is imported by the extraction route,
 * by the wizard and by non-React code. These two answer "what may this dialog
 * SHOW and SUBMIT" — a question about one screen — and one of them
 * (`citizenshipForWrite`) is about a `natural_person` column that never reaches
 * a document at all. Same reason `id-card.ts` refuses to carry `cnp`.
 *
 * Pure module: no React, no fetch, no DB. Unit-tested in
 * src/__tests__/id-card-review-rules.test.ts.
 */

/** Trimmed-non-empty. A whitespace-only value counts as absent. */
const filled = (v: string | null | undefined): v is string =>
  typeof v === "string" && v.trim() !== "";

/**
 * Which `lookup_institution` row the review dialog's picker opens on.
 *
 * ⚠️ **THE DOCUMENT OUTRANKS THE MATCHER, and until #34.13 the document was
 * never asked.** `institutionId` in the dialog is seeded from the extraction
 * route's match and from nothing else, so a Document that ALREADY carries an
 * institution opened the picker either empty or — worse — on a different row
 * the matcher happened to find. The user could not see what the document
 * holds, which is precisely what a picker beside a preview exists to show.
 *
 * ⚠️ **THIS DECIDES WHAT IS SHOWN AND NOTHING ELSE.** Every field in
 * `documentFieldsFromIdCard` is write-if-empty, so on a document that already
 * has an institution the FK arm cannot fire whatever the picker holds — and
 * whether the id may be SENT at all is `institutionForCardWrite`'s answer, not
 * this one. A seeded echo nobody has endorsed is refused below, so on a
 * pre-filed document the `subject` fallback still fires and the card's
 * authority is still recorded. `sameInstitutionAlready` becomes true only on
 * the two grounds that rule sends a value at all: the MATCHER named the row the
 * document holds (the ordinary second pass over one card, which is what
 * #34.02's second review round made idempotent), or a person picked that row
 * themselves — in which case they have said it, and the prose beside it would
 * be the duplication either way. Seeding from the
 * matcher instead would leave on screen a row the write is never going to
 * reach, next to a document filed under a different one.
 *
 * Returns `""` — not `null` — because the value drives a `<select>` whose empty
 * option is `""`; a `null` there is React's uncontrolled-input warning.
 */
export function institutionSelectSeed(seeds: InstitutionAnswers): string {
  if (filled(seeds.documentInstitutionId)) return seeds.documentInstitutionId.trim();
  if (filled(seeds.matchedInstitutionId)) return seeds.matchedInstitutionId.trim();
  return "";
}

/** The two answers the picker is seeded from, neither of them a person's. */
export type InstitutionAnswers = {
  /** `document.institution_id` as the Document currently holds it. */
  documentInstitutionId?: string | null;
  /** What the extraction route's matcher found, if anything. */
  matchedInstitutionId?: string | null;
};

/**
 * The institution this click may put on the Document — or null.
 *
 * ⚠️ **SEEDING THE PICKER FROM THE DOCUMENT IS NOT THE SAME AS THE CARD
 * NAMING THAT ROW, and collapsing the two loses the reading.** `card.institutionId`
 * in `documentFieldsFromIdCard` means „what a person filed this CARD under".
 * A value that is only the document's own institution echoed back into a
 * control is not that — nobody has said the card's authority is that row, and
 * the matcher (which misses on every identity card today, because no seeded
 * institution is a card issuer) certainly has not.
 *
 * Sending it anyway makes `sameInstitutionAlready` true BY CONSTRUCTION — the
 * two ids are equal because one was copied from the other — and that arm exists
 * to suppress the `subject` fallback. The card's authority would then reach
 * neither the FK (write-if-empty blocks it) nor the prose, on precisely the
 * documents where a human already cared enough to set an institution. An
 * adversarial round on #34.13 found exactly that.
 *
 * So the value travels on one of two grounds, and „the document already had
 * it" is not one of them:
 *
 *   `chosen`  — a person moved the picker, or pressed „adaugă". Their answer,
 *               whatever it equals.
 *   the matcher named it — the card's authority resolved to this row. When the
 *               document ALSO holds it, that is the ordinary second pass over
 *               one card, and `sameInstitutionAlready` is then true for the
 *               right reason: the reading really is already in the right
 *               column, and #34.02's second review round is why the prose must
 *               not be written beside it.
 *
 * ⚠️ **`documentInstitutionId` IS NOT A PARAMETER HERE, and its absence is the
 * statement.** A first draft accepted it and never read it, which made two of
 * this rule's own tests pass for the wrong reason. The document cannot be a
 * ground for writing, so it cannot be an input: „not chosen and not matched"
 * refuses whatever the document holds, and there is no branch that could ever
 * consult it.
 *
 * Returns null for „nobody has placed this authority", which is the state
 * `documentFieldsFromIdCard` answers with the `subject` line — and, in the
 * dialog, the state that offers „adaugă «…»" and the sentence beside it.
 */
export function institutionForCardWrite(state: {
  /** What the picker holds right now. */
  selected: string;
  /** Has a person moved the picker themselves? */
  chosen: boolean;
  /** What the extraction route's matcher found, if anything. */
  matchedInstitutionId?: string | null;
}): string | null {
  if (!filled(state.selected)) return null;
  const selected = state.selected.trim();
  if (state.chosen) return selected;
  const matched = filled(state.matchedInstitutionId) ? state.matchedInstitutionId.trim() : "";
  return selected === matched ? selected : null;
}

/**
 * The citizenship this click may write — never one the screen shows as „—".
 *
 * ⚠️ **THE TEST IS "CAN THE SELECT SHOW IT", NOT "DID THE LIST FAIL".** The
 * citizenship select is `<AsyncSelect>`, which is uncontrolled: `register`
 * assigns the DOM value once at ref-attach time and `key={options.length}`
 * remounts it when the loaded list changes. So a value sitting in
 * `_formValues` with no matching `<option>` renders as the empty entry — and
 * that happens for two different reasons, only one of which is a failed load.
 * The other is a row deleted from `lookup_citizenship` between the model
 * reading the card and the user pressing Confirm, on a list that loaded
 * perfectly. Asking the OPTIONS, rather than a load state, covers both with
 * one sentence and cannot drift from what is on screen.
 *
 * ⚠️ **THIS IS NOT "BLANK THE VALUE", and #32.13's idiom is why it must not
 * be.** The form keeps its `citizenshipId` untouched: the moment the list
 * recovers — the dialog's own retry, or the next mount — the option exists,
 * the select shows it, and this function lets it through. Clearing the field
 * would throw away an answer a paid model call produced, permanently, for a
 * failure that heals on a button press.
 *
 * ⚠️ **AND IT IS THE WRITE THAT GIVES WAY, NOT THE PERSON.** A refused
 * citizenship still creates the person: `natural_person.citizenship_id` is
 * nullable and editable on the person's own form afterwards, whereas a
 * citizenship written from a field nobody could read is invisible to everyone
 * — including the user who would have corrected it. Failing this one field
 * closed is strictly better than failing five open, which is the same trade
 * `isoDate` makes in `id-card.ts`.
 *
 * Returns the value to submit: the held id, or `""` for "no citizenship", which
 * `toApiPayload`'s `blank()` turns into `null`.
 */
export function citizenshipForWrite(
  held: string | null | undefined,
  options: readonly { value: string }[],
): string {
  if (!filled(held)) return "";
  const value = held.trim();
  return options.some((o) => o.value === value) ? value : "";
}

/**
 * Is the form holding a citizenship the select cannot show?
 *
 * The one predicate behind both the sentence under the field and the refusal
 * above — so the screen and the write cannot disagree, which is the whole
 * defect #34.13 closed. Written in terms of `citizenshipForWrite` rather than
 * beside it: two conditions that must always agree are one condition.
 */
export function citizenshipIsHidden(
  held: string | null | undefined,
  options: readonly { value: string }[],
): boolean {
  return filled(held) && citizenshipForWrite(held, options) === "";
}
