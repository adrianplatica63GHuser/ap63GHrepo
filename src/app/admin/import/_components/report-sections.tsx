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

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Finding, ImportReport, SkippedGroup } from "@/lib/import/checks";

type Props = { report: ImportReport };

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

function SkippedSection({ groups }: { groups: SkippedGroup[] }) {
  const t = useTranslations("adminImport.wizard.report");
  const [open, setOpen] = useState(false);
  const total = groups.reduce((n, g) => n + g.paths.length, 0);
  if (total === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
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

export function ReportSections({ report }: Props) {
  const t = useTranslations("adminImport.wizard.report");
  const [showQuiet, setShowQuiet] = useState(false);

  const loud = report.findings.filter((f) => f.loudness === "loud");
  const quiet = report.findings.filter((f) => f.loudness === "quiet");
  const nothingToSay = report.findings.length === 0 && report.skipped.length === 0;

  return (
    <section className="rounded-xl border border-card-rim bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>

      {nothingToSay ? (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{t("allClear")}</p>
      ) : (
        <p className="mt-1 text-xs text-fade dark:text-zinc-400">{t("intro")}</p>
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
            onClick={() => setShowQuiet((v) => !v)}
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

      <SkippedSection groups={report.skipped} />
    </section>
  );
}
