/**
 * Which document types may have a form, and which are waiting for one.
 *                                                (Slice #27.05, #29.09, #37.85)
 *
 * ⚠️ **THE FILE NAME IS HISTORICAL.** Until Slice #37.85 this module also held
 * `discoverForType` — the import's one-document, schema-free read of a type
 * with no form — and `shouldDiscoverType`, the rule that spent it. #37.85
 * removed both: one document is never evidence for a type's form, and the only
 * writers of `lookup_document_type.template_fields` are now DocTypeEngine and
 * the Form editor in Reference Data. What is left are the two predicates every
 * screen that asks the question shares — the import's rows and its #29.08
 * gate (`type-form-gate.ts`), and DocTypeEngine's picker.
 */

// Still a pure module: `document-type-match` has no React, no DB and no next/*,
// which is the same rule `id-card.ts` follows to import the catch-all KEY from
// it. What is imported here is the ROW test.  (Slice #34.10)
import { documentTypeIsCatchAll } from "@/lib/documents/document-type-match";

/**
 * Is this document's type one that is waiting for a form at all?
 *                                                              (Slice #27.05)
 *
 * What the import's row SAYS ("this type has no form yet"), what its summary
 * counts, and what the #29.08 gate stops the run for. Defined in terms of
 * `typeMayHoldAForm` below, so the permanent refusals live in one place.
 */
export function typeAwaitsForm(input: {
  typeId: string;
  typeKey: string | null;
  typeName: string | null;
  fallbackTypeId: string | null;
  typeHasForm: boolean;
  typeIsIdCard: boolean;
}): boolean {
  return typeMayHoldAForm(input) && !input.typeHasForm;
}

/**
 * May this type have a form AT ALL — whether or not it already has one?
 *                                                              (Slice #29.09)
 *
 * ⚠️ **THIS IS THE SAME RULE WITH ONE TERM REMOVED, AND `typeAwaitsForm` IS
 * DEFINED IN TERMS OF IT.**
 * DocTypeEngine asks a question #27.05 never had to: not "is this type waiting
 * for a form", but "may I point twenty documents and twenty billed reads at
 * this type". The two answers differ for exactly one input — a type that
 * ALREADY has a form — because a discovery run against such a type is a normal
 * thing to do (it is how you find what is still unrecognised) and the save is
 * additive. They must not differ for any other, and writing the refusal by hand
 * in the new screen is precisely how they would: `type-form-gate.ts`'s header
 * says a validator that disagrees with the executor is worse than no validator,
 * because it is believed, and #29.06 was deleted for being that shape.
 *
 * So the two permanent refusals live here, once:
 *
 *  - **CARTE_IDENTITATE.** It has no form and must never be given one — its
 *    data comes from the import's own identity-card step, and a second editable
 *    copy of a CNP on every document is what `id-card.ts` refuses. Without this
 *    a user would discover the refusal by spending twenty reads first.
 *  - **The catch-all.** NECLASIFICAT holds documents whose type is WRONG, not
 *    documents whose type is unfinished. A form distilled from whatever
 *    happened to be unclassifiable would be written onto the row every
 *    unrecognised document in the archive shares.
 *
 * ⚠️ **THE CATCH-ALL NOW HAS TWO WITNESSES, AND SLICE #34.10 IS THE SLICE
 * THAT ADDED THE SECOND — CLOSING A DIVERGENCE THAT WAS RECORDED RATHER THAN
 * FIXED.** `catch-all-form-guard.ts` said it in as many words: this function
 * "identifies the catch-all by the row's ID, resolved through `catchAllType`
 * from the key `UNCLASSIFIED`", while `documentTypeIsCatchAll` "reads the row's
 * own key AND name, so it also covers the second row an archive can hold keyed
 * `NECLASIFICAT` and any row named 'Neclasificat' or 'Unclassified'". The
 * engine's picker asked both and agreed with the write door; the IMPORT asked
 * only the narrow one, so a run over such a row spent a billed discovery read
 * (#27.05's, removed in #37.85) and was then refused at the save. That is why
 * the two are one function rather than two that "deliberately disagree".
 *
 * ⚠️ **BOTH TERMS STAY. THE WIDE ONE DOES NOT REPLACE THE NARROW ONE**, and
 * that is not belt-and-braces — they answer for different callers. The id term
 * is exact and needs no row, which is the only thing available where a type was
 * invented mid-run by `runAiInterpret` and never appeared in the start-of-run
 * list. The key/name term needs a row and reaches rows `catchAllType` cannot
 * see. Dropping either one narrows the rule for the callers that depend on it.
 *
 * ⚠️ **`typeKey`/`typeName` ARE NULLABLE AND ARE NOT OPTIONAL, DELIBERATELY.**
 * An optional field is one a call site can forget, and forgetting it here is
 * silent: the predicate answers the OLD, narrower way and nothing type-checks
 * the omission. Required-and-nullable makes "this caller has no row" a sentence
 * somebody wrote — `typeKey: null, typeName: null` — rather than an absence.
 * `import-discover-run.test.ts` reads the call sites and pins that.
 *
 * ⚠️ **WHAT THE WIDENING COSTS, STATED RATHER THAN HIDDEN.** A type whose
 * NAME merely reads as "Neclasificat"/"Unclassified" — rather than carrying the
 * key — stops being reported as awaiting a form. Adrian confirmed that
 * direction for this slice. It is the
 * same trade `documentTypeIsCatchAll` and `meansUnclassified` already state and
 * accept about the same rows, one door over; what would be wrong is for the
 * import to keep making the opposite trade in silence.
 */
export function typeMayHoldAForm(input: {
  typeId: string;
  /**
   * `lookup_document_type.key` — or `null` where the caller has no row.
   *
   * ⚠️ **`null` MEANS "NO ROW", NOT "NO KEY".** `documentTypeIsCatchAll`
   * treats a blank key as "ask the name instead", which is right, and that is
   * exactly what `null` reaches here too. What a caller must not do is pass
   * `""` for a row it holds: `type-form-gate.ts` mints a synthetic row whose
   * key is deliberately blanked from `UNCLASSIFIED`, and that blank is a
   * statement about that row, not a missing one.
   */
  typeKey: string | null;
  /** `lookup_document_type.name` — or `null` where the caller has no row. */
  typeName: string | null;
  fallbackTypeId: string | null;
  typeIsIdCard: boolean;
}): boolean {
  if (input.typeId === "") return false;
  // ⚠️ Ahead of every other term, because it is the one that is about the
  // DOCUMENT and it makes the row's sentence wrong as well as the read: a card
  // must not print "this type has no form yet" either. See above.
  if (input.typeIsIdCard) return false;
  if (input.fallbackTypeId !== null && input.typeId === input.fallbackTypeId) return false;
  // The wide witness. Reads the row's own two columns, exactly as the write
  // door and the engine's picker do, so all three now give one answer.
  if (documentTypeIsCatchAll({ key: input.typeKey, name: input.typeName })) return false;
  return true;
}
