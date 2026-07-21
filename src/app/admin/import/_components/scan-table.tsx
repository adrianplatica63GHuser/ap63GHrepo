"use client";

/**
 * ScanTable — Slice #21.01.Import
 *
 * Displays the full recursive list of files found in the picked folder.
 * Each row shows the path relative to the root, the Haiku AI description
 * (once scanned), property-folder metadata (tarla/parcela) when applicable,
 * page count for page-group entries, and a status badge.
 *
 * Non-scannable files (not image/PDF) are rendered at reduced opacity.
 */

import { useTranslations } from "next-intl";
import { parseFolderName, perToSlash } from "@/lib/import/folder-utils";
import type { FSEntry } from "@/lib/import/folder-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScanStatus =
  | "pending"
  | "converting"
  | "scanning"
  | "done"
  | "skip"
  | "error";

export type ScanResult = {
  status: ScanStatus;
  /** classifiedLabel returned by Haiku */
  description?: string;
  typeKey?: string | null;
  confidence?: "high" | "medium" | "low";
  extractable?: boolean;
  errorMsg?: string;
};

type Props = {
  entries: FSEntry[];
  rootFolderName: string;
  scanResults: Map<string, ScanResult>;
};

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

type EntryGroup = {
  /** pathParts[0] — the first-level property subfolder name */
  key:     string;
  entries: FSEntry[];
};

/**
 * Slice #21.02.Import: partition entries into property-subfolder groups and an
 * ungrouped remainder.
 *
 * An entry belongs to a group when its first path segment (`pathParts[0]`) is
 * itself a property folder (starts with a digit, matches the tarla-parcela
 * pattern). All such entries are collected per first segment; everything else
 * goes into `ungrouped`.
 */
function partitionEntries(entries: FSEntry[]): {
  groups:     EntryGroup[];
  ungrouped:  FSEntry[];
} {
  const groupMap = new Map<string, FSEntry[]>();
  const ungrouped: FSEntry[] = [];

  for (const entry of entries) {
    const first = entry.pathParts[0];
    if (first && parseFolderName(first).isPropertyFolder) {
      const arr = groupMap.get(first) ?? [];
      arr.push(entry);
      groupMap.set(first, arr);
    } else {
      ungrouped.push(entry);
    }
  }

  const groups: EntryGroup[] = [];
  for (const [key, groupEntries] of groupMap.entries()) {
    groups.push({ key, entries: groupEntries });
  }

  return { groups, ungrouped };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScanTable({ entries, rootFolderName, scanResults }: Props) {
  const t = useTranslations("adminImport.wizard");

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-fade dark:text-zinc-500">
        {t("noEntries")}
      </p>
    );
  }

  const { groups, ungrouped } = partitionEntries(entries);

  const tableHeader = (
    <thead>
      <tr className="border-b border-crease text-left text-xs font-semibold uppercase tracking-wide text-fade dark:border-zinc-700">
        <th className="pb-2 pr-3">{t("colPath")}</th>
        <th className="w-56 pb-2 pr-3">{t("colDescription")}</th>
        <th className="w-36 pb-2 pr-3 hidden md:table-cell">{t("colFolderInfo")}</th>
        <th className="w-28 pb-2">{t("colStatus")}</th>
      </tr>
    </thead>
  );

  // When there are no property-folder groups, render a single flat table (original layout).
  if (groups.length === 0) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm" aria-label={rootFolderName}>
          {tableHeader}
          <tbody>
            {ungrouped.map((entry) => (
              <ScanRow
                key={entry.path}
                entry={entry}
                result={scanResults.get(entry.path)}
                t={t}
                stripPrefix={null}
              />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Grouped layout: one table per group, then ungrouped at the bottom.
  return (
    <div className="space-y-6">
      {groups.map(({ key, entries: groupEntries }) => (
        <div key={key}>
          {/* Group header — rootFolderName / perToSlash(key) */}
          <p className="mb-1 text-xs font-semibold text-ink dark:text-zinc-200">
            <span className="text-fade dark:text-zinc-400">{rootFolderName}</span>
            {" / "}
            <span>{perToSlash(key)}</span>
          </p>
          <div className="overflow-x-auto rounded border border-crease dark:border-zinc-700">
            <table className="w-full text-sm" aria-label={`${rootFolderName} / ${perToSlash(key)}`}>
              {tableHeader}
              <tbody>
                {groupEntries.map((entry) => (
                  <ScanRow
                    key={entry.path}
                    entry={entry}
                    result={scanResults.get(entry.path)}
                    t={t}
                    stripPrefix={key}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {ungrouped.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold text-fade dark:text-zinc-400">
            {rootFolderName}
          </p>
          <div className="overflow-x-auto rounded border border-crease dark:border-zinc-700">
            <table className="w-full text-sm" aria-label={rootFolderName}>
              {tableHeader}
              <tbody>
                {ungrouped.map((entry) => (
                  <ScanRow
                    key={entry.path}
                    entry={entry}
                    result={scanResults.get(entry.path)}
                    t={t}
                    stripPrefix={null}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScanRow
// ---------------------------------------------------------------------------

type RowProps = {
  entry: FSEntry;
  result: ScanResult | undefined;
  t: ReturnType<typeof useTranslations<"adminImport.wizard">>;
  /** Slice #21.02.Import: when set, strip this prefix + "/" from the
   *  displayed path so the group folder name isn't repeated in each row. */
  stripPrefix: string | null;
};

function ScanRow({ entry, result, t, stripPrefix }: RowProps) {
  const isSkipped = result?.status === "skip";

  // Strip the group folder prefix from the displayed path.
  const displayPath =
    stripPrefix && entry.path.startsWith(stripPrefix + "/")
      ? entry.path.slice(stripPrefix.length + 1)
      : entry.path;

  return (
    <tr
      className={[
        "border-b border-crease dark:border-zinc-800",
        isSkipped ? "opacity-40" : "",
      ].join(" ")}
    >
      {/* Path */}
      <td className="py-2 pr-3 min-w-0 max-w-xs">
        <span
          className="block truncate font-mono text-xs text-ink dark:text-zinc-200"
          title={entry.path}
        >
          {displayPath}
        </span>
        {entry.kind === "page-group" && (
          <span className="mt-0.5 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {t("pageGroupLabel", { count: entry.handles.length })}
          </span>
        )}
      </td>

      {/* AI Description + confidence badge (7.8) */}
      <td className="py-2 pr-3">
        {result?.description ? (
          <div className="space-y-0.5">
            <span className="text-xs text-ink dark:text-zinc-200">
              {result.description}
            </span>
            {result.confidence && (
              <ConfidenceBadge confidence={result.confidence} t={t} />
            )}
          </div>
        ) : result?.errorMsg ? (
          <span
            className="text-xs text-red-600 dark:text-red-400"
            title={result.errorMsg}
          >
            {result.errorMsg}
          </span>
        ) : null}
      </td>

      {/* Folder info (tarla/parcela) — hidden on small screens */}
      <td className="py-2 pr-3 hidden md:table-cell">
        <FolderInfoCell entry={entry} />
      </td>

      {/* Status badge */}
      <td className="py-2">
        <StatusBadge result={result} t={t} />
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// FolderInfoCell — shows tarla/parcela for property-folder entries
// ---------------------------------------------------------------------------

function FolderInfoCell({ entry }: { entry: FSEntry }) {
  const fi = entry.folderInfo;
  if (!fi?.isPropertyFolder || (!fi.tarlaSola && !fi.parcela)) return null;

  const parts: string[] = [];
  if (fi.tarlaSola) parts.push("T " + perToSlash(fi.tarlaSola));
  if (fi.parcela)   parts.push("P " + perToSlash(fi.parcela));

  return (
    <span className="text-xs text-fade dark:text-zinc-400">
      {parts.join(" / ")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ConfidenceBadge (7.8) — coloured indicator for AI scan confidence
// ---------------------------------------------------------------------------

function ConfidenceBadge({
  confidence,
  t,
}: {
  confidence: "high" | "medium" | "low";
  t: ReturnType<typeof useTranslations<"adminImport.wizard">>;
}) {
  const styles = {
    high:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    medium: "bg-amber-100  text-amber-700  dark:bg-amber-900/40  dark:text-amber-300",
    low:    "bg-red-100    text-red-600    dark:bg-red-900/40    dark:text-red-400",
  } as const;

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        styles[confidence],
      ].join(" ")}
    >
      {t(`confidence_${confidence}` as "confidence_high" | "confidence_medium" | "confidence_low")}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({
  result,
  t,
}: {
  result: ScanResult | undefined;
  t: ReturnType<typeof useTranslations<"adminImport.wizard">>;
}) {
  if (!result || result.status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {t("statusPending")}
      </span>
    );
  }

  switch (result.status) {
    case "converting":
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 animate-pulse dark:bg-amber-900/40 dark:text-amber-300">
          {t("statusConverting")}
        </span>
      );
    case "scanning":
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 animate-pulse dark:bg-blue-900/40 dark:text-blue-300">
          {t("statusScanning")}
        </span>
      );
    case "done":
      return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          {t("statusDone")}
        </span>
      );
    case "skip":
      return (
        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
          {t("statusSkipped")}
        </span>
      );
    case "error":
      return (
        <span
          className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/40 dark:text-red-400"
          title={result.errorMsg}
        >
          {t("statusError")}
        </span>
      );
    default:
      return null;
  }
}
