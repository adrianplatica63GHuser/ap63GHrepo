"use client";

/**
 * CancelImportDialog — what renouncing the import leaves behind. (Slice #26.03)
 *
 * The shell's Cancel is available at every stage, and the rule attached to it
 * is that it states the consequences BEFORE it acts. A plain "are you sure?"
 * would fail that on the one state where it matters: after the bulk import has
 * run, cancelling leaves real documents in the archive, and a user who was only
 * asked whether they were sure has been told nothing about them.
 *
 * The sentences are chosen by `cancelConsequences`, a pure function over the
 * facts of the run — see `src/lib/import/cancel-consequences.ts` for why the
 * choosing does not happen here.
 *
 * Escape keeps the import, and the destructive button is `danger` and says what
 * it does ("Da, renunț la import") rather than "OK": the two buttons must be
 * distinguishable by their labels alone, because that is all a user re-reading
 * the dialog has.
 *
 * FOCUS GOES TO THE PANEL, NOT TO THE SAFE BUTTON. Focusing the safe button
 * looks like the careful choice and is the opposite: the user arrives here by
 * CLICKING, and a browser does not match `:focus-visible` on a programmatic
 * focus that follows a pointer interaction — so `buttonClass`'s ring (which is
 * `focus-visible:` only, deliberately) never paints. That leaves a button armed
 * for Enter with nothing on screen saying so, next to a destructive twin.
 * Focusing the panel gives the screen reader the dialog and arms nothing.
 *
 * The BACKGROUND is made inert by `ImportWizard`, not by this file. It has to
 * be: without it, a Tab or two from here reaches the Import button behind the
 * overlay, and Enter there walks the user into the property step, the tag step
 * and the bulk import with this dialog still open and still showing the facts
 * it froze before any of it happened.
 */

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { buttonClass } from "@/lib/ui/button-styles";
import {
  cancelConsequences,
  type CancelConsequenceTone,
  type CancelFacts,
} from "@/lib/import/cancel-consequences";

type Props = {
  facts: CancelFacts;
  /** Name of the stage the user is cancelling from, already translated. */
  stageLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
};

/**
 * Tone → the marker in front of the line. Deliberately not a colour alone:
 * "stays in the system" and "is given up" are opposite facts and must be
 * distinguishable in a screenshot, in monochrome and to a colour-blind reader.
 */
const TONE_GLYPH: Record<CancelConsequenceTone, string> = {
  keeps: "▲",
  loses: "✕",
  safe: "✓",
};

const TONE_TEXT: Record<CancelConsequenceTone, string> = {
  keeps: "text-amber-800 dark:text-amber-300",
  loses: "text-ink dark:text-zinc-300",
  safe: "text-emerald-700 dark:text-emerald-400",
};

export function CancelImportDialog({
  facts,
  stageLabel,
  onConfirm,
  onDismiss,
}: Props) {
  const t = useTranslations("adminImport.cancel");
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape keeps the import. The safe branch is the one a reflex should reach,
  // and a dialog whose Escape destroyed the run would be the opposite.
  //
  // `stopPropagation` is not available here (the listener is on `window`, so
  // there is nothing left to stop), which is why the wizard makes this dialog
  // unreachable while another Escape-listening dialog is open: two window-level
  // handlers would both fire on one press, dismissing this one AND cancelling
  // the dialog underneath it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  // Move focus into the dialog. Giving it BACK is the wizard's job, not this
  // component's: the commit that mounts this dialog also marks the wizard's
  // content inert, and the HTML focus-fixup rule blurs a focused element the
  // moment it gains an inert ancestor — so an opener captured here would
  // already be `body`. `ImportWizard` captures it in the click handler instead.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const consequences = cancelConsequences(facts);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ga-cancel-import-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="w-full max-w-lg rounded-xl border border-card-rim bg-white shadow-xl outline-none dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="border-b border-card-rim px-5 py-4 dark:border-zinc-700">
          <h2
            id="ga-cancel-import-title"
            className="text-base font-semibold text-ink dark:text-zinc-100"
          >
            {t("title")}
          </h2>
          <p className="mt-1 text-xs text-fade dark:text-zinc-400">
            {t("atStage", { stage: stageLabel })}
          </p>
        </div>

        <div className="space-y-3 px-5 py-5">
          <p className="text-sm text-ink dark:text-zinc-300">{t("intro")}</p>

          <ul className="space-y-2">
            {consequences.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={["mt-0.5 shrink-0", TONE_TEXT[c.tone]].join(" ")}
                >
                  {TONE_GLYPH[c.tone]}
                </span>
                <span className={TONE_TEXT[c.tone]}>
                  {t(`consequence.${c.id}`)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-card-rim px-5 py-3 dark:border-zinc-700">
          <button
            type="button"
            onClick={onDismiss}
            className={buttonClass({ variant: "secondary", size: "lg" })}
          >
            {t("keepGoing")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={buttonClass({ variant: "danger", size: "lg" })}
          >
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
