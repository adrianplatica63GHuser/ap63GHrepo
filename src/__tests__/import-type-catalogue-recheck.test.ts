/**
 * A discovery refused on an unread catalogue leaves a type nothing mentions —
 * and the free way back.                                        (Slice #34.24)
 *
 * WHAT THIS PINS
 * --------------
 * #34.11 gave the retry's catalogue read a witness and made two decisions
 * refuse to answer when it did not come back: the billed discovery is not
 * spent, and `typeFormMissing` is not written. Both are right — silence is the
 * one answer that is never a false claim — and the second has a price that
 * slice named rather than hid: with no flag the row drops out of
 * `handleDiscoverSaved`'s sweep, out of `formArrivedElsewhere` and out of
 * `summariseImportRun.typesWithoutForm`, so for a type whose ONLY document took
 * that path the run reports CLEAN over a type that has no form. The row cannot
 * be retried again either: a retry whose model call succeeded patches
 * `aiStatus: "done"` with `aiPartialWrite` false, and the retry button is drawn
 * inside the block those two gate.
 *
 * The first `describe` below is that price, priced — one document, one formless
 * type, the catalogue read failing on the retry's path — and its second half is
 * the test that failed before this slice existed.
 *
 * ⚠️ **THE RECOVERY IS A SECOND ACTION AND NOT A FOURTH TERM ON THE RETRY, AND
 * THE REASON IS MONEY.** The retry's own note: "The click is one billed model
 * call, and the count the user approved before the run did not include
 * retries." This row's document was READ. What failed was a GET, and a GET is
 * free — so the recovery re-runs the catalogue read and the decision that hangs
 * off it, and buys nothing. Everything below that looks like a negative
 * assertion is that sentence, pinned: no second `runAiInterpret`, no third
 * `discoverForType`, no third claim in `discoverClaimedRef`, and not one term
 * added to `canRetryReads`, `!aiRefused` or `!refillRefused`.
 *
 * Nothing in `src/__tests__/` renders `bulk-import-dialog.tsx`, so the half of
 * this that lives inside a `useCallback` is held the way this suite already
 * holds the rest of that file: the RULE is a pure module with its own
 * assertions, and the call site is read as source with `stripComments` — never
 * a local regex stripper, for the reason `import-discover-run.test.ts` writes
 * out at its own import of it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { stripComments } from "@/lib/dev/strip-comments";
import { summariseImportRun, type SummaryRow } from "@/lib/import/import-outcome";
import { typeAwaitsForm } from "@/lib/import/discover-run";
import {
  canRecheckTypeCatalogue,
  typeCatalogueWitness,
  typeFormPatchAfterFailedRecheck,
  typeFormPatchAfterRecheck,
  typeFormPatchForDeletedType,
} from "@/lib/import/type-form-witness";

const DIALOG = "src/app/admin/import/_components/bulk-import-dialog.tsx";
const dialog = stripComments(readFileSync(join(process.cwd(), DIALOG), "utf8"));

/**
 * The handler, from its name to the next declaration after it.
 *
 * ⚠️ **ENDED AT A DECLARATION, NEVER AT A SECTION COMMENT.** `stripComments`
 * replaces every comment with its own newlines, so an anchor inside one is not
 * in the string this reads at all — `indexOf` answers `-1`, the window becomes
 * the empty string, and every negative assertion below passes over nothing.
 */
const handlerBody = (): string => {
  const start = dialog.indexOf("const handleRecheckTypeForm = useCallback(");
  expect(start).toBeGreaterThan(-1);
  const end = dialog.indexOf("const doneCount = results.filter(", start);
  expect(end).toBeGreaterThan(start);
  return dialog.slice(start, end);
};

const MESSAGES = ["ro-RO", "en-GB"] as const;
const importDialogMessages = (locale: (typeof MESSAGES)[number]): Record<string, string> =>
  JSON.parse(readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8")).adminImport
    .wizard.importDialog;

/**
 * The re-check's patch, with the two inputs that are about the RE-READ QUEUE
 * defaulted off — every test that is about the form question passes neither.
 */
const recheckPatch = (over: Partial<Parameters<typeof typeFormPatchAfterRecheck>[0]>) =>
  typeFormPatchAfterRecheck({
    awaitsForm: false,
    typeAbsolved: false,
    formArrivedSinceRead: false,
    canQueueRefill: false,
    ...over,
  });

/** One settled row of a run, in the shape the summary reads. */
const row = (over: Partial<SummaryRow> = {}): SummaryRow => ({
  status: "done",
  isCoordinate: false,
  cornerPropertyCode: null,
  cornerCount: 0,
  isIdCard: false,
  canLinkPerson: false,
  aiProcessed: true,
  documentTypeId: "type-arenda",
  documentTypeName: "Contract de arendă",
  ...over,
});

// ---------------------------------------------------------------------------
// 1. The price #34.11 named, and the recovery that takes it back
// ---------------------------------------------------------------------------

describe("a run over one document whose type list could not be read", () => {
  /**
   * The row exactly as the retry leaves it on the failed-read path: the
   * document was read and its fields written, the type is known, and
   * `typeFormMissing` was never written — because that patch's `{}` arm leaves
   * an absent key rather than a claim off a list nobody read.
   */
  const withheld = row({ typeFormMissing: undefined });

  it("⚠️ reports CLEAN over a type that has no form — this is the price", () => {
    const summary = summariseImportRun([withheld], 1);
    expect(summary.typesWithoutForm).toBe(0);
    expect(summary.typesWithoutFormNames).toEqual([]);
  });

  it("⚠️ …and the free re-check is what takes it back", () => {
    // The catalogue reads this time, and says what it would have said an hour
    // ago: this type has no form and may hold one.
    const recovered = {
      ...withheld,
      ...recheckPatch({ awaitsForm: true, typeAbsolved: false }),
    };
    const summary = summariseImportRun([recovered], 1);
    expect(summary.typesWithoutForm).toBe(1);
    expect(summary.typesWithoutFormNames).toEqual(["Contract de arendă"]);
  });

  it("⚠️ counts the TYPE once however many of its documents were recovered", () => {
    // `typesWithoutForm` counts distinct type ids, which is the property the
    // recovered rows must not break: three documents of one formless type are
    // one type to build a form for, not three.
    const recovered = {
      ...withheld,
      ...recheckPatch({ awaitsForm: true, typeAbsolved: false }),
    };
    expect(summariseImportRun([recovered, recovered, recovered], 1).typesWithoutForm).toBe(1);
  });

  it("claims nothing when the re-check finds the type already has a form", () => {
    const settled = {
      ...withheld,
      ...recheckPatch({ awaitsForm: false, typeAbsolved: true }),
    };
    expect(summariseImportRun([settled], 1).typesWithoutForm).toBe(0);
  });

  it("⚠️ and a second failed read leaves the count exactly where it was", () => {
    // Not an answer, so not a claim — and the row is unchanged in the one way
    // that matters to the summary.
    const stillUnread = { ...withheld, ...typeFormPatchAfterFailedRecheck() };
    expect(summariseImportRun([stillUnread], 1).typesWithoutForm).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. The rule itself
// ---------------------------------------------------------------------------

describe("the witness the retry leaves behind", () => {
  const witness = (over: Partial<Parameters<typeof typeCatalogueWitness>[0]> = {}) =>
    typeCatalogueWitness({
      catalogueReadFailed: true,
      typeKnown: true,
      alreadyAnswered: false,
      ...over,
    });

  it("is set when the catalogue read failed, on a row that has a type", () => {
    expect(witness()).toEqual({
      typeCatalogueUnread: true,
      typeCatalogueRecheckFailed: undefined,
      typeCatalogueTypeGone: undefined,
    });
  });

  /**
   * ⚠️ **CLEARED, not merely absent, when the read came back.** A row that came
   * back `aiPartialWrite` keeps its retry button, so it can reach this site a
   * second time — and a witness left standing would go on offering a re-check
   * of a question that has since been answered.
   */
  it("⚠️ is CLEARED — an explicit `undefined`, not an absent key — on a good read", () => {
    // (`in`, for the reason the good-path patch's own test writes out: `toEqual`
    // cannot tell a cleared key from an absent one.)
    const patch = witness({ catalogueReadFailed: false });
    expect("typeCatalogueUnread" in patch).toBe(true);
    expect(patch.typeCatalogueUnread).toBeUndefined();
  });

  /**
   * ⚠️ **AND NOT ON A ROW THAT IS ALREADY REPORTED.** The run loop writes
   * `typeFormMissing` on every document it reads, and the retry's failed-read
   * arm writes an ABSENT key, which erases nothing — so a `partialWrite` row of
   * a formless type keeps its `true` through a failed catalogue read. That row
   * is already counted and already draws „tipul acestui document nu are încă
   * formular"; a witness beside it would draw a second sentence saying nothing
   * in this run reports it, one span from the sentence that does.
   */
  it("⚠️ says nothing on a row that already answers the question", () => {
    // Both halves the call site folds in: the `typeFormMissing` the run loop
    // wrote and this failed read left standing, and the `typeFormAdded` a
    // mid-run acceptance wrote on a row whose retry then lost the catalogue.
    // Either way the row already says something true, one span away.
    expect(witness({ alreadyAnswered: true }).typeCatalogueUnread).toBeUndefined();
  });

  it("⚠️ …but DOES mark a row the same call re-typed, which is reported by nothing", () => {
    // The re-type arm of the failed-read ternary clears `typeFormMissing`, so
    // `alreadyAnswered` is false there by construction — and that row is the one
    // the recovery is most useful for: a type nobody has looked at at all.
    expect(witness({ alreadyAnswered: false }).typeCatalogueUnread).toBe(true);
  });

  /**
   * ⚠️ **THE LAST PRESS'S OUTCOME GOES ON EVERY ARM THAT HAS A TYPE.** A retry
   * is another attempt at the same question, and „lista tot nu a putut fi
   * citită … nu s-a trimis nimic către AI" drawn straight after a billed model
   * call is false in its second half.
   */
  it("⚠️ clears a stale failed-press flag, whichever way the read went", () => {
    for (const catalogueReadFailed of [true, false]) {
      const patch = witness({ catalogueReadFailed });
      expect([catalogueReadFailed, "typeCatalogueRecheckFailed" in patch]).toEqual([
        catalogueReadFailed,
        true,
      ]);
      expect(patch.typeCatalogueRecheckFailed).toBeUndefined();
    }
  });

  it("says nothing at all about a row with no type", () => {
    // Nothing to re-check, so no control and no key: an absent key leaves the
    // row alone, which is the difference this module's `TypeFormPatch` header
    // is about. Such a row can never have carried either flag.
    expect(witness({ typeKnown: false })).toEqual({});
    expect(witness({ typeKnown: false, catalogueReadFailed: false })).toEqual({});
  });
});

describe("whether a row is offered the free re-check", () => {
  it("is offered exactly when the witness and a type are both there", () => {
    expect(canRecheckTypeCatalogue({ typeCatalogueUnread: true, documentTypeId: "t1" })).toBe(true);
    expect(canRecheckTypeCatalogue({ typeCatalogueUnread: true })).toBe(false);
    expect(canRecheckTypeCatalogue({ documentTypeId: "t1" })).toBe(false);
    expect(canRecheckTypeCatalogue({})).toBe(false);
  });

  /**
   * ⚠️ **A REFUSED ROW KEEPS IT, and that is the opposite of the retry button
   * one span along.** `!aiRefused` and `!refillRefused` are there because a
   * refused read cannot answer differently and is billed every time it is
   * asked. This press buys nothing — and a row that will never be read again is
   * the row whose type is the only thing left that anything can still fix.
   */
  it("⚠️ is offered on a row whose reads were REFUSED, unlike the retry", () => {
    // The refusal flags are not terms of this rule at all, which is what makes
    // the answer below the same one an unrefused row gets.
    const refused = { typeCatalogueUnread: true, documentTypeId: "t1", aiRefused: true };
    expect(canRecheckTypeCatalogue(refused)).toBe(true);
  });
});

describe("what the re-check writes", () => {
  it("writes the same answer the retry writes on its own good path", () => {
    const patch = recheckPatch({ awaitsForm: true, typeAbsolved: false });
    expect(patch.typeFormMissing).toBe(true);
    // ⚠️ **PRESENCE, not `toEqual` against `undefined`** — Jest ignores a key
    // whose value is `undefined` on both sides, so the obvious spelling of this
    // assertion passes over a patch that stopped clearing the witness
    // altogether. And it has to be THIS patch: clearing it in a second
    // `updateResult` would put a render between the two in which the row says
    // both things at once.
    for (const key of ["typeCatalogueUnread", "typeCatalogueRecheckFailed"] as const) {
      expect([key, key in patch, patch[key]]).toEqual([key, true, undefined]);
    }
  });

  it("⚠️ carries no `false` for a type that is not waiting", () => {
    // `|| undefined`, as everywhere else this flag is written: the summary reads
    // `=== true`, but the saved session and the report walk what is PRESENT, and
    // a false flag is a fact nobody asked for.
    expect(
      recheckPatch({ awaitsForm: false, typeAbsolved: false }).typeFormMissing,
    ).toBeUndefined();
    expect(
      recheckPatch({ awaitsForm: true, typeAbsolved: true }).typeFormMissing,
    ).toBeUndefined();
  });

  /**
   * ⚠️ **THE WITNESS SURVIVES A SECOND FAILURE, which is the whole point of
   * it.** A failed press is not an answer: nothing about the type may be
   * written, and the way back must not be taken away — the archive may be
   * readable a minute later, and this row is the only thing that remembers the
   * question was never asked.
   */
  it("⚠️ leaves the way back open when the list still cannot be read", () => {
    const patch = typeFormPatchAfterFailedRecheck();
    expect(patch).toEqual({ typeCatalogueRecheckFailed: true });
    expect("typeCatalogueUnread" in patch).toBe(false);
    expect("typeFormMissing" in patch).toBe(false);
  });

  /**
   * ⚠️ **AND CLOSES IT, CLAIMING NOTHING, WHEN THE LIST CAME BACK WITHOUT THIS
   * TYPE.** The retry answers that same `null` the narrow way and #34.11
   * declined to buy the race a witness — for a window of milliseconds between
   * two awaits. This control is offered for as long as the dialog is open, so
   * "the type is not in the archive any more" is the ordinary reading here; and
   * `typeAwaitsForm` with a null key and name would answer `true`, naming a
   * deleted type in the saved report under whatever name the run remembers.
   */
  it("⚠️ claims nothing about a type that is no longer in the list, and says so", () => {
    const patch = typeFormPatchForDeletedType();
    expect("typeFormMissing" in patch).toBe(false);
    expect(patch.typeCatalogueUnread).toBeUndefined();
    expect(patch.typeCatalogueRecheckFailed).toBeUndefined();
    // ⚠️ **And the row keeps a sentence.** Clearing the witness alone made the
    // whole block vanish on the press — the broken button this control was
    // written to stop being — over a row still carrying a `documentTypeId` the
    // archive no longer serves.
    expect(patch.typeCatalogueTypeGone).toBe(true);
    expect(dialog).toContain('t("typeCatalogueTypeGone")');
    expect(dialog).toContain("canRecheckTypeCatalogue(result) || typeCatalogueTypeGone === true");
    // …and the summary is therefore unchanged by it.
    const unchanged = { ...row({ typeFormMissing: undefined }), ...patch };
    expect(summariseImportRun([unchanged], 1).typesWithoutForm).toBe(0);
  });

  /**
   * ⚠️ **THE TWO COPIES OF ONE EXPRESSION, PINNED TO THE SAME WORDS.** The
   * retry's own `typeFormMissing` ternary is not folded into this module: it is
   * pinned character by character, through both arms, by #34.11's block in
   * `import-discover-run.test.ts` — a test that records which mutation each
   * half of it was written to catch — so folding it into a call would delete
   * those guards to remove a duplicate. Both are checked to say the same thing
   * instead, and the third copy site is where this is folded.
   */
  it("⚠️ queues the re-read `formArrivedElsewhere` structurally cannot queue", () => {
    // That callback matches on `typeFormMissing === true`, and a witness row is
    // by construction a row with no such flag — so `absorbTypeList`, which the
    // re-check calls like every other reader of a fresh list, queues every OTHER
    // document of the type and skips the one the user pressed. Two documents of
    // one type, both read before the form existed: one counted and offered a
    // re-read, the other in no count with no control.
    expect(
      typeFormPatchAfterRecheck({
        awaitsForm: false,
        typeAbsolved: true,
        formArrivedSinceRead: true,
        canQueueRefill: true,
      }),
    ).toEqual({
      typeFormMissing: undefined,
      typeCatalogueUnread: undefined,
      typeCatalogueRecheckFailed: undefined,
      refill: "pending",
      refillErrorDetail: undefined,
    });
    // ⚠️ **And never over a position something else has already settled**, nor
    // on a row with no document — `awaitsRefill`'s own invariant.
    expect(
      "refill" in
        typeFormPatchAfterRecheck({
          awaitsForm: false,
          typeAbsolved: true,
          formArrivedSinceRead: true,
          canQueueRefill: false,
        }),
    ).toBe(false);
    // …and not at all when the form is not news to this run: the read that
    // produced these columns went to the same template.
    expect(
      "refill" in
        typeFormPatchAfterRecheck({
          awaitsForm: false,
          typeAbsolved: true,
          formArrivedSinceRead: false,
          canQueueRefill: true,
        }),
    ).toBe(false);
  });

  it("⚠️ agrees with the retry's inline copy, term for term", () => {
    expect(dialog).toContain("typeFormMissing: (awaitsForm && !typeAbsolved) || undefined");
    for (const awaitsForm of [true, false]) {
      for (const typeAbsolved of [true, false]) {
        expect([
          awaitsForm,
          typeAbsolved,
          recheckPatch({ awaitsForm, typeAbsolved }).typeFormMissing,
        ]).toEqual([awaitsForm, typeAbsolved, (awaitsForm && !typeAbsolved) || undefined]);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. The call site — that the free press is free, and that it decides the same
// ---------------------------------------------------------------------------

describe("⚠️ the recovery costs nothing, and the retry's contract is untouched", () => {
  it("⚠️ makes no billed call of any kind", () => {
    const handler = handlerBody();
    // The two things in this file that cost money, neither of them reachable
    // from a press that is advertised as free. `runAiInterpret` re-reads the
    // DOCUMENT; `discoverForType` reads it to propose a form for its type.
    expect(handler).not.toContain("runAiInterpret(");
    expect(handler).not.toContain("discoverForType(");
    // …and the spending rule is not even asked, which is the decision
    // `type-form-witness.ts` writes out: acting on a yes costs a read, and a
    // yes nobody may act on is a value no reader has.
    expect(handler).not.toContain("shouldDiscoverType(");
    // Structurally, too: the file still holds exactly the call sites #34.11 and
    // #32.05 counted.
    expect([...dialog.matchAll(/shouldDiscoverType\(\{/g)]).toHaveLength(2);
    expect([...dialog.matchAll(/runAiInterpret\(/g)]).toHaveLength(3);
    expect([...dialog.matchAll(/discoverForType\(/g)]).toHaveLength(2);
  });

  it("⚠️ leaves `discoverClaimedRef` exactly as #34.11 left it", () => {
    // That ref keeps a failed DISCOVERY claimed on purpose, so one rate limit
    // cannot buy three more attempts inside a run. This handler makes no
    // discovery to claim — and must not release one either, which is what a
    // `delete` here would be.
    expect(handlerBody()).not.toContain("discoverClaimedRef");
    expect([...dialog.matchAll(/discoverClaimedRef\.current\.add\(/g)]).toHaveLength(2);
    expect([...dialog.matchAll(/claimedTypeIds: discoverClaimedRef\.current/g)]).toHaveLength(2);
    expect(dialog).not.toContain("discoverClaimedRef.current.delete(");
  });

  it("⚠️ adds no fourth term to the retry button", () => {
    // The contract #34.11 declined to touch, and this slice does not touch it
    // either: `canRetryReads`, and the two money terms beside it, unchanged and
    // in one place.
    expect(dialog).toContain("canRetryInterpret && !aiRefused && !refillRefused && (");
    expect([...dialog.matchAll(/canRetryReads\(\{/g)]).toHaveLength(1);
    // …and the free control is drawn from its OWN gate, never from that one.
    // ⚠️ **BOTH halves, and the block's own gate carries a second flag** — the
    // deleted-type sentence is drawn on `typeCatalogueTypeGone`, which the
    // per-row test is false for, so the button needs its own copy of that test
    // or it survives into a state where every press returns silently.
    expect(dialog).toContain(
      "(canRecheckTypeCatalogue(result) || typeCatalogueTypeGone === true) && (",
    );
    expect(dialog).toMatch(/canRecheckTypeCatalogue\(result\) &&\s*canRecheckTypeForm && \(/);
  });

  it("⚠️ keeps `!preflight.sessionLost` standing beside `!preflight.readFailed`", () => {
    // Every lost session is a failed read, so the wider term does subsume the
    // narrower — but the narrower is the fact the lines above it act on, two
    // reviewers rejected `abortRef` as its witness, and a reader who finds one
    // term where two arguments are written down deletes whichever he read
    // second. Nothing in this slice may collapse them.
    expect(dialog).toContain("!preflight.sessionLost &&");
    expect(dialog).toContain("!preflight.readFailed &&");
  });

  it("⚠️ asks the same questions the retry asks, of a fresh list", () => {
    const handler = handlerBody();
    // The free GET, through the one function that owes the follow-ups — the
    // refs `typeAwaitsForm` reads, the identity-card clear, the run's names and
    // the re-read queue.
    expect(handler).toContain("await enrichDiscoverSteps(discoverStepsRef.current)");
    expect(handler).toContain("absorbTypeList(fresh)");
    expect(handler).toContain("typeAwaitsForm({");
    // …and it refuses to answer on a read that did not come back, exactly as
    // the retry does one screen up.
    expect(handler).toContain("if (fresh.readFailed) {");
    expect(handler).toContain("typeFormPatchAfterFailedRecheck()");
    // The absolution is asked of the same two causes as on the retry path, and
    // NOT through a fourth `typeRows?.some(…)` — #34.11's suite counts those.
    expect(handler).toContain("fresh.idCardTypeIds.includes(typeId) || row.hasForm");
    // ⚠️ **The list's answer and nothing else.** A round-3 draft compared it
    // against `docTypeFormRef`, which every catalogue read in the dialog raises,
    // so the second row of a type — and any row re-checked after its type's form
    // was accepted in the review — was dropped from the queue its siblings were
    // put in. The witness already IS the record that this run had never seen a
    // form for this type when this document was read.
    expect(handler).toContain("formArrivedSinceRead: row.hasForm,");
    expect(handler).not.toContain("docTypeFormRef.current.get(typeId) === true;");
    expect(handler).toContain(
      "canQueueRefill: result.docId !== undefined && result.refill === undefined",
    );
    expect([...dialog.matchAll(/\.typeRows\?\.some\(/g)]).toHaveLength(3);
    // …and a list that came back WITHOUT this type claims nothing at all, which
    // is the one place this slice answers a race the retry does not — see
    // `typeFormPatchForDeletedType`.
    expect(handler).toContain("if (row === null) {");
    expect(handler).toContain("typeFormPatchForDeletedType()");
  });

  it("⚠️ writes the witness on BOTH arms of a failed read, and clears it on a good one", () => {
    // One spread, OUTSIDE the `typeFormMissing` ternary, so the re-typed row —
    // the one moved onto a type nobody has looked at at all — keeps its way back
    // too. The claim and the read are two different facts and this slice does
    // not fold them.
    expect(dialog).toMatch(
      /\.\.\.typeCatalogueWitness\(\{\s*catalogueReadFailed: preflight\.readFailed,\s*typeKnown: finalTypeId !== null,\s*alreadyAnswered:/,
    );
    // ⚠️ **Both halves of `alreadyAnswered`, and both conditioned on there
    // being no re-type** — because a re-type clears each of the two flags a few
    // lines below, which is what makes "what the patch leaves standing"
    // different from "what the row carried at the click".
    expect(dialog).toContain(
      "(result.typeFormMissing === true && interpreted.documentTypeId === null) ||",
    );
    // ⚠️ **`!awaitsForm` as the second half, not a list of flags.** Three rounds
    // enumerated them — `typeFormAdded`, then the `refill: "pending"`
    // `formArrivedElsewhere` writes while deliberately setting no flag at all —
    // and each found one more row drawing two sentences at once. On this path a
    // `false` from `awaitsForm` can only come from `typeHasForm`, `typeIsIdCard`
    // or the catch-all's id, all read from refs this run only ever raises.
    expect(dialog).toMatch(/alreadyAnswered:[\s\S]{0,160}!awaitsForm,/);
    // …and the ternary it sits beside is untouched: the withheld arm still
    // writes no claim.
    const at = dialog.indexOf("typeFormMissing: (awaitsForm");
    const spreadAt = dialog.lastIndexOf("...(preflight.readFailed", at);
    expect(spreadAt).toBeGreaterThan(-1);
    expect(dialog.slice(spreadAt, at)).not.toContain("typeFormMissing: true");
  });

  it("⚠️ cannot race the run, the retry, the review, or itself", () => {
    // `canRetryReads`' three terms, read rather than rewritten — the run has
    // settled, no follow-up is open, no billed call is in flight — plus
    // `canRefill`'s `!reviewingTypes` for its own reason, plus this control's
    // own one-at-a-time claim. The synchronous halves are inside the handler,
    // because render-time state is one commit behind.
    const handler = handlerBody();
    expect(dialog).toContain("canRetry && !reviewingTypes && recheckingPath === null");
    expect(handler).toContain("if (readRunningRef.current) return;");
    expect(handler).toContain("if (followUpsOpenRef.current) return;");
    expect(handler).toContain("if (recheckingRef.current !== null) return;");
    // The review's own direction, with the one-frame window #27.05 priced and
    // accepted — what is not acceptable is only one of the two being guarded.
    expect(handler).toContain("if (reviewingTypes) return;");
    // Released whichever way it returned — a claim left standing makes every
    // later press a no-op, which is the shape this file has already paid for.
    expect(handler).toContain("recheckingRef.current = null;");
  });

  /**
   * ⚠️ **AND THE CLAIM IS SHARED, WHICH A PRIVATE ONE WAS NOT — this is the
   * blocker an adversarial round found.** The re-check holds a
   * `documentTypeId` captured before its GET went out. A retry pressed during
   * that GET can RE-TYPE the document and land first, and the re-check's patch
   * then writes `typeFormMissing` earned about the OLD type onto a row that now
   * carries the new one — the exact claim the retry's own re-type arm exists to
   * prevent, and unfixable afterwards because both controls are gone by then.
   * All three of the other async handlers read the claim.
   */
  it("⚠️ is a SHARED claim: the retry, the re-read walk and the review all read it", () => {
    // Its own guard plus one in each of the three handlers that can write a row
    // or replace the queue underneath it.
    expect([...dialog.matchAll(/if \(recheckingRef\.current !== null\) return;/g)]).toHaveLength(4);
    for (const owner of [
      "const handleReviewTypes = useCallback(",
      "const handleRefill = useCallback(",
      "const handleRetryInterpret = useCallback(",
    ]) {
      const at = dialog.indexOf(owner);
      expect([owner, at]).not.toEqual([owner, -1]);
      // ⚠️ **Bounded by the handler's FIRST await rather than by a character
      // count**, because that is the property: a guard after the await does not
      // guard anything, and a fixed window is a number that goes wrong the next
      // time somebody adds a paragraph. (`"await "` with the space, so
      // `awaitsRefill` is not mistaken for one.)
      const beforeAwait = dialog.slice(at, dialog.indexOf("await ", at));
      expect([owner, beforeAwait]).toEqual([
        owner,
        expect.stringContaining("if (recheckingRef.current !== null) return;"),
      ]);
    }
    // ⚠️ **AND EVERY CONTROL THAT REFUSES TO RUN ALSO REFUSES TO BE DRAWN.**
    // Three handlers now return early while a free GET is in flight, so three
    // render-time gates carry the same fact — otherwise an enabled button
    // returns silently for the length of a GET, which is the broken-button
    // failure this file names, and the header sentence goes on offering a retry
    // the buttons will not perform, which is the pair `canRetryReads` exists to
    // keep in step. It is fed in at `canRetryReads`' INPUT, never as a term of
    // the function itself.
    expect(dialog).toContain("retryRunning: readRunning || recheckingPath !== null,");
    expect([...dialog.matchAll(/recheckingPath === null/g)].length).toBeGreaterThanOrEqual(3);
    // ⚠️ **And the guards it was written beside are still there.** A first draft
    // of this slice wrote its own guard OVER `handleRetryInterpret`'s
    // follow-up-modal one, leaving the retry the only handler on the screen that
    // could start underneath an open stepper — one billed call, and the
    // duplicate person the 26.xx redesign exists to prevent.
    expect([...dialog.matchAll(/if \(followUpsOpenRef\.current\) return;/g)]).toHaveLength(4);
    expect([...dialog.matchAll(/if \(readRunningRef\.current\) return;/g)].length)
      .toBeGreaterThanOrEqual(4);
    // ⚠️ **AND THE TWO CONTROLS THAT WRITE OR END THE RUN'S ARTEFACTS TAKE IT
    // TOO.** Save-report's own note says why it carries `readRunning`: the run's
    // one durable artefact must not be written in the middle of a read the
    // screen is visibly still doing. That argument is about the artefact, not
    // about money, so a free read is no exception — a report saved one second
    // early says "no types without a form" over a type that has none. Close is
    // the same, one worse: neither flag is persisted, so the resumed session has
    // no trace of the question.
    expect([
      ...dialog.matchAll(
        /disabled=\{currentFollowUp !== null \|\| readRunning \|\| recheckingPath !== null\}/g,
      ),
    ]).toHaveLength(2);
    expect(dialog).not.toContain("disabled={currentFollowUp !== null || readRunning}");
    // ⚠️ **And `reviewingTypes`, which gates this control, can no longer stick
    // `true` for the life of the dialog** — fixed in passing, because #34.24 is
    // what made that pre-existing hole reach a row with no retry left.
    const review = dialog.slice(
      dialog.indexOf("const handleReviewTypes = useCallback("),
      dialog.indexOf("const applyPendingNewType"),
    );
    expect(review).toMatch(
      /try \{\s*enriched = await enrichDiscoverSteps\([\s\S]{0,80}\} finally \{\s*if \(mountedRef\.current\) \{?\s*setReviewingTypes\(false\);/,
    );
    // …and the backlog with it: that loop deletes as it walks, so a throw
    // half-way through otherwise leaves the header offering a review over a
    // queue that has already shrunk, with the control just given back.
    expect(review).toMatch(
      /\} finally \{[\s\S]{0,400}setDiscoverBacklog\(discoverStepsRef\.current\.size\);/,
    );
    // ⚠️ **And it is NOT `readRunningRef`.** That ref means "a BILLED read on a
    // settled row is in flight" and every reader of it is entitled to that
    // meaning. Close and Save-report are disabled here too, by their own term
    // above, for the artefact argument rather than the money one.
    expect(handlerBody()).not.toContain("readRunningRef.current = true");
  });
});

// ---------------------------------------------------------------------------
// 4. The recovered row reaches the readers it was dropping out of
// ---------------------------------------------------------------------------

/**
 * ⚠️ **ASSERTED, NOT ARGUED — as far as a suite that renders nothing can.**
 * Both sweeps are inline callbacks inside the dialog, so what is pinned here is
 * the PREDICATE each of them tests, read out of the source, applied to the row
 * the recovery produces. If somebody rewrites either predicate, the source
 * assertion fails rather than the model quietly going on agreeing with a rule
 * that no longer exists.
 */
describe("⚠️ the recovered row is reached by everything it was dropping out of", () => {
  const recovered = {
    ...row(),
    ...recheckPatch({ awaitsForm: true, typeAbsolved: false }),
    docId: "doc-1",
  };

  it("is not skipped by `handleDiscoverSaved`'s sweep, which skips on the flag", () => {
    expect(dialog).toContain("if (r.typeFormMissing !== true) return r;");
    expect(recovered.typeFormMissing !== true).toBe(false);
    // …and the sweep's own `docId` term, which is what `awaitsRefill` is
    // allowed to assume: a recovered row has one, because `typeFormMissing` is
    // only ever written on a row the run READ.
    expect(dialog).toContain(
      'r.docId !== undefined ? { refill: "pending", refillErrorDetail: undefined } : {}',
    );
    expect(recovered.docId).toBeDefined();
  });

  it("`formArrivedElsewhere` matches on the same flag, and this row now carries it", () => {
    expect(dialog).toMatch(
      /r\.typeFormMissing === true &&\s*r\.documentTypeId !== undefined &&\s*withForm\.has\(r\.documentTypeId\)/,
    );
    expect(recovered.typeFormMissing).toBe(true);
    expect(recovered.documentTypeId).toBeDefined();
  });

  it("`summariseImportRun` counts it — which is the whole of the goal", () => {
    expect(summariseImportRun([recovered], 1).typesWithoutForm).toBe(1);
  });

  /**
   * ⚠️ **AND `typeFormAdded` IS STILL UNREACHABLE IN THE HARMFUL DIRECTION.**
   * #34.11 traced it and left it alone; this slice does not make it reachable.
   * The flag is only ever SET in `handleDiscoverSaved`, on a row that carried
   * `typeFormMissing === true` — so a recovered row can gain it only by the
   * user accepting a form for the type the row is actually on, which is the
   * sentence being true rather than false. What this slice adds writes the flag
   * nowhere, and both of its existing set sites are still where they were.
   */
  it("⚠️ writes `typeFormAdded` nowhere, so the harmful direction stays closed", () => {
    expect(handlerBody()).not.toContain("typeFormAdded");
    expect([...dialog.matchAll(/typeFormAdded: true/g)]).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 5. The copy — because a control nobody understands is not a way back
// ---------------------------------------------------------------------------

describe("⚠️ the row says what happened and what the press costs", () => {
  const KEYS = [
    "typeCatalogueUnread",
    "typeCatalogueStillUnread",
    "typeCatalogueRecheck",
    "typeCatalogueRecheckHint",
    "typeCatalogueChecking",
    "typeCatalogueTypeGone",
  ] as const;

  it.each(MESSAGES)("%s carries all six, non-empty", (locale) => {
    const block = importDialogMessages(locale);
    for (const key of KEYS) {
      expect({
        locale,
        key,
        ok: typeof block[key] === "string" && block[key].trim() !== "",
      }).toEqual({ locale, key, ok: true });
    }
  });

  /**
   * ⚠️ **THE HINT SAYS THE OPPOSITE OF THE RETRY'S, AND THAT IS THE SLICE.**
   * `interpretRetryHint` warns that the click is one billed model call. A user
   * who has just been told that needs to be told when a press is NOT one, or
   * the free control goes unpressed for the right reason.
   */
  it("the Romanian hint promises the document is not sent again", () => {
    const ro = importDialogMessages("ro-RO");
    expect(ro.typeCatalogueRecheckHint).toContain("nu costă nimic");
    expect(ro.typeCatalogueRecheckHint).toContain("NU este trimis");
    expect(ro.interpretRetryHint).toContain("se plătește");
  });

  it("⚠️ the sentence is about the READ, never a claim about the type", () => {
    // The one thing #34.11 refused to say off a list nobody read is the one
    // thing this sentence must not say either. The row's "no form yet" sentence
    // is `typeFormPending`, and it is earned elsewhere.
    const ro = importDialogMessages("ro-RO");
    expect(ro.typeCatalogueUnread).toContain("nu a putut fi citită");
    expect(ro.typeCatalogueUnread).not.toContain("nu are încă formular");
    // ⚠️ **And the failed-press sentence names no CAUSE, because its two
    // writers do not share one.** The `readFailed` branch knows the list did not
    // come back; the `catch` is reached only when the GET DID come back and the
    // prune loop threw. "The check did not succeed" is true of both; "the list
    // could not be read" was true of one, and was drawn on the other.
    expect(ro.typeCatalogueStillUnread).not.toContain("nu a putut fi citită");
    expect(ro.typeCatalogueStillUnread).toContain("Nu s-a trimis nimic către AI");
    expect(ro.typeCatalogueStillUnread).not.toContain("nu are încă formular");
  });

  it("the six keys are drawn by the row", () => {
    for (const key of KEYS) expect(dialog).toContain(`t("${key}")`);
  });

  /**
   * ⚠️ **AND THE HEADER COUNTS THEM, which an adversarial round found missing.**
   * `unreadRetryableCount`'s own header states the rule: it is said beside Close
   * because Close is the end of the window. Neither flag behind this one is
   * persisted, so without a line above the fold a run ends with N open questions,
   * `typesWithoutForm: 0` in the saved report, and the cure reachable only by
   * scrolling to the right row.
   */
  it("⚠️ the header counts these rows and offers the press, in two branches", () => {
    expect(dialog).toContain(
      "const typeCatalogueUnreadCount = results.filter(canRecheckTypeCatalogue).length;",
    );
    expect(dialog).toContain('t("doneTypeCatalogueUnread", { count: typeCatalogueUnreadCount })');
    expect(dialog).toContain(
      't("doneTypeCatalogueUnreadWaiting", { count: typeCatalogueUnreadCount })',
    );
    // The branch is the control's own gate, so the sentence and the button
    // cannot come to disagree — the pair `canRetryReads` exists for.
    expect(dialog).toMatch(/\{canRecheckTypeForm\s*\?\s*t\("doneTypeCatalogueUnread"/);
    for (const locale of MESSAGES) {
      const block = importDialogMessages(locale);
      for (const key of ["doneTypeCatalogueUnread", "doneTypeCatalogueUnreadWaiting"]) {
        expect({ locale, key, plural: block[key].includes("{count, plural,") }).toEqual({
          locale,
          key,
          plural: true,
        });
      }
    }
    // Romanian needs the `few` form, which #32.05's own copy test pins for the
    // lines beside this one.
    for (const key of ["doneTypeCatalogueUnread", "doneTypeCatalogueUnreadWaiting"]) {
      expect({ key, few: importDialogMessages("ro-RO")[key].includes("few {") }).toEqual({
        key,
        few: true,
      });
    }
  });

  it("⚠️ the offer names the price, which is nothing", () => {
    const ro = importDialogMessages("ro-RO");
    expect(ro.doneTypeCatalogueUnread).toContain("este gratuit");
    expect(ro.doneTypeCatalogueUnread).toContain("nu se trimite din nou către AI");
    // …and the waiting branch promises no press it cannot deliver.
    expect(ro.doneTypeCatalogueUnreadWaiting).toContain("Așteptați pașii aflați în curs");
  });
});

// ---------------------------------------------------------------------------
// 6. The rule the recovery decides with is still the ONE rule
// ---------------------------------------------------------------------------

describe("⚠️ the re-check asks `typeAwaitsForm`, with the row's two columns", () => {
  /**
   * #34.10 made `typeKey`/`typeName` required-and-nullable precisely so that a
   * new call site cannot answer the narrow, id-only way by forgetting them —
   * and this slice adds a call site. Both columns, off the row the fresh read
   * returned.
   */
  it("passes the key and the name it has just read", () => {
    const handler = handlerBody();
    const call = handler.indexOf("typeAwaitsForm({");
    expect(call).toBeGreaterThan(-1);
    const args = handler.slice(call, handler.indexOf("});", call));
    // Written as the row's own values rather than `?? null`, because the branch
    // above returns on a missing row — so this site says it HAS one, which is
    // the whole difference between the two answers `typeMayHoldAForm` gives.
    expect(args).toContain("typeKey: row.key");
    expect(args).toContain("typeName: row.name");
    expect(args).toContain("fallbackTypeId: fallbackTypeIdRef.current");
  });

  it("and the rule itself still answers the way both call sites need", () => {
    // Not a second copy of `import-discover-run.test.ts` — one row, to pin that
    // what the recovery writes is what that suite's rule says, rather than a
    // second opinion about the same type.
    expect(
      typeAwaitsForm({
        typeId: "type-arenda",
        typeKey: "CONTRACT_ARENDA",
        typeName: "Contract de arendă",
        fallbackTypeId: "type-neclasificat",
        typeHasForm: false,
        typeIsIdCard: false,
      }),
    ).toBe(true);
  });
});
