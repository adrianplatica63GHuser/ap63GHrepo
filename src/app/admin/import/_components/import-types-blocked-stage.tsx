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
 * NOTHING IS DERIVED HERE. The verdict arrives complete; this file chooses
 * sentences for it. `type-form-gate.ts` holds no display text and this holds no
 * rule, which is the split every stage panel in this folder is built on.
 */

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { ActivityCue } from "@/components/activity-cue";
import { buttonClass } from "@/lib/ui/button-styles";
import { COST_NOTE_CLASS } from "@/lib/ui/cost-note";
import type { TypeFormLookup } from "@/lib/import/type-form-gate";

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
  /** The folder may simply have been the wrong one; re-enters at Structure. */
  onChooseFolder: () => void;
};

export function ImportTypesBlockedStage({
  folderName,
  lookup,
  onRetry,
  busy,
  busyLabel,
  attempt,
  onLeave,
  onChooseFolder,
}: Props) {
  const t = useTranslations("adminImport.typesBlocked");

  const verdict = lookup.ok ? lookup.verdict : null;
  const missing = verdict?.missingForm ?? [];
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
            {missing.map((type) => (
              <li
                // `id` for a stored type, and the NAME for one that does not
                // exist yet — there is no id to key on, and `checkTypeForms`
                // has already folded two spellings of one name into one row, so
                // the name is unique within this list by construction.
                key={type.id ?? `new:${type.name}`}
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
                  {type.kind === "new"
                    ? t("row.new", { count: type.documentCount })
                    : t("row.existing", { count: type.documentCount })}
                </p>
              </li>
            ))}
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

        <button
          type="button"
          onClick={onChooseFolder}
          disabled={busy}
          className={buttonClass({ variant: "secondary", size: "md" })}
        >
          {t("chooseAnotherFolder")}
        </button>

        {busy && <ActivityCue>{busyLabel}</ActivityCue>}
      </div>

      <p className="mt-2 text-xs text-fade dark:text-zinc-400">{t("leaveHint")}</p>
    </section>
  );
}
