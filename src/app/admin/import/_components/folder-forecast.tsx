"use client";

/**
 * FolderForecast — the Evaluation screen.   (Slice #24.02a, re-homed in #29.08)
 *
 * The folder has been walked, the archive has been asked, and — since #29.08 —
 * every document in it has been classified. Nothing has been written. This
 * panel says what the import is about to do, and **Continuă** goes on to the
 * Import stage, which is where the run is priced and where the one button that
 * writes to the archive lives.
 *
 * ⚠️ **THIS FILE'S HEADER USED TO SAY THE OPPOSITE, AND THE SENTENCE WAS THE
 * SLICE IT CAME FROM.** It read: "Continuă is the first thing in the whole flow
 * that costs money. That ordering is the slice." That was #24.02a's achievement
 * — before it, `handlePickFolder` walked the folder and started the
 * classification pass in the same uninterrupted async block, 451 Claude calls
 * on Adrian's archive spent by the act of choosing a folder, before a single
 * precondition had been checked or a single number shown.
 *
 * #29.08 did not undo that. The classification is still behind a press that
 * says what it will spend; the press moved one screen earlier, to the
 * Pre-existing panel, because the import has to know which document types a
 * folder holds BEFORE it can promise that each of them has a form to put a
 * document's information into. So the warning went with the press, and this
 * screen reports a classification that has happened instead of forecasting one
 * that has not. Leaving the old sentence here would have left the file's own
 * documentation describing a rule it no longer has — which is the failure
 * #29.02 had to fix once already, in `phase-dwell.ts`.
 *
 * ⚠️ **AND WHAT THIS PANEL DRAWS IS STILL COMPUTED FROM THE WALK, NOT FROM THE
 * CLASSIFICATION.** `forecastImport` reads names and structure and nothing
 * else — `preflight.ts` says so — so every number in the table below means
 * exactly what it meant before the reorder; what changed is that the images it
 * counts have now actually been sent. The classification's own answers reach
 * this screen through `ScanTable` underneath it, row by row, and nowhere else.
 * Saying "this screen reports the classification" without that qualification
 * would be the same overclaim the intro line used to make in the other
 * direction.
 *
 * ⚠️ **THE BUTTON NO LONGER CARRIES A COUNT, and losing it is the point rather
 * than an omission.** It carried the number the CLICK acted on — the images
 * about to be sent for classification — because a number argues better than a
 * warning. This click sends nothing and spends nothing, so a count on it could
 * only be a number about something else. The count moved to the sentence beside
 * the press that does spend, on the Pre-existing panel. The images that WERE
 * sent are still a line in the table below, where the rest of the run's
 * arithmetic lives.
 *
 * Slice #24.02b fills the space below with the blockers, the skipped list and
 * the warnings. This is the frame they land in, and the forecast stays at the
 * top of it — shown even when everything passes.
 */

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui/button-styles";
import type { ImportForecast } from "@/lib/import/preflight";

type Props = {
  rootFolderName: string;
  forecast: ImportForecast;
  /** Slice #24.02b: null when the metadata pass did not complete. */
  uploadBytes: number | null;
  /**
   * The folder's entries the archive already holds.   (Slice #26.08)
   *
   * ⚠️ **It is here because without it this panel can refuse a run it should
   * allow.** `forecast` counts what will be CREATED, and a folder the archive
   * holds in its entirety creates nothing — so `documents === 0`, which used to
   * mean "there is literally nothing to import" and disabled Continuă. Re-offer
   * an already-imported folder in order to attach it to a new Property (the
   * ordinary reason to do that) and the screen said the folder was empty while
   * the stage one click earlier had promised every document would be linked.
   *
   * ⚠️ **TWO numbers, and the second is what the button turns on.** `total` is
   * what the row reports; `linked` is the subset that will actually attach the
   * archived document to a Property this run creates. The rest — a `floating`
   * document, or a `common` one in a run that resolves no property — is a row
   * where genuinely NOTHING happens, and gating Continuă on `total` walked the
   * user through the property step, the tag dialog and the import dialog to
   * arrive at "0 documente importate" over a run that wrote nothing at all.
   */
  alreadyInSystem: { total: number; linked: number };
  droppedCount: number;
  onContinue: () => void;
  onChangeFolder: () => void;
  /** Re-walk the SAME folder — no picker dialog. See the button's comment. */
  onRecheck: () => void;
};

function formatMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1);
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-crease py-1.5 last:border-0 dark:border-zinc-800">
      <dt className="text-sm text-fade dark:text-zinc-400">{label}</dt>
      <dd className="font-mono text-sm text-ink dark:text-zinc-200">{value}</dd>
    </div>
  );
}

export function FolderForecast({
  rootFolderName,
  forecast,
  uploadBytes,
  alreadyInSystem,
  droppedCount,
  onContinue,
  onChangeFolder,
  onRecheck,
}: Props) {
  const t = useTranslations("adminImport.wizard.forecast");

  /**
   * Give the keyboard somewhere to land when this screen arrives.
   *                                                            (Slice #29.08)
   *
   * ⚠️ **IT NEEDS ONE NOW AND DID NOT BEFORE, and a fourth adversarial round
   * found both routes.** Until the reorder this panel was only ever reached by
   * pressing a button on the Pre-existing screen, so focus followed the press.
   * It is now reached twice without one: when the classification finishes and
   * the type gate passes, and when the stop screen's "Încearcă din nou"
   * succeeds — in that second case the wizard changes the phase in the same
   * commit that clears the busy flag, so the stop screen's own focus effect
   * never runs. Either way the panel that unmounted left focus on `<body>`, and
   * a heading that takes it is also what a screen reader reads out.
   *
   * The pattern is the four stage panels', copied rather than abstracted, for
   * the reason they give: RESTORES focus, never seizes it — only when focus is
   * on nothing at all.
   */
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    const active = typeof document === "undefined" ? null : document.activeElement;
    if (active === null || active === document.body) headingRef.current?.focus();
  }, []);

  const { documents, pageGroups, classificationCalls, coordinateCandidates } = forecast;

  /**
   * Is there anything for Continuă to do?   (Slice #26.08)
   *
   * Creating a Document is one thing worth doing and linking an existing one is
   * another, so the button is dead only when neither is on the table. See
   * `alreadyInSystem`.
   */
  const nothingToDo = documents === 0 && alreadyInSystem.linked === 0;

  // One candidate is the normal case and is named. Zero and several are both
  // worth saying out loud. (#24.02a guessed that #24.02b would turn "several"
  // into a blocker; it did not — that slice blocks nothing at all, and C-02 is
  // explicitly out of its scope. See the header of src/lib/import/checks.ts.)
  const coordinateValue =
    coordinateCandidates.length === 0
      ? t("noCoordinateFile")
      : coordinateCandidates.length === 1
        ? coordinateCandidates[0]
        : t("severalCoordinateFiles", { count: coordinateCandidates.length });

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      {/* `tabIndex={-1}` so the effect above can put the keyboard here on
          arrival. Not reachable by Tab, and NO `outline-none` — that class
          removes the ring for exactly the keyboard user this exists for. */}
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-semibold text-ink dark:text-zinc-100"
      >
        {t("title")}
      </h2>
      {/* ⚠️ Plain body text since #29.08, not `COST_NOTE_CLASS`. The amber
          treatment is reserved for a sentence about money, and this one no
          longer is: the spend happened one screen ago and the next click makes
          none. Leaving it amber would train the eye to ignore the treatment on
          the screen where it still means something.

          ⚠️ **TWO SENTENCES, AND THE SECOND IS NOT AN EDGE CASE.** Two ordinary
          runs reach this screen having sent nothing at all: a folder the
          archive already holds in its entirety, re-offered to attach it to a
          new Property, and a folder holding nothing a model can read. A single
          sentence saying the documents have been classified would then sit two
          rows above "Imagini pentru clasificare automată: 0". Found by the
          adversarial round. */}
      <p className="mt-1.5 text-sm text-ink dark:text-zinc-300">
        {classificationCalls > 0
          ? t("intro", { folder: rootFolderName })
          : t("introNothingSent", { folder: rootFolderName })}
      </p>

      <dl className="mt-4">
        <Row label={t("documents")} value={String(documents)} />
        {/* Only when there are any: a run with none should not have to read a
            row about a stage that found nothing. */}
        {alreadyInSystem.total > 0 && (
          <Row label={t("alreadyInSystem")} value={String(alreadyInSystem.total)} />
        )}
        <Row label={t("pageGroups")} value={String(pageGroups)} />
        <Row label={t("classificationCalls")} value={String(classificationCalls)} />
        <Row label={t("coordinateFile")} value={coordinateValue} />
        {/* Both parked in #24.02a for want of plumbing, both answerable now:
            the walk reports what it dropped, and the metadata pass has sized
            every file. */}
        <Row label={t("ignoredFiles")} value={String(droppedCount)} />
        {uploadBytes !== null && (
          <Row label={t("uploadSize")} value={t("megabytes", { mb: formatMb(uploadBytes) })} />
        )}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* The ONLY disabled case is an empty folder, where there is literally
            nothing to import. No finding in the report disables this button —
            see the header of src/lib/import/checks.ts for why the checker is
            advisory throughout. */}
        <button
          type="button"
          onClick={onContinue}
          disabled={nothingToDo}
          className={buttonClass({ variant: "primary", size: "lg" })}
        >
          {t("continueButton")}
        </button>
        {/* Slice #24.02c. The report is a to-do list acted on in Windows
            Explorer, so the expensive part of this loop was coming BACK: the
            user had to re-open the OS picker and find the folder again just to
            see whether their fix worked. The browser still holds the handle,
            so re-walking it is one click and no dialog — which is what turns
            the report from a snapshot into a checklist. */}
        <button
          type="button"
          onClick={onRecheck}
          className={buttonClass({ variant: "secondary", size: "md" })}
        >
          {t("recheckFolder")}
        </button>
        <button
          type="button"
          onClick={onChangeFolder}
          className={buttonClass({ variant: "secondary", size: "md" })}
        >
          {t("changeFolder")}
        </button>
        {nothingToDo && (
          <p role="status" className="text-sm text-red-700 dark:text-red-400">
            {/* Deliberately does not say "the folder is empty". The walk drops
                hidden files, Windows metadata and the eight ignored extensions
                before this panel ever sees them, so a folder holding nothing
                but a .zip and a .dwg walks to zero entries while looking full
                in Explorer. Slice #24.02b names those files; until then the
                copy must not claim a folder is empty when it is not. */}
            {t("nothingToImport")}
          </p>
        )}
      </div>
    </section>
  );
}
