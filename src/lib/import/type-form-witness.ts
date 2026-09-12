/**
 * The form question the run could not ask, and the free way to ask it again.
 *                                                              (Slice #34.24)
 *
 * WHAT THIS IS FOR
 * ----------------
 * `handleRetryInterpret` reads the document type catalogue once, between the
 * model call and the row's patch, and decides two things off it: whether to
 * SPEND a billed discovery on the type, and whether the row should say the type
 * is still waiting for a form. Slice #34.11 gave both decisions a witness —
 * `EnrichResult.readFailed` — and made each of them refuse to answer when the
 * catalogue read did not come back. That is the right answer for both: silence
 * is the one answer that is never a false claim, and the discovery is money.
 *
 * ⚠️ **AND SILENCE HAS A PRICE, WHICH #34.11 NAMED RATHER THAN HID.** With no
 * `typeFormMissing` the row drops out of `handleDiscoverSaved`'s sweep, out of
 * `formArrivedElsewhere` and out of `summariseImportRun.typesWithoutForm` — so
 * for a type whose ONLY document took that path, the run reports clean over a
 * type that has no form. The row cannot be retried again either: a retry whose
 * model call succeeded patches `aiStatus: "done"` with `aiPartialWrite` false,
 * and the retry button is drawn inside the block those two gate. "It will be
 * caught on the next retry" is not available: on the ordinary row there is no
 * next retry. #34.11 named the recovery as a slice of its own, and this module
 * is its rule.
 *
 * WHAT THE RECOVERY COSTS, AND WHY IT IS NOT THE RETRY
 * ---------------------------------------------------
 * ⚠️ **THE ANSWER IS A SECOND ACTION, NOT A FOURTH TERM ON THE RETRY BUTTON,
 * AND THE REASON IS MONEY.** The retry's own note says it in one line: "The
 * click is one billed model call, and the count the user approved before the
 * run did not include retries." The row this module is about had its document
 * READ — its fields are written, its people were queued, its type was settled.
 * What failed was a GET. Leaving such a row retryable would have offered a
 * second PAID read of the document to learn a fact about the CATALOGUE, which
 * is the wrong thing bought for the right reason. The re-check re-runs the
 * catalogue read and the decision that hangs off it, and buys nothing.
 *
 * ⚠️ **SO `shouldDiscoverType` IS DELIBERATELY NOT ASKED AGAIN, and that is a
 * decision rather than an omission.** Acting on a yes costs a billed discovery
 * read; computing a yes nobody may act on is a value no reader has. What the
 * re-check restores is the run's REPORTING — the row's sentence, the sweep, the
 * count and the names in the saved report — and the discovery the refused run
 * never bought stays unbought. A type recovered this way is reported as one
 * still waiting for a form, which is exactly what it is, and #27.04's
 * "Descoperire AI" on the document itself is the deliberate, priced way to
 * propose one.
 *
 * WHY THE RULE IS HERE AND NOT INLINE
 * -----------------------------------
 * The decision is taken inside a `useCallback` in a 7,500-line component that
 * nothing in `src/__tests__/` renders, which is the same argument
 * `discover-run.ts` makes about `shouldDiscoverType`: a rule a test cannot
 * reach is a rule that drifts. What is pinned from here is the whole of it —
 * which key is written, which is withheld, and the difference between the two.
 *
 * ⚠️ **THE RETRY'S OWN `typeFormMissing` TERNARY IS NOT MOVED IN HERE, AND
 * THAT IS THE SECOND COPY OF ONE EXPRESSION.** It is pinned, character by
 * character and through both arms, by `import-discover-run.test.ts`'s #34.11
 * block — a test that records which mutation each half of it was written to
 * catch — so folding it into a call would delete those guards to remove a
 * duplicate. Both copies say `(awaitsForm && !typeAbsolved) || undefined` and
 * `import-type-catalogue-recheck.test.ts` pins that they still say the same
 * thing. The third copy site is where this is folded, not the second.
 */

/**
 * One patch, in the shape `updateResult` spreads over a row.
 *
 * ⚠️ **AN ABSENT KEY AND AN EXPLICIT `undefined` ARE TWO DIFFERENT
 * INSTRUCTIONS, and every function here trades on the difference.**
 * `updateResult` does `{ ...row, ...patch }`, so a key that is not in the patch
 * leaves the row's previous answer standing, while a key whose value is
 * `undefined` erases it. That is the same distinction the dialog's own
 * conditional spreads are written for, and it is why these functions return an
 * object rather than a boolean: "say nothing" and "say no" are both answers
 * here, and a boolean cannot carry the first.
 */
export type TypeFormPatch = {
  typeFormMissing?: boolean | undefined;
  typeCatalogueUnread?: boolean | undefined;
  typeCatalogueRecheckFailed?: boolean | undefined;
  /** …and the list came back without this type at all. See the patch for it. */
  typeCatalogueTypeGone?: boolean | undefined;
  /**
   * The re-read queue, written for the one branch that inherits
   * `formArrivedElsewhere`'s job — see `typeFormPatchAfterRecheck`.
   *
   * ⚠️ **`"pending"` as a literal rather than the dialog's `RefillState`**, so
   * this module stays free of the component: the union there includes it, and
   * the compiler checks the assignment at the call site. The value is the only
   * one this module has any business writing.
   */
  refill?: "pending";
  refillErrorDetail?: string | undefined;
};

/**
 * The witness the retry leaves on a row whose catalogue read did not come back.
 *
 * ⚠️ **WRITTEN ON BOTH ARMS OF THE FAILED READ, AND THE RE-TYPE ARM IS THE ONE
 * THAT LOOKS WRONG AND IS NOT.** The retry withholds `typeFormMissing` on a
 * failed read, and on the re-type half of it CLEARS the flag instead — because
 * a `true` earned about the type the row has just been moved OFF would name the
 * NEW type, possibly the most complete type in the archive, as one still
 * waiting for a form. That is a rule about the CLAIM. This is a fact about the
 * READ: on both arms the list could not be read, so on both arms the form
 * question is unanswered — and on the re-type arm it is unanswered about a type
 * nobody has looked at at all. Folding the two would lose exactly the row the
 * recovery is most useful for.
 *
 * ⚠️ **AND IT IS CLEARED, NOT MERELY LEFT ALONE, WHEN THE READ SUCCEEDS.** A
 * row can reach this site twice: the retry is drawn again on a row that came
 * back `aiPartialWrite`, so a second press whose catalogue read DID come back
 * must take the witness off — otherwise the row goes on offering a re-check of
 * a question that has since been answered.
 *
 * ⚠️ **THE RETURN TYPE IS NARROWED TO THE TWO KEYS IT ACTUALLY WRITES, and it
 * is not tidiness.** This patch is spread AFTER the retry's `typeFormMissing`
 * ternary, so a `typeFormMissing` key returned from here would silently win over
 * the claim that ternary is argued, at length, for withholding. `TypeFormPatch`
 * permits the key; `Pick` makes returning it a compile error.
 *
 * `typeKnown` is false where the row has no type at all (`finalTypeId === null`
 * — no `documentTypeId` from this call and none on the row). There is nothing
 * to re-check for such a row, and a control that cannot answer anything is one
 * more thing on the screen to press. Such a row can never have carried the
 * witness either — it would have needed a type to earn one — so saying nothing
 * is the whole of the answer here.
 *
 * ⚠️ **`alreadyAnswered` IS THE TERM TWO ADVERSARIAL ROUNDS ADDED AND THEN
 * WIDENED, AND WITHOUT IT THE ROW CONTRADICTS ITSELF.** It covers both ways a
 * row can already be saying something true about the form question: the
 * `typeFormMissing` the run loop wrote, and — the second round's find — the
 * `typeFormAdded` a mid-run acceptance wrote, on a row whose read came back
 * partial and whose retry then lost the catalogue. The run loop writes `typeFormMissing` on every
 * document it reads; a row whose read came back `partialWrite` keeps that `true`
 * through a retry, because the failed-read arm writes an ABSENT key and an
 * absent key erases nothing. Such a row is already counted by
 * `summariseImportRun` and already draws „tipul acestui document nu are încă
 * formular" — so a witness beside it would draw a second sentence saying the
 * question was never decided and nothing reports it, one span from the sentence
 * that reports it. There is nothing to recover on that row: it is reported, in
 * the safe direction, and `formArrivedElsewhere` is what takes the claim back if
 * the type has since gained a form.
 *
 * ⚠️ **It is what the PATCH leaves standing, not what the row carried at the
 * click**, and the two differ on exactly one arm: a retry that RE-TYPES the
 * document clears `typeFormMissing` even on a failed read. That row ends up
 * reported by nothing, about a type nobody has looked at — which is the row this
 * recovery is most useful for, and computing the term off the click-time
 * snapshot alone would have suppressed the witness on precisely it.
 *
 * ⚠️ **`typeCatalogueRecheckFailed` IS CLEARED HERE TOO, on every arm that has a
 * type.** The retry is another attempt at the same question, so a "the list
 * still could not be read" left standing from an earlier press would be drawn
 * over a row that has just made a fresh attempt — and its sentence says nothing
 * was sent to the AI, which after a retry is false.
 */
export function typeCatalogueWitness(input: {
  catalogueReadFailed: boolean;
  typeKnown: boolean;
  alreadyAnswered: boolean;
}): Pick<
  TypeFormPatch,
  "typeCatalogueUnread" | "typeCatalogueRecheckFailed" | "typeCatalogueTypeGone"
> {
  if (!input.typeKnown) return {};
  return {
    typeCatalogueUnread: (input.catalogueReadFailed && !input.alreadyAnswered) || undefined,
    typeCatalogueRecheckFailed: undefined,
    // A retry may have re-typed the document, and it re-asks the whole question
    // either way, so last time's "that type is gone" is not this row's answer
    // any more.
    typeCatalogueTypeGone: undefined,
  };
}

/**
 * May this row be offered the free re-check?
 *
 * ⚠️ **THE ROW'S HALF ONLY.** Whether the DIALOG may run one — the run has
 * settled, no follow-up is open, no billed call is in flight — is
 * `canRetryReads`' question and is asked at the call site with its own terms,
 * unchanged. This is the per-row half, which is what `aiRefused` is off the
 * result rather than through a prop for.
 *
 * ⚠️ **`aiRefused` AND `refillRefused` ARE DELIBERATELY NOT TERMS, and they are
 * terms on the retry button one line away.** Both of those are about money: a
 * refused read cannot answer differently and is billed every time it is asked.
 * This action makes no model call at all, so neither argument reaches it — and
 * a refused row is a row that will never be read again, which makes the state
 * of its type the ONLY thing left that anything can still fix.
 */
export function canRecheckTypeCatalogue(row: {
  typeCatalogueUnread?: boolean;
  documentTypeId?: string;
}): boolean {
  return row.typeCatalogueUnread === true && row.documentTypeId !== undefined;
}

/**
 * What the free re-check writes when the catalogue read comes back.
 *
 * The same expression the retry uses on its own good path — `(awaitsForm &&
 * !typeAbsolved) || undefined` — because it is the same question asked of the
 * same two answers, one read later. `|| undefined` so a row that does NOT await
 * a form carries no key at all rather than `false`: `summariseImportRun` reads
 * `=== true`, but the saved session and the report both walk what is present,
 * and a false flag is a fact nobody asked for.
 *
 * ⚠️ **THE WITNESS GOES IN THE SAME PATCH, and it has to be this one.** The
 * list has now been read, so the row is no longer waiting on anything: leaving
 * `typeCatalogueUnread` set would draw the action again over a question that
 * has just been answered, and clearing it in a second `updateResult` would put
 * a render between the two in which the row says both.
 */
export function typeFormPatchAfterRecheck(input: {
  awaitsForm: boolean;
  typeAbsolved: boolean;
  /**
   * The list says this type HAS a form — which for a row carrying the witness
   * means the form arrived after this document was read.  (adversarial round 3,
   * narrowed by round 4)
   *
   * ⚠️ **THIS IS `formArrivedElsewhere`'S JOB, DONE HERE BECAUSE THAT CALLBACK
   * STRUCTURALLY CANNOT DO IT FOR THIS ROW.** It matches on `typeFormMissing
   * === true`, and a row carrying the witness is by construction a row that
   * carries no such flag — so `absorbTypeList`, which the re-check calls like
   * every other reader of a fresh list, queues every OTHER document of the type
   * for a re-read and silently skips the one the user actually pressed. Two
   * documents of one type, both read before the form existed, both with their
   * values stranded in Notes: one counted and offered a re-read, the other in no
   * count with no control and nothing said about it in the saved report.
   *
   * ⚠️ **THE CALLER PASSES THE LIST'S ANSWER AND NOTHING ELSE, because the
   * witness has already done the comparing.** A row can only carry it if
   * `awaitsForm` was true when the document was read — that is what
   * `alreadyAnswered`'s `!awaitsForm` term refuses the witness for — and
   * `awaitsForm` is false whenever the run knows of a form. So a witness row is
   * by construction a row this run read while believing the type had none, which
   * is exactly what `formArrivedElsewhere` decides from for every other row.
   * Round 3's first version compared the list against `docTypeFormRef` instead;
   * that map is run-wide and every catalogue read raises it, so the second row
   * of a type — or any row re-checked after its type's form was accepted in the
   * review — was silently dropped from the queue its siblings were put in.
   *
   * ⚠️ **Decided from what the RUN knew, not from the archive's history**, which
   * is the same trade `formArrivedElsewhere` makes for its own rows: a form that
   * existed before this document was read but that this run had never seen still
   * queues a re-read nobody needed. The alternative is a row whose columns are
   * empty and whose screen says nothing, and this file's own precedent — the
   * argument at `refillQueuedByAbsorb` — is that the visible wrong direction is
   * the one a user can act on.
   */
  formArrivedSinceRead: boolean;
  /** The row has a document and is not already in that queue. */
  canQueueRefill: boolean;
}): TypeFormPatch {
  return {
    typeFormMissing: (input.awaitsForm && !input.typeAbsolved) || undefined,
    typeCatalogueUnread: undefined,
    typeCatalogueRecheckFailed: undefined,
    ...(input.formArrivedSinceRead && input.canQueueRefill
      ? { refill: "pending" as const, refillErrorDetail: undefined }
      : {}),
  };
}

/**
 * …and what it writes when the catalogue could not be read AGAIN.
 *
 * ⚠️ **THE WITNESS STAYS, WHICH IS THE WHOLE POINT OF IT.** A second failure is
 * not an answer, so nothing about the type may be written and the way back must
 * not be taken away: the archive may be readable in a minute, and this row is
 * the only thing that remembers the question was never asked.
 *
 * ⚠️ **AND THE PRESS SAYS SO.** `typeCatalogueRecheckFailed` exists because the
 * alternative is a control that does nothing visible — which is how a rescue
 * path becomes indistinguishable from a broken button, a sentence this dialog
 * already writes about `handleReviewTypes`. It is the LAST PRESS's outcome, not
 * a fact about the run, so the call site clears it before each attempt.
 */
export function typeFormPatchAfterFailedRecheck(): TypeFormPatch {
  return { typeCatalogueRecheckFailed: true };
}

/**
 * …and what it writes when the list came back and this type is not in it.
 *
 * ⚠️ **THE DELETED-TYPE RACE, TAKEN HERE RATHER THAN INHERITED — AND THE
 * WINDOW IS WHY.** The retry answers the same `null` the narrow, id-only way and
 * `finalTypeRow`'s own header names that as a known gap; #34.11 deliberately
 * declined to buy it a witness, and this slice does not re-open that decision
 * for the retry. But the retry's window is the milliseconds between two awaits,
 * where "deleted since" is a genuine race. This control is offered for as long
 * as the dialog is open, after the run has settled, so on THIS path "the type is
 * not in the archive any more" is the ordinary reading rather than the unlucky
 * one — and `typeAwaitsForm` with a null key and a null name would answer `true`
 * for it, writing „tipul acestui document nu are încă formular" about a type
 * that no longer exists, permanently, into the saved report, under the stale
 * name the run happens to remember.
 *
 * ⚠️ **SO IT CLAIMS NOTHING AND CLOSES THE CONTROL — AND SAYS SO.** No
 * `typeFormMissing` key at all: the row keeps whatever it had, which for a
 * recoverable row is nothing. The witness goes, because the question HAS been
 * answered: the list was read. And `typeCatalogueTypeGone` takes its place,
 * because a first draft cleared the witness alone — so the whole amber block
 * vanished on the press, which is the broken button this control was written to
 * stop being, over a row still carrying a `documentTypeId` the archive no longer
 * serves.
 */
export function typeFormPatchForDeletedType(): Pick<
  TypeFormPatch,
  "typeCatalogueUnread" | "typeCatalogueRecheckFailed" | "typeCatalogueTypeGone"
> {
  return {
    typeCatalogueUnread: undefined,
    typeCatalogueRecheckFailed: undefined,
    typeCatalogueTypeGone: true,
  };
}
