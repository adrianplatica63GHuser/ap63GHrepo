"use client";

/**
 * ImportWizard — Slice #21.01.Import
 *
 * Main orchestrator for the new import flow.  Renders entirely client-side
 * (wrapped in a ssr:false dynamic import).
 *
 * ONE FOLDER = ONE PROPERTY  (Slice #23.00.Import)
 * ────────────────────────────────────────────────
 * A picked folder is no longer an arbitrary tree tagged by ancestor folder
 * names — it represents exactly one Property. Before any file is imported the
 * user resolves that Property (pick an existing one, or create it now), and
 * every Document the run creates is linked to it directly. Subfolder names
 * still become tags, but tags are descriptive only and link nothing.
 *
 * STATE MACHINE
 * ─────────────
 *  preflight     → the preconditions checklist; no folder picker exists yet
 *  idle          → checks passed, user hasn't picked a folder
 *  walking       → walkFolder() running (fast, <1 s)
 *  folder-report → walked, nothing spent; the forecast awaits Continuă
 *  scanning      → concurrent Haiku AI scans running in background
 *  ready         → scan complete; scan-table rendered + "Import" CTA visible
 *  property      → PropertyStepDialog is open (resolve the run's Property)
 *  tag-dialog    → TagDialog is open (animated tag-prep step)
 *  importing     → BulkImportDialog is running
 *  resumed       → ResumedSessionView is showing a previous run's record
 *
 * File System Access API handles are stored in a module-level singleton so
 * they survive React unmount/remount (handles cannot be serialised).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  walkFolder,
  tagsForEntry,
  type FSDirectoryHandle,
  type FSEntry,
} from "@/lib/import/folder-utils";
import { isFileKind, isImageOrPdf } from "@/lib/files/file-kinds";
import {
  loadSavedSession,
  clearSavedSession,
  type SavedImportSession,
} from "@/lib/import/session";
import { ScanTable, type ScanResult } from "./scan-table";
import { TagDialog, type TagFolderInfo } from "./tag-dialog";
import { BulkImportDialog } from "./bulk-import-dialog";
import {
  PropertyStepDialog,
  type ResolvedProperty,
} from "./property-step-dialog";
import { ResumedSessionView } from "./resumed-session-view";
import { PreflightChecklist } from "./preflight-checklist";
import { FolderForecast } from "./folder-forecast";
import { forecastImport } from "@/lib/import/preflight";
import { buttonClass } from "@/lib/ui/button-styles";

// ---------------------------------------------------------------------------
// Module-level singleton — preserves FS handles across React re-renders
// ---------------------------------------------------------------------------

let _dirHandle: FSDirectoryHandle | null = null;

// ---------------------------------------------------------------------------
// Scan helpers
// ---------------------------------------------------------------------------

// Slice #24.03: the local IMAGE_EXTS set, PDF_EXT and extOf are gone. Which
// extensions are images, which is a PDF, and how an extension is read are all
// asked of the file-kind registry in src/lib/files/file-kinds.ts — the same
// module the folder walk, the coordinate shortlist and the provenance rules
// now read from, so "scannable here" and "an image there" can no longer drift.

/** Check if any file in the entry is worth sending to the scan route. */
function entryScannable(entry: FSEntry): boolean {
  if (entry.kind === "page-group") {
    return entry.handles.length > 0 && isImageOrPdf(entry.handles[0].name);
  }
  return isImageOrPdf(entry.name);
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
  if (isFileKind(file.name, "pdf")) {
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
  /**
   * Slice #24.02a. `preflight` is the new FIRST phase: the folder picker does
   * not exist until every precondition is green. `folder-report` is the new
   * gate between the walk and the classification pass — before this slice the
   * two ran as one uninterrupted async block, so choosing a folder spent one
   * Claude call per image before anything had been checked or shown.
   *
   * `idle` survives as "checks passed, no folder chosen yet", which is what
   * the resume button and the picker have always been gated on.
   */
  | "preflight"
  | "idle"
  | "walking"
  | "folder-report"
  | "scanning"
  | "ready"
  | "property"
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
        result.push({ name });
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

  const [phase, setPhase] = useState<Phase>("preflight");
  const [rootFolderName, setRootFolderName] = useState<string>("");
  const [entries, setEntries] = useState<FSEntry[]>([]);
  const [scanResults, setScanResults] = useState<Map<string, ScanResult>>(new Map());
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [walkError, setWalkError] = useState<string | null>(null);
  // Slice #23.00.Import: the one Property this folder represents. Null until
  // the user resolves it in the property step; the import cannot start
  // without it.
  const [resolvedProperty, setResolvedProperty] = useState<ResolvedProperty | null>(null);
  // Saved session — lazy-initialised from localStorage so no effect is needed.
  // loadSavedSession() guards against SSR with a `typeof window` check.
  const [savedSession, setSavedSession] = useState<SavedImportSession | null>(
    () => loadSavedSession(),
  );

  const cancelScanRef = useRef(false);

  /**
   * The preconditions' verdict, hoisted so the picker can be gated on it.
   *
   * Kept out of `phase` on purpose: a failing check is not a phase, it is a
   * fact about the world that can change under a screen the user is already
   * looking at. `Verifică din nou` re-runs while the phase stays `preflight`.
   */
  const [preflightPassed, setPreflightPassed] = useState(false);

  const handlePreflightVerdict = useCallback((passed: boolean) => {
    setPreflightPassed(passed);
    // A gate, not a watchdog. The checklist is mounted only while the phase is
    // `preflight`, so a passing verdict is the one and only transition this
    // can make; there is deliberately no "failing takes the picker away again"
    // branch, because the component that would emit it has already unmounted
    // by then. Under React StrictMode's double-invoked mount effect such a
    // branch would fire from a stale closure and yank the user off a picker
    // they had just been given. A precondition that breaks after the picker
    // appears surfaces where it always did: as a failure during the run.
    if (passed) setPhase((current) => (current === "preflight" ? "idle" : current));
  }, []);

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
    // Clear the PREVIOUS folder's entries before the new name goes up. Without
    // this, a walk that fails — or simply takes a moment — leaves the old
    // folder's file table on screen labelled with the new folder's name, and
    // every status cell blank because nothing has been scanned.
    setEntries([]);
    setScanResults(new Map());
    setScanProgress({ done: 0, total: 0 });
    // A new folder is a new Property question — never carry the previous
    // run's answer over, or documents would silently land on the wrong one.
    setResolvedProperty(null);
    setPhase("walking");

    let walked: FSEntry[] = [];
    try {
      walked = await walkFolder(handle);
    } catch (err) {
      setWalkError(err instanceof Error ? err.message : "Walk failed");
      setPhase("idle");
      return;
    }

    // Slice #24.02a — the walk ends here. It used to fall straight into the
    // classification pass in this same async block, which is how choosing a
    // folder came to cost one Claude call per image before anything had been
    // validated or shown. The scan now waits for `startScan`, behind Continuă.
    setEntries(walked);
    setPhase("folder-report");
  }, [t]);

  // -------------------------------------------------------------------
  // Classification pass — everything below this line costs money
  // -------------------------------------------------------------------

  /**
   * Send every scannable entry for automatic classification, 3 at a time.
   *
   * Lifted verbatim out of `handlePickFolder` in Slice #24.02a; the only
   * change is that it takes the walked entries as an argument instead of
   * closing over a local. It has exactly one caller — the Continuă button —
   * and `scanEntry` is called from nowhere else, which together are what make
   * "no classification without a press" a property rather than an intention.
   */
  const startScan = useCallback(async (walked: FSEntry[]) => {
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
          const isImg = isFileKind(
            entry.kind === "page-group" ? entry.handles[0].name : entry.name,
            "image",
          );
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
  }, []);

  // Cancel scan on unmount
  useEffect(() => () => { cancelScanRef.current = true; }, []);

  // -------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------

  const folders = collectFolders(entries, rootFolderName);

  const scannableCount = entries.filter(entryScannable).length;
  const scanDone = phase === "ready";

  // Derived at render time rather than copied into state when the walk ends:
  // one copy cannot drift from the list the user is looking at. Cheap — it is
  // a single pass over names, no file contents and no I/O.
  const forecast = useMemo(() => forecastImport(entries), [entries]);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Toolbar row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Slice #24.02a — the picker does not exist until every precondition
            is green. Rendering it disabled would invite the user to click at
            it; not rendering it at all makes the checklist the only thing on
            screen with something to do. */}
        {/* Hidden during `folder-report`: that panel carries its own
            "choose another folder", and two controls with different labels
            doing the same thing is a question the user has to stop and
            answer. */}
        {preflightPassed && phase !== "folder-report" && (
          <button
            type="button"
            onClick={handlePickFolder}
            disabled={
              phase === "walking" || phase === "scanning" || phase === "importing"
            }
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {rootFolderName ? t("changeFolderButton") : t("chooseFolderButton")}
          </button>
        )}

        {/* Resume last session — stays gated on `idle`, i.e. behind the
            checklist. Slice #24.02a briefly made it reachable from `preflight`
            on the grounds that a resumed session touches no filesystem — but
            ResumedSessionView's only control is "new import", which CLEARS the
            saved session. Reaching it with failing preconditions would have
            meant the sole way back to the checklist was destroying the record
            of the previous run. */}
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

        {/* Resolved property chip — the run's destination, always visible
            once chosen so it can't be forgotten mid-import. */}
        {resolvedProperty && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cta/30 bg-cta-pale px-3 py-1 text-xs font-medium text-cta dark:bg-cta/15">
            <span className="font-mono">{resolvedProperty.code}</span>
            <span>{resolvedProperty.nickname ?? t("propertyStep.noNickname")}</span>
            <span className="text-cta/70">
              {t("propertyStep.chipCorners", { count: resolvedProperty.cornerCount })}
            </span>
          </span>
        )}

        {/* Slice #23.09.UX — a toolbar chip, so it takes the blink and the
            live region directly rather than through ActivityCue, whose
            block layout would break this flex row. No bar for the same
            reason. */}
        {phase === "walking" && (
          <span role="status" className="ga-cue-blink text-sm font-medium text-cta">
            {t("walkingFolder")}
          </span>
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
            onClick={() => setPhase("property")}
            disabled={phase === "scanning"}
            className={buttonClass({
              variant: "primary",
              size: "lg",
              className: "ml-auto",
            })}
          >
            {t("importButton")}
          </button>
        )}
      </div>

      {/* Step zero — the preconditions. Shown until they all pass. */}
      {phase === "preflight" && (
        <PreflightChecklist onVerdict={handlePreflightVerdict} />
      )}

      {/* The walk is done and nothing has been spent yet. */}
      {phase === "folder-report" && (
        <FolderForecast
          rootFolderName={rootFolderName}
          forecast={forecast}
          onContinue={() => void startScan(entries)}
          onChangeFolder={handlePickFolder}
        />
      )}

      {/* Walk error */}
      {walkError && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {walkError}
        </div>
      )}

      {/* File table — hidden while showing a resumed session, and while the
          folder report is up: the scan has not run, so every row would render
          a blank status behind a panel asking whether to run it. */}
      {entries.length > 0 && phase !== "resumed" && phase !== "folder-report" && (
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
            // The resume button is reachable from `preflight` too, so this
            // must not drop the user onto a picker whose preconditions never
            // passed.
            setPhase(preflightPassed ? "idle" : "preflight");
          }}
        />
      )}

      {/* Property step (modal) — Slice #23.00.Import.
          Resolves the one Property this folder represents, and optionally
          seeds/refreshes its corners from a coordinate file in the folder. */}
      {phase === "property" && (
        <PropertyStepDialog
          entries={entries}
          rootFolderName={rootFolderName}
          onCancel={() => setPhase("ready")}
          onResolved={(property) => {
            setResolvedProperty(property);
            setPhase("tag-dialog");
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

      {/* Bulk import dialog (modal).
          `resolvedProperty` is non-null by construction — the only route into
          the importing phase runs through the property step — but the guard
          keeps the required propertyId prop honest rather than asserting. */}
      {phase === "importing" && resolvedProperty && (
        <BulkImportDialog
          entries={entries}
          rootFolderName={rootFolderName}
          scanResults={scanResults}
          propertyId={resolvedProperty.id}
          cornerSourcePath={
            // Slice #23.06.Import — which picked file's corners actually
            // landed on the Property, so the loop can claim
            // property_corner_source the instant that file's Document exists.
            // Null when nothing was written (no file, zero corners, or the
            // user kept the existing corners): then no file is the origin of
            // this Property's geometry and none may be locked to it.
            resolvedProperty.cornerSourcePath
          }
          onPropertyCornersChanged={(cornerCount) =>
            setResolvedProperty((prev) => (prev ? { ...prev, cornerCount } : prev))
          }
          onClose={() => {
            setPhase("ready");
            // Reset scan results so the table shows fresh state
          }}
        />
      )}
    </div>
  );
}
