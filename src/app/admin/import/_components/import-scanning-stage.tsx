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
};

export function ImportScanningStage({ folderName, progressLabel }: Props) {
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
        <ActivityCue progress>{progressLabel}</ActivityCue>
      </div>

      <p className="mt-3 text-xs text-fade dark:text-zinc-400">{t("waitHint")}</p>
    </section>
  );
}
