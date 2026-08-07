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
 * THE SHELL  (Slice #26.03)
 * ─────────────────────────
 * Every phase is drawn under a two-line stage indicator, and the phase → stage
 * map lives with the stage catalogue in `src/lib/import/workflow-stages.ts` —
 * along with the `ImportPhase` union itself, so the map and the machine cannot
 * come to disagree about which phases exist. `information` is the new first
 * phase; acknowledging it starts the preconditions, whose logic is untouched.
 *
 * The state machine is documented beside that union, not here, for the same
 * reason: one copy.
 *
 * THE STRUCTURE STAGE  (Slice #26.04)
 * ───────────────────────────────────
 * The folder picker moved out of the toolbar and into `ImportStructureStage`,
 * behind a tick the user re-confirms on every round of the fix-and-re-check
 * loop. The walk IS the structure check now: the moment it finishes, the
 * verdict decides where the user lands — back on the violation list, or on the
 * Evaluation screen with Structure green behind them.
 *
 * ⚠️ **The metadata pass runs only when Structure is clean.** It is ~760
 * `getFile()` calls on Adrian's archive and it feeds the folder report, which a
 * failed structure check never reaches. Paying for it on every turn of a loop
 * built to be gone round several times would have made the loop slower than
 * the fixing it exists to prompt.
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
import { ReportSections } from "./report-sections";
import { checkFolder, type FileMeta } from "@/lib/import/checks";
import { readFileMetadata } from "@/lib/import/metadata-pass";
import type { DirectoryObservation } from "@/lib/import/folder-utils";
import { buttonClass } from "@/lib/ui/button-styles";
import { ImportStageBar, MODAL_PHASES } from "./import-stage-bar";
import { ImportInformation } from "./import-information";
import { ImportStructureStage } from "./import-structure-stage";
import { CancelImportDialog } from "./cancel-import-dialog";
import { checkStructureStage } from "@/lib/import/structure-check";
import {
  stageForPhase,
  type ImportPhase,
  type WorkflowStageId,
} from "@/lib/import/workflow-stages";
import type { CancelFacts } from "@/lib/import/cancel-consequences";

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

// Slice #24.02a introduced `preflight` as the first phase: the folder picker
// does not exist until every precondition is green, and `folder-report` is the
// gate between the walk and the classification pass. Slice #26.03 moved the
// union — and the note describing each member — into
// `src/lib/import/workflow-stages.ts`, so that the phase → stage map used by
// the indicator is checked against the same list the machine runs on. Nothing
// about the phases themselves changed except the new `information` entry.

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
  const tStage = useTranslations("adminImport.workflow");

  const [phase, setPhase] = useState<ImportPhase>("information");
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

  /**
   * The current run's cancellation token.   (Slice #26.03)
   *
   * This replaced a single `cancelScanRef` boolean, which could not do the job
   * once a Cancel existed. Two failures, both reproduced before the change:
   *
   *  - `runWalk` cleared the flag on entry, so a scan left in flight by a
   *    cancelled run found it `false` again when its fetch settled, wrote its
   *    result into the NEXT run's state and drained the rest of the old
   *    folder's queue — real Claude calls, billed, against a folder the user
   *    had renounced.
   *  - Nothing re-read the flag after `runWalk`'s awaits, so the tail of a
   *    cancelled walk restored the folder name, the entries and the phase a
   *    moment after the reset had cleared them.
   *
   * A token is an object, so a closure that captured one keeps looking at THAT
   * run's flag for ever; a later run cannot un-cancel it. `beginRun()` retires
   * the previous token before minting the next, so overlapping runs are
   * impossible rather than merely unlikely.
   */
  const runTokenRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const beginRun = useCallback(() => {
    runTokenRef.current.cancelled = true;
    const token = { cancelled: false };
    runTokenRef.current = token;
    return token;
  }, []);

  const endRun = useCallback(() => {
    runTokenRef.current.cancelled = true;
  }, []);

  // Slice #24.02b — what the walk SAW, and what each file weighs. Both feed
  // the report; neither changes what the import does.
  const [observations, setObservations] = useState<DirectoryObservation[]>([]);
  const [metadata, setMetadata] = useState<Map<string, FileMeta> | null>(null);
  const [metaProgress, setMetaProgress] = useState({ done: 0, total: 0 });
  // The report's two disclosures live here, not in the panel: the panel
  // unmounts during a re-walk, so component state would collapse every
  // expanded section on each turn of the fix-and-re-check loop.
  const [showQuiet, setShowQuiet] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  /**
   * The preconditions' verdict, hoisted so the picker can be gated on it.
   *
   * Kept out of `phase` on purpose: a failing check is not a phase, it is a
   * fact about the world that can change under a screen the user is already
   * looking at. `Verifică din nou` re-runs while the phase stays `preflight`.
   */
  const [preflightPassed, setPreflightPassed] = useState(false);

  /**
   * Slice #26.04 — the Structure stage's two pieces of screen state.
   *
   * `structureAcknowledged` is the "Respect regulile de structură" tick. It
   * gates the picker AND the re-check, and `runWalk` clears it at the start of
   * every walk so it comes back unticked on each round of the loop. That is the
   * brief's wording ("the tick and the button return as Verifică din nou") and
   * it is also the only signal available that the user actually went to File
   * Explorer between two presses — the browser cannot tell us, and a loop whose
   * button can be hammered is a loop that reads as broken.
   *
   * `structureRulesOpen` is the disclosure over the rules listing, hoisted here
   * for the reason `showQuiet` and `showSkipped` are: the panel re-renders on
   * every check, and a user reading the rules beside their fix list must not
   * have them shut under them.
   */
  const [structureAcknowledged, setStructureAcknowledged] = useState(false);
  const [structureRulesOpen, setStructureRulesOpen] = useState(false);

  /**
   * Slice #26.03 — the Cancel's two pieces of memory.
   *
   * `documentsCreated` is the only fact the cancel dialog needs that nothing
   * else on screen already knows: once the bulk import has written its first
   * Document, cancelling does not remove it. It is set by `BulkImportDialog`
   * on the first successful create, NOT when the dialog opens — a run that
   * fails on document zero must not send the user hunting a documents list for
   * records that were never made. It is reset when a NEW folder is picked,
   * because a new folder is a new run and the previous run's documents were
   * left behind by finishing, not by cancelling.
   *
   * `cancelSnapshot` is non-null exactly while the confirmation is open, and
   * every word the dialog shows comes out of it — the facts AND the stage name
   * in the header. A scan finishing under an open dialog would otherwise
   * rewrite the list the user is reading and shift the buttons out from under
   * the pointer, and freezing the list while leaving the header live is worse
   * still: the header would flip to "Import" over a list that still describes a
   * running scan, so the dialog would contradict itself.
   */
  const [documentsCreated, setDocumentsCreated] = useState(false);
  const [cancelSnapshot, setCancelSnapshot] = useState<{
    facts: CancelFacts;
    stage: WorkflowStageId;
  } | null>(null);

  /**
   * The control the Cancel was opened from, so the keyboard can be given back.
   *
   * Captured in the CLICK handler rather than in the dialog's mount effect, and
   * that is forced by the `inert` wrapper: the commit that mounts the dialog
   * also marks the wrapper inert, and the HTML focus-fixup rule blurs a focused
   * element the moment it gains an inert ancestor — so a dialog reading
   * `document.activeElement` from its own effect would capture `body` and
   * restore nothing. Restored from an effect that runs after the wrapper
   * un-inerts, by which point the button is focusable again.
   */
  const cancelOpenerRef = useRef<HTMLElement | null>(null);

  /** Has a folder been chosen in THIS visit? See `openCancelDialog`. */
  const folderPickedRef = useRef(false);

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
    if (passed) setPhase((current) => (current === "preflight" ? "structure" : current));
  }, []);

  // -------------------------------------------------------------------
  // Pick folder
  // -------------------------------------------------------------------

  /**
   * Walk a folder we already hold a handle for, and build the report.
   *
   * Split out of `handlePickFolder` in Slice #24.02c so that "I fixed the
   * files, check again" costs one click instead of a round trip through the
   * OS picker. The browser keeps the directory handle alive for the session,
   * and re-enumerating it sees the user's edits — so the report can be a live
   * checklist worked against in Explorer, rather than a snapshot that goes
   * stale the moment someone acts on it.
   */
  const runWalk = useCallback(
    async (
      handle: FSDirectoryHandle,
      mode: "pick" | "recheck",
      /**
       * Where a FAILED walk leaves the user.
       *
       * An explicit argument since #26.04, and `mode` can no longer stand in
       * for it: the re-check button now exists on two screens — the structure
       * violation list and the folder report — and a failed re-check must
       * return to the one it was pressed from, not to whichever of the two the
       * mode happens to imply.
       */
      failurePhase: ImportPhase,
    ) => {
      // Everything below belongs to THIS token. Every `set*` after an await is
      // guarded on it, so a walk the user cancelled cannot put its folder,
      // its entries or its phase back on screen a second later.
      const token = beginRun();

      setWalkError(null);
      setMetaProgress({ done: 0, total: 0 });
      // Every check re-asks the tick. Cleared here rather than in the two
      // callers so that no route into a walk can skip it.
      setStructureAcknowledged(false);
      setPhase("walking");

      // A permission grant can lapse between two walks. `requestPermission`
      // only works inside a user gesture, which is exactly where this runs —
      // so ask, rather than letting the walk throw and sending the user back
      // through the OS picker this button exists to avoid.
      try {
        if (typeof handle.queryPermission === "function") {
          let state = await handle.queryPermission({ mode: "read" });
          if (state === "prompt" && typeof handle.requestPermission === "function") {
            state = await handle.requestPermission({ mode: "read" });
          }
          if (state === "denied") throw new Error("permission-denied");
        }
      } catch {
        // Fall through — the walk below reports the failure properly.
      }

      let walked: FSEntry[] = [];
      const seen: DirectoryObservation[] = [];
      try {
        // The observer records each directory's shape at the moment the walk
        // decides about it. Collected here rather than re-derived later because
        // by the time the walk returns its flat list, the evidence for WHY a
        // folder did not become one document is gone.
        walked = await walkFolder(handle, [], (o) => seen.push(o));
        if (token.cancelled) return;
      } catch {
        if (token.cancelled) return;
        // The DOMException message here is untranslated English ("A requested
        // file or directory could not be found"), which has no place in a
        // Romanian UI — and the folder may legitimately have moved, because
        // acting on this very report is what the user was told to do.
        setWalkError(t(mode === "recheck" ? "recheckFailed" : "walkFailed"));
        // Crucially, nothing above this point cleared the existing findings, so
        // a failed re-check returns the user to the list they were working
        // from rather than destroying it. Which list that is comes from the
        // caller (`failurePhase`) — see the parameter's note; a failed PICK has
        // just cleared one and belongs back at the Structure screen, where the
        // picker now lives.
        setPhase(failurePhase);
        return;
      }

      if (mode === "pick") {
        // A new folder is a new Property question — never carry the previous
        // run's answer over, or documents would silently land on the wrong one.
        setResolvedProperty(null);
        // ...and a new run for the Cancel's account of what it would leave
        // behind. Documents imported under the previous folder are still in the
        // archive, but they are not something cancelling THIS run abandons.
        setDocumentsCreated(false);
      }
      setRootFolderName(handle.name);
      setScanResults(new Map());
      setScanProgress({ done: 0, total: 0 });

      // Slice #24.02a — the walk ends here. It used to fall straight into the
      // classification pass in this same async block, which is how choosing a
      // folder came to cost one Claude call per image before anything had been
      // validated or shown. The scan waits for `startScan`, behind Continuă.
      setEntries(walked);
      setObservations(seen);

      /**
       * Slice #26.04 — the structure check, and the fork the whole stage turns
       * on.
       *
       * Computed from the local `seen` rather than from the `observations`
       * state set one line above: the phase decision cannot wait for a render,
       * and reading the state here would decide this walk's destination from
       * the PREVIOUS walk's observations — which, on the second turn of a
       * fix-and-re-check loop, is exactly the list the user has just fixed.
       *
       * `clean` and not `violations.length === 0`: a walk that gave up part-way
       * suppresses three of the rules, so an empty list from a truncated walk
       * is not a clean folder. See `checkStructureStage`.
       */
      const verdict = checkStructureStage(seen);
      if (!verdict.clean) {
        // Nothing below this point is worth paying for — the folder report is
        // unreachable until Structure passes. Metadata is dropped rather than
        // left standing, so no later render can pair this walk's entries with
        // the previous walk's file sizes.
        setMetadata(null);
        setPhase("structure-report");
        return;
      }

      // T1: one getFile() per file. Metadata only — it does not read contents
      // — but it is ~760 calls on Adrian's archive, so it reports progress
      // rather than assuming every machine is as quick as his.
      try {
        const meta = await readFileMetadata(walked, seen, {
          onProgress: (p) => {
            if (!token.cancelled) setMetaProgress(p);
          },
          isCancelled: () => token.cancelled,
        });
        if (token.cancelled) return;
        setMetadata(meta);
      } catch {
        if (token.cancelled) return;
        // The four size/MIME rules simply do not fire. Everything derived from
        // names still works, so a failure here degrades the report rather than
        // stopping the import.
        setMetadata(null);
      }

      if (token.cancelled) return;
      setPhase("folder-report");
    },
    [t, beginRun],
  );

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
    folderPickedRef.current = true;
    // Named here rather than only after the walk resolves.
    //
    // Fixed in passing (#26.04): a walk that FAILED left this holding the
    // PREVIOUS folder's name while `_dirHandle` already held the new one — so
    // the toolbar said `📁 Arhiva 2024` and Verifică din nou re-walked
    // `Arhiva 2025`. `_dirHandle` is the fact; the name must follow it, and it
    // is known the moment the picker returns.
    //
    // It does not weaken what the Cancel dialog reads: that asks
    // `folderPickedRef`, precisely because a display name is not the fact.
    setRootFolderName(handle.name);
    // A different folder: drop the previous one's report before walking, so a
    // slow or failing walk cannot leave folder A's findings under folder B's
    // name. A RE-check deliberately does the opposite and keeps them.
    setEntries([]);
    setObservations([]);
    setMetadata(null);
    await runWalk(handle, "pick", "structure");
  }, [t, runWalk]);

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
    // The scan belongs to the walk that produced `walked`, so it takes that
    // run's token rather than minting a new one: cancelling the run has to
    // stop both, and a fresh token here would hand the scan a flag the Cancel
    // had already set and then discarded.
    const token = runTokenRef.current;

    setPhase("scanning");
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
          if (token.cancelled) { resolve(); return; }
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
              if (token.cancelled) return;
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
              if (token.cancelled) return;
              setScanResults((prev) => {
                const next = new Map(prev);
                next.set(entry.path, { status: "error", errorMsg: "Scan failed" });
                return next;
              });
            })
            .finally(() => {
              if (token.cancelled) { resolve(); return; }
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

    if (!token.cancelled) {
      setPhase("ready");
    }
  }, []);

  /**
   * "I have fixed the files — check again." Re-walks the folder already
   * picked, with no picker dialog.
   *
   * A handle can stop working between the first walk and this one: the folder
   * may have been moved or unmounted, or the permission may have lapsed. The
   * walk's own error path already covers that — it surfaces `walkError` and
   * puts the user back on the screen they pressed the button from, where the
   * "choose another folder" control sits beside this one.
   *
   * ⚠️ #26.04's brief names this explicitly: **re-checking must not require
   * re-picking the folder, and that must survive.** It does — the module-level
   * `_dirHandle` is untouched by this slice, and the only thing that changed is
   * which screen the button is drawn on.
   */
  const handleRecheck = useCallback(async () => {
    // Where a FAILED re-check puts the user back. The button exists on exactly
    // two screens since #26.04, and each must return to itself: the structure
    // violation list is a to-do list the user is working through, and the
    // folder report is the same thing one stage later. Anything else throws
    // away the list they were reading because the FOLDER went missing.
    const returnTo: ImportPhase =
      phase === "folder-report" ? "folder-report" : "structure-report";

    if (!_dirHandle) {
      // Fixed in passing (#26.03): this used to return in silence, so a button
      // that had lost its handle would have done nothing at all — no message,
      // no cue — and the user would have been left pressing it.
      //
      // No route to it is known: the button only exists at `folder-report`, and
      // every route into that phase runs through a walk whose handle was
      // non-null. It is a guard against a future one, not a fix for a reported
      // bug, and it is here rather than deleted because the alternative to a
      // message is silence.
      setWalkError(t("recheckFailed"));
      return;
    }
    await runWalk(_dirHandle, "recheck", returnTo);
  }, [runWalk, t, phase]);

  /**
   * Slice #26.03 — renounce the run and go back to the beginning.
   *
   * Called only from the confirmation dialog, which has already told the user
   * what stays behind. What it does is deliberately total: every trace of the
   * run in this component is dropped, including the directory handle, and the
   * shell returns to Information with the indicator all grey again. A partial
   * reset — keeping the folder, say — would leave the indicator claiming a
   * stage the state no longer supports.
   *
   * Two things it does NOT touch, and both are stated in the dialog: documents
   * and Properties already written are left in the archive (removing them is a
   * deletion, and a Cancel is not a licence to delete), and the saved report of
   * the previous run stays in localStorage.
   */
  const handleCancelConfirmed = useCallback(() => {
    // Retires the run's token, which is what actually stops the walk, the
    // metadata pass and the scan — and, crucially, keeps them stopped: the
    // token is never handed back, so a fetch that settles after this point
    // finds its own flag set and writes nothing.
    endRun();
    _dirHandle = null;
    folderPickedRef.current = false;

    setCancelSnapshot(null);
    setPhase("information");
    // The preconditions are re-asked on the way back through, rather than
    // trusted from before: a cancel can be minutes or hours after they passed,
    // and a stale green tick is exactly the kind of confident output this
    // codebase has been bitten by.
    setPreflightPassed(false);

    setRootFolderName("");
    setEntries([]);
    setObservations([]);
    setMetadata(null);
    setMetaProgress({ done: 0, total: 0 });
    setScanResults(new Map());
    setScanProgress({ done: 0, total: 0 });
    setResolvedProperty(null);
    setDocumentsCreated(false);
    setWalkError(null);
    setShowQuiet(false);
    setShowSkipped(false);
    // Slice #26.04 — the Structure screen goes back to how a first-time visitor
    // meets it: rules open, nothing ticked. A tick carried over from a
    // renounced run would let the next one pick a folder without ever having
    // read the rules on the way past.
    setStructureAcknowledged(false);
    setStructureRulesOpen(false);
  }, [endRun]);

  // Mint a token for this mount, and retire whatever token is live on unmount —
  // which is what cancels the walk, the metadata pass and the scan when the
  // user navigates away mid-run.
  //
  // The minting half exists for StrictMode: its simulated unmount runs the
  // cleanup, so without a fresh token here the module would sit in development
  // with `runTokenRef.current.cancelled === true` from first mount.
  useEffect(() => {
    // Deliberately `[]` and deliberately NOT calling `beginRun`/`endRun`: with
    // those in the dep list, the day either callback gains a dependency this
    // effect re-runs mid-walk, retires the live token, and every
    // `if (token.cancelled) return` fires at once — the walk dies in silence
    // with the phase stuck on `walking` and the cue blinking for ever.
    runTokenRef.current = { cancelled: false };
    // The cleanup reads the ref, it does NOT close over the token minted
    // above. `runWalk` calls `beginRun()`, which installs a different object —
    // so a cleanup holding the mount token would be setting a flag nothing
    // reads, and navigating away mid-run would leave ~760 getFile() calls and
    // the rest of the folder's classification queue running against a dead
    // component. (That is what the single boolean ref this replaced got right
    // for free, and it is the one thing a token-per-run must not lose.)
    return () => { runTokenRef.current.cancelled = true; };
  }, []);

  // -------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------

  const folders = collectFolders(entries, rootFolderName);

  const scannableCount = entries.filter(entryScannable).length;
  const scanDone = phase === "ready";

  /**
   * The three phases the Structure panel owns.   (Slice #26.04)
   *
   * `walking` is one of them and that is the whole shape of the stage: the walk
   * exists to answer the structure question, so the panel stays on screen while
   * it runs rather than being replaced by a bare spinner and then re-appearing
   * with a different answer.
   */
  const inStructure =
    phase === "structure" || phase === "walking" || phase === "structure-report";

  // Derived at render time rather than copied into state when the walk ends:
  // one copy cannot drift from the list the user is looking at. Cheap — it is
  // a single pass over names, no file contents and no I/O.
  const forecast = useMemo(() => forecastImport(entries), [entries]);

  /**
   * The Structure verdict on screen.   (Slice #26.04)
   *
   * Derived, not stored, for the same reason as the forecast and the report —
   * and `null` when nothing has been walked, which is what tells the panel to
   * show the rules alone rather than an all-clear nobody earned.
   *
   * `observations.length === 0` is a sound test for "no walk yet": `walkFolder`
   * observes every directory it visits including the chosen folder itself, so
   * one observation is the minimum a completed walk can produce — an EMPTY
   * folder still yields its own.
   *
   * `runWalk` computes the same verdict from its local `seen` to choose the
   * next phase. That is not a second copy of the rule: it is the same pure
   * function over the same array, called once because a phase decision cannot
   * wait for a render and once because a render cannot read a local.
   */
  const structureVerdict = useMemo(
    () => (observations.length === 0 ? null : checkStructureStage(observations)),
    [observations],
  );

  /**
   * Has this run already paid for classification?   (Slice #26.03)
   *
   * Read off the scan RESULTS, not off `scanProgress.done`, and counting BOTH
   * `done` and `error`. Two wrong answers were tried first, and each is a lie
   * in the dialog that exists to stop lies:
   *
   *  - `scanProgress.done > 0` counts every settled request including the ones
   *    that never reached the model, so a run that fell over locally would be
   *    reported as paid for.
   *  - `some(status === "done")` counts only answers, so with the scan route
   *    down every entry errors, nothing is `done`, and the dialog tells a user
   *    staring at a table of red rows that nothing was sent — after every file
   *    was sent and billed.
   *
   * A settled request is a spent one. `error` is evidence of sending; only
   * `pending` and `skip` are evidence of not having sent.
   *
   * A boolean rather than the `Map` itself, so that `openCancelDialog` depends
   * on the FACT rather than on the container: `scanResults` is a fresh `Map` on
   * every classification, so a dep on it gives the callback a new identity ~760
   * times on Adrian's archive, where the answer changed at most once. (That is
   * a tidiness argument, not a performance one — `ImportStageBar` is not
   * memoised, so it re-renders on every scan result either way.)
   */
  const classificationSpent = useMemo(
    () =>
      [...scanResults.values()].some(
        (r) => r.status === "done" || r.status === "error",
      ),
    [scanResults],
  );

  // Pure, and derived at render time for the same reason as the forecast: a
  // copy in state is a copy that can disagree with the list on screen.
  const report = useMemo(
    () =>
      checkFolder({
        entries,
        observations,
        metadata: metadata ?? undefined,
      }),
    [entries, observations, metadata],
  );

  /**
   * Freeze the facts at the moment the Cancel is pressed. See `cancelFacts`
   * above for why this is a snapshot and not a live read.
   *
   * The facts are frozen here rather than read at render — see `cancelSnapshot`
   * above.
   */
  const openCancelDialog = useCallback(() => {
    // Belt and braces beside the disabled button in the stage bar. While a
    // modal owns the screen this confirmation must not be openable at all:
    // both it and `TagDialog` listen for Escape on `window`, so one press
    // would dismiss this dialog AND cancel the step underneath it — the user
    // answers "no, keep importing" and is thrown out of the tag step.
    if (MODAL_PHASES.includes(phase)) return;

    cancelOpenerRef.current =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;

    setCancelSnapshot({
      stage: stageForPhase(phase),
      facts: {
        // Neither the display name nor the module-level handle.
        //
        // `rootFolderName` is a DISPLAY value, and this codebase's own rule is
        // that a display value must never double as a lock. (It used to have a
        // second fault as well — it was set only after the walk resolved, so it
        // read empty through the whole `walking` phase, where the ~760-file
        // metadata pass lives and a user is very likely to give up. #26.04
        // moved it to the moment the picker returns, which fixes that one and
        // changes nothing here: it is still a name, not a fact.)
        //
        // `_dirHandle` has the opposite fault: it is a module singleton that
        // outlives the component, so after an import, a route change and a
        // return, it still holds the previous visit's folder and the dialog
        // would offer to forget one the user has not picked.
        //
        // A ref set when the picker returns and cleared by the Cancel is the
        // fact itself: this visit has a folder.
        folderPicked: folderPickedRef.current,
        classificationSpent,
        classificationRunning: phase === "scanning",
        propertyResolved: resolvedProperty !== null,
        documentsCreated,
        savedReportExists: savedSession !== null,
      },
    });
    // `_dirHandle` is a module-level singleton read inside an event handler,
    // never during render, so it needs no dependency and cannot go stale here.
  }, [classificationSpent, phase, resolvedProperty, documentsCreated, savedSession]);

  const dismissCancelDialog = useCallback(() => setCancelSnapshot(null), []);

  useEffect(() => {
    if (cancelSnapshot !== null) return;
    const opener = cancelOpenerRef.current;
    if (!opener) return;
    cancelOpenerRef.current = null;
    opener.focus?.();
  }, [cancelSnapshot]);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  return (
    <div>
      {/*
        Slice #26.03 — everything except the cancel confirmation lives inside
        this wrapper, and the wrapper goes `inert` while that confirmation is
        open.

        This is not belt-and-braces; without it the confirmation is a dialog in
        name only. None of this app's dialogs traps focus or marks the
        background inert, and `aria-modal` does nothing at all to sequential
        keyboard focus — so from the open confirmation a Tab or two reaches the
        Import button behind it, and Enter there starts the property step, the
        tag step and the bulk import WITH THE CONFIRMATION STILL OPEN, still
        showing the frozen facts it captured before any of that. Confirming
        then unmounts a running import loop mid-write, which is the one outcome
        the whole design is arranged to prevent — and on the way there two
        window-level Escape handlers coexist, so one press dismisses this
        dialog and cancels the step underneath it.

        `inert` is one attribute and closes all of it: nothing inside can take
        focus, so nothing inside can change the phase while the user is being
        asked a question about it.
      */}
      <div className="space-y-4" inert={cancelSnapshot !== null}>
      {/* The shell. Present in every phase, so the user can always see which of
          the ten stages they are in and always has a way out. */}
      <ImportStageBar phase={phase} onCancel={openCancelDialog} />

      {/* Step zero — what the import is going to ask of the user. */}
      {phase === "information" && (
        <ImportInformation onAcknowledge={() => setPhase("preflight")} />
      )}

      {/* Toolbar row. Hidden on the two screens where every one of its children
          is gated off, so the Information and preconditions cards do not sit
          under an empty flex row that still spends a gap.

          `empty:hidden` closes the case #26.04 introduced: on the Structure
          screen with no saved session and no folder yet, every child is gated
          off too, and the phase list above cannot say so without restating each
          child's condition — which is two copies of the same set, one of which
          would go stale. `:empty` asks the DOM instead. React renders a false
          branch as nothing at all, and JSX strips whitespace-only lines, so the
          div genuinely has no child nodes; if that ever stopped being true the
          row would simply reappear, which is today's behaviour. */}
      {phase !== "information" && phase !== "preflight" && (
      <div className="flex items-center gap-3 flex-wrap empty:hidden">
        {/* Slice #24.02a — the picker does not exist until every precondition
            is green. Rendering it disabled would invite the user to click at
            it; not rendering it at all makes the checklist the only thing on
            screen with something to do. */}
        {/* Hidden during `folder-report`: that panel carries its own
            "choose another folder", and two controls with different labels
            doing the same thing is a question the user has to stop and
            answer. Hidden through the Structure phases since #26.04 for the
            stronger version of the same reason: the picker there is BEHIND a
            tick, and a second copy of it up here would be a way round the gate
            rather than merely a duplicate.

            ⚠️ And hidden at `resumed`, which is the route that made the last
            sentence true rather than decorative: the resume button is on the
            Structure screen, so Structure → Reia → Alege folder… was two clicks
            from the gate to the OS picker with the tick never touched. The
            resumed view's only intended control is "Import nou", which is what
            its own comment below has said since #24.02a. */}
        {preflightPassed && phase !== "folder-report" && phase !== "resumed" && !inStructure && (
          <button
            type="button"
            onClick={handlePickFolder}
            disabled={phase === "scanning" || phase === "importing"}
            className={buttonClass({ variant: "primary", size: "lg" })}
          >
            {rootFolderName ? t("changeFolderButton") : t("chooseFolderButton")}
          </button>
        )}

        {/* Resume last session — stays gated on the Structure screen, i.e.
            behind the checklist, and only before a folder has been walked.
            Slice #24.02a briefly made it reachable from `preflight` on the
            grounds that a resumed session touches no filesystem — but
            ResumedSessionView's only control is "new import", which CLEARS the
            saved session. Reaching it with failing preconditions would have
            meant the sole way back to the checklist was destroying the record
            of the previous run. */}
        {phase === "structure" && savedSession && (
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

        {/* Slice #26.04 — the walking cue used to live here as a toolbar chip.
            It moved into `ImportStructureStage`, because `walking` is now
            always a Structure phase, so a copy up here could only ever say the
            same sentence twice — once in this row's `role="status"` and once
            in the panel's `ActivityCue`, which is also one. The two SENTENCES
            did not move: the panel is handed them already translated, out of
            `adminImport.wizard`, so no key was renamed. */}

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
      )}

      {/* The preconditions. Shown until they all pass. Unchanged by #26.03 —
          it starts one click later, and nothing else about it moved. */}
      {phase === "preflight" && (
        <PreflightChecklist onVerdict={handlePreflightVerdict} />
      )}

      {/* Slice #26.04 — the Structure stage: the rules, the tick, the picker,
          and the fix-and-re-check loop. One panel across all three of its
          phases, so a check does not swap the screen out from under the reader
          and back again. */}
      {inStructure && (
        <ImportStructureStage
          verdict={structureVerdict}
          folderName={rootFolderName}
          busy={phase === "walking"}
          busyLabel={
            // Two sentences, and which one is true says where the walk is:
            // the metadata pass reports a running count, and it only starts
            // once the structure has already passed.
            metaProgress.total > 0
              ? t("readingMetadata", { done: metaProgress.done, total: metaProgress.total })
              : t("walkingFolder")
          }
          acknowledged={structureAcknowledged}
          onAcknowledgedChange={setStructureAcknowledged}
          onChooseFolder={handlePickFolder}
          onRecheck={() => void handleRecheck()}
          rulesOpen={structureRulesOpen}
          onRulesOpenChange={setStructureRulesOpen}
        />
      )}

      {/* The walk is done and nothing has been spent yet. */}
      {phase === "folder-report" && (
        <>
          <FolderForecast
            rootFolderName={rootFolderName}
            forecast={forecast}
            uploadBytes={report.uploadBytes}
            droppedCount={report.droppedCount}
            onContinue={() => void startScan(entries)}
            onChangeFolder={handlePickFolder}
            onRecheck={() => void handleRecheck()}
          />
          <ReportSections
            report={report}
            forecast={forecast}
            uploadBytes={report.uploadBytes}
            folderName={rootFolderName}
            showQuiet={showQuiet}
            onShowQuietChange={setShowQuiet}
            showSkipped={showSkipped}
            onShowSkippedChange={setShowSkipped}
          />
        </>
      )}

      {/* Walk error.

          `role="alert"` since #26.04, and it is the loop that earns it. A
          failed RE-check leaves the previous round's violation list on screen
          unchanged — correctly, because it is still the best information there
          is — so the only thing that says "this list is not the answer to the
          button you just pressed" is this sentence. Without a live region a
          screen-reader user hears the panel re-announce the old count and has
          no way to know the check never ran.

          `alert` and not `status`, against this codebase's usual preference:
          the precedent (`scan-confidence-warning.tsx`) reserves `alert` for a
          red warning that something is wrong, and a walk that could not read
          the folder is exactly that. */}
      {walkError && (
        <div
          role="alert"
          className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
        >
          {walkError}
        </div>
      )}

      {/* File table — listed by the phases that MAY show it rather than by the
          ones that may not.

          It was the other way round until #26.04, and the new phases are what
          broke it: `structure-report` walks a folder, so `entries` is non-empty
          there, and an exclusion list that had never heard of it would have put
          a table of files with blank statuses under a list of structure
          violations. The scan is the only thing that fills those cells, so the
          phases where the table has anything to say are exactly the ones from
          the classification pass onwards — and a positive list cannot be made
          wrong by a phase nobody thought to add to it. */}
      {entries.length > 0 &&
        (phase === "scanning" ||
          phase === "ready" ||
          phase === "property" ||
          phase === "tag-dialog" ||
          phase === "importing") && (
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
            // Fixed in passing (#26.03): the fallback used to be `preflight`,
            // under a comment claiming the resume button is reachable from
            // there. It is not — the button is gated on the Structure screen —
            // and since #26.03 the first screen is `information`, so a fallback
            // that skipped it would drop the user into the checklist with no
            // explanation of what the import is about to ask of them.
            setPhase(preflightPassed ? "structure" : "information");
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
          // Slice #26.03 — the first Document of the run has been created, so
          // from now on cancelling leaves records behind and the confirmation
          // has to say so. Fired on the create rather than when this dialog
          // opened: a run that fails on document zero must not send a business
          // user hunting the documents list for rows that were never written.
          onFirstDocumentCreated={() => setDocumentsCreated(true)}
          onClose={() => {
            setPhase("ready");
            // Slice #26.03 — the dialog writes the run's report to
            // localStorage as it finishes, and this state was read once at
            // mount and never again, so the report existed while the wizard
            // believed it did not. That made the Cancel omit the one
            // reassurance that stops a user fearing the report went with the
            // run, and left Resume invisible until a page reload.
            setSavedSession(loadSavedSession());
          }}
        />
      )}

      </div>

      {/* Slice #26.03 — the Cancel's confirmation. Its facts AND its stage name
          were frozen when the button was pressed (see `openCancelDialog`), so
          nothing it says can rewrite itself, and the buttons cannot move, while
          it is being read. It sits outside the wrapper above because that
          wrapper is what it makes inert. */}
      {cancelSnapshot && (
        <CancelImportDialog
          stageLabel={tStage(`stage.${cancelSnapshot.stage}`)}
          facts={cancelSnapshot.facts}
          onConfirm={handleCancelConfirmed}
          onDismiss={dismissCancelDialog}
        />
      )}
    </div>
  );
}
