"use client";

/**
 * FolderForecast — the screen's promise, kept.   (Slice #24.02a)
 *
 * The folder has been walked. Nothing has been sent anywhere, nothing has been
 * written, and no classification call has been spent. This panel says what the
 * import is about to do, and **Continuă** is the first thing in the whole flow
 * that costs money.
 *
 * That ordering is the slice. Before it, `handlePickFolder` walked the folder
 * and started the classification pass in the same uninterrupted async block —
 * 451 Claude calls on Adrian's archive, spent by the act of choosing a folder,
 * before a single precondition had been checked or a single number shown.
 *
 * The button carries a count on purpose — a number argues better than a
 * warning, and a user who expected 330 has one thing to notice rather than a
 * paragraph to read. It carries the number the CLICK acts on, which is the
 * count of images about to be sent for classification, NOT the document total.
 * Pressing Continuă creates nothing: four more steps stand between here and
 * the first Document row, and a button that promised to create 357 documents
 * while spending 451 classification calls would be lying in both directions.
 * The document total is a line in the panel, where it belongs.
 *
 * Slice #24.02b fills the space below with the blockers, the skipped list and
 * the warnings. This is the frame they land in, and the forecast stays at the
 * top of it — shown even when everything passes.
 */

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

/**
 * The sentences on this screen that say what has and has not been spent.
 *
 * Deliberately louder than the fine print they used to be. These are the only
 * warning that the NEXT click is the one that costs money, and rendered as
 * muted 12px grey they read as boilerplate — the thing a user's eye is trained
 * to skip. Amber, italic and a size up puts them between body text and a
 * warning, which is what they are.
 *
 * Exported so the report panel's opening line gets the same treatment: three
 * sentences with one job should not be able to drift into three styles.
 */
export const COST_NOTE_CLASS =
  "text-sm font-medium italic text-amber-700 dark:text-amber-400";

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
      <h2 className="text-lg font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>
      <p className={`mt-1.5 ${COST_NOTE_CLASS}`}>{t("intro", { folder: rootFolderName })}</p>

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

      <p className={`mt-3 ${COST_NOTE_CLASS}`}>{t("nothingSpentYet")}</p>

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
          {t("continueButton", { count: classificationCalls })}
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
