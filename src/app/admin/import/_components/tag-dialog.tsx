"use client";

/**
 * TagDialog — Slice #21.01.Import
 *
 * Step 2 of the import wizard: shows the unique folder names that will
 * become document tags, then animates a "preparing tags" progress bar,
 * and finally reveals the "Import Files" CTA.
 *
 * The tags themselves are just strings — they are applied as real DB writes
 * during the subsequent bulk-import step. This dialog is purely cosmetic UX.
 *
 * Props:
 *   folderNames   — ordered list of unique tag strings (root first)
 *   totalFiles    — total number of importable entries (for the CTA label)
 *   onConfirm     — called when the user proceeds to the import step
 *   onCancel      — called when the user dismisses without importing
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { parseFolderName } from "@/lib/import/folder-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TagFolderInfo = {
  name: string;
  /** Populated when the folder is a recognised property folder */
  parsedFolder?: ParsedFolder;
};

type Phase = "confirm" | "animating" | "done";

type Props = {
  folders: TagFolderInfo[];
  totalFiles: number;
  onConfirm: () => void;
  onCancel: () => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** How long (ms) each "tag" label stays visible during animation */
const TAG_CYCLE_INTERVAL = 220;
/** Total animation wall-time (ms) */
const ANIMATION_DURATION = 2200;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TagDialog({ folders, totalFiles, onConfirm, onCancel }: Props) {
  const t = useTranslations("adminImport.wizard.tagDialog");

  const [phase, setPhase] = useState<Phase>("confirm");
  const [progress, setProgress] = useState(0);
  const [cycleIndex, setCycleIndex] = useState(0);

  // Kick off the animation when the user clicks "Confirm"
  const handleConfirm = useCallback(() => {
    setPhase("animating");
    setProgress(0);
    setCycleIndex(0);
  }, []);

  // Run the progress + label-cycling animation
  useEffect(() => {
    if (phase !== "animating") return;

    const startTime = Date.now();

    // Progress bar: requestAnimationFrame-driven for smoothness
    let rafId: number;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(elapsed / ANIMATION_DURATION, 1);
      setProgress(pct);
      if (pct < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setPhase("done");
      }
    };
    rafId = requestAnimationFrame(tick);

    // Label cycling: setInterval at a fixed cadence
    const labelInterval = setInterval(() => {
      setCycleIndex((i) => (i + 1) % Math.max(folders.length, 1));
    }, TAG_CYCLE_INTERVAL);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(labelInterval);
    };
  }, [phase, folders.length]);

  // ESC to cancel (only in confirm phase)
  useEffect(() => {
    if (phase !== "confirm") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onCancel]);

  const currentLabel =
    folders.length > 0 ? folders[cycleIndex % folders.length].name : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg rounded-xl border border-card-rim bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="border-b border-card-rim px-5 py-4 dark:border-zinc-700">
          <h2 className="text-base font-semibold text-ink dark:text-zinc-100">
            {t("title")}
          </h2>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          {phase === "confirm" && (
            <>
              <p className="text-sm text-ink dark:text-zinc-300">
                {t("message", { count: folders.length })}
              </p>

              {/* Folder list */}
              <ul className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-crease bg-canvas px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
                {folders.map((fi) => (
                  <FolderRow key={fi.name} fi={fi} />
                ))}
              </ul>
            </>
          )}

          {phase === "animating" && (
            <AnimationPhase
              progress={progress}
              label={currentLabel}
              t={t}
            />
          )}

          {phase === "done" && (
            <DonePhase count={folders.length} totalFiles={totalFiles} t={t} onImport={onConfirm} />
          )}
        </div>

        {/* Footer — only in confirm phase */}
        {phase === "confirm" && (
          <div className="flex items-center justify-end gap-3 border-t border-card-rim px-5 py-3 dark:border-zinc-700">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {t("cancelButton")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d"
            >
              {t("confirmButton")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FolderRow — one item in the folder list
// ---------------------------------------------------------------------------

function FolderRow({ fi }: { fi: TagFolderInfo }) {
  // Parse the folder name directly — self-contained, no reliance on the caller.
  // /per(?=\d)/gi replaces "per" only before a digit — proper names are safe.
  const pf = parseFolderName(fi.name);

  const aliases: string[] = [];
  if (pf.isPropertyFolder) {
    const slashFull = fi.name.replace(/per(?=\d)/gi, "/");
    if (slashFull !== fi.name) aliases.push(slashFull);

    const tarla   = pf.tarlaSola ? pf.tarlaSola.replace(/per(?=\d)/gi, "/") : null;
    const parcela = pf.parcela   ? pf.parcela.replace(/per(?=\d)/gi,   "/") : null;
    if (tarla)            aliases.push(tarla);
    if (parcela)          aliases.push(parcela);
    if (tarla && parcela) aliases.push(`${tarla}-${parcela}`);
  }

  return (
    <li className="flex flex-col gap-1 py-1.5">
      <span className="font-medium text-sm font-mono text-ink dark:text-zinc-200">
        {fi.name}
      </span>
      {aliases.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {aliases.map((alias) => (
            <span
              key={alias}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-mono bg-cta-pale text-cta dark:bg-cta/15 dark:text-cta border border-cta/20"
            >
              {alias}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// AnimationPhase — progress bar + cycling label
// ---------------------------------------------------------------------------

function AnimationPhase({
  progress,
  label,
  t,
}: {
  progress: number;
  label: string;
  t: ReturnType<typeof useTranslations<"adminImport.wizard.tagDialog">>;
}) {
  return (
    <div className="space-y-3 py-2">
      <p className="text-sm font-medium text-ink dark:text-zinc-200">
        {t("progressTitle")}
      </p>
      {/* Progress bar */}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className="h-full rounded-full bg-cta transition-none"
          style={{ width: `${(progress * 100).toFixed(1)}%` }}
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {/* Cycling tag name */}
      <p
        className="text-center text-sm text-fade dark:text-zinc-400 tabular-nums transition-opacity duration-150"
        aria-live="off"
      >
        {label}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DonePhase — success message + import button
// ---------------------------------------------------------------------------

function DonePhase({
  count,
  totalFiles,
  t,
  onImport,
}: {
  count: number;
  totalFiles: number;
  t: ReturnType<typeof useTranslations<"adminImport.wizard.tagDialog">>;
  onImport: () => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <p className="text-sm text-emerald-700 dark:text-emerald-300">
        ✓ {t("doneMessage", { count })}
      </p>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onImport}
          className="inline-flex items-center rounded-md bg-cta px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-cta-d"
        >
          {t("importFilesButton", { count: totalFiles })}
        </button>
      </div>
    </div>
  );
}
