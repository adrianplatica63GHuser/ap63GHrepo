"use client";

/**
 * ReportSections — what the import will do that you did not ask for.
 * (Slice #24.02b)
 *
 * Sits under the forecast, inside the same folder-report phase. The forecast
 * answers "how much"; this answers "and will it do what I meant".
 *
 * **Nothing here blocks.** Continuă stays enabled no matter what is listed.
 * A checker that blocks needs an override, an override needs a rule for when
 * to use it, and the first false positive teaches the user to reach for it
 * every time — so this informs, and the user decides.
 *
 * Two loudness levels, not three, and the split is empirical. Measured on
 * Adrian's archive: warnings about how files are NAMED are almost always a
 * real accident with a one-action fix, and warnings caused by a SUBFOLDER are
 * almost always a property folder behaving exactly as intended. The quiet ones
 * are collapsed behind a disclosure rather than dropped, because "almost
 * always" is not "always" and the evidence should still be reachable.
 */

import { useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { buildReportHtml, reportFileName } from "@/lib/import/report-html";
import { downloadHtmlFile, fileNameStamp } from "@/lib/ui/download-html";
import { buttonClass } from "@/lib/ui/button-styles";
import type { ImportForecast } from "@/lib/import/preflight";
import type { Finding, ImportReport, SkippedGroup } from "@/lib/import/checks";

type Props = {
  report: ImportReport;
  /** Repeated in the downloadable copy, in full — including the rows the
   *  first draft dropped: the coordinate file and the upload size. */
  forecast: ImportForecast;
  uploadBytes: number | null;
  /**
   * How many of the folder's entries the archive already holds.
   * (Slice #26.08)
   *
   * The saved page is the artefact read later by someone who was not at the
   * screen, so it must not be the LESS complete of the two: without this row a
   * run that links forty existing documents and creates none prints "create 0,
   * upload 0.0 MB" and says nowhere that anything happens at all.
   */
  alreadyInSystem: number;
  folderName: string;
  /**
   * The two disclosures live in the PARENT so they survive a re-check. This
   * whole subtree unmounts while the folder is re-walked, so component state
   * would collapse every expanded section on each iteration of the exact
   * fix-and-re-check loop this slice was built for.
   */
  showQuiet: boolean;
  onShowQuietChange: (open: boolean) => void;
  showSkipped: boolean;
  onShowSkippedChange: (open: boolean) => void;
};

/** How many example paths one finding shows before it stops listing them. */
const MAX_PATHS_SHOWN = 4;

function FindingRow({ finding }: { finding: Finding }) {
  const t = useTranslations("adminImport.wizard.report");
  const loud = finding.loudness === "loud";
  const shown = finding.paths.slice(0, MAX_PATHS_SHOWN);
  const hidden = finding.paths.length - shown.length;

  return (
    <li
      className={[
        "rounded-md border px-3 py-2",
        loud
          ? "border-amber-300 bg-amber-50 dark:border-amber-700/60 dark:bg-amber-950/30"
          : "border-crease bg-paper dark:border-zinc-800 dark:bg-zinc-900/40",
      ].join(" ")}
    >
      <div className="flex items-baseline gap-2">
        <span
          className={[
            "shrink-0 font-mono text-[10px] uppercase tracking-wide",
            loud ? "text-amber-700 dark:text-amber-400" : "text-fade",
          ].join(" ")}
        >
          {finding.ruleId}
        </span>
        <p className={loud ? "text-sm text-ink dark:text-zinc-100" : "text-sm text-fade dark:text-zinc-400"}>
          {t(`finding.${finding.kind}`, finding.counts)}
        </p>
      </div>

      {shown.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 pl-1">
          {shown.map((p) => (
            <li key={p} className="truncate font-mono text-xs text-fade dark:text-zinc-500" title={p}>
              {p}
            </li>
          ))}
          {hidden > 0 && (
            <li className="text-xs italic text-fade">{t("morePaths", { count: hidden })}</li>
          )}
        </ul>
      )}
    </li>
  );
}

function SkippedSection({
  groups,
  open,
  onOpenChange,
}: {
  groups: SkippedGroup[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("adminImport.wizard.report");
  const total = groups.reduce((n, g) => n + g.paths.length, 0);
  if (total === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className="text-sm font-medium text-cta underline-offset-2 hover:underline"
      >
        {t("skippedToggle", { count: total })}
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {groups.map((g) => (
            <div key={g.reason}>
              <p className="text-xs font-semibold text-ink dark:text-zinc-200">
                {t(`skippedReason.${g.reason}`, { count: g.paths.length })}
              </p>
              <ul className="mt-1 space-y-0.5">
                {g.paths.slice(0, 20).map((p) => (
                  <li key={p} className="truncate font-mono text-xs text-fade dark:text-zinc-500" title={p}>
                    {p}
                  </li>
                ))}
                {g.paths.length > 20 && (
                  <li className="text-xs italic text-fade">
                    {t("morePaths", { count: g.paths.length - 20 })}
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReportSections({
  report,
  forecast,
  uploadBytes,
  alreadyInSystem,
  folderName,
  showQuiet,
  onShowQuietChange,
  showSkipped,
  onShowSkippedChange,
}: Props) {
  const t = useTranslations("adminImport.wizard.report");
  const tf = useTranslations("adminImport.wizard.forecast");
  const locale = useLocale();

  /**
   * Build the take-away copy and hand it to the browser as a download.
   *
   * Everything user-facing is translated HERE and passed in as plain strings:
   * `report-html.ts` must never become a second place Romanian lives. The
   * screen truncates each finding to four example paths; this does not
   * truncate at all, which is the point of having it.
   *
   * The screen is left exactly as it was afterwards. Downloading is not a
   * decision about what to do next — the user may fix the files and press
   * Verifică din nou, or continue anyway, and neither should be pre-empted.
   */
  const handleDownload = useCallback(() => {
    const now = new Date();
    const stamp = fileNameStamp(now);

    const html = buildReportHtml({
      folderName,
      generatedAt: now.toLocaleString(locale),
      report,
      locale,
      strings: {
        documentTitle: t("documentTitle"),
        generatedAt: t("documentGenerated"),
        folderLabel: t("documentFolder"),
        forecastTitle: tf("title"),
        forecastRows: [
          { label: tf("documents"), value: String(forecast.documents) },
          // Only when there are any — mirroring the on-screen panel, so the
          // page and the screen show the same rows for the same run.
          ...(alreadyInSystem > 0
            ? [{ label: tf("alreadyInSystem"), value: String(alreadyInSystem) }]
            : []),
          { label: tf("pageGroups"), value: String(forecast.pageGroups) },
          { label: tf("classificationCalls"), value: String(forecast.classificationCalls) },
          { label: tf("ignoredFiles"), value: String(report.droppedCount) },
          // The first draft stopped here and dropped both of these. The
          // coordinate file decides where the Property's corners come from —
          // the single most consequential line in the forecast.
          {
            label: tf("coordinateFile"),
            value:
              forecast.coordinateCandidates.length === 0
                ? tf("noCoordinateFile")
                : forecast.coordinateCandidates.join(", "),
          },
          ...(uploadBytes === null
            ? []
            : [{
                label: tf("uploadSize"),
                value: tf("megabytes", { mb: (uploadBytes / (1024 * 1024)).toFixed(1) }),
              }]),
        ],
        findingsTitle: t("title"),
        quietTitle: t("documentQuietTitle"),
        skippedTitle: t("documentSkippedTitle"),
        allClear: t("allClear"),
        nothingSkipped: t("documentNothingSkipped"),
        renderFinding: (kind, counts) => t(`finding.${kind}`, counts),
        renderSkippedReason: (reason, count) => t(`skippedReason.${reason}`, { count }),
      },
    });

    // Slice #26.04 moved the Blob/object-URL dance — and the next-tick revoke
    // that Firefox and Safari need — into `download-html.ts`, because the
    // Structure stage became the second place that saves a page.
    downloadHtmlFile(html, reportFileName(t("documentFilePrefix"), folderName, stamp));
  }, [folderName, forecast, uploadBytes, report, t, tf, locale]);

  const loud = report.findings.filter((f) => f.loudness === "loud");
  const quiet = report.findings.filter((f) => f.loudness === "quiet");
  const nothingToSay = report.findings.length === 0 && report.skipped.length === 0;

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>

      {nothingToSay ? (
        <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">{t("allClear")}</p>
      ) : (
        // Prominent, but NOT amber. Amber in this panel already means "this
        // is a warning" on the finding rows below, and this line's job is the
        // opposite — it says the import will run regardless. Same size, weight
        // and italics as the cost notes; different colour, because it carries
        // a different meaning.
        <p className="mt-1.5 text-sm font-medium italic text-ink dark:text-zinc-200">
          {t("intro")}
        </p>
      )}

      {loud.length > 0 && (
        <ul className="mt-3 space-y-2">
          {loud.map((f, i) => (
            <FindingRow key={`${f.ruleId}-${f.paths[0] ?? i}`} finding={f} />
          ))}
        </ul>
      )}

      {quiet.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => onShowQuietChange(!showQuiet)}
            aria-expanded={showQuiet}
            className="text-sm font-medium text-cta underline-offset-2 hover:underline"
          >
            {t("quietToggle", { count: quiet.length })}
          </button>
          {showQuiet && (
            <ul className="mt-2 space-y-2">
              {quiet.map((f, i) => (
                <FindingRow key={`${f.ruleId}-${f.paths[0] ?? i}`} finding={f} />
              ))}
            </ul>
          )}
        </div>
      )}

      <SkippedSection
        groups={report.skipped}
        open={showSkipped}
        onOpenChange={onShowSkippedChange}
      />

      {/* The take-away copy. Offered even when nothing was found, because
          "this folder is clean" is itself worth filing. */}
      <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={handleDownload}
          className={buttonClass({ variant: "secondary", size: "md" })}
        >
          {t("downloadButton")}
        </button>
        <p className="mt-1.5 text-xs text-fade dark:text-zinc-400">{t("downloadHint")}</p>
      </div>
    </section>
  );
}
