"use client";

/**
 * ImportWizard — Slice #21.01.Import
 *
 * Main orchestrator for the new import flow.  Renders entirely client-side
 * (wrapped in a ssr:false dynamic import).
 *
 * STATE MACHINE
 * ─────────────
 *  idle          → user hasn't picked a folder yet
 *  walking       → walkFolder() running (fast, <1 s)
 *  scanning      → concurrent Haiku AI scans running in background
 *  ready         → scan complete; scan-table rendered + "Import" CTA visible
 *  tag-dialog    → TagDialog is open (animated tag-prep step)
 *  importing     → BulkImportDialog is running
 *
 * File System Access API handles are stored in a module-level singleton so
 * they survive React unmount/remount (handles cannot be serialised).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  walkFolder,
  tagsForEntry,
  parseFolderName,
  type FSDirectoryHandle,
  type FSEntry,
} from "@/lib/import/folder-utils";
import {
  loadSavedSession,
  clearSavedSession,
  type SavedImportSession,
} from "@/lib/import/session";
import { ScanTable, type ScanResult } from "./scan-table";
import { TagDialog, type TagFolderInfo } from "./tag-dialog";
import { BulkImportDialog } from "./bulk-import-dialog";
import { ResumedSessionView } from "./resumed-session-view";

// ---------------------------------------------------------------------------
// Module-level singleton — preserves FS handles across React re-renders
// ---------------------------------------------------------------------------

let _dirHandle: FSDirectoryHandle | null = null;

// ---------------------------------------------------------------------------
// Scan helpers
// ---------------------------------------------------------------------------

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif"]);
const PDF_EXT = ".pdf";

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function isScannable(name: string): boolean {
  return IMAGE_EXTS.has(extOf(name)) || extOf(name) === PDF_EXT;
}

/** Check if any file in the entry is scannable */
function entryScannable(entry: FSEntry): boolean {
  if (entry.kind === "page-group") {
    return entry.handles.length > 0 && isScannable(entry.handles[0].name);
  }
  return isScannable(entry.name);
}

// ---------------------------------------------------------------------------
// PDF.js (lazy) — only page 1 for scanning
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;
async function ensurePdfJs() {
  if (pdfjsLib) return;
  pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
}

async function pdfToImageBlob(file: File): Promise<Blob> {
  await ensurePdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("blob null"))), "image/png"),
  );
}

// ---------------------------------------------------------------------------
// Haiku scan helper
// ---------------------------------------------------------------------------

async function scanEntry(entry: FSEntry): Promise<{
  classifiedLabel: string;
  suggestedTypeKey: string | null;
  confidence: "high" | "medium" | "low";
  extractable: boolean;
  notes: string | null;
}> {
  let file: File;
  if (entry.kind === "page-group") {
    // Use the first page of the group
    file = await entry.handles[0].getFile();
  } else {
    file = await entry.handle.getFile();
  }

  let blob: Blob = file;
  if (extOf(file.name) === PDF_EXT) {
    blob = await pdfToImageBlob(file);
  }

  const fd = new FormData();
  const f = blob instanceof File ? blob : new File([blob], "page.png", { type: "image/png" });
  fd.append("file", f);

  const res = await fetch("/api/admin/import/scan-folder", { method: "POST", body: fd });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Phase type
// ---------------------------------------------------------------------------

type Phase =
  | "idle"
  | "walking"
  | "scanning"
  | "ready"
  | "tag-dialog"
  | "importing"
  | "resumed";

// ---------------------------------------------------------------------------
// Unique folder names for tagging
// ---------------------------------------------------------------------------

function collectFolders(
  entries: FSEntry[],
  rootFolderName: string,
): TagFolderInfo[] {
  const seen = new Set<string>();
  const result: TagFolderInfo[] = [];

  // Root folder itself
  seen.add(rootFolderName);
  result.push({ name: rootFolderName });

  for (const entry of entries) {
    const tags = tagsForEntry(rootFolderName, entry);
    // tags[0] = rootFolderName (already added), tags[1..] = pathParts
    for (let i = 1; i < tags.length; i++) {
      const name = tags[i];
      if (!seen.has(name)) {
        seen.add(name);
        // Check if this segment corresponds to a property folder
        const pf = parseFolderName(name);
        result.push({ name, parsedFolder: pf.isPropertyFolder ? pf : undefined });
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportWizard() {
  const t = useTranslations("adminImport.wizard");

  const [phase, setPhase] = useState<Phase>("idle");
  const [rootFolderName, setRootFolderName] = useState<string>("");
  const [entries, setEntries] = useState<FSEntry[]>([]);
  const [scanResults, setScanResults] = useState<Map<string, ScanResult>>(new Map());
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [walkError, setWalkError] = useState<string | null>(null);
  // Saved session — lazy-initialised from localStorage so no effect is needed.
  // loadSavedSession() guards against SSR with a `typeof window` check.
  const [savedSession, setSavedSession] = useState<SavedImportSession | null>(
    () => loadSavedSession(),
  );

  const cancelScanRef = useRef(false);

  // -------------------------------------------------------------------
  // Pick folder
  // -------------------------------------------------------------------

  const handlePickFolder = useCallback(async () => {
    // Check browser support
    if (typeof window === "undefined" || !("showDirectoryPicker" in window)) {
      setWalkError(t("unsupported"));
      return;
    }

    let handle: FSDirectoryHandle;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      handle = (await (window as any).showDirectoryPicker({
        mode: "read",
      })) as FSDirectoryHandle;
    } catch {
      // User cancelled — no-op
      return;
    }

    _dirHandle = handle;
    const name = handle.name;
    setRootFolderName(name);
    setWalkError(null);
    setScanResults(new Map());
    setScanProgress({ done: 0, total: 0 });
    setPhase("walking");

    let walked: FSEntry[] = [];
    try {
      walked = await walkFolder(handle);
    } catch (err) {
      setWalkError(err instanceof Error ? err.message : "Walk failed");
      setPhase("idle");
      return;
    }

    setEntries(walked);
    setPhase("scanning");
    cancelScanRef.current = false;

    // Start concurrent background scans (3 at a time)
    const scannable = walked.filter(entryScannable);
    setScanProgress({ done: 0, total: scannable.length });

    // Mark all scannable as pending, non-scannable as skip
    setScanResults(() => {
      const m = new Map<string, ScanResult>();
      for (const e of walked) {
        m.set(e.path, { status: entryScannable(e) ? "pending" : "skip" });
      }
      return m;
    });

    const CONCURRENCY = 3;
    let nextIdx = 0;
    let running = 0;
    let doneSoFar = 0;

    await new Promise<void>((resolve) => {
      function launch() {
        while (running < CONCURRENCY && nextIdx < scannable.length) {
          if (cancelScanRef.current) { resolve(); return; }
          const entry = scannable[nextIdx++];
          running++;

          // Mark as scanning/converting
          const isImg = IMAGE_EXTS.has(extOf(
            entry.kind === "page-group" ? entry.handles[0].name : entry.name,
          ));
          setScanResults((prev) => {
            const next = new Map(prev);
            next.set(entry.path, { status: isImg ? "scanning" : "converting" });
            return next;
          });

          scanEntry(entry)
            .then((cl) => {
              if (cancelScanRef.current) return;
              setScanResults((prev) => {
                const next = new Map(prev);
                next.set(entry.path, {
                  status: "done",
                  description: cl.classifiedLabel,
                  typeKey: cl.suggestedTypeKey,
                  confidence: cl.confidence,
                  extractable: cl.extractable,
                });
                return next;
              });
            })
            .catch(() => {
              if (cancelScanRef.current) return;
              setScanResults((prev) => {
                const next = new Map(prev);
                next.set(entry.path, { status: "error", errorMsg: "Scan failed" });
                return next;
              });
            })
            .finally(() => {
              if (cancelScanRef.current) { resolve(); return; }
              doneSoFar++;
              running--;
              setScanProgress({ done: doneSoFar, total: scannable.length });
              if (nextIdx < scannable.length) {
                launch();
              } else if (running === 0) {
                resolve();
              }
            });
        }
        if (scannable.length === 0) resolve();
      }
      launch();
    });

    if (!cancelScanRef.current) {
      setPhase("ready");
    }
  }, [t]);

  // Cancel scan on unmount
  useEffect(() => () => { cancelScanRef.current = true; }, []);

  // -------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------

  const folders = collectFolders(entries, rootFolderName);

  const scannableCount = entries.filter(entryScannable).length;
  const scanDone = phase === "ready";

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Toolbar row */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handlePickFolder}
          disabled={phase === "walking" || phase === "scanning" || phase === "importing"}
          className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
        >
          {rootFolderName ? t("changeFolderButton") : t("chooseFolderButton")}
        </button>

        {/* Resume last session — shown only while idle and a saved session exists */}
        {phase === "idle" && savedSession && (
          <button
            type="button"
            onClick={() => setPhase("resumed")}
            className="inline-flex items-center rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40"
          >
            {t("resumeButton", { folder: savedSession.rootFolderName })}
          </button>
        )}

        {rootFolderName && (
          <span className="font-mono text-sm text-ink dark:text-zinc-200">
            📁 {rootFolderName}
          </span>
        )}

        {phase === "walking" && (
          <span className="text-sm text-fade animate-pulse">{t("walkingFolder")}</span>
        )}

        {phase === "scanning" && (
          <span className="text-sm text-fade">
            {t("scanningProgress", { done: scanProgress.done, total: scanProgress.total })}
          </span>
        )}

        {scanDone && scannableCount > 0 && (
          <span className="text-sm text-fade">
            {t("scanComplete", { total: entries.length, scannable: scannableCount })}
          </span>
        )}

        {/* Import button — shown once we have at least one entry */}
        {(phase === "ready" || phase === "scanning") && entries.length > 0 && (
          <button
            type="button"
            onClick={() => setPhase("tag-dialog")}
            disabled={phase === "scanning"}
            className="ml-auto inline-flex items-center rounded-md border border-cta px-4 py-2 text-sm font-medium text-cta hover:bg-cta/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("importButton")}
          </button>
        )}
      </div>

      {/* Walk error */}
      {walkError && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {walkError}
        </div>
      )}

      {/* File table — hidden while showing a resumed session */}
      {entries.length > 0 && phase !== "resumed" && (
        <div className="rounded-xl border border-card-rim bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <ScanTable
            entries={entries}
            rootFolderName={rootFolderName}
            scanResults={scanResults}
          />
        </div>
      )}

      {/* Resumed session view — replaces the file table while active */}
      {phase === "resumed" && savedSession && (
        <ResumedSessionView
          session={savedSession}
          onClear={() => {
            clearSavedSession();
            setSavedSession(null);
            setPhase("idle");
          }}
        />
      )}

      {/* Tag dialog (modal) */}
      {phase === "tag-dialog" && (
        <TagDialog
          folders={folders}
          totalFiles={entries.length}
          onCancel={() => setPhase("ready")}
          onConfirm={() => setPhase("importing")}
        />
      )}

      {/* Bulk import dialog (modal) */}
      {phase === "importing" && (
        <BulkImportDialog
          entries={entries}
          rootFolderName={rootFolderName}
          scanResults={scanResults}
          onClose={() => {
            setPhase("ready");
            // Reset scan results so the table shows fresh state
          }}
        />
      )}
    </div>
  );
}
