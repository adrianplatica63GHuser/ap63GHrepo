"use client";

/**
 * ImportScanningStage — the Scanning stage's screen.   (Slice #26.09)
 *
 * WHAT MOVED, AND WHAT DID NOT
 * ----------------------------
 * The scan itself is untouched: same `startScan`, same three-at-a-time Haiku
 * calls, same `ScanTable` under this panel. The brief's word for this slice is
 * "re-homed", and this is the home — until now the running scan announced
 * itself as a bare sentence in the wizard's toolbar row, a leftover of the flow
 * that existed before the shell did. Every other stage says what it is doing in
 * a panel of its own, and a stage that does not is the one the user reads as
 * "nothing is happening".
 *
 * There is NOTHING TO PRESS here, deliberately. The scan is the one stage that
 * neither asks the user for anything nor waits for them: it runs to the end and
 * hands over to Import. The way out is the Cancel in the stage bar, which is
 * where it is on every other stage, and saying so here would be a fourth copy
 * of a sentence the Information page already made.
 *
 * ⚠️ **`done` IS NOT A SPINNER SWITCH — IT IS WHAT STOPS THIS PANEL LYING.**
 * Slice #29.02 lets the user hold the flow after each stage that passes, and
 * the scan is one of the six. Held, this panel is on screen over a scan that
 * has FINISHED, and two things it says become false at once: `ActivityCue`
 * announces itself as live work to a screen reader and animates for a reader
 * who can see it, and `waitHint` tells the user to wait for something that is
 * over and to use Cancel if they change their mind — when the thing they should
 * do is press the button in the card below. So `done` drops both. The progress
 * line stays, as plain text: "scanate 12 din 12" is the stage's result, and the
 * result is the one thing worth keeping on a screen the user is being asked to
 * read before moving on. It still has NOTHING TO PRESS — the button belongs to
 * the pause, not to the stage.
 *
 * The PROGRESS LINE is handed in already translated, exactly as the four stage
 * panels before it take their busy label — that keeps the running count in
 * `adminImport.wizard`, the one place it has ever lived, so no wording changed
 * and no e2e locator moved. The panel's own copy is its own namespace.
 */

import { useTranslations } from "next-intl";

import { ActivityCue } from "@/components/activity-cue";

type Props = {
  folderName: string;
  /** Already translated by the caller, from the wizard's own namespace. */
  progressLabel: string;
  /**
   * Has the scan finished, with the flow held here?   (Slice #29.02)
   *
   * Defaulted, so every caller that does not know about step-through — and the
   * tests that render this panel on its own — keeps exactly today's screen.
   */
  done?: boolean;
};

export function ImportScanningStage({
  folderName,
  progressLabel,
  done = false,
}: Props) {
  const t = useTranslations("adminImport.scanning");

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>
      <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">
        {t("intro", { folder: folderName })}
      </p>

      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink dark:text-zinc-300">
        <li>{t("whatItReads")}</li>
        <li>{t("whatItWrites")}</li>
      </ul>

      <div className="mt-4">
        {done ? (
          <p className="text-sm font-medium text-ink dark:text-zinc-200">
            {progressLabel}
          </p>
        ) : (
          <ActivityCue progress>{progressLabel}</ActivityCue>
        )}
      </div>

      {!done && (
        <p className="mt-3 text-xs text-fade dark:text-zinc-400">{t("waitHint")}</p>
      )}
    </section>
  );
}
