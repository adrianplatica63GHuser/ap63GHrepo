"use client";

/**
 * ResumedSessionView — Slice #21.01.Import (session-persistence fix)
 *
 * Displays the results of a PREVIOUS import session that was saved to
 * localStorage.  Shown when the user clicks "Resume last import" on the
 * wizard's idle screen.
 *
 * File System Access API handles are not available in a resumed session, so
 * the AI Interpret action is unavailable here.  The "Open →" links open each
 * document in a new tab, which is the primary use-case (the user navigated
 * away to inspect a document and wants to come back to the list).
 *
 * The "New import" button clears the saved session and returns to the idle
 * phase so the user can pick a fresh folder.
 */

import { useTranslations } from "next-intl";
import type { SavedImportEntry, SavedImportSession } from "@/lib/import/session";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function minutesAgo(isoString: string): number {
  return Math.round((Date.now() - new Date(isoString).getTime()) / 60_000);
}

function StatusBadge({ entry }: { entry: SavedImportEntry }) {
  // Reuse the same i18n keys as BulkImportDialog's ResultRow so the labels
  // stay consistent.
  const tD = useTranslations("adminImport.wizard.importDialog");

  if (entry.status === "done" && entry.docId) {
    return (
      <span className="inline-flex items-center gap-1.5">
        {entry.aiProcessed && (
          <span
            className="inline-flex items-center rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
            title={tD("aiProcessedBadge")}
          >
            ✓ AI
          </span>
        )}
        <a
          href={`/documents/${entry.docId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          {tD("viewLink")}
        </a>
      </span>
    );
  }
  if (entry.status === "error") {
    return (
      <span
        className="text-xs text-red-600 dark:text-red-400"
        title={entry.errorMsg}
      >
        {tD("errorShort")}
      </span>
    );
  }
  return <span className="text-xs text-fade">—</span>;
}

function ConfidenceDot({ confidence }: { confidence?: "high" | "medium" | "low" }) {
  if (!confidence) return null;
  const cls =
    confidence === "high"   ? "bg-emerald-500" :
    confidence === "medium" ? "bg-amber-400"   :
                              "bg-red-500";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${cls} mr-1 flex-shrink-0`}
      title={confidence}
    />
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  session:  SavedImportSession;
  onClear:  () => void;
};

export function ResumedSessionView({ session, onClear }: Props) {
  const t = useTranslations("adminImport.wizard");
  const mins = minutesAgo(session.savedAt);

  const doneCount  = session.entries.filter((e) => e.status === "done").length;
  const errorCount = session.entries.filter((e) => e.status === "error").length;

  return (
    <div className="space-y-3">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40">
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t("resumedTitle", { folder: session.rootFolderName })}
          </p>
          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
            {t("resumedAge", { minutes: mins })}
            {" · "}
            {doneCount} {t("resumedDone")}
            {errorCount > 0 && ` · ${errorCount} ${t("resumedErrors")}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:bg-transparent dark:text-amber-300 dark:hover:bg-amber-900/30"
        >
          {t("resumedNewImport")}
        </button>
      </div>

      {/* Hint */}
      <p className="text-xs text-fade">
        {t("resumedHint")}
      </p>

      {/* Results table */}
      <div className="overflow-x-auto rounded-xl border border-card-rim bg-white dark:border-zinc-700 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-crease text-left text-xs font-semibold uppercase tracking-wide text-fade dark:border-zinc-700">
              <th className="px-4 py-2 pr-3">{t("colPath")}</th>
              <th className="px-4 py-2 pr-3">{t("colDescription")}</th>
              <th className="w-24 px-4 py-2">{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {session.entries.map((entry) => (
              <tr
                key={entry.path}
                className={[
                  "border-b border-crease dark:border-zinc-800",
                  entry.status === "error" ? "bg-red-50/40 dark:bg-red-950/20" : "",
                ].join(" ")}
              >
                {/* Name + path */}
                <td className="px-4 py-2 pr-3 min-w-0">
                  <span
                    className="block truncate font-mono text-xs text-ink dark:text-zinc-200"
                    title={entry.path}
                  >
                    {entry.displayName}
                  </span>
                  <span className="text-[10px] text-fade">{entry.path}</span>
                </td>

                {/* AI scan description */}
                <td className="px-4 py-2 pr-3 min-w-0 max-w-xs">
                  {entry.scanDescription ? (
                    <span className="flex items-start gap-1 text-xs text-ink dark:text-zinc-300">
                      <ConfidenceDot confidence={entry.confidence} />
                      <span className="line-clamp-2">{entry.scanDescription}</span>
                    </span>
                  ) : (
                    <span className="text-xs text-fade">—</span>
                  )}
                </td>

                {/* Status / link */}
                <td className="px-4 py-2">
                  <StatusBadge entry={entry} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
