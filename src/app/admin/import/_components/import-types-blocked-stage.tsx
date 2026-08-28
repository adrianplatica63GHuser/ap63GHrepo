"use client";

/**
 * ImportTypesBlockedStage — where an import stops.              (Slice #29.08)
 *
 * WHAT THIS SCREEN IS
 * -------------------
 * The folder passed every check, the archive was asked, and the classification
 * has run. It found a document type with no form to put a document's
 * information into — either one the archive holds without a form, or one that
 * does not exist yet and that the run would have created without a form. So the
 * import stops here, names them, and sends the user to DocTypeEngine.
 *
 * ⚠️ **AN EXIT, NOT A PAUSE, AND THAT IS A DELIBERATE SIMPLIFICATION RATHER
 * THAN A SHORTCUT.** There is no "carry on anyway", no resume, and nothing
 * about this run is remembered. The whole preparation line — eight
 * preconditions, fifteen structure rules, six file rules, two copy rules and
 * four archive rules — costs nothing, so coming back and starting again once
 * the types have their forms is cheap. What it is NOT free of is the
 * classification, which has already been paid for and will be paid for again;
 * `nothingWritten` says so rather than implying the run cost nothing.
 *
 * ⚠️ **THE FAILED READ IS A STATE OF ITS OWN, and it is the same distinction
 * the Pre-existing screen makes one stage earlier.** "This type has no form"
 * and "we could not find out whether it has one" produce the same stop and must
 * never produce the same screen: the first is a list to act on, the second is
 * an error that a second press may well clear. So the failure branch gets its
 * own red block and its own button, and it is the ONE thing on this screen that
 * offers to try again — re-reading the archive's list of document types costs
 * nothing and resumes nothing, because the verdict is recomputed from
 * classification results the wizard is already holding.
 *
 * ⚠️ **THE TYPES ARE LISTED IN THE FOLDER'S OWN ORDER, not alphabetically and
 * not by count.** `checkTypeForms` builds them in walk order, which is what
 * makes the list checkable against File Explorer — the same argument every
 * violation list in this folder makes.
 *
 * ⚠️ **THE FILES BEHIND EACH TYPE ARE FOLDED, AND THE PAGE IS NOT.**
 * (Slice #32.02.) A type can carry two documents or two hundred, so each row
 * opens on a disclosure that is CLOSED on arrival — every row, including a row
 * with one file. There is no "open all", nothing is remembered across a retry,
 * and the list is not capped once it is open: the fold is the answer to length,
 * and a cap on top of a fold would be a second one. The saved page carries
 * every type, every path and every justification expanded, whatever is open on
 * screen — which is the whole reason a fold here is safe.
 *
 * ⚠️ **THE JUSTIFICATIONS COST NOTHING, AND THAT IS A CONSTRAINT RATHER THAN A
 * HAPPY ACCIDENT.** Each bullet says which key or which label the classifier
 * gave, whether that matched by key, matched by name or matched nothing, and
 * how sure it was — four facts `resolveAgainstTypes` and the scan had already
 * paid for. Nothing new is asked of the model: no `reason` field on
 * `CLASSIFY_SYSTEM_PROMPT` (it would be billed on every scanned file in every
 * folder, and would explain why a LABEL was read rather than why a file landed
 * on a TYPE), and not the classify route's `notes`, which is documented as a
 * note about EXTRACTION and is dropped by the wizard anyway.
 *
 * ⚠️ **THE THREE SENTENCES ARE THREE CALLS WITH THE KEY WRITTEN OUT, and a
 * computed key would be a green suite over a red screen.**
 * `import-types-blocked-copy.test.ts` scrapes THIS FILE for quoted keys handed
 * to the translator and demands the scraped set and
 * `REQUIRED_KEYS` be equal in both directions; a `t(`why.${kind}`)` is invisible
 * to that regex, so its keys would be reported as declared-but-unused. Every
 * key this panel asks for is written out, here and there.
 *
 * NOTHING IS DERIVED HERE. The verdict arrives complete; this file chooses
 * sentences for it. `type-form-gate.ts` holds no display text and this holds no
 * rule, which is the split every stage panel in this folder is built on.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { ActivityCue } from "@/components/activity-cue";
import { buttonClass } from "@/lib/ui/button-styles";
import { COST_NOTE_CLASS } from "@/lib/ui/cost-note";
import { displayPathOf } from "@/lib/import/folder-utils";
import {
  buildRulesPageHtml,
  groupedViolationBlocks,
  reportFileName,
} from "@/lib/import/report-html";
import { downloadHtmlFile, fileNameStamp } from "@/lib/ui/download-html";
import type {
  ClassifiedFile,
  ClassifiedType,
  TypeFormLookup,
} from "@/lib/import/type-form-gate";

type Props = {
  /** The folder that was classified. Never `""` when this panel is mounted. */
  folderName: string;
  /**
   * The gate's answer. Non-null by construction — the only route to this phase
   * is `phaseAfterClassification` refusing one — but it carries `{ ok: false }`
   * for a catalogue that could not be read, which is a different screen.
   */
  lookup: TypeFormLookup;
  /**
   * Read the archive's list of document types again and decide again. Offered
   * ONLY when the read FAILED — not when it succeeded and named a type without
   * a form. See the header for why that asymmetry is deliberate, and the slice
   * handover for the argument against it.
   */
  onRetry: () => void;
  /**
   * Is that re-read running right now?
   *
   * Only ever true on the failed-read branch, because that is the only branch
   * with a button that starts anything. Every control in the row goes inert
   * while it runs, including the two that leave — a fetch is in flight against
   * a token this screen does not own, and a reset under it would be the
   * overlapping-run failure `beginRun` exists to make impossible.
   */
  busy: boolean;
  /** Already translated by the caller, out of `adminImport.wizard`. */
  busyLabel: string;
  /**
   * How many times the gate has answered for this classification.
   *
   * Drawn only from the second attempt onwards. A retry that comes back with
   * the same reason leaves every sentence on this screen byte-identical to the
   * one before it, which reads as a dead button — and, in the wizard's live
   * region, is a text change that never happens and therefore an announcement
   * that never fires. See `typeGateAttempts` there.
   */
  attempt: number;
  /** End the run and go back to the beginning. Nothing to undo. */
  onLeave: () => void;
};

/**
 * The arrival state of every fold, shared rather than rebuilt.
 *
 * One frozen empty set, so "nothing is open" has one identity: the read above
 * returns it for a stale stamp, and a fresh `new Set()` there would change the
 * value of `openTypes` on every render for no reason at all.
 */
const NO_FOLDS_OPEN: ReadonlySet<string> = Object.freeze(new Set<string>());

export function ImportTypesBlockedStage({
  folderName,
  lookup,
  onRetry,
  busy,
  busyLabel,
  attempt,
  onLeave,
}: Props) {
  const t = useTranslations("adminImport.typesBlocked");
  const locale = useLocale();

  const verdict = lookup.ok ? lookup.verdict : null;
  /**
   * The types waiting for a form.
   *
   * ⚠️ **MEMOISED, and `react-hooks/exhaustive-deps` is why.** `?? []` builds a
   * fresh array on every render, and `handleSave` closes over it — so an
   * un-memoised default would change the identity of the Save handler on every
   * keystroke anywhere in the tree. The same fix the four sibling panels apply
   * to their own derived lists.
   */
  const missing = useMemo(() => verdict?.missingForm ?? [], [verdict]);
  const unclassifiedCount = verdict?.unclassifiedCount ?? 0;
  /**
   * Which failure, and therefore which sentence and whether "try again" helps.
   *
   * ⚠️ **A LIST THAT ANSWERED AND CANNOT BE USED IS NOT A LIST THAT COULD NOT
   * BE READ.** A request that failed may well succeed on a second press; a 200
   * carrying no document types, or none keyed UNCLASSIFIED, will answer exactly
   * the same way for ever, and what the user needs is the sentence saying what
   * to put back in Reference Data. Offering a button that cannot help is worse
   * than offering none.
   */
  const reason = lookup.ok ? null : lookup.reason;
  /**
   * A second press cannot change a list that answered and cannot be used, so
   * the button is not drawn for it. `session` DOES get one: signing in again in
   * another tab and pressing it costs nothing, where starting the import over
   * pays for the whole classification a second time.
   */
  const unusable = reason === "unusable";

  /**
   * Which types have been opened, and WHICH ANSWER they were opened against.
   *                                                            (Slice #32.02)
   *
   * A `Set` of the same keys the list renders on, so a type that does not exist
   * yet — which has no id — is keyed on its name, which `checkTypeForms` has
   * already made unique within this list by folding two spellings into one row.
   *
   * ⚠️ **THE ATTEMPT IS STORED BESIDE THE SET RATHER THAN RESET IN AN EFFECT,
   * and `react-hooks/set-state-in-effect` is why.** The first draft closed every
   * fold from a `useEffect` keyed on `attempt`; calling `setState` synchronously
   * in an effect body is a cascading render and the lint refuses it outright.
   * Stamping the set with the attempt it belongs to needs no effect at all: a
   * stamp that does not match the current one reads as the empty set, so a
   * verdict arriving afresh finds every fold closed by construction, with no
   * second render and nothing to keep in step.
   *
   * ⚠️ **AND IT IS NOT DEAD CODE, though today nothing can be open when it
   * fires.** The only button that raises `attempt` is drawn on the FAILED-READ
   * branch, which has no disclosures at all. The rule is "closed when the screen
   * arrives", not "closed the first time it arrives", and the day a retry is
   * offered beside a verdict is the day a remembered fold would show the
   * previous answer's files under this answer's counts.
   */
  const [fold, setFold] = useState<{ attempt: number; open: ReadonlySet<string> }>(() => ({
    attempt,
    open: NO_FOLDS_OPEN,
  }));
  const openTypes = fold.attempt === attempt ? fold.open : NO_FOLDS_OPEN;

  /**
   * The list key for a type — `id` for a stored one, the NAME for one that does
   * not exist yet. Used for the React key, for the fold and for nothing else,
   * so the three cannot come apart.
   */
  const keyOf = useCallback(
    (type: ClassifiedType): string => type.id ?? `new:${type.name}`,
    [],
  );

  const toggleType = useCallback(
    (key: string) => {
      setFold((prev) => {
        // A stamp from a previous answer is the empty set, exactly as the read
        // above treats it — so the first press after a fresh verdict opens one
        // type rather than re-opening the last answer's.
        const next = new Set(prev.attempt === attempt ? prev.open : NO_FOLDS_OPEN);
        if (!next.delete(key)) next.add(key);
        return { attempt, open: next };
      });
    },
    [attempt],
  );

  /**
   * The counted sentence a row carries — the same one on the screen and on the
   * saved page, from one call, so the two can never word it differently.
   */
  const rowSentence = useCallback(
    (type: ClassifiedType): string =>
      type.kind === "new"
        ? t("row.new", { count: type.documentCount })
        : t("row.existing", { count: type.documentCount }),
    [t],
  );

  /**
   * Why THIS file was read as this type — the one line under its path.
   *
   * ⚠️ **THREE SENTENCES, AND THERE HAVE TO BE THREE.** A type with five
   * documents behind it would otherwise print one byte-identical italic line
   * five times, which teaches the reader less than printing none. Each names
   * the file's OWN answer: the key it returned, or the label it read.
   *
   * ⚠️ **AND SIX CALLS WITH THE KEY WRITTEN OUT, RATHER THAN TWO COMPUTED
   * ONES.** See the
   * module header: the copy test scrapes this source for string literals, and a
   * template-literal key would take the suite red over a panel that is right.
   *
   * An absent confidence renders the sentence without its confidence clause —
   * never the word "undefined". `classifiedEntriesOf` only ever carries one for
   * a `done` scan, and a row that is not `done` has `answer: null` and never
   * reaches a type at all, so the fall-through should be unreachable; it is
   * written anyway.
   */
  const justificationOf = useCallback(
    (file: ClassifiedFile): string => {
      const why =
        file.how === "key"
          ? t("why.key", { said: file.said })
          : file.how === "name"
            ? t("why.name", { said: file.said })
            : t("why.none", { said: file.said });
      const sure =
        file.confidence === "high"
          ? t("confidence.high")
          : file.confidence === "medium"
            ? t("confidence.medium")
            : file.confidence === "low"
              ? t("confidence.low")
              : null;
      return sure === null ? why : `${why} ${sure}`;
    },
    [t],
  );

  /**
   * The take-away page — the same five symbols the other four panels use, and
   * no second exporter.                                        (Slice #32.02)
   *
   * ⚠️ **THE PAGE IS THE COMPLETE ARTEFACT AND THE SCREEN IS THE ONE THAT
   * FOLDS.** Every type, every file and every justification is on it, expanded,
   * in walk order, whatever is open or closed when the button is pressed — which
   * is exactly why the fold on screen is safe. A page mirroring the screen's
   * open/closed state would be the worst of both.
   *
   * ⚠️ **`clean: false`, `violations` never `null`, `sections` empty.** This
   * handler is only reachable from the verdict branch, where `missing` is
   * non-empty by construction — `phaseAfterClassification` is what mounted the
   * panel, and it mounts it only for a verdict that is not clean. So the
   * exporter's "not checked yet" and green all-clear pages cannot arise here,
   * and the three strings that would print them — `notCheckedYet`, `allClear`
   * and `blocked` — are not passed. Nor are the two headings this page has
   * nothing under: `rulesTitle` (the stage has no rules, so `sections` is `[]`
   * and #32.02 taught the exporter to leave the heading out rather than print
   * one with nothing beneath it) and `warningsTitle`.
   */
  const handleSave = useCallback(() => {
    const now = new Date();
    const html = buildRulesPageHtml({
      // Guarded although the panel is never mounted without one: `""` would
      // print a "Folder:" line with nothing after it.
      folderName: folderName === "" ? null : folderName,
      generatedAt: now.toLocaleString(locale),
      locale,
      // No rules to print. See `RulesPageStrings.rulesTitle`.
      sections: [],
      // One block per type carrying its name and its counted sentence and no
      // paths, then one block per file carrying that file's justification and
      // that file's single path — `groupedViolationBlocks` holds that shape, and
      // it holds it in the exporter so a test can reach it.
      violations: [
        ...groupedViolationBlocks(
          missing.map((type) => ({
            // The slot for "what this block is about". No `ruleId`: a document
            // type has no rule to quote, and a name in the ID chip would read
            // as a rule reference that does not exist.
            culprit: type.name,
            sentence: rowSentence(type),
            groups: type.files.map((file) => ({
              heading: justificationOf(file),
              paths: [displayPathOf(folderName, file.path)],
            })),
          })),
        ),
        /**
         * The unclassified line, in the place the screen puts it: under the
         * list, as the BARE COUNT it is there.       (Slice #32.02)
         *
         * ⚠️ **ON THE PAGE AS WELL AS ON THE SCREEN, and it names nothing.**
         * Without it a user checking this page against the folder finds files
         * sitting there that appear nowhere on it. Naming them would put a long
         * list needing no action beneath the one list that does — which is the
         * decision this slice was handed, and it holds on both.
         *
         * ⚠️ **AND NOT INSIDE THE NOTE BELOW.** An adversarial round put it
         * there and read the result: the first thing under the heading "Ce
         * urmează" was a sentence saying it is neither an action nor the reason
         * the import stopped, on the opposite side of that heading from where
         * the screen puts it. No `culprit` and no paths, so it cannot be read
         * as one more type.
         */
        ...(unclassifiedCount > 0
          ? [{ sentence: t("unclassified", { count: unclassifiedCount }), related: [] }]
          : []),
      ],
      // Not a claim we could make: this page's subject is an import that
      // stopped, and the all-clear is green.
      clean: false,
      warnings: [],
      /**
       * ⚠️ **THE PAGE CARRIES THE REMEDY AND THE TWO GREY LINES, and an
       * adversarial round is why.** The first draft passed the list and nothing
       * else, so the one artefact the user actually works from in File Explorer
       * said what was wrong and never said what to do about it — which is the
       * failure `RulesPageWarning.sentence` in `report-html.ts` already records
       * about the Constraints page, reappearing on a page with no rules to
       * carry the remedy in their place. `answersNote` is the wired slot for
       * it: a tinted block printed under the fix list, which is where these
       * sentences sit on the screen too.
       */
      answersNote: {
        heading: t("whatNextTitle"),
        lines: [t("whatNext"), t("nothingWritten")],
      },
      strings: {
        documentTitle: t("save.documentTitle"),
        generatedAt: t("save.generatedAt"),
        folderLabel: t("save.folderLabel"),
        violationsTitle: t("save.violationsTitle"),
      },
    });
    downloadHtmlFile(
      html,
      reportFileName(t("save.filePrefix"), folderName, fileNameStamp(now)),
    );
  }, [folderName, justificationOf, locale, missing, rowSentence, t, unclassifiedCount]);

  /**
   * Give the keyboard somewhere to land, and take it back when a retry ends.
   *
   * Copied deliberately from the four sibling stage panels rather than
   * abstracted out of them, and this screen needs it more than any of them:
   * it is the ONE screen in the flow that arrives without the user pressing
   * anything, so focus is wherever the panel that unmounted left it — which,
   * after `ImportPreexistingStage` goes, is `<body>`. `busy` also disables the
   * button the user just pressed, and a disabled element cannot hold focus.
   *
   * RESTORES focus; it does not seize it. Only when focus is on nothing at all.
   */
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const retryRef = useRef<HTMLButtonElement | null>(null);
  const wasBusy = useRef(false);
  const arrived = useRef(false);
  useEffect(() => {
    const finished = wasBusy.current && !busy;
    const justMounted = !arrived.current;
    arrived.current = true;
    wasBusy.current = busy;
    if (busy || (!finished && !justMounted)) return;
    const active = typeof document === "undefined" ? null : document.activeElement;
    const stranded = active === null || active === document.body;
    // ⚠️ **THE HEADING IS THE FALLBACK ON BOTH EDGES, and a third round found
    // the case that needs it: a retry that turns `unreadable` into `unusable`
    // unmounts the very button this would hand the keyboard back to, in the
    // same commit the effect runs in — so `retryRef.current` is null and,
    // without this, focus stays on `<body>` over a screen that has just
    // replaced all of its text.
    const target = justMounted ? headingRef : (retryRef.current ? retryRef : headingRef);
    if (stranded) target.current?.focus();
  }, [busy]);

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      {/* ⚠️ **NO `role="status"` HERE, and one was written and removed.** A
          live region inserted into the DOM together with its text is not
          reliably announced — the region has to exist before its content
          changes — and this whole panel mounts on the transition, so its own
          region would be exactly that. The wizard's permanently-mounted sr-only
          paragraph carries the announcement instead; the same argument
          `ImportStepGate` makes about itself one file over. */}

      {/* `tabIndex={-1}` so the effect above can put the keyboard here on
          arrival. Not reachable by Tab, and NO `outline-none` — that class
          removes the ring for exactly the keyboard user this exists for. */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-ink dark:text-zinc-100"
      >
        {verdict === null ? t("failed.title") : t("title")}
      </h2>
      <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">
        {t("folderLine", { folder: folderName })}
      </p>

      {/* -- The archive's list of types could not be read ------------------- */}
      {verdict === null && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
          {/* One sentence per cause, and they are three different remedies:
              try again, sign in and try again, or put the default type back.
              A shared sentence would have to be vague about all three. */}
          <p className="text-sm text-red-800 dark:text-red-300">
            {reason === "unusable"
              ? t("failed.unusableIntro")
              : reason === "session"
                ? t("failed.sessionIntro")
                : t("failed.unreadableIntro")}
          </p>
          {attempt > 1 && (
            <p className="mt-1 text-sm text-red-800 dark:text-red-300">
              {t("attempt", { n: attempt })}
            </p>
          )}
        </div>
      )}

      {/* -- The types that have no form ------------------------------------ */}
      {verdict !== null && (
        <>
          <p className="mt-3 text-sm text-ink dark:text-zinc-200">
            {t("intro", { count: missing.length })}
          </p>

          <h3 className="mt-5 text-sm font-semibold text-ink dark:text-zinc-100">
            {t("listTitle")}
          </h3>
          <ul className="mt-2 space-y-2">
            {missing.map((type) => {
              // `id` for a stored type, and the NAME for one that does not
              // exist yet — there is no id to key on, and `checkTypeForms`
              // has already folded two spellings of one name into one row, so
              // the name is unique within this list by construction.
              const key = keyOf(type);
              const open = openTypes.has(key);
              return (
              <li
                key={key}
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700/60 dark:bg-amber-950/30"
              >
                <p className="text-sm font-semibold text-ink dark:text-zinc-100">
                  {type.name}
                </p>
                <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-300">
                  {/* Two sentences, not one with a flag in it: a type the
                      archive already holds and a type this run would have
                      invented need different things said about them, and the
                      second is the one a user has never seen before. */}
                  {rowSentence(type)}
                </p>

                {/* ⚠️ **THE NAME SAYS WHICH TYPE, AND `aria-expanded` SAYS
                    WHETHER IT IS OPEN.** (Slice #32.02.) The type name is in the
                    label rather than left to the line above it, because a
                    screen-reader user moving button to button down this list
                    hears the buttons and not the paragraphs between them — a row
                    of identical "Arată fișierele" controls names nothing. No
                    `aria-controls`: the region is rendered only while it is
                    open, and an `aria-controls` pointing at an id that is not in
                    the document is worse than none — the same shape the four
                    sibling panels' disclosures already take. */}
                <button
                  type="button"
                  onClick={() => toggleType(key)}
                  aria-expanded={open}
                  // ⚠️ **`dark:text-amber-200`, AND IT IS NOT DECORATION.** An
                  // adversarial round measured the four sibling disclosures'
                  // bare `text-cta` at 1.65:1 in dark mode: `--color-cta` is
                  // `#334155` and `globals.css` never redefines it under
                  // `prefers-color-scheme: dark`, so this control — the whole
                  // screen half of the slice, repeated once per row on a tinted
                  // card — would have been a near-black smear on near-black
                  // while every static line around it carries its own `dark:`
                  // variant. The row's own palette supplies the answer;
                  // `dark:text-cta-light`, which six other call sites reach for,
                  // is defined nowhere and would have been the same bug spelled
                  // more confidently.
                  className="mt-1.5 text-sm font-medium text-cta underline-offset-2 hover:underline dark:text-amber-200"
                >
                  {open
                    ? t("files.hide", { type: type.name })
                    : t("files.show", { type: type.name })}
                </button>

                {open && (
                  // Walk order, uncapped. The fold is the answer to length; a
                  // cap on top of it would be a second one, and the list stops
                  // being checkable against File Explorer the moment it is
                  // silently shortened.
                  <ul className="mt-2 space-y-1.5 border-l border-amber-300 pl-3 dark:border-amber-700/60">
                    {type.files.map((file) => (
                      // The walk's own path, which is unique per entry: the
                      // wizard keys its scan results on it.
                      <li key={file.path}>
                        <p className="break-all font-mono text-xs text-ink dark:text-zinc-300">
                          {displayPathOf(folderName, file.path)}
                        </p>
                        <p className="mt-0.5 text-xs italic text-amber-800 dark:text-amber-300">
                          {justificationOf(file)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
              );
            })}
          </ul>

          {/* Said only when there are any. A run with none should not have to
              read a sentence about a group that is empty — and the sentence
              exists to stop the catch-all being mistaken for the reason the
              import stopped, which it never is. */}
          {unclassifiedCount > 0 && (
            <p className="mt-4 text-sm text-fade dark:text-zinc-400">
              {t("unclassified", { count: unclassifiedCount })}
            </p>
          )}

          <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">
              {t("whatNextTitle")}
            </h3>
            <p className="mt-1 text-sm text-ink dark:text-zinc-200">{t("whatNext")}</p>
          </div>

          {/* ⚠️ **THE TAKE-AWAY, AND ONLY ON THIS BRANCH.** (Slice #32.02.) The
              failed-read branch has no list to save, and a page saying nothing
              could be read is worse than no page — so the control is drawn
              inside the verdict fragment rather than beside the buttons below,
              where it would have to be guarded a second time. Not disabled by
              `busy` either: `busy` is only ever true on the branch this is not
              on. */}
          <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleSave}
              className={buttonClass({ variant: "secondary", size: "md" })}
            >
              {t("save.button")}
            </button>
            <p className="mt-1.5 text-xs text-fade dark:text-zinc-400">{t("save.hint")}</p>
          </div>
        </>
      )}

      {/* What this run did and did not cost. In the cost treatment because it
          is a statement about money and about what is in the archive — the two
          things this screen must not be vague about. */}
      <p className={`mt-4 ${COST_NOTE_CLASS}`}>{t("nothingWritten")}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* The failed read is the only branch with something worth pressing
            twice; a type without a form does not acquire one because the user
            pressed a button on this screen. */}
        {verdict === null && !unusable && (
          <button
            type="button"
            ref={retryRef}
            onClick={onRetry}
            disabled={busy}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {t("retry")}
          </button>
        )}

        <button
          type="button"
          onClick={onLeave}
          disabled={busy}
          className={buttonClass({
            variant: verdict === null ? "secondary" : "primary",
            size: verdict === null ? "md" : "lg",
          })}
        >
          {t("leave")}
        </button>

        {/* ⚠️ **"Alege alt folder…" STOOD HERE UNTIL #32.04, and nothing is
            stranded by its going.** It sat beside "Oprește importul" — the
            primary once a verdict is in — whose own hint two lines below says
            that button restarts everything from the beginning exactly as the
            first time. That is the journey this one offered as well, quieter
            and with none of the explanation. */}
        {busy && <ActivityCue>{busyLabel}</ActivityCue>}
      </div>

      <p className="mt-2 text-xs text-fade dark:text-zinc-400">{t("leaveHint")}</p>
    </section>
  );
}
