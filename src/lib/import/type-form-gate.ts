/**
 * Does every document type this folder holds already have a form?
 *                                                              (Slice #29.08)
 *
 * WHY THIS EXISTS
 * ---------------
 * An import should not create a document whose type has no form to put the
 * document's information into. Until this slice it did so routinely: the run
 * classified each file, resolved a `lookup_document_type` row for it - creating
 * one from the model's label where none existed - and imported it regardless,
 * so the type-specific values the AI read went into free-text Notes and the
 * result screen offered a billed re-read that stopped being reachable the
 * moment the dialog closed.
 *
 * #29.08 moves the classification in front of the Evaluation screen and puts
 * this question between the two. If every type has a form the import carries on
 * exactly as before; if any does not, the run stops and names them.
 *
 * ⚠️ **AND SINCE #32.05 THE STOP IS A FORK RATHER THAN AN EXIT.** The screen
 * this gate raises now carries a second press beside "Oprește importul":
 * continue with these types exactly as they are. Nothing in THIS file knows
 * about it and nothing in this file should — `checkTypeForms`, `typesAreClean`,
 * `catalogueIsUsable`, `noClassificationHappened` and `typeAwaitsForm` decide
 * exactly what they decided before, because a waiver is a decision about a
 * verdict and not a different verdict. What changed is who may act on the
 * answer: `typesAreClean` still says this run has not PROVED every type has a
 * form, and the user may now say "I know — go on anyway". The offer is drawn
 * only where there IS a verdict; a failed or unusable catalogue read has named
 * no types, so there is nothing to waive.
 *
 * ⚠️ **WHAT THIS GATE DOES NOT PROMISE, SAID FIRST BECAUSE AN EARLIER DRAFT OF
 * THIS HEADER PROMISED IT.** It does NOT make "a document is created whose type
 * has no form" unreachable. It closes the routine cause - the classification's
 * own answers - and leaves two it cannot see:
 *
 *  - **The catch-all.** A document nothing could classify is filed on
 *    NECLASIFICAT, which has no form and correctly never gets one. That is a
 *    document whose type is WRONG, not one whose type is unfinished, and
 *    `import-outcome.ts` has always drawn that line. It is counted here and
 *    never counted against.
 *  - **The AI read re-typing a document mid-run.** `runAiInterpret`'s own
 *    header says it: the interpret route may disagree with the scan's thumbnail
 *    glance and return a different `documentTypeId`, and **that is also a path
 *    that auto-creates `lookup_document_type` rows**. Such a type was never a
 *    classifier answer this gate saw and cannot have a form, because it was
 *    created seconds ago. `bulk-import-dialog.tsx` reads the type AFTER the
 *    read for exactly this reason.
 *
 * That second one is why the reconciling re-read (`awaitsRefill` and the
 * controls around it) is still in the dialog after this slice: the gate makes
 * its precondition rare, not impossible, and removing the reconciliation would
 * leave those runs reporting a fully landed import over documents whose values
 * are still in Notes.
 *
 * ⚠️ **IT ASKS `resolveAgainstTypes` AND `typeAwaitsForm`; IT DECIDES NOTHING
 * ITSELF, AND THAT IS THE WHOLE DESIGN.** A gate that worked out "this answer
 * means that type" by its own rule would be a second matcher beside the one the
 * import run uses - the shape Slice #29.06 deleted after two writers
 * disagreeing about when two names are one name produced two types from one
 * document. And a gate that tested `!hasForm` by hand would be a second opinion
 * about which types are waiting for one - which is `typeAwaitsForm` in
 * `discover-run.ts`, the rule the run itself uses to decide both whether to
 * spend a discovery read and whether a row may say "this type has no form yet".
 * This codebase's own rule says it in a sentence: a validator that disagrees
 * with the executor is worse than no validator, because it is believed.
 *
 * THE THREE ANSWERS, AND WHY ONLY TWO OF THEM ARE THIS GATE'S BUSINESS
 * -------------------------------------------------------------------
 *  - **`match`** - the archive holds this type. `typeAwaitsForm` decides, so
 *    the catch-all and an identity card are both excused, and the has-a-form
 *    test is `documentTypeHasForm` rather than a `length > 0` on the raw jsonb:
 *    a template that parses to no usable field renders no inputs and
 *    contributes nothing to the extraction prompt.
 *  - **`create`** - a real label naming a type nothing holds yet. It blocks
 *    unless it reads as an identity card, and by construction rather than by
 *    policy: the row does not exist, so it cannot have a form, and the first
 *    thing the run would do is mint one without a form and file documents on it.
 *  - **`declined`** - the model had no idea, or the file was never classified
 *    at all. Counted, never counted against; see the catch-all note above.
 *
 * ⚠️ **THE IDENTITY CARD IS THE CASE THAT MAKES OR BREAKS THIS GATE, and the
 * first draft got it wrong.** CARTE_IDENTITATE has no form and must never have
 * one: its data is captured by the import's own identity-card step, and
 * `ai-interpret`'s prompt is built from `template_fields`, so giving it a fake
 * form would spend a billed read against invented columns. A gate that blocked
 * on it would refuse every folder containing a `buletin.jpg` - which is most of
 * them - and send the user to DocTypeEngine to do the one thing this codebase
 * says in three separate files is wrong. `typeAwaitsForm` already excuses it;
 * asking that function rather than `!hasForm` is what makes the exemption a
 * property here rather than a second copy of it.
 *
 * ⚠️ **A CATALOGUE THIS GATE CANNOT DECIDE FROM IS NOT A CLEAN ANSWER.** An
 * empty list, or one with no catch-all row, makes every real label look like a
 * create - so a naive read would stop the import and name types that exist and
 * have forms. `bulk-import-dialog.tsx` refuses both, in as many words ("an
 * EMPTY list is treated as a failed read, not as 'every type was deleted'"), so
 * `catalogueIsUsable` refuses them here too and the caller reports the failure
 * screen rather than a list of invented findings.
 *
 * ⚠️ **TWO ENTRIES THAT WOULD CREATE ONE TYPE ARE ONE ENTRY HERE, AND THE WAY
 * THEY ARE FOLDED IS THE RUN'S LOOP, RUN AGAIN.** `ensureDocType` resolves each
 * answer against ONE list and PUSHES every row it creates back into it, so the
 * second entry of an invented type is an ordinary `match` against a row that
 * did not exist a moment ago. This module does exactly that and nothing else.
 *
 * ⚠️ **THREE ROUNDS GOT IT WRONG THREE DIFFERENT WAYS, AND ALL THREE LOOKED
 * REASONABLE.** Folding on the key alone split `{key, "Contract"}` from
 * `{no key, "Contract"}`. Folding on key-or-name through an alias table folded
 * TRANSITIVELY — A(k1,"X"), B(k2,"X"), C(k2,"Y") became one type where the run
 * creates two. Keeping the created rows in a SECOND list and consulting it only
 * after the catalogue said `create` reordered the two passes inside
 * `matchDocumentType`, which runs its KEY pass over the whole list before its
 * NAME pass — so a created row matched by key beats a catalogue row matched by
 * name in the run, and lost to it here. Each wrong answer is a stop screen that
 * cannot be reconciled against File Explorer: a split lists one type twice, a
 * merge leaves one off, and the reorder names a stored type the run will not
 * file a single document on. The only version that cannot be wrong in any
 * direction is the run's own loop, so that is what this is.
 *
 * ⚠️ **THE CATALOGUE IS A SNAPSHOT AND THE RUN READS ITS OWN, and the window is
 * user-paced rather than a network hop** - the Evaluation screen, the property
 * step and the tag dialog all stand between them. Both directions are possible:
 * a type given a form in another tab turns a blocked run into one that would
 * have passed, and a type DELETED from Reference Data turns a passed run into
 * one that mints a formless replacement. (An earlier version of this paragraph
 * claimed the second could not happen "because nothing in this app removes a
 * form". Deletes became real in #29.04.) Re-reading here would shorten the
 * window, not close it, and the run's own read is the one that decides where
 * documents land - so the honest thing is to record it rather than to design
 * around it.
 *
 * NO ROMANIAN LIVES HERE. The verdict carries type NAMES, which are data, and
 * ids; every sentence around them is `messages/*.json`'s - the rule every
 * checker in this folder follows.
 *
 * Pure, client-safe, no DB and no React: the wizard calls it, and its test
 * calls it with the same shapes.
 */

import {
  catchAllType,
  classifiedLabelOf,
  resolveAgainstTypes,
  UNCLASSIFIED_DOCUMENT_TYPE_KEY,
  type ClassifierAnswer,
  type DocumentTypeCandidate,
} from "@/lib/documents/document-type-match";
import { documentTypeHasForm } from "@/lib/documents/status";
import { typeAwaitsForm } from "@/lib/import/discover-run";
import { ID_CARD_TYPE_KEYS, isIdCardTypeName } from "@/lib/import/id-card";

/**
 * A row of the document-type catalogue, as this gate needs it: the three
 * columns any resolver needs, plus the one column that answers the question.
 *
 * `templateFields` is `unknown` on purpose and is read only through
 * `documentTypeHasForm` - the same contract `bulk-import-dialog.tsx` holds it
 * under, and for the same reason.
 *
 * ⚠️ **`origin` is deliberately NOT here.** The route serves it and the
 * Reference Data list reads it, but nothing in the import does: an import cares
 * whether a type has a form, never who created it.
 */
export type DocumentTypeForGate = DocumentTypeCandidate & {
  /** `lookup_document_type.template_fields`, raw. */
  templateFields?: unknown;
};

/**
 * One entry the run will create a Document for, and what the classifier said
 * about it.
 *
 * ⚠️ **`answer: null` means "never classified", NOT "classified as nothing".**
 * A file that is not an image or a PDF is never sent, and a request that failed
 * came back with nothing to say - both land on the catch-all, and neither is a
 * type missing a form. The caller decides which entries are in this list; see
 * the wizard, where it is the entries left after the Pre-existing stage has
 * excused the ones the archive already holds.
 */
export type ClassifiedEntry = {
  /** The walk's path for the entry. Carried so the input reads as itself. */
  path: string;
  answer: ClassifierAnswer | null;
  /**
   * Did the scan read this document as an identity card?
   *
   * ⚠️ **THE WEAKER OF THE TWO SIGNALS, AND ONLY USED WHERE IT IS THE ONLY
   * ONE.** `discover-run.ts` states the rule this follows: the TYPE answers
   * whether a document is a card - its key, or a name that reads as one - and
   * the scan is fallen back on only for a type that does not exist yet, where
   * there is no row to ask. `isIdCardEntry` in `src/lib/import/id-card.ts` is
   * what produces it; the wizard calls that and passes the answer, so this
   * module stays free of `ScanResult`.
   */
  isIdCard?: boolean;
  /**
   * How sure the classifier said it was — `ScanResult.confidence`, carried
   * across unchanged.                                          (Slice #32.02)
   *
   * ⚠️ **NOTHING NEW IS ASKED OF THE MODEL FOR THIS.** The scan route already
   * returns it and the wizard already stores it on the `ScanResult` it hands
   * the table; this field only stops it being dropped on the way here, so the
   * stop screen can say how sure the answer behind a file was. Not one extra
   * token is billed for it.
   *
   * Optional, and an absent value is a sentence without a confidence clause —
   * never the word "undefined" on a screen.
   */
  confidence?: ClassifierConfidence;
};

/**
 * How sure the classifier said it was.                          (Slice #32.02)
 *
 * ⚠️ **DECLARED HERE RATHER THAN IMPORTED FROM `scan-table.tsx`.** That is a
 * `"use client"` component, and this module is pure and client-safe by
 * contract — the wizard is what carries a `ScanResult`'s value across, and the
 * two agree structurally. The same reason `ClassifiedEntry.isIdCard` is a
 * boolean here rather than a `ScanResult`.
 */
export type ClassifierConfidence = "high" | "medium" | "low";

/**
 * One file behind a type's count, and why it was read as that type.
 *                                                              (Slice #32.02)
 *
 * ⚠️ **EVERY FIELD IS SOMETHING THE APP ALREADY HELD.** `resolveAgainstTypes`
 * returns `how` on a match; the answer carries the key and the label; the scan
 * carries the confidence. Nothing here costs a request, and nothing here is a
 * second opinion about the type — the file is pushed by the same `addOrMerge`
 * that increments `documentCount`, in the same pass over the same list, so the
 * two cannot come to disagree about how many documents a type has.
 */
export type ClassifiedFile = {
  /** The walk's path for the entry, exactly as it arrived. */
  path: string;
  /**
   * Which of the three answers THIS file's own resolution was.
   *
   *  - `"key"` — the classifier's key is this type's key.
   *  - `"name"` — the label it read reads as this type's name.
   *  - `"none"` — nothing the archive holds carried that name, so the run
   *    would have created the type from the label.
   *
   * ⚠️ **`"key"` and `"name"` do NOT promise the type is STORED.** The second
   * document of a type this run would invent resolves against the row the loop
   * pushed a moment ago, exactly as the run's own loop does — so it is an
   * ordinary key or name match against a type that is not in the archive. The
   * sentence chosen for each says "this type" rather than "the archive", and
   * the row above it is what says whether the archive holds it. Wording that
   * claimed otherwise would be true of the first document of an invented type
   * and false of every one after it.
   */
  how: "key" | "name" | "none";
  /**
   * What the classifier itself gave — its KEY when `how` is `"key"`, and the
   * LABEL it read otherwise.
   *
   * The file's own answer, never the type's name: five documents folded into
   * one type print five justifications, and a sentence built from the type's
   * name would print the same line five times and teach the reader nothing.
   */
  said: string;
  /** How sure it said it was, when it said. */
  confidence?: ClassifierConfidence;
};

/** One document type this classification established, and what it costs. */
export type ClassifiedType = {
  /** `existing` - the archive holds it. `new` - the run would create it. */
  kind: "existing" | "new";
  /** The stored row's id, or `null` for a type that does not exist yet. */
  id: string | null;
  /** The stored row's name, or the label the model read. Data, not UI text. */
  name: string;
  /** Does it have a form? Always `false` for a `new` one, by construction. */
  hasForm: boolean;
  /**
   * Would ANY of this run's documents of this type report a form as missing?
   *
   * ⚠️ **`typeAwaitsForm`'s answer, ORed across the type's entries, and both
   * halves of that matter.** It is not `!hasForm`: the catch-all and an
   * identity card both have no form and neither is waiting for one. And it is
   * not one entry's answer applied to the whole type: the run asks the question
   * per DOCUMENT, and for a type the archive does not hold the scan's own
   * signal is part of the answer — so a folder holding one document the scan
   * read as a card and one it did not, both landing on one invented type, has a
   * document that would report a missing form. Taking the first entry's answer
   * for the type would make the verdict depend on walk order.
   */
  awaitsForm: boolean;
  /** How many of this run's entries would land on it. */
  documentCount: number;
  /**
   * The entries themselves, in walk order.                     (Slice #32.02)
   *
   * ⚠️ **`documentCount` IS NOT DERIVED FROM THIS, AND THAT IS DELIBERATE.**
   * The obvious tidy-up — dropping the number and rendering `files.length` —
   * would put a second place in charge of how many documents a type has, which
   * is the exact shape this module's header refuses. Both are written by one
   * `addOrMerge` in one pass, and `import-type-form-gate.test.ts` pins
   * `documentCount === files.length` so the day they diverge is a red test
   * rather than a screen.
   *
   * Walk order, for the reason the type list is in walk order: it is what makes
   * the list checkable line by line against File Explorer.
   */
  files: ClassifiedFile[];
};

/** What the classification established about this folder's document types. */
export type TypeFormVerdict = {
  /** Every type, in the order the walk first met one - never the model's. */
  types: readonly ClassifiedType[];
  /** The subset waiting for a form. Empty means the import may carry on. */
  missingForm: readonly ClassifiedType[];
  /**
   * Entries that will land on the catch-all — either because the model
   * declined, or because the file was never sent for classification at all.
   * Reported, never counted against.
   */
  unclassifiedCount: number;
  clean: boolean;
};

/**
 * Why the gate has no verdict.
 *
 * ⚠️ **TWO CAUSES, TWO SCREENS, AND ONE BUTTON THAT ONLY HELPS ONE OF THEM.**
 * They were one value until an adversarial round pointed out what that costs:
 *
 *  - `unreadable` — the request failed, timed out, or the session went. A
 *    second press may well succeed, and "try again" is the right offer.
 *  - `unusable` — the request answered, over a 200, with a list this gate
 *    cannot decide from: no rows at all, or no catch-all row. Pressing "try
 *    again" re-reads the same list and fails identically, for ever. What the
 *    user needs is the sentence that says what to put back, which
 *    `fetchDocTypes` has always thrown for the same two catalogues.
 *  - `session` — the request was answered by a sign-in page, or by a 401.
 *    ⚠️ **NOT a 403.** `isSessionLoss` is `redirected || status === 401` and
 *    `ai-interpret-run.ts` excludes 403 deliberately; a refusal that is about
 *    the ROLE rather than the session arrives here as `unreadable`, which
 *    over-offers a retry rather than under-offering one. Named so the next
 *    reader does not take this bullet for a promise the code does not make.
 *    ⚠️ **A third round added it, and the reason is money.** It arrives as the
 *    `session-expired` sentinel `fetchDocumentTypeCatalogue` throws, and
 *    everywhere else in the run that sentinel is mapped to a banner WITH A
 *    SIGN-IN LINK. Folded into `unreadable` it produced a screen telling the
 *    user to try again and then come back later — over a classification that
 *    has already been paid for and that starting again would pay for twice.
 *    Signing in and pressing the same button costs nothing, so the screen has
 *    to be the one that says so.
 */
export type TypeFormFailure = "unreadable" | "unusable" | "session";

/**
 * The gate's answer, or the fact that it has none.
 *
 * ⚠️ **THREE STATES, AND THE MIDDLE ONE IS THE WHOLE REASON THIS IS NOT A
 * `TypeFormVerdict | null`.** "Every type has a form" and "we could not find
 * out" produce completely different screens and must never produce the same one
 * - the identical argument `PreexistingResult` carries one stage earlier, in
 * the one place this codebase has already been bitten by collapsing them.
 * `null` is "not asked in this run"; `{ ok: false }` is "asked and no usable
 * answer came back"; `{ ok: true }` carries the verdict.
 */
export type TypeFormLookup =
  | { ok: true; verdict: TypeFormVerdict }
  | { ok: false; reason: TypeFormFailure };

/**
 * Can this gate decide from the catalogue it was handed at all?
 *
 * ⚠️ **BOTH REFUSALS ARE `fetchDocTypes`' OWN, and they are here so the two
 * cannot drift.** That function throws on an empty list and throws again when
 * `catchAllType` finds no row, each with a sentence telling Adrian what to do.
 * The gate meets the same two catalogues one screen earlier, and reading either
 * of them as data would be worse than the run's refusal rather than better: an
 * empty list makes every real label a `create`, so the stop screen would name
 * types that exist and have forms and send the user to build duplicates.
 */
export function catalogueIsUsable(rows: readonly DocumentTypeForGate[]): boolean {
  return rows.length > 0 && catchAllType(rows) !== null;
}

/**
 * Did the classification produce a single answer?
 *
 * ⚠️ **A RUN THAT CLASSIFIED NOTHING HAS NOTHING FOR THIS GATE TO DECIDE, and
 * an adversarial round found what forgetting that costs.** Two ordinary runs
 * send no images at all: a folder the archive already holds in its entirety —
 * re-offered in order to attach it to a new Property, which is the case #26.08
 * built `alreadyInSystem.linked` for — and a folder holding nothing a model can
 * read. Every document in both lands on the catch-all, so no type the
 * classifier named can be waiting for a form. Asking the archive for its list
 * of document types at that point can only produce a reason to stop a run that
 * cannot possibly create the thing this gate exists to prevent.
 *
 * The caller uses it to skip the request entirely, which is also why the
 * scanning panel does not sit there saying it is reading a list nobody needs.
 */
export function noClassificationHappened(entries: readonly ClassifiedEntry[]): boolean {
  return entries.every((entry) => entry.answer === null);
}

/**
 * May this import carry on?
 *
 * Exported so the wizard holds no copy of the rule that an unread catalogue
 * blocks. `null` and `{ ok: false }` both answer `false`, which is the
 * under-claiming direction and the one the whole gate exists to take: a run
 * that has not PROVED every type has a form has not earned the right to write
 * documents on them.
 */
export function typesAreClean(lookup: TypeFormLookup | null): boolean {
  return lookup !== null && lookup.ok && lookup.verdict.clean;
}

/**
 * Which document types this classification established, and which of them are
 * waiting for a form.
 */
export function checkTypeForms(input: {
  /** The entries this run will create a Document for. */
  entries: readonly ClassifiedEntry[];
  /** The archive's document types, with `templateFields`. */
  catalogue: readonly DocumentTypeForGate[];
}): TypeFormVerdict {
  const { entries, catalogue } = input;
  /**
   * The row the run files a document on when nothing resolved.
   *
   * ⚠️ **PASSED THOUGH IT CANNOT CURRENTLY FIRE, and that is a decision rather
   * than an oversight.** `matchDocumentType` refuses the catch-all by key and
   * refuses any row whose NAME means "unclassified", so no answer ever resolves
   * to it as a `match` and `typeAwaitsForm`'s fallback term is never the one
   * that excuses anything here — a test pins that. It is still passed honestly,
   * because the alternative is handing `null`, which that function reads as
   * "the fallback is not known": narrowing a shared rule's input at one call
   * site is how a caller starts holding a second opinion about it, which is the
   * whole thing this module refuses to do.
   */
  const fallbackTypeId = catchAllType(catalogue)?.id ?? null;

  // Insertion order is the walk's order, and `Map` preserves it - so the stop
  // screen lists types in the order the user's own folder produced them rather
  // than alphabetically or by count, which is what makes the list checkable
  // against File Explorer.
  const found = new Map<string, ClassifiedType>();
  /**
   * The list the run resolves against — the catalogue, PLUS the rows it would
   * have created, pushed in as it goes.
   *
   * ⚠️ **ONE LIST AND ONE `resolveAgainstTypes` CALL PER ENTRY, because that is
   * literally what `ensureDocType` does, and a fourth adversarial round proved
   * that anything else diverges.** Round three kept the created rows in a
   * SECOND list and consulted it only after the catalogue came back `create` —
   * which silently reorders the two passes inside `matchDocumentType`. That
   * function runs its KEY pass over the whole list before its NAME pass over
   * the whole list, so in the run a created row matched by key beats a
   * catalogue row matched by name; asking the catalogue first inverts it.
   *
   * Measured on a fuzz of every three-answer combination over a seeded-shape
   * catalogue: the two-list version diverged on 1,980 of 357,911, every one an
   * OVER-report — a stop screen naming a stored type the run would not file a
   * single document on, under a sentence saying one document in this folder is
   * of that type. This version diverges on 0 of 592,704.
   *
   * ⚠️ **`key` IS THE ANSWER'S KEY, WHICH IS THE BEST AVAILABLE GUESS AND IS
   * SAID TO BE ONE.** The server creates the row under
   * `canonicalTypeKey(typeKey)`, which this side cannot call; since #29.07 a
   * whitelisted key lands on a row under exactly that key, so the two agree for
   * every key the model was taught. `UNCLASSIFIED` is blanked rather than
   * stored: `matchDocumentType` refuses to NAME-match any row carrying it, so a
   * created row keeping it could never be folded into, and one type would be
   * listed twice under one name with `id: null` on both — which is also a
   * duplicate React key on the stop screen's list.
   */
  const items: DocumentTypeForGate[] = [...catalogue];
  /** Which of `items` this loop invented, so the two are told apart on a match. */
  const createdIds = new Set<string>();
  let unclassifiedCount = 0;

  for (const entry of entries) {
    if (entry.answer === null) {
      unclassifiedCount++;
      continue;
    }

    const resolution = resolveAgainstTypes(items, entry.answer);
    if (resolution.kind === "declined") {
      unclassifiedCount++;
      continue;
    }

    if (resolution.kind === "match") {
      // A row this loop invented for an earlier entry is still a row the run
      // would CREATE — one row, several documents — so it keeps its `new`
      // shape rather than being reported as something the archive holds.
      const row = resolution.row;
      const file = fileOf(entry, resolution.how);
      addOrMerge(found, "id:" + row.id, () =>
        createdIds.has(row.id)
          ? newTypeOf(row.name, entry, row.id, fallbackTypeId, file)
          : existingTypeOf(row, entry, fallbackTypeId, file),
      );
      continue;
    }

    // ⚠️ A stand-in id, and only two things are ever asked of it: that it is
    // not empty, and that it is not the catch-all's. `new:<n>` is neither, and
    // it cannot collide with a uuid.
    const row: DocumentTypeForGate = {
      id: "new:" + createdIds.size,
      key: createdKeyOf(entry.answer),
      name: resolution.name,
    };
    items.push(row);
    createdIds.add(row.id);
    addOrMerge(found, "id:" + row.id, () =>
      newTypeOf(row.name, entry, row.id, fallbackTypeId, fileOf(entry, "none")),
    );
  }

  const types = [...found.values()];
  const missingForm = types.filter((type) => type.awaitsForm);

  return {
    types,
    missingForm,
    unclassifiedCount,
    // `missingForm.length === 0` and not `types.every(...)`: an empty list of
    // types is a clean answer, and it is a real one - a folder of nothing but
    // unreadable files classifies nothing, creates nothing, and has no type
    // that could be waiting for a form.
    clean: missingForm.length === 0,
  };
}

/**
 * The key a created row is stored under — see the list's own note.
 *
 * `UNCLASSIFIED` is blanked because `matchDocumentType` refuses to name-match a
 * row carrying it, so a created row keeping it could never be folded into. An
 * absent key is `""`, which that function's key pass skips, leaving the name
 * pass — which is what the run falls back to as well.
 */
function createdKeyOf(answer: ClassifierAnswer): string {
  const typeKey = answer.typeKey?.trim() ?? "";
  return typeKey === UNCLASSIFIED_DOCUMENT_TYPE_KEY ? "" : typeKey;
}

/**
 * Add a type, or fold this entry into the one already there.
 *
 * ⚠️ **`awaitsForm` is ORed and everything else is kept from the FIRST entry.**
 * The count and the name belong to the type; the waiting belongs to a document,
 * and the run asks it per document — so a type is waiting if any of its
 * documents would say so. Taking the last entry's answer instead would make the
 * verdict depend on walk order, which is the shape of bug that survives every
 * manual pass because the fast path hides it.
 */
function addOrMerge(
  found: Map<string, ClassifiedType>,
  key: string,
  build: () => ClassifiedType,
): void {
  const already = found.get(key);
  const next = build();
  if (already === undefined) {
    found.set(key, next);
    return;
  }
  already.documentCount++;
  // ⚠️ **THE COUNT AND THE LIST MOVE TOGETHER, in one statement pair, for the
  // reason `ClassifiedType.files` gives: they are one fact about a type and a
  // screen that could show "5 documents" over four bullets is a screen nobody
  // can check against File Explorer. `next` is built per entry and therefore
  // carries exactly one file, so this appends exactly one.  (Slice #32.02)
  already.files.push(...next.files);
  already.awaitsForm = already.awaitsForm || next.awaitsForm;
}

/**
 * One entry, as the file behind a type's count.                (Slice #32.02)
 *
 * Everything here has already been paid for: `how` is `resolveAgainstTypes`'
 * own answer, the key and the label are the classifier's own, and the
 * confidence came back with the scan. Nothing is asked of the model.
 *
 * ⚠️ **THE `answer === null` BRANCH IS UNREACHABLE AND IS WRITTEN ANYWAY.** An
 * entry with no answer is counted as unclassified and `continue`s before this
 * is ever called. "Should be unreachable" is how the last three defects in the
 * wizard got in, so the fallbacks are real rather than a `!`.
 */
function fileOf(entry: ClassifiedEntry, how: ClassifiedFile["how"]): ClassifiedFile {
  const answer = entry.answer;
  // The key the CLASSIFIER gave, trimmed exactly as `matchDocumentType` trims
  // it before comparing — so a key match prints the string that did the
  // matching, not the row's spelling of it (they are equal, and printing the
  // answer's is what makes this the file's own justification).
  const typeKey = answer?.typeKey?.trim() ?? "";
  const label = answer === null ? null : classifiedLabelOf(answer);
  return {
    path: entry.path,
    how,
    said: how === "key" ? typeKey : (label ?? ""),
    confidence: entry.confidence,
  };
}

/** A type the archive already holds. */
function existingTypeOf(
  row: DocumentTypeForGate,
  entry: ClassifiedEntry,
  fallbackTypeId: string | null,
  file: ClassifiedFile,
): ClassifiedType {
  const hasForm = documentTypeHasForm(row.templateFields);
  return {
    kind: "existing",
    id: row.id,
    name: row.name,
    hasForm,
    awaitsForm: typeAwaitsForm({
      typeId: row.id,
      fallbackTypeId,
      typeHasForm: hasForm,
      // ⚠️ **THE SAME `||` THE RUN WRITES, TERM FOR TERM, AND AN ADVERSARIAL
      // ROUND IS WHY THE SECOND TERM IS HERE.** `bulk-import-dialog.tsx` asks
      // `docTypeIdCardRef.current.get(id) === true || isIdCardEntry(sr)`, and
      // that ref is built from exactly the key-and-name test on the left. The
      // first draft stopped at the left half on the grounds that `discover-run`
      // says the TYPE answers for a stored row — true of what SHOULD be asked,
      // and not of what the run asks. Dropping the scan term made the gate stop
      // imports the run would never have flagged: `Buletin de analiză`,
      // `Buletin de încercare` and `Copie CI` are ordinary formless types that
      // `isIdCardTypeName` deliberately refuses and `isIdCardLabel` accepts.
      // A gate that disagrees with the executor is worse than no gate.
      typeIsIdCard:
        (ID_CARD_TYPE_KEYS as readonly string[]).includes(row.key) ||
        isIdCardTypeName(row.name) ||
        entry.isIdCard === true,
    }),
    documentCount: 1,
    files: [file],
  };
}

/** A type nothing holds yet, which the run would create without a form. */
function newTypeOf(
  name: string,
  entry: ClassifiedEntry,
  syntheticId: string,
  fallbackTypeId: string | null,
  file: ClassifiedFile,
): ClassifiedType {
  return {
    // Not "we have not checked": there is no row to check. A type the run
    // would create cannot already have a form.
    kind: "new",
    id: null,
    name,
    hasForm: false,
    awaitsForm: typeAwaitsForm({
      // A stand-in, and only two things are ever asked of it: that it is not
      // empty, and that it is not the catch-all's id. The fold key is both.
      typeId: syntheticId,
      fallbackTypeId,
      typeHasForm: false,
      // ⚠️ **THE SCAN'S SIGNAL ALONE, AND A THIRD ROUND TOOK THE LABEL TEST
      // BACK OUT.** For a type the run CREATES, `docTypeIdCardRef` has no entry
      // — it is built once from the start-of-run list — so the run's expression
      // collapses to `isIdCardEntry(sr)` and nothing else. Keeping
      // `isIdCardTypeName(name)` here excused types the run would then flag: a
      // label like "Acte de identitate" passes that test and fails
      // `isIdCardLabel`, and `isIdCardEntry` short-circuits to false on any
      // non-card key without ever reading the label. The gate would have
      // promised no form was needed and the run would have spent a billed
      // discovery read on one. Agreement with the executor, again, over the
      // tidier rule.
      typeIsIdCard: entry.isIdCard === true,
    }),
    documentCount: 1,
    files: [file],
  };
}
