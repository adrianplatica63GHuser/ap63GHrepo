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
 * next stage with Structure green behind them.
 *
 * THE CONSTRAINTS STAGE  (Slice #26.05)
 * ─────────────────────────────────────
 * A clean structure check no longer lands on the Evaluation screen. It lands on
 * `ImportConstraintsStage`, which presents what the FILES must satisfy and then
 * runs the identical loop against the same folder — no re-picking, exactly as
 * #26.04's constraint requires and for the same reason.
 *
 * ⚠️ **The metadata pass moved with it, and that is the whole reason `runWalk`
 * now takes a `target`.** It is ~760 `getFile()` calls on Adrian's archive, and
 * it exists to answer four constraints (a file's size, and the type Windows
 * reports for it). Leaving it on the structure round would mean paying for it
 * on every turn of a loop the user may go round several times before a single
 * constraint has been looked at — so a structure check now STOPS at the
 * verdict, and the pass runs when the Constraints button is pressed.
 *
 * THE PRE-EXISTING STAGE  (Slice #26.08)
 * ──────────────────────────────────────
 * A clean duplication check no longer lands on the Evaluation screen either. It
 * lands on `ImportPreexistingStage`, the first stage that asks a question of
 * the ARCHIVE rather than of the folder — and the first that does not block:
 * nothing there is a fault, so the user reads what the import will do with the
 * documents the system already holds, ticks, and carries on.
 *
 * ⚠️ **Its answer is STATE, not a `useMemo`, and that is the one structural
 * difference between it and the three stages before it.** Those three derive
 * their verdict at render time from `entries`, `observations` and `metadata`,
 * because their checks are pure functions over data already in hand. This one
 * needs a round trip to the server, so the verdict cannot be re-derived during
 * a render — it is computed once in `runWalk` and published in the same commit
 * as everything else that walk produced. `preexisting === null` is therefore
 * "not asked in this run", exactly as `metadata === null` is "not measured".
 *
 * EVALUATION, SCANNING AND IMPORT  (Slice #26.09)
 * ───────────────────────────────────────────────
 * The last three screens of the flow that existed before the shell are stages
 * like any other now. Evaluation was already a panel — `FolderForecast` and the
 * report under it — and it is unchanged. Scanning and Import were not: a
 * running scan announced itself as a sentence in the toolbar row, and the one
 * button in the whole workflow that writes to the archive sat in that same row
 * with `ml-auto` and no sentence anywhere saying what it would do. Both now
 * have a panel, `ImportScanningStage` and `ImportRunStage`, and the toolbar
 * row keeps only what is about the RUN rather than about a stage: the folder's
 * name and the property chips.
 *
 * ⚠️ **The folder picker left the toolbar with them, and that closes a hole
 * rather than tidying one.** Every stage panel from #26.04 onwards carries its
 * own "choose another folder" behind that stage's tick; a second copy two rows
 * above them was a way round the gate. The remaining routes to the picker are
 * the five panels' own buttons.
 *
 * ⚠️ **AI interpretation is no longer a button.** The brief's sentence is that
 * all of it happens automatically during the import run, so `BulkImportDialog`
 * reads every document it creates and the row reports what came back. What that
 * costs is on the Import panel, before the click — see `ImportRunStage`.
 *
 * ⚠️ **A constraints check re-walks the folder first, and may fail back to
 * Structure.** That is not defensive: the user has been in File Explorer since
 * the last check, and a file deleted to fix a constraint can leave a page
 * folder numbered 1, 2, 4. Re-running the structure check is the only way the
 * stage's own precondition stays true, and landing back on `structure-report`
 * when it does not is the honest outcome.
 *
 * File System Access API handles are stored in a module-level singleton so
 * they survive React unmount/remount (handles cannot be serialised).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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
import { ImportSummaryDialog } from "./import-summary-dialog";
import type { ImportRunSummary } from "@/lib/import/import-outcome";
import {
  PropertyStepDialog,
  type ResolvedProperty,
  type ResolvedRun,
} from "./property-step-dialog";
import { ResumedSessionView } from "./resumed-session-view";
import { ImportCheckResult, PropertyNameReadings } from "./import-check-result";
import { PreflightChecklist } from "./preflight-checklist";
import { FolderForecast } from "./folder-forecast";
import { forecastImport } from "@/lib/import/preflight";
import {
  summariseConstraints,
  summariseDuplication,
  summariseStructure,
} from "@/lib/import/check-summary";
import { ReportSections, reportHasNothingToSay } from "./report-sections";
import { checkFolder, uploadKeysOf, type FileMeta } from "@/lib/import/checks";
import { readFileMetadata } from "@/lib/import/metadata-pass";
import type { DirectoryObservation } from "@/lib/import/folder-utils";
import { ImportStageBar, MODAL_PHASES } from "./import-stage-bar";
import { ImportInformation } from "./import-information";
import { ImportStructureStage } from "./import-structure-stage";
import { ImportConstraintsStage } from "./import-constraints-stage";
import { ImportDuplicationStage } from "./import-duplication-stage";
import { ImportPreexistingStage } from "./import-preexisting-stage";
import { shouldInterpretEntry } from "@/lib/import/ai-interpret-run";
import { isIdCardEntry } from "@/lib/import/id-card";
import { ImportScanningStage } from "./import-scanning-stage";
import { ImportStepGate, STAGES_WITH_NEXT_ACTION } from "./import-step-gate";
import { auditSavedSession, type SavedSessionAudit } from "@/lib/import/session-client";
import { ImportRunStage } from "./import-run-stage";
import { CancelImportDialog } from "./cancel-import-dialog";
import { checkStructureStage } from "@/lib/import/structure-check";
import {
  SHARED_FOLDER_DISPLAY_NAMES,
  type PropertyConfirmation,
  type PropertyConfirmations,
} from "@/lib/import/structure-rules";
import { checkConstraintsStage } from "@/lib/import/constraint-check";
import { checkDuplicationStage } from "@/lib/import/duplication-check";
import {
  checkPreexistingStage,
  preexistingCandidatesOf,
  preexistingDecisionsByPath,
  type PreexistingResult,
  type PreexistingRow,
} from "@/lib/import/preexisting-check";
import { lookupPreexisting } from "@/lib/import/preexisting-client";
import {
  phaseAfterClassification,
  phaseAfterFileChecks,
  stageForPhase,
  stepThroughRest,
  type ImportPhase,
  type WalkTarget,
  type WorkflowStageId,
} from "@/lib/import/workflow-stages";
import {
  catalogueIsUsable,
  checkTypeForms,
  noClassificationHappened,
  typesAreClean,
  type ClassifiedEntry,
  type TypeFormLookup,
} from "@/lib/import/type-form-gate";
import { fetchDocumentTypeCatalogue } from "@/lib/import/document-type-catalogue";
import { ImportTypesBlockedStage } from "./import-types-blocked-stage";
import { ImportCardsBlockedStage } from "./import-cards-blocked-stage";
import {
  cardsAreClean,
  checkMultiCard,
  type MultiCardEntry,
  type MultiCardVerdict,
} from "@/lib/import/multi-card-gate";
import type { CancelFacts } from "@/lib/import/cancel-consequences";

// ---------------------------------------------------------------------------
// Module-level singleton — preserves FS handles across React re-renders
// ---------------------------------------------------------------------------

let _dirHandle: FSDirectoryHandle | null = null;

/**
 * How many property-folder name readings the Structure result lists.
 *                                                            (Slice #29.11)
 *
 * STR-02 caps a run at five property folders and a clean verdict is the only
 * state this card is drawn in, so this ceiling is not reachable today. It is
 * here because the cap is a rule that can be raised in a slice that never looks
 * at this file, and an unbounded list of folder-name readings would then be the
 * whole screen. A count of what is not shown goes under the list rather than
 * the list silently ending — "no silent caps" is the same rule the folder
 * report's `MAX_PATHS_SHOWN` follows.
 */
const MAX_NAME_READINGS_SHOWN = 5;

// ---------------------------------------------------------------------------
// Scan helpers
// ---------------------------------------------------------------------------

// Slice #24.03: the local IMAGE_EXTS set, PDF_EXT and extOf are gone. Which
// extensions are images, which is a PDF, and how an extension is read are all
// asked of the file-kind registry in src/lib/files/file-kinds.ts — the same
// module the folder walk, the coordinate shortlist and the provenance rules
// now read from, so "scannable here" and "an image there" can no longer drift.

/**
 * What the classifier said about each entry, as the type gate needs it.
 *                                                            (Slice #29.08)
 *
 * ⚠️ **ONLY A `done` ROW IS AN ANSWER, and the run agrees with that by
 * ACCIDENT rather than by testing it.** `startScan` seeds `scanResults` with a
 * bare status for EVERY walked entry, so presence in the map proves nothing.
 * `bulk-import-dialog.tsx` passes `{ typeKey: sr?.typeKey, label:
 * sr?.description }` to `ensureDocType` with no status test at all — it reads
 * `status === "done"` only afterwards, to decide whether the ROW reports how
 * the type was resolved. The two agree today because `startScan` replaces the
 * whole `ScanResult` object on every transition, so a non-`done` row carries
 * neither field. That is a property of one function rather than a shared rule,
 * and it is recorded here because the day it stops holding the wizard would
 * filter where the run does not: two writers, one folder, different types.
 *
 * `pending`, `skip`, `preexisting` and `error` all come through here as `null`,
 * which `checkTypeForms` counts as heading for the catch-all and does not block
 * on.
 *
 * One function for both callers — the end of the scan, and the stop screen's
 * "try again" — so the two cannot come to disagree about what an answer is.
 */
function classifiedEntriesOf(
  entries: readonly FSEntry[],
  results: ReadonlyMap<string, ScanResult>,
): ClassifiedEntry[] {
  return entries.map((entry) => {
    const result = results.get(entry.path);
    return {
      path: entry.path,
      answer:
        result?.status === "done"
          ? { typeKey: result.typeKey, label: result.description }
          : null,
      // The weaker of the two identity-card signals, and the gate uses it only
      // for a type the archive does not hold — see `ClassifiedEntry`. The same
      // call `interpretUpperBound` already makes one screen later.
      isIdCard: isIdCardEntry(result),
      // ⚠️ **CARRIED, NOT FETCHED.**                            (Slice #32.02)
      // `confidence` is already on the `ScanResult` this line is reading — the
      // scan route returns it and the row above stores it — so the stop
      // screen's per-file justification costs no request, no prompt change and
      // not one extra token. Gated on `done` for the same reason `answer` is:
      // a `pending`, `skip`, `preexisting` or `error` row has no answer to be
      // confident about, and a value surviving from a previous transition would
      // be a claim about a scan that did not happen.
      confidence: result?.status === "done" ? result.confidence : undefined,
    };
  });
}

/**
 * What the classifier said about how many PEOPLE each entry's identity
 * document shows, as the multi-card gate needs it.             (Slice #32.08)
 *
 * ⚠️ **THE SAME `done` RULE `classifiedEntriesOf` STATES ABOVE, and for the
 * same reason.** `startScan` seeds `scanResults` with a bare status for every
 * walked entry, so presence in the map proves nothing; a `pending`, `skip`,
 * `preexisting` or `error` row carries no answer, and a count surviving from a
 * previous transition would be a claim about a scan that did not happen. The
 * two functions are deliberately separate rather than one returning both
 * shapes: the type gate and this gate take different inputs, are asked at
 * different moments, and folding them would make each one's test drag the
 * other's fixtures in.
 *
 * Not fetched, not asked for twice: the count came back with the classification
 * that was already paid for, and the row above stores it.
 */
function multiCardEntriesOf(
  entries: readonly FSEntry[],
  results: ReadonlyMap<string, ScanResult>,
): MultiCardEntry[] {
  return entries.map((entry) => {
    const result = results.get(entry.path);
    return {
      /**
       * ⚠️ **THE PAGE THE CLASSIFICATION ACTUALLY LOOKED AT, NOT THE ENTRY'S
       * OWN PATH — and for a page group those are different things.**
       * (Found by an adversarial round.) `FSPageGroupEntry.path` is the
       * SUBFOLDER, so a verdict keyed on it put a directory on a screen that
       * says "this scan has to be split", over an instruction to split "the
       * file" — and the user opening that folder finds twenty numbered scans
       * and no indication which one. `scanEntry` sends `handles[0]`, so that is
       * the file the count is about and that is the file to split.
       *
       * Nothing downstream needs this to be the entry key: the gate carries the
       * string, the panel prints it, and React keys the row on it — and it is
       * still unique per entry, because a page group's first page name is
       * unique within its own folder.
       */
      path:
        entry.kind === "page-group" && entry.handles.length > 0
          ? `${entry.path}/${entry.handles[0].name}`
          : entry.path,
      identityPersonCount:
        result?.status === "done" ? (result.identityPersonCount ?? null) : null,
    };
  });
}

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
  /**
   * How many distinct people's identity documents this page shows.
   *                                                            (Slice #32.08)
   *
   * ⚠️ **DECLARED HERE BECAUSE LEAVING IT OFF MADE THE WHOLE GATE DEAD CODE,
   * SILENTLY, AND `tsc` STAYED GREEN.** The gate read `undefined` for every
   * entry, answered `clean` on every folder, and the stop screen became
   * unreachable in production. Found by an adversarial round.
   *
   * ⚠️ **THIS DECLARATION IS NOT WHAT PREVENTS A REPEAT, and a SECOND round
   * corrected the first fix's claim that it was.** Declaring the field here
   * only makes READING it type-safe. What makes OMITTING it an error is that
   * `ScanResult.identityPersonCount` is REQUIRED (see `scan-table.tsx`), which
   * is why every other construction site in this file now sets it to `null`.
   */
  identityPersonCount: number | null;
  notes: string | null;
}> {
  let file: File;
  if (entry.kind === "page-group") {
    // ⚠️ **THE FIRST PAGE OF THE GROUP, AND THE MULTI-CARD GATE INHERITS THAT
    // LIMIT.** (Slice #32.08.) A two-card sheet on page four of a group is not
    // seen here. Which refusal picks it up depends on what the run reads the
    // group AS, and the rule is narrower than it looks — the AI read is given
    // every page and is skipped only for a card that can actually produce a
    // person. `multi-card-gate.ts`'s header states the division and the
    // residual gap rather than promising what this line cannot deliver.
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

/**
 * Carry `ResolvedProperty.created` forward across attempts.   (Slice #26.10)
 *
 * ⚠️ **`created` is a fact about the RUN; every other field on that type is a
 * fact about the ATTEMPT** — and an adversarial round found the difference the
 * hard way. `PropertyStepDialog` sets it from the same expression that counts
 * what THIS attempt wrote, so a folder created on attempt one comes back from
 * attempt two as `{outcome: "linked", cornersAdded: 0}` — nothing left to write,
 * because attempt one wrote it — and reports `created: false`. Replacing the
 * entry by `folderName`, which both call sites do and must, then erases the
 * only record that this run put a Property in the archive.
 *
 * What that costs is not cosmetic: `runLandedSomething` reads it. A run that
 * created two Properties on attempt one, was retried, and then lost every
 * document to an expired session would close with no concluding message, no
 * statistics and no navigation — and nothing anywhere saying that two real
 * Properties are now in the archive. That is the exact state the flag was added
 * to prevent, inverted.
 *
 * The same shape as `cornersWrittenBefore`, which the dialog already takes back
 * from the wizard for the same reason: only the thing that outlives the attempts
 * can remember them.
 */
function keepCreated(
  previous: readonly ResolvedProperty[],
  incoming: ResolvedProperty,
): ResolvedProperty {
  const before = previous.find((p) => p.folderName === incoming.folderName);
  return before?.created === true && !incoming.created
    ? { ...incoming, created: true }
    : incoming;
}

export function ImportWizard() {
  const t = useTranslations("adminImport.wizard");
  const tStage = useTranslations("adminImport.workflow");
  /** Slice #29.02 — for the always-mounted live region; the card has its own. */
  const tStepGate = useTranslations("adminImport.stepGate");
  /** Slice #29.08 — the same region announces the stop; see its comment. */
  const tTypesBlocked = useTranslations("adminImport.typesBlocked");
  /** Slice #32.08 — the identity-scan stop screen's own namespace. */
  const tCardsBlocked = useTranslations("adminImport.cardsBlocked");
  /** Slice #29.11 — the account a clean check gives of what it looked at. */
  const tCheck = useTranslations("adminImport.checkResult");
  /**
   * The Cancel dialog's own namespace — for its BUTTON's label, not its copy.
   *                                                            (Slice #32.04)
   *
   * `recheckFailed` ends by telling the user what to do about a folder that has
   * moved, and it named a control that no longer exists on any screen it can
   * appear on. The route that does exist is the stage bar's Cancel, and the
   * sentence names it by interpolation rather than by a second copy of its
   * label — the rule this slice applied at four other sites.
   */
  const tCancel = useTranslations("adminImport.cancel");
  const [phase, setPhase] = useState<ImportPhase>("information");
  const [rootFolderName, setRootFolderName] = useState<string>("");
  const [entries, setEntries] = useState<FSEntry[]>([]);
  const [scanResults, setScanResults] = useState<Map<string, ScanResult>>(new Map());
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [walkError, setWalkError] = useState<string | null>(null);
  /**
   * The Properties this run resolved, and which entry belongs to which.
   * (Slice #23.00.Import as one Property; a run of up to five since #26.07.)
   *
   * Null until the property step has created or found every one of them —
   * which is the ordering the brief asks for: no Document is created until the
   * Property its folder belongs to exists.
   *
   * ⚠️ It is NOT null-means-"the import cannot start" any more. A chosen folder
   * holding only `floating` resolves ZERO Properties, and that is a legitimate
   * run: the source document says floating documents "are just saved into the
   * system … but they are not linked to any of the properties". What the
   * importing phase requires is that the step RAN, not that it produced
   * something — `resolvedRun !== null` says the first, `properties.length > 0`
   * would say the second and would refuse an import the rules allow.
   */
  const [resolvedRun, setResolvedRun] = useState<ResolvedRun | null>(null);

  /**
   * Has this run put a Property into the archive?   (Slice #26.07)
   *
   * NOT the same fact as `resolvedRun !== null`, and an adversarial round is
   * what found the difference. The property step writes one folder at a time,
   * so a failure on folder four leaves three real Properties behind while
   * `resolvedRun` is still null — and the Cancel's account of what it leaves
   * behind was gated on exactly that, so it stayed silent about properties in
   * precisely the case where orphaned ones existed, and spoke only when the
   * step had finished and nothing was orphaned. Backwards, both ways round.
   *
   * Set by the step as each Property lands; cleared when a new folder is picked
   * and when the wizard resets.
   */
  const [propertiesTouched, setPropertiesTouched] = useState(false);

  /**
   * The Properties this run has actually put in the archive, as they land.
   *
   * ⚠️ **The toolbar chips come from HERE, not from `resolvedRun`**, and an
   * adversarial round is why. The property step writes one folder at a time and
   * its Cancel is no longer disabled mid-write, so a user who gives up after
   * three of five leaves three real Properties behind — with `resolvedRun` null,
   * because `onResolved` only fires on a complete loop. Chips read off
   * `resolvedRun` showed none of them, while the Cancel's confirmation said
   * properties remain: the user was told to go and find something and shown no
   * code to find it by.
   *
   * On the ordinary path this holds exactly what `resolvedRun.properties` does,
   * because every one of them was announced on its way through.
   */
  const [touchedProperties, setTouchedProperties] = useState<ResolvedProperty[]>([]);

  /**
   * Property folders whose corners the property step has already written.
   *
   * Held here rather than in the step for the same reason the chips are:
   * cancelling mid-write and coming back is the ordinary way to fix the folder
   * that failed, and a fresh dialog forgot — so the card told the user their
   * coordinate file had been ignored and sent them to edit corners that came
   * from that very file two minutes earlier.
   */
  const [cornersWritten, setCornersWritten] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Saved session — lazy-initialised from localStorage so no effect is needed.
  // loadSavedSession() guards against SSR with a `typeof window` check.
  const [savedSession, setSavedSession] = useState<SavedImportSession | null>(
    () => loadSavedSession(),
  );

  /**
   * The archive's answer, and the report it is an answer ABOUT.
   *                                                            (Slice #29.11)
   *
   * ⚠️ **THE SESSION IS HELD BESIDE THE ANSWER, AND `react-hooks/set-state-in-effect`
   * IS WHY.** The first version stored the answer alone and cleared it to `null`
   * synchronously inside the effect, on the way in, so that a new report showed
   * "se verifică…" instead of the previous one's verdict. ESLint refuses that —
   * a `setState` in an effect body is a cascading render — and the rule is right
   * about the shape even though the intent was sound: "which report is this an
   * answer to" is a fact about the answer, not a second piece of state to keep
   * in step with it.
   *
   * Carried as the session OBJECT rather than a name or a timestamp, because
   * object identity is exactly the question being asked: `setSavedSession` is
   * only ever handed a fresh `loadSavedSession()` parse, so a report replaced by
   * a finished run is a different object even when its folder name is the same.
   *
   * ⚠️ **THE WIZARD OFFERED A RESUME IT HAD NEVER CHECKED, and #29.04 turned
   * that from a rarity into the weekly state of things.** `SavedImportEntry`
   * holds a `docId` and no more, and nothing compared those ids to the archive:
   * the observed run offered "Reia ultimul import (A)" and listed PROP01429 and
   * three DOC codes against a database that had been emptied. The resumed view
   * is read-only by design — File System Access handles cannot be serialised —
   * so validating the ids is the only lever there is.
   */
  const [auditedReport, setAuditedReport] = useState<{
    session: SavedImportSession;
    result: SavedSessionAudit;
  } | null>(null);

  /**
   * Does the saved report still match the archive?
   *
   * `null` while the question is in flight, before it has been asked at all, or
   * when the answer in hand belongs to a report that has since been replaced.
   * The answer's own `ok: false` covers "we could not ask", which is a
   * different thing again — see `SavedSessionAudit`.
   *
   * ⚠️ **DERIVED, NOT STORED, and that is what makes the stale case impossible
   * rather than merely handled.** A copy in state has to be cleared by
   * something; this one cannot be wrong, because it stops matching the moment
   * `savedSession` becomes a different object. Same argument the three verdicts
   * further down make for deriving rather than storing, and it is why there is
   * no longer any `setState` on the way into the effect below.
   */
  const savedSessionAudit: SavedSessionAudit | null =
    auditedReport !== null && auditedReport.session === savedSession
      ? auditedReport.result
      : null;

  /**
   * Ask once per saved report, and re-ask when a run replaces it.
   *
   * ⚠️ **`cancelled` STILL EARNS ITS KEEP, although the derived value above
   * already refuses a stale answer.** Two reports can be in flight across one
   * `setSavedSession` — a finished run replaces the report while the previous
   * one's lookup is still out — and without this the older promise would land
   * LAST, overwriting the new report's entry with an answer about the old one.
   * The derived read would then correctly show `null` for ever, because the
   * stored session no longer matches. This is the ordinary effect-cleanup shape
   * rather than the run token the walk uses, because there is nothing to abort:
   * the request is a single read that costs one index lookup.
   *
   * The effect body writes no state at all — see `auditedReport`.
   */
  useEffect(() => {
    if (savedSession === null) return;
    let cancelled = false;
    void auditSavedSession(savedSession).then((result) => {
      if (!cancelled) setAuditedReport({ session: savedSession, result });
    });
    return () => {
      cancelled = true;
    };
  }, [savedSession]);

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
  /**
   * The user's answers to STR-15, keyed by the folder's path from the chosen
   * folder.   (Slice #28.02)
   *
   * ⚠️ **Here rather than in the panel, and it OUTLIVES a check.** The panel
   * unmounts on every re-walk, so panel state would throw the answers away each
   * time round the fix-and-re-check loop — and the loop is designed to be gone
   * round several times, so the user would be asked the same question about the
   * same folder after every unrelated fix. That is the same reason the two
   * report disclosures below live up here.
   *
   * ⚠️ **And it is cleared on a NEW FOLDER, in `handlePickFolder`.** An answer
   * is about one folder on one disk. Carrying `48-50D → property` into a
   * different chosen folder that happens to hold a `48-50D` of its own would
   * silently skip the one question standing between it and a Property nobody
   * agreed to.
   *
   * ⚠️ **The ref is not a cache — it is the only copy `runWalk` can read.**
   * `runWalk` is an async callback that decides the next PHASE from a verdict it
   * computes itself, and a phase decision cannot wait for a render. Reading the
   * state there would read the value captured when the callback was created,
   * which on the turn after an answer is the answer's absence: the walk would
   * come back not-clean, bounce to `structure-report`, and the panel — rendering
   * from the fresh state — would show no violation at all. A folder that could
   * not proceed, with nothing on screen saying why.
   */
  const [propertyAnswers, setPropertyAnswers] = useState<PropertyConfirmations>(
    () => new Map(),
  );
  const propertyAnswersRef = useRef<PropertyConfirmations>(propertyAnswers);
  const setPropertyAnswer = useCallback(
    (path: string, answer: PropertyConfirmation | null) => {
      // ⚠️ The REF is the source of truth here and the state is published from
      // it, rather than the other way round. Two reasons, and the second is the
      // one that bites: a functional updater that also wrote the ref would be a
      // side effect inside a reducer, which StrictMode calls twice in
      // development — and two clicks landing in one tick would each build their
      // `next` from a `propertyAnswers` that has not re-rendered yet, so the
      // second would discard the first. Reading the ref, which is written
      // synchronously, makes both orders correct.
      const next = new Map(propertyAnswersRef.current);
      if (answer === null) next.delete(path);
      else next.set(path, answer);
      propertyAnswersRef.current = next;
      setPropertyAnswers(next);
    },
    [],
  );

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
   * Slice #26.05 — the Constraints stage's two, which are the same two.
   *
   * A separate tick rather than a shared one, and the reason is the sentence
   * beside each: "Respect regulile de structură" and "Am citit restricțiile
   * privind fișierele" are two different statements, and a user who confirmed
   * the first has not made the second. Sharing one boolean would also mean a
   * constraints check silently satisfying the structure gate on the round the
   * re-walk bounces back to it.
   */
  const [constraintsAcknowledged, setConstraintsAcknowledged] = useState(false);
  const [constraintsRulesOpen, setConstraintsRulesOpen] = useState(false);

  /**
   * Slice #26.06 - the Duplication stage's two, plus one that the other stages
   * did not need.
   */
  const [duplicationAcknowledged, setDuplicationAcknowledged] = useState(false);
  const [duplicationRulesOpen, setDuplicationRulesOpen] = useState(false);
  /**
   * Has the duplication match been run against THIS walk?   (Slice #26.06)
   *
   * The other two stages derive "not checked in this run" from data they own:
   * Structure from `observations.length === 0`, Constraints from
   * `metadata === null`. Duplication cannot, and the reason is the shape of the
   * flow rather than an oversight - it is fed by exactly the same `entries` and
   * `metadata` the Constraints check was, so by the time the user is standing
   * on the Duplication rules screen with nothing checked, every input the
   * verdict needs is already in state and complete. Deriving from them would
   * put an answer on a screen that has not asked the question yet.
   *
   * A fact about the run, therefore, and published in the same commit as
   * `entries` and `metadata` at every exit of `runWalk` - the discipline
   * #26.05's second adversarial round established, for the same reason: a flag
   * set on one side of an await and read beside data from the other renders a
   * hybrid of two checks.
   *
   * NOT cleared at the top of a walk, deliberately. A re-check must leave the
   * previous round's list on screen while it runs - that is the to-do list the
   * user is working through, and it is what the other two panels do - and
   * clearing this on the way in would blank it for the duration.
   */
  const [duplicationChecked, setDuplicationChecked] = useState(false);

  /**
   * Slice #26.08 - the Pre-existing stage's three, and the first of them is
   * unlike anything the other stages hold.
   *
   * `preexisting` is the ANSWER, not a flag. The three stages before it derive
   * their verdicts at render time from data already in hand; this one cannot,
   * because the answer comes from the server. So it is stored, and stored as a
   * discriminated result rather than as a list:
   *
   *   - `null`            - the archive has not been asked in this run.
   *   - `{ ok: false }`   - it was asked and did not answer.
   *   - `{ ok: true, … }` - it answered.
   *
   * ⚠️ **The middle case is the whole reason this is not a `PreexistingVerdict
   * | null`.** "The archive holds none of these" and "we could not reach the
   * archive" produce the same import and must never produce the same screen -
   * see `PreexistingResult`. Collapsing them would print a green all-clear over
   * a request that never arrived, in the one stage whose entire output is a
   * claim about something the user cannot go and look at.
   *
   * It is published in the same commit as `entries` and `metadata` at every
   * exit of `runWalk` - the discipline #26.05's second adversarial round
   * established - and cleared at every exit that did not compute it, because a
   * verdict from the previous walk beside this walk's entries is a report about
   * files the user has since changed.
   */
  const [preexisting, setPreexisting] = useState<PreexistingResult | null>(null);
  const [preexistingAcknowledged, setPreexistingAcknowledged] = useState(false);
  const [preexistingNotesOpen, setPreexistingNotesOpen] = useState(false);

  /**
   * Does every document type this folder holds have a form?     (Slice #29.08)
   *
   * The ANSWER, not a flag, and stored for exactly the reason `preexisting` is:
   * it comes from the server, so it cannot be re-derived during a render. The
   * three states are the same three, and they mean the same three things:
   *
   *   - `null`            - the classification has not run in this run.
   *   - `{ ok: false }`   - it ran, and the list of types could not be read.
   *   - `{ ok: true, … }` - it ran, and here is what it found.
   *
   * ⚠️ **The middle case is why this is not a `TypeFormVerdict | null`, and it
   * is the identical argument `PreexistingResult` carries.** "Every type has a
   * form" and "we could not find out" must never produce the same screen — the
   * first lets an import proceed and the second stops it — and collapsing them
   * would let a failed read look like an all-clear.
   *
   * ⚠️ **It is NOT cleared when a new walk starts, it is cleared when the SCAN
   * results are.** The two are the same commit today (`runWalk` clears
   * `scanResults` on every walk), and they are written together at the end of
   * `startScan`, because a verdict about the types beside a different walk's
   * classification is a report about files the user has since changed — the
   * discipline #26.05's second adversarial round established for every other
   * value on this component.
   */
  const [typeLookup, setTypeLookup] = useState<TypeFormLookup | null>(null);
  /**
   * Which files this classification refuses for showing more than ONE person's
   * identity document, or `null` when the question has not been asked.
   *                                                            (Slice #32.08)
   *
   * ⚠️ **A `MultiCardVerdict | null` WHERE `typeLookup` IS A THREE-STATE
   * LOOKUP, and the difference is not an inconsistency.** That value has to
   * separate "every type has a form" from "we could not find out", because the
   * second stops the import and the first does not. This one has nothing to
   * separate: the check reads answers the wizard is already holding, makes no
   * request, and cannot fail. There is no third state to represent, and
   * inventing one would be a shape a reader has to rule out.
   *
   * ⚠️ **CLEARED WHERE `typeLookup` IS CLEARED, and for the identical reason.**
   * A verdict about the identity scans beside a different walk's classification
   * is a report about files the user has since been sent to File Explorer to
   * split.
   */
  const [cardVerdict, setCardVerdict] = useState<MultiCardVerdict | null>(null);
  /**
   * Is the type gate reading the archive's list right now?
   *
   * Only ever true on the stop screen's "try again": at the end of the scan the
   * whole wizard is already in the `scanning` phase and that panel has its own
   * cue. A boolean rather than a phase, for the reason `preflightPassed` is one
   * — a fetch in flight is not a place the user is standing.
   */
  const [typeGateBusy, setTypeGateBusy] = useState(false);
  /**
   * How many times the type gate has answered for this classification.
   *                                                            (Slice #29.08)
   *
   * ⚠️ **IT EXISTS TO MAKE A REPEATED FAILURE AUDIBLE, and a fourth
   * adversarial round is why.** The stop screen's "Încearcă din nou" can come
   * back with the same reason it went out with — a fault that has not cleared
   * is the commonest retry outcome, not a corner — and when it does, every
   * sentence on the screen is byte-identical to the one before it. The wizard's
   * live region then has no text CHANGE to announce, so a screen-reader user
   * presses the one button on the screen, waits up to thirty seconds, and hears
   * nothing: indistinguishable from a dead button.
   *
   * The count is drawn on the screen as well as spoken, because "that was
   * attempt 3" is worth knowing to a sighted user staring at an unchanged red
   * block for the same reason.
   */
  const [typeGateAttempts, setTypeGateAttempts] = useState(0);
  /**
   * Did the user press "continue without forms" on the stop screen?
   *                                                            (Slice #32.05)
   *
   * ⚠️ **ONE BOOLEAN FOR THE RUN, NEVER A SET OF TYPE IDS, and the reason is
   * that half the blocking types have no id to key on.** `ClassifiedType.id` is
   * `null` for every `new` type — the run mints that row minutes later, under an
   * id nothing on the stop screen can know — and a `new` type is the commonest
   * thing on that list, because it is the case the gate blocks by construction.
   * A waiver keyed on ids would cover the stored formless types and miss exactly
   * the ones the user was looking at. It would also miss the third case:
   * `runAiInterpret` may re-type a document mid-run onto a type it creates on
   * the spot, which `type-form-gate.ts` records as the gate's own blind spot,
   * and that type is the same situation the user has just waived. One boolean
   * answers all three.
   *
   * ⚠️ **CLEARED WHEREVER `typeLookup` IS CLEARED, and nowhere else.** A waiver
   * is an answer about a verdict, so it is exactly as stale as the verdict is: a
   * new walk drops both, and so does the reset behind "Oprește importul". Both
   * sites are two lines below the `typeLookup` line they belong to, so a reader
   * adding a third reset finds all three together.
   */
  const [typeFormsWaived, setTypeFormsWaived] = useState(false);

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

  /**
   * Has a run of THIS folder finished?   (Slice #26.09)
   *
   * ⚠️ **Closing the import dialog returns the wizard to `ready`, which is the
   * Import stage's own screen** — the gap `workflow-stages.ts` records as
   * "KNOWN GAP, left for 26.10". Until this slice that screen was a toolbar
   * button; now it is a panel that says what the button will do, and saying it
   * a second time after a finished run is not merely untidy: pressing Importă
   * again re-imports the whole folder. `preexistingDecisions` was computed
   * during the walk and knows nothing about the documents the run has just
   * created, so every one of them would be created again and every AI read paid
   * for again.
   *
   * ⚠️ **It IS `documentsCreated` at the moment it is set, and the two
   * questions only look alike.** `documentsCreated` asks "did this run write
   * records the Cancel must warn about"; this asks "would pressing Importă
   * again write them a SECOND time". A run that created no document has nothing
   * to duplicate, so it must stay repeatable — otherwise a session that died on
   * document one leaves a screen saying the import finished, with the only way
   * forward a re-pick that re-walks and re-scans the folder at full price.
   *
   * The remaining write such a run makes is `associateDocumentsToProperty`,
   * which is `onConflictDoNothing()`, and the property step refuses a second
   * Property for a parcel that already has one (#26.07) — so repeating it costs
   * clicks and nothing else.
   *
   * Cleared where the folder changes: a new pick, and the Cancel's full reset.
   */
  const [runCompleted, setRunCompleted] = useState(false);

  /**
   * Has this run already paid for classification?      (#26.03, rebuilt #29.08)
   *
   * ⚠️ **A FACT ABOUT THE RUN, LIKE `documentsCreated`, AND IT USED TO BE A
   * `useMemo` OVER `scanResults`.** That memo counted a settled request —
   * `done` or `error`, because a settled request is a spent one and only
   * `pending`, `skip` and `preexisting` are evidence of not having sent. The
   * reasoning was right and the SOURCE stopped being: `runWalk` clears
   * `scanResults` on its way into every walk, and #29.08 put the Evaluation
   * screen AFTER the classification — so "Verifică din nou folderul", pressed
   * there, wiped the evidence and then spent thirty seconds in the metadata
   * pass with the Cancel dialog telling the user, in as many words, that
   * nothing had been sent and nothing consumed. That dialog exists to stop the
   * flow lying about what a cancel costs, so a stale flag in it is worse here
   * than anywhere else in the wizard. Found by the adversarial round.
   *
   * ⚠️ **SET WHEN THE REQUEST IS ISSUED, not when it settles**, which is a
   * shade more honest than the memo it replaces: a scan half way through its
   * queue had every in-flight row on `scanning` or `converting`, neither of
   * which the memo counted, so a Cancel pressed mid-pass reported nothing
   * spent over hundreds of billed calls already sent.
   *
   * Cleared where the folder changes — a new pick, and the Cancel's full reset
   * — exactly as `documentsCreated` is, and for the same reason: the previous
   * folder's spend is not something cancelling THIS run abandons.
   */
  const [classificationSpent, setClassificationSpent] = useState(false);
  /**
   * The finished run's statistics, or null.   (Slice #26.10)
   *
   * Set by `BulkImportDialog`'s Close and it is the ONLY thing that draws the
   * concluding message — a boolean beside a separate summary would be two
   * states that can disagree about whether there is anything to show.
   *
   * ⚠️ **It comes from the dialog rather than being derived here**, because
   * every fact in it — which reads failed, which people were created, which
   * cards nobody answered — lives in that dialog's state and nowhere else. See
   * the prop.
   */
  const [runSummary, setRunSummary] = useState<ImportRunSummary | null>(null);
  const [cancelSnapshot, setCancelSnapshot] = useState<{
    facts: CancelFacts;
    stage: WorkflowStageId;
  } | null>(null);

  /**
   * Step-through: does the run stop after every stage that passes?
   *                                                        (Slice #29.02)
   *
   * ⚠️ **TICKED BY DEFAULT SINCE #32.03, AND THE FLOW NOW DEPENDS ON IT.** It
   * shipped unticked, because #29.02's whole promise was that with it unticked
   * nothing about the flow changed, not one extra click anywhere. Real use
   * answered the question that promise was protecting: a clean step that flies
   * past is a step nobody read, and #32.01 and #32.03 spent two slices making a
   * clean paused screen worth stopping on — the account of what the check
   * looked at, and nothing else. That screen is only ever reached with this
   * ticked, so the default is now load-bearing rather than a convenience, and
   * `import-workflow-stages.test.ts` pins it.
   *
   * ⚠️ **STATE *AND* A REF, and the ref is not an optimisation.** The decision
   * is taken inside `runWalk` and `startScan`, both of which are deliberately
   * tiny `useCallback`s (`[t, beginRun]` and `[]`) that close over none of the
   * check state — a note on `runWalk` says why, and `propertyAnswersRef` exists
   * for exactly the same reason one stage earlier. Adding `stepThrough` to
   * those dependency lists would give `runWalk` a new identity every time the
   * user ticked the box, and `handlePickFolder`/`handleRecheck` a new one after
   * it. So the ref is what the transitions read, and the state is what the
   * checkbox renders from; `changeStepThrough` writes both, in that order.
   *
   * ⚠️ **READ AT THE MOMENT OF THE TRANSITION, never captured earlier.** That
   * is what makes ticking the box four stages in work, and it is the behaviour
   * to keep: the control is a statement about what happens next, not a mode the
   * run is started in.
   *
   * ⚠️ **NOT PERSISTED.** `IMPORT_SESSION_KEY` in `localStorage` holds a
   * FINISHED RUN'S REPORT so it can be reopened; a viewing preference is not
   * part of a report and does not belong in it. `SavedImportSession` has no
   * field for one. A new import starts ticked, exactly as a first one does —
   * see `handleCancelConfirmed`.
   */
  const [stepThrough, setStepThrough] = useState(true);
  const stepThroughRef = useRef(true);

  /**
   * The pause currently on screen, or `null`.   (Slice #29.02)
   *
   * `rest` is the phase the wizard is holding at — the stage that just passed —
   * and `to` is where the button goes. Both are needed: `to` alone cannot say
   * which screen the card belongs under, and the render guard below is what
   * keeps a stale gate from being drawn over the wrong one.
   *
   * ⚠️ **THE GUARD IS AT RENDER TIME BECAUSE IT CANNOT BE ANYWHERE ELSE.** The
   * gate and the phase are set in one commit, and a state updater cannot be
   * made conditional on a value it is itself updating — so `settle` writes both
   * unconditionally and the render draws the card only while `phase` still
   * equals `gate.rest`. A gate that does not match where the user is standing
   * is not drawn at all, which is the under-claiming direction: at worst a
   * pause is missed, never a pause shown over a screen it does not describe.
   */
  const [gate, setGate] = useState<{ rest: ImportPhase; to: ImportPhase } | null>(
    null,
  );

  /**
   * The pause actually on screen — the render guard, applied once.
   *
   * Three things read it (the card, and the two panels that have to know they
   * are being paused over), and they must not each re-derive the condition:
   * that is three chances for one of them to test `gate !== null` alone and
   * start drawing a pause over a screen the user has already left.
   */
  const activeGate = gate !== null && phase === gate.rest ? gate : null;

  /** Slice #26.10 — the concluding message's one exit; see its own dialog. */
  const router = useRouter();

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

  /**
   * Tick or untick the control.   (Slice #29.02)
   *
   * The ref first, then the state, so a transition that fires between the two
   * reads the value the user just chose rather than the one they just left.
   *
   * ⚠️ **UNTICKING DOES NOT RELEASE A PAUSE THAT IS ALREADY ON SCREEN**, and
   * that is deliberate. The control governs the transitions still to come; a
   * gate that is already drawn has a button under it, one click away. Releasing
   * it on the untick would move the screen out from under a user who was
   * reading it — a jump nobody asked for, to save them a click they can see.
   */
  const changeStepThrough = useCallback((next: boolean) => {
    stepThroughRef.current = next;
    setStepThrough(next);
  }, []);

  /**
   * Make one of the six self-advancing transitions.   (Slice #29.02)
   *
   * Every caller passes the phase it is IN and the phase it would move to; what
   * happens between them is `stepThroughRest`'s to decide, and this function
   * holds no copy of that rule. A transition the table does not name is not
   * gated whatever the checkbox says, which is why the `*-report` destinations
   * and the archive's no-answer case need no special handling here.
   *
   * The `current === from` guard is `handlePreflightVerdict`'s, generalised.
   * Its note explains the case: under StrictMode the checklist's mount effect
   * is double-invoked, so a verdict can arrive from a stale closure after the
   * phase has already moved on. Every other caller runs behind a cancellation
   * token that has already returned early in that situation, so for them the
   * guard is belt and braces — but it is the same guard, and one expression of
   * it is cheaper to keep true than five.
   */
  const settle = useCallback((from: ImportPhase, to: ImportPhase) => {
    const rest = stepThroughRef.current ? stepThroughRest(from, to) : null;
    if (rest !== null) setGate({ rest, to });
    setPhase((current) => (current === from ? (rest ?? to) : current));
  }, []);

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
    // ⚠️ **AND SINCE #29.02 A FAILING VERDICT DOES HAVE SOMETHING TO DO, which
    // is exactly what the paragraph above says cannot happen.** It was right
    // until this slice: the checklist unmounted the instant it passed, so a
    // later failure had no screen to arrive on. Step-through is what stops it
    // unmounting - a pause REST at `preflight` leaves the checklist standing
    // with its own live "Verifica din nou" - and a re-check that now fails
    // publishes red lines under an emerald card reading "toate preconditiile
    // sunt indeplinite", with a live button into the folder picker. Found by
    // the adversarial round, and it is the worst kind of defect this codebase
    // records: confident output that stopped being measured against its input.
    //
    // Dropping the pause is the whole fix. The phase is untouched - a failing
    // checklist has always stayed on its own screen - so what the user is left
    // with is the red list and the re-check, which is the screen they would
    // have had if the first probe had failed.
    if (!passed) {
      setGate(null);
      return;
    }
    // `settle` carries the functional guard this line used to hold on its own,
    // and adds the pause when the user asked for one. At the rest the checklist
    // stays mounted with all eight lines green and its own "toate verificarile
    // au trecut" under them: the screen #26.11's floor was added to make
    // visible at all, now held until it is dismissed.
    settle("preflight", "structure");
  }, [settle]);

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
       * How far this run goes.
       *
       * `"structure"` stops at the structure verdict and hands over to the
       * Constraints stage's rules screen with nothing checked and nothing spent.
       * `"constraints"` carries straight on through the metadata pass and the
       * constraint check, and stops at the Duplication rules screen.
       * `"duplication"` goes the whole way.
       *
       * An argument rather than a read of `phase`, because this decides whether
       * ~760 `getFile()` calls happen and a decision that expensive belongs to
       * the button that was pressed, not to a state value that may have moved.
       *
       * ⚠️ **Slice #26.06 added the third value, and the FIRST duplication
       * check therefore re-walks and re-sizes a folder the constraints check
       * measured seconds earlier.** That is a real second ~760-call pass, not a
       * free ride on the first, and the slice's adversarial review was right to
       * call an earlier draft of this note out for implying otherwise. It is
       * the price of two things worth paying for:
       *
       *  - the check means "as the folder is NOW". Every screen before this one
       *    has just told the user to go and work in File Explorer, and a stage
       *    that answered from a snapshot taken before their last trip would be
       *    the stale-state failure the whole redesign exists to remove.
       *  - the stage gets a stopping point. The user reads what a duplicate is
       *    before being shown files to remove, which is the one instruction in
       *    the whole Preparation line that looks like a licence to delete.
       *
       * The alternative - deriving the first verdict from the state the
       * constraints check left behind and making the button a re-check only -
       * halves the cost and was considered. It was not taken because it puts an
       * answer on a screen that has not asked the question, and because the
       * expensive path exists either way the moment the user comes back from
       * fixing something.
       */
      target: WalkTarget,
      /**
       * Where a FAILED walk leaves the user.
       *
       * An explicit argument since #26.04, and `mode` can no longer stand in
       * for it: the re-check button now exists on three screens — the structure
       * violation list, the constraints violation list and the folder report —
       * and a failed re-check must return to the one it was pressed from, not
       * to whichever of them the mode happens to imply.
       */
      failurePhase: ImportPhase,
    ) => {
      // Everything below belongs to THIS token. Every `set*` after an await is
      // guarded on it, so a walk the user cancelled cannot put its folder,
      // its entries or its phase back on screen a second later.
      const token = beginRun();

      setWalkError(null);
      setMetaProgress({ done: 0, total: 0 });
      // Every check re-asks the tick. Cleared here rather than in the callers
      // so that no route into a walk can skip it — and BOTH ticks, whatever the
      // target, because a constraints check re-walks and can land the user back
      // on the Structure screen, where a tick carried over from before their
      // trip to File Explorer would let them press Verifică din nou without
      // re-confirming anything.
      setStructureAcknowledged(false);
      setConstraintsAcknowledged(false);
      setDuplicationAcknowledged(false);
      setPreexistingAcknowledged(false);
      // Slice #29.02 - and the pause, if one is on screen. Every route into a
      // walk passes through here, including "Verifica din nou" pressed from a
      // gate, so this is the one place it has to be dropped. The render guard
      // would hide it the moment the phase moved to a checking phase anyway;
      // clearing it is what stops it reappearing when this walk lands back on
      // the same rest phase with a different answer.
      setGate(null);
      // Slice #29.02 - hoisted out of the `setPhase` call it used to be
      // written inline in, because the end of the walk needs the same value:
      // `settle` is told the phase the wizard is IN, and the phase it is in is
      // the one this line put it in. Deriving it twice from `target` would be
      // two expressions of one fact.
      const fromPhase: ImportPhase =
        target === "structure"
          ? "walking"
          : target === "constraints"
            ? "constraints-checking"
            : target === "duplication"
              ? "duplication-checking"
              : "preexisting-checking";
      setPhase(fromPhase);

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
        // `button` is read by `recheckFailed` only: `walkFailed` follows a
        // failed PICK, which has already cleared `observations`, so the
        // Structure panel's primary is back to "Alege folderul…" and that
        // message needs no route of its own. Supplying it on both arms keeps
        // the ternary a choice of sentence rather than of call shape; the extra
        // value costs `walkFailed` its no-compile fast path and nothing else —
        // it holds no brace, apostrophe or `<`, so the formatted output is
        // byte-identical, and this line runs at most once per failed pick.
        setWalkError(
          t(mode === "recheck" ? "recheckFailed" : "walkFailed", {
            button: tCancel("button"),
          }),
        );
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
        setResolvedRun(null);
        setPropertiesTouched(false);
        setTouchedProperties([]);
        setCornersWritten(new Set());
        // ...and a new run for the Cancel's account of what it would leave
        // behind. Documents imported under the previous folder are still in the
        // archive, but they are not something cancelling THIS run abandons.
        setDocumentsCreated(false);
      }
      setRootFolderName(handle.name);
      setScanResults(new Map());
      setScanProgress({ done: 0, total: 0 });
      // Slice #29.08 - the type gate's answer is about a classification, and a
      // walk is what invalidates one. Cleared HERE, beside the scan results it
      // was computed from, rather than at any of the three exits below: a
      // verdict about the types beside a different walk's classification is a
      // report about files the user has since been told to go and change.
      setTypeLookup(null);
      setTypeGateAttempts(0);
      // Slice #32.05 — and the answer the user gave to that verdict. A waiver
      // is a decision about types this walk has not classified yet.
      setTypeFormsWaived(false);
      // Slice #32.08 — and the identity-scan verdict, which is a report about
      // this walk's files and about no other walk's.
      setCardVerdict(null);

      /**
       * ⚠️ **`entries`, `observations` and `metadata` are published TOGETHER, at
       * each of the three exits below — never here.**   (Slice #26.05)
       *
       * They were set at this point until the slice's second adversarial round
       * ran, and the constraints branch is what made that wrong. Between here
       * and `setMetadata` there is now an awaited ~760-call metadata pass, and
       * every await yields: React flushes the commit and re-renders with THIS
       * walk's entries beside the PREVIOUS check's file sizes. `constraintVerdict`
       * is a `useMemo` over exactly those three, so for the whole duration of
       * the pass the panel drew a red "these files could not be read" block
       * naming precisely the files the user had just fixed — and Salvează wrote
       * that hybrid into a dated page they then carried to File Explorer.
       *
       * The structure branch never had the bug and could not have: it decides
       * from its local `seen` with no await in between. That is the difference
       * to keep in mind — a state split across an await is only safe while
       * nothing renders from both halves.
       *
       * (Slice #24.02a's original point stands and is why the walk still ends
       * here rather than falling into the classification pass: choosing a folder
       * used to cost one Claude call per image before anything had been
       * validated or shown. The scan waits for `startScan`, behind Continuă.)
       */

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
      const verdict = checkStructureStage(seen, propertyAnswersRef.current);
      if (!verdict.clean) {
        // Nothing below this point is worth paying for — every later stage is
        // unreachable until Structure passes. Metadata is dropped rather than
        // left standing, so no later render can pair this walk's entries with
        // the previous walk's file sizes.
        setEntries(walked);
        setObservations(seen);
        setMetadata(null);
        setDuplicationChecked(false);
        // #26.08 - and the archive's answer goes with them. It was about the
        // files this walk has just found to be wrongly arranged, so keeping it
        // would put a report about a folder that no longer exists beside the
        // list of what is wrong with the one that does.
        setPreexisting(null);
        setPhase("structure-report");
        return;
      }

      if (target === "structure") {
        // Slice #26.05 — Structure is clean, so Constraints begins. Nothing is
        // checked yet and nothing has been spent: the user reads the
        // constraints, ticks, and presses the button that pays for the metadata
        // pass. `metadata` is cleared rather than left alone so the derived
        // verdict is `null` — "not checked" and "checked and clean" are
        // different screens, and the all-clear must be earned by this folder.
        setEntries(walked);
        setObservations(seen);
        setMetadata(null);
        setDuplicationChecked(false);
        setPreexisting(null);
        // Slice #29.02 - the transition Adrian could never see: a clean
        // structure walk has no report screen at all, so Structure is replaced
        // by Constraints without ever having said that it passed. Gated, it
        // rests on `structure`, where the panel's own emerald `clean` line is
        // already waiting for a verdict it could not previously be shown.
        settle(fromPhase, "constraints");
        return;
      }

      // T1: one getFile() per file. Metadata only — it does not read contents
      // — but it is ~760 calls on Adrian's archive, so it reports progress
      // rather than assuming every machine is as quick as his.
      //
      // ⚠️ `constraintMetadata` is what the verdict below is computed from, for
      // the same reason the structure verdict reads the local `seen`: a phase
      // decision cannot wait for a render, and reading the state here would
      // decide this check's destination from the PREVIOUS check's file sizes —
      // which, on the second turn of the loop, is exactly the list the user has
      // just fixed.
      let constraintMetadata: Map<string, FileMeta>;
      try {
        constraintMetadata = await readFileMetadata(walked, seen, {
          onProgress: (p) => {
            if (!token.cancelled) setMetaProgress(p);
          },
          isCancelled: () => token.cancelled,
        });
        if (token.cancelled) return;
      } catch {
        if (token.cancelled) return;
        // ⚠️ An EMPTY map, not `null`, and the difference is a green tick over
        // a folder nobody looked at. Before #26.05 a failed pass degraded an
        // advisory report and that was the right call; now it feeds a stage
        // that BLOCKS, so "we could not read anything" has to arrive as a
        // measurable fact. Every upload file then lands in `unreadable`, the
        // verdict is not clean, and the panel says so.
        //
        // No `walkError` beside it: the panel's own red block names the files
        // and says what to do, and a second banner reading "the re-check failed"
        // would contradict it — the check DID run, and its answer is that
        // nothing could be read.
        constraintMetadata = new Map();
      }

      const constraints = checkConstraintsStage({
        entries: walked,
        observations: seen,
        metadata: constraintMetadata,
      });

      /**
       * Slice #26.06 - the second fork, and it decides `duplicationChecked` as
       * well as the phase.
       *
       * A duplication check is only what THIS press asked for AND what the
       * constraints let it get to: a run that came for the constraints stops at
       * the Duplication explanations with nothing checked, and a run that came
       * for duplication but found a broken constraint never reaches the match.
       *
       * Computed from the locals, like both verdicts above it, because a phase
       * decision cannot wait for a render - and the FORK ITSELF lives in
       * `workflow-stages.ts`, because it is the whole of this slice's new
       * decision and there is no way to reach it from a test while it sits
       * behind an awaited 760-call I/O pass. See `phaseAfterFileChecks`.
       */
      // #26.08 - `preexisting` runs the match too, because it is a later stage
      // and everything before it has to be clean for its own question to mean
      // anything. A run that came to ask the archive and found copies inside
      // the folder has not asked the archive, and `phaseAfterFileChecks` sends
      // it back to the Duplication list.
      const duplication =
        constraints.clean && (target === "duplication" || target === "preexisting")
          ? checkDuplicationStage({ entries: walked, metadata: constraintMetadata })
          : null;

      /**
       * The only question in the whole walk that leaves this machine.
       * (Slice #26.08)
       *
       * Asked exactly when this press asked for it AND every check before it
       * came back clean - the same shape as the duplication match above it, one
       * stage later.
       *
       * ⚠️ **This is the await the guard below has been waiting for.** The note
       * that used to stand there said the cancel check was above the writes
       * although nothing awaited between the metadata pass and them, "the day
       * anything does". This is that day: a run the user renounces while the
       * archive is being asked must not come back and write its entries, its
       * sizes and its report into a wizard `handleCancelConfirmed` has already
       * reset. The `token.cancelled` test immediately after the lookup is the
       * one that matters, and the one below the fork is now genuinely a second
       * line rather than the only line.
       *
       * `lookupPreexisting` never throws and never returns a partial answer, so
       * there is no try/catch here and no half-answered state to render - see
       * its module header.
       */
      let preexistingResult: PreexistingResult | null = null;
      if (target === "preexisting" && duplication !== null && duplication.clean) {
        const { candidates, unchecked } = preexistingCandidatesOf({
          entries: walked,
          metadata: constraintMetadata,
        });
        const lookup = await lookupPreexisting(candidates);
        if (token.cancelled) return;
        preexistingResult = lookup.ok
          ? {
              ok: true,
              verdict: checkPreexistingStage({
                entries: walked,
                matches: new Map(lookup.matches.map((m) => [m.path, m])),
                unchecked,
                // The walk's own listing of the chosen folder - the same source
                // STR-02 counts and the property step reads. Without it a
                // property subfolder holding no importable file is invisible
                // here, and a `common` document in a run of nothing but such
                // folders would be promised a link to a property nobody built.
                topLevelDirNames: seen.find((o) => o.depth === 0)?.dirNames ?? [],
              }),
            }
          : { ok: false };
      }

      const next = phaseAfterFileChecks({
        target,
        constraintsClean: constraints.clean,
        duplicationClean: duplication === null ? null : duplication.clean,
        // ⚠️ A FAILED lookup is `false`, not `null`. `null` means the archive
        // was never asked and lands the user back on the explanations with the
        // button still to press; `false` means there is something to show them,
        // and a failure is very much something to show them.
        preexistingClean:
          preexistingResult === null
            ? null
            : preexistingResult.ok && preexistingResult.verdict.clean,
      });

      // The second cancel check. See the note inside the lookup above for why
      // it is no longer the only one.
      if (token.cancelled) return;

      // ONE commit, so no render can pair this walk with the previous check's
      // sizes, none can pair this walk's entries with the previous check's
      // duplication verdict, and none can pair either with the previous walk's
      // report from the archive. See the note above `checkStructureStage`.
      setEntries(walked);
      setObservations(seen);
      setMetadata(constraintMetadata);
      setDuplicationChecked(next.duplicationRan);
      setPreexisting(preexistingResult);
      // Slice #29.02 - still inside the ONE commit above: `settle` calls
      // `setGate` and `setPhase`, both synchronously and nothing else, so this
      // walk's entries, metadata, duplication flag, archive answer, phase and
      // pause all land in a single render. Splitting them is exactly the
      // hybrid render the comment above forbids.
      settle(fromPhase, next.phase);
    },
    [t, tCancel, beginRun, settle],
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
    setDuplicationChecked(false);
    setPreexisting(null);
    // A different folder is a different set of questions — see the declaration.
    setPropertyAnswers(new Map());
    propertyAnswersRef.current = new Map();
    // ⚠️ Here rather than inside `runWalk`'s `mode === "pick"` block, which is
    // AFTER the walk: a pick whose walk throws never reaches that block, and
    // would have left this true against a folder the user has just changed.
    setRunCompleted(false);
    // ⚠️ **Slice #29.08, and it belongs on THIS line for exactly the reason
    // above — a third adversarial round found it one block too late.** It sat
    // inside `runWalk`'s `mode === "pick"` branch, so a pick whose walk threw
    // left it true against a folder that has never been classified: the
    // Pre-existing screen then told the user their classification "s-a pierdut
    // la ultima verificare" and that continuing would pay "a doua oară", on a
    // folder whose first image had not been sent. Deliberately NOT cleared on a
    // re-check: a re-walk of the SAME folder is the same run, and the calls it
    // has already paid for are still paid.
    setClassificationSpent(false);
    // Always `"structure"`: a folder that has just been picked has passed
    // nothing, whichever screen the picker was pressed from.
    await runWalk(handle, "pick", "structure", "structure");
  }, [t, runWalk]);

  // -------------------------------------------------------------------
  // Classification pass — everything below this line costs money
  // -------------------------------------------------------------------

  /**
   * Read the archive's list of document types and decide whether this import
   * may go on.                                                 (Slice #29.08)
   *
   * ⚠️ **ONE CALLBACK FOR BOTH CALLERS, and the second caller is the whole
   * reason it is one.** The end of the scan asks this, and so does the stop
   * screen's "try again" when the list could not be read. Two copies would be
   * two chances for the retry to decide by a different rule from the one that
   * stopped the run — and the retry is pressed by a user who is being told the
   * import cannot continue, which is the worst place for the two to disagree.
   *
   * ⚠️ **A FAILED READ IS `{ ok: false }`, NEVER A THROW AND NEVER `null`.**
   * `null` is returned for exactly one thing, and it is not a failure: the run
   * was cancelled while the request was in flight, so there is nobody left to
   * tell. Every other outcome is an answer the stop screen renders. The catch
   * is deliberately bare: `fetchDocumentTypeCatalogue` throws the
   * `session-expired` sentinel as well as ordinary network and HTTP failures,
   * and all of them mean the same thing here — the gate has no answer, so the
   * import stops. Distinguishing them would need a screen per cause, and the
   * one action that helps is the same for all of them.
   *
   * `token` is an ARGUMENT rather than a read of the ref, for the reason
   * `startScan` takes the run's token rather than minting one: the gate belongs
   * to the classification that produced its input, and a cancelled run must not
   * come back and put a verdict on screen a second later.
   */
  const runTypeGate = useCallback(
    async (
      toImport: readonly FSEntry[],
      results: ReadonlyMap<string, ScanResult>,
      token: { cancelled: boolean },
    ): Promise<TypeFormLookup | null> => {
      // ⚠️ **SET HERE RATHER THAN BY EACH CALLER, and the adversarial round is
      // why.** The read takes up to 30 seconds and BOTH callers sit on a screen
      // that has something to say about it: the scan panel's cue would
      // otherwise go on counting a scan that finished, and the Cancel dialog
      // would promise to stop a classification "aflată chiar acum în lucru"
      // over a queue that has entirely settled — the exact sentence #29.02
      // added `activeGate` to that expression to stop it saying. One flag, set
      // by the thing that is actually busy.
      const classified = classifiedEntriesOf(toImport, results);

      // ⚠️ **A RUN THAT CLASSIFIED NOTHING IS ANSWERED WITHOUT ASKING ANYBODY,
      // and an adversarial round found what asking costs.** A folder the
      // archive already holds in its entirety — re-offered to attach it to a
      // new Property, which is the case #26.08 exists for — and a folder
      // holding nothing a model can read both send zero images. Every document
      // in them lands on the catch-all, so no type the classifier named can be
      // waiting for a form; a catalogue read there can only produce a reason to
      // stop a run that cannot create the thing this gate prevents. It also
      // keeps the scanning panel from announcing that it is reading a list
      // nobody needs. `checkTypeForms` is still what answers, over the same
      // entries, so the verdict is the module's rather than this file's.
      if (noClassificationHappened(classified)) {
        const lookup: TypeFormLookup = {
          ok: true,
          verdict: checkTypeForms({ entries: classified, catalogue: [] }),
        };
        setTypeLookup(lookup);
        setTypeGateAttempts((n) => n + 1);
        return lookup;
      }

      setTypeGateBusy(true);
      let lookup: TypeFormLookup;
      try {
        const catalogue = await fetchDocumentTypeCatalogue();
        if (token.cancelled) {
          setTypeGateBusy(false);
          return null;
        }
        lookup = catalogueIsUsable(catalogue)
          ? { ok: true, verdict: checkTypeForms({ entries: classified, catalogue }) }
          : // ⚠️ **A 200 IS NOT AN ANSWER IF THE LIST IS UNUSABLE.** An empty
            // catalogue, or one with no catch-all row, makes every real label
            // look like a type the run would invent — so a naive read would
            // stop the import and name types that exist and have forms.
            // `catalogueIsUsable` carries `fetchDocTypes`' own two refusals.
            // It is `unusable` rather than `unreadable` because the two need
            // different screens: this one will answer the same way for ever, so
            // "try again" is not the offer — the sentence that says what to put
            // back in Reference Data is.
            { ok: false, reason: "unusable" };
      } catch (error) {
        if (token.cancelled) {
          setTypeGateBusy(false);
          return null;
        }
        // ⚠️ **THE SENTINEL IS READ, NOT SWALLOWED, and a third adversarial
        // round is why.** `fetchDocumentTypeCatalogue` throws exactly
        // `session-expired` for a 401 and for a rewritten 200 carrying a
        // sign-in page, and every other reader of that sentinel in this run
        // maps it to a banner with a sign-in link. Folded into "we could not
        // read the list" it produced a screen telling the user to try again
        // and then come back later — over a classification they have already
        // paid for, which starting again pays for twice. Signing in and
        // pressing the same button costs nothing.
        const expired =
          error instanceof Error && error.message === "session-expired";
        lookup = { ok: false, reason: expired ? "session" : "unreadable" };
      }
      setTypeGateBusy(false);
      setTypeLookup(lookup);
      setTypeGateAttempts((n) => n + 1);
      return lookup;
    },
    [],
  );

  /**
   * Send every scannable entry for automatic classification, 3 at a time.
   *
   * Lifted verbatim out of `handlePickFolder` in Slice #24.02a; the only
   * change is that it takes the walked entries as an argument instead of
   * closing over a local. It has exactly one caller and `scanEntry` is called
   * from nowhere else, which together are what make "no classification without
   * a press" a property rather than an intention.
   *
   * ⚠️ **#29.08 MOVED THE PRESS AND DID NOT REMOVE IT.** That caller used to be
   * the Evaluation screen's Continuă; it is the PRE-EXISTING screen's Continuă
   * now, because the import has to know which document types a folder holds
   * before it can promise that each of them has a form. Still one caller, still
   * a button that says what it is about to spend — the warning moved with it,
   * to `ImportPreexistingStage`.
   *
   * ⚠️ **AND IT NO LONGER HANDS OVER TO `ready`.** When the last request
   * settles the gate runs — the archive's list of document types, read once,
   * against what the classifier said — and `phaseAfterClassification` decides
   * between the Evaluation screen and the stop screen. That is the whole of
   * this slice on this side of the file; the rule itself is in
   * `workflow-stages.ts` and this function holds no copy of it.
   */
  const startScan = useCallback(async (
    walked: FSEntry[],
    /**
     * Entries the Pre-existing stage decided will not be imported.
     * (Slice #26.08)
     *
     * An ARGUMENT rather than a read of state, for the reason `runWalk`'s
     * `target` is one: this decides whether ~80 billed Haiku calls happen, and
     * a decision that expensive belongs to the button that was pressed.
     *
     * They still get a row and a status — `skip`, the same one a non-scannable
     * file gets — because `ScanTable` renders a missing result as `pending`,
     * and a table of files stuck on "în așteptare" for ever is worse than the
     * spend it saved.
     */
    skip: ReadonlyMap<string, unknown> = new Map(),
  ) => {
    // The scan belongs to the walk that produced `walked`, so it takes that
    // run's token rather than minting a new one: cancelling the run has to
    // stop both, and a fresh token here would hand the scan a flag the Cancel
    // had already set and then discarded.
    const token = runTokenRef.current;

    // Slice #29.02 - the Evaluation screen's Continua is what starts this, so
    // any gate on screen belongs to the stage before it and is over.
    setGate(null);
    setPhase("scanning");
    const willScan = (e: FSEntry) => entryScannable(e) && !skip.has(e.path);
    const scannable = walked.filter(willScan);
    setScanProgress({ done: 0, total: scannable.length });

    // Three states, not two. `skip` says the file is not something the system
    // can classify; `preexisting` says it is, and was not sent because the
    // archive already holds it. Wearing one badge, the second row would tell a
    // business user their perfectly ordinary PDF is unreadable — see
    // `ScanStatus`.
    setScanResults(() => {
      const m = new Map<string, ScanResult>();
      for (const e of walked) {
        m.set(e.path, {
          status: skip.has(e.path) ? "preexisting" : entryScannable(e) ? "pending" : "skip",
          // Slice #32.08 — `null` is the honest value: nothing has been
          // classified. Required rather than omitted, so that the ONE
          // construction site that must carry a real answer cannot forget it.
          identityPersonCount: null,
        });
      }
      return m;
    });

    /**
     * The classifier's answers, as they arrive.                (Slice #29.08)
     *
     * ⚠️ **A LOCAL MAP BESIDE THE STATE ONE, for the reason every verdict in
     * `runWalk` is computed from a local.** The gate below decides a PHASE, and
     * a phase decision cannot wait for a render: reading `scanResults` here
     * would read the map this callback captured when it was created, which is
     * the one from before a single answer arrived — every entry would look
     * unclassified, every folder would pass the gate, and the slice would be a
     * no-op that looked like it worked.
     *
     * It holds the same objects `setScanResults` writes, so `classifiedEntriesOf`
     * can be asked of either — which is what keeps the end of the scan and the
     * stop screen's "try again" reading one rule rather than two.
     */
    const settled = new Map<string, ScanResult>();

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
          // Slice #29.08 - the moment of the spend. See `classificationSpent`:
          // this is issued, therefore billed, whatever comes back.
          setClassificationSpent(true);

          // Mark as scanning/converting
          const isImg = isFileKind(
            entry.kind === "page-group" ? entry.handles[0].name : entry.name,
            "image",
          );
          setScanResults((prev) => {
            const next = new Map(prev);
            next.set(entry.path, {
              status: isImg ? "scanning" : "converting",
              identityPersonCount: null,
            });
            return next;
          });

          scanEntry(entry)
            .then((cl) => {
              if (token.cancelled) return;
              const result: ScanResult = {
                status: "done",
                description: cl.classifiedLabel,
                typeKey: cl.suggestedTypeKey,
                confidence: cl.confidence,
                extractable: cl.extractable,
                // ⚠️ **THE LINE THE FIRST DRAFT OF #32.08 LEFT OUT, WHICH MADE
                // THE ENTIRE BLOCK DEAD.** The route returned the count, the
                // gate read the field, and nothing put the one in the other —
                // so every folder answered "clean" and the stop screen could
                // not be reached. What stops that recurring is that the field
                // is REQUIRED on `ScanResult`; the three sites above set it to
                // `null` and this is the one that has a real answer.
                identityPersonCount: cl.identityPersonCount,
              };
              // ONE object, written to both — so the gate below and the table
              // on screen are looking at the same answer rather than at two
              // constructions of it.
              settled.set(entry.path, result);
              setScanResults((prev) => {
                const next = new Map(prev);
                next.set(entry.path, result);
                return next;
              });
            })
            .catch(() => {
              if (token.cancelled) return;
              setScanResults((prev) => {
                const next = new Map(prev);
                next.set(entry.path, {
                  status: "error",
                  errorMsg: "Scan failed",
                  identityPersonCount: null,
                });
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

    if (token.cancelled) return;

    /**
     * The gate.                                                (Slice #29.08)
     *
     * ⚠️ **OVER THE ENTRIES THE RUN WILL CREATE A DOCUMENT FOR, not over every
     * file in the folder.** A `link` or `skip` row from the Pre-existing stage
     * creates nothing, so its type cannot be a type this import files a
     * document on — and blocking a run because a document the archive ALREADY
     * HOLDS is of a formless type would refuse an import over something that
     * happened months ago and that this run cannot change. It is the same list
     * `entriesToImport` derives one level up, computed from the arguments this
     * function was given rather than from state, for the reason the whole
     * function takes them as arguments.
     */
    const toImport = walked.filter((entry) => !skip.has(entry.path));

    /**
     * The identity-scan refusal.                               (Slice #32.08)
     *
     * ⚠️ **ASKED FIRST, AND OF THE ANSWERS ALREADY IN HAND — no request, no
     * token, nothing to cancel under.** The count came back with the
     * classification, so this is arithmetic over `settled` and it cannot fail;
     * that is why it is a plain verdict rather than the three-state lookup
     * beside it, and why there is no `busy` flag for it anywhere.
     *
     * ⚠️ **AND WHEN IT REFUSES, THE ARCHIVE'S LIST OF DOCUMENT TYPES IS NOT
     * READ AT ALL.** That read costs a request and up to thirty seconds, and
     * this run is going to end on a screen that sends the user to File Explorer
     * to split a scan — so a type verdict computed here could only be shown on
     * a screen that has no room for it, and would in any case be recomputed on
     * the next run, after the classification has been paid for again. Which of
     * the two stops a folder tripping both lands on is
     * `phaseAfterClassification`'s to say, and this file holds no copy of it;
     * what this file decides is only whether to SPEND on a question the answer
     * to that has already made moot.
     */
    const cards = checkMultiCard(multiCardEntriesOf(toImport, settled));
    setCardVerdict(cards);
    const cardsClean = cardsAreClean(cards);

    const lookup = cardsClean ? await runTypeGate(toImport, settled, token) : null;
    // ⚠️ **`lookup === null` MEANS TWO DIFFERENT THINGS AND ONLY ONE OF THEM
    // RETURNS.** From `runTypeGate` it means the run was cancelled under the
    // request, and there is nobody left to tell. From the line above it means
    // the gate was never asked because the identity scans already stopped this
    // run — which is a run that very much still has something to say. The
    // `cardsClean` term is what tells them apart.
    if (cardsClean && lookup === null) return;

    // Slice #29.02, re-pointed by #29.08 - the scan hands over the moment the
    // last request settles AND the gate has answered. Gated, it rests on
    // `scanning`, and the panel is told the scan is over so that it stops
    // telling the user to wait for it. Where it hands over TO is
    // `phaseAfterClassification`'s to say; this file holds no copy of that rule,
    // and the stop screen is deliberately not a gated destination — see
    // `SELF_ADVANCING_TRANSITIONS`.
    settle(
      "scanning",
      phaseAfterClassification({
        cardsClean,
        // `null` where the gate was never asked — see the comment above, and
        // `phaseAfterClassification`'s own note on why that argument accepts
        // one rather than being narrowed to a boolean.
        typesClean: lookup === null ? null : typesAreClean(lookup),
      }).phase,
    );
  }, [settle, runTypeGate]);


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
    // Where a FAILED re-check puts the user back. The button exists on four
    // screens since #26.05 — the Structure violation list, the Constraints
    // rules screen, the Constraints violation list and the folder report — and
    // each must return to itself: each is a to-do list the user is working
    // through, and anything else throws away the list they were reading because
    // the FOLDER went missing.
    //
    // `constraints` (the rules, never yet checked) is listed separately from
    // `constraints-report` on purpose — returning a first-time user to a
    // violation list they have never seen would be a screen made of nothing.
    const returnTo: ImportPhase =
      // ⚠️ **THE `structure` ARM IS REACHABLE SINCE #29.02, AND #26.06's
      // ADVERSARIAL REVIEW IS WHY IT WAS NOT BEFORE.** The note here said the
      // Structure panel renders its PICKER rather than the re-check while its
      // verdict is null, and that a failed pick clears `observations` on the
      // way in — so `handleRecheck` could not be reached from that phase at
      // all, and a round of #26.06 that added an arm anyway was describing a
      // defect that could not occur. Step-through built the route: a clean
      // structure walk now RESTS on `structure` holding a non-null clean
      // verdict, so `checked` is true, the button IS the re-check, and pressing
      // it on a folder that has since been moved lands here.
      //
      // ⚠️ **#32.01 REMOVED THAT BUTTON FROM THE PAUSED SCREEN, AND THE ARM
      // STAYS.** `ImportStructureStage` hides its whole button row once the
      // verdict is clean and a gate is holding this stage, so the press the
      // paragraph above describes can no longer be made there. The arm is still
      // reachable — `phase === "structure"` is also where clearing a resumed
      // session lands, with the panel's controls back — and it is the honest
      // destination for a failed re-walk holding a clean verdict either way.
      // What must not stay is a paragraph naming a press that cannot happen;
      // this is that correction, not a deletion.
      //
      // It returns to `structure`, not to `structure-report`: the verdict in
      // hand is clean, and `structure-report` is the violation list. Without
      // this arm the fall-through put the user on a fix list with nothing on
      // it — found by the adversarial round, not by the type checker, because
      // both phases render the same panel and neither is `busy`.
      phase === "structure"
        ? "structure"
        : phase === "folder-report"
        ? "folder-report"
        : phase === "constraints"
          ? "constraints"
          : phase === "constraints-report"
            ? "constraints-report"
            : phase === "duplication"
              ? "duplication"
              : phase === "duplication-report"
                ? "duplication-report"
                : phase === "preexisting"
                  ? "preexisting"
                  : phase === "preexisting-report"
                    ? "preexisting-report"
                    : "structure-report";

    // How far it goes. Pressed from either Structure screen it re-checks the
    // structure and stops; pressed from anywhere later it goes the whole way,
    // because those screens are only reachable through a clean structure check
    // and the user is asking about the files.
    const target: WalkTarget =
      phase === "structure" || phase === "walking" || phase === "structure-report"
        ? "structure"
        : phase === "constraints" ||
            phase === "constraints-checking" ||
            phase === "constraints-report"
          ? "constraints"
          : phase === "duplication" ||
              phase === "duplication-checking" ||
              phase === "duplication-report"
            ? "duplication"
            : // The Pre-existing screens and the Evaluation screen. Both are
              // reachable only through three clean checks, so the press means
              // "check the lot, then ask the archive" - and from Evaluation
              // that is the only honest reading, because the user has been in
              // File Explorer and may have put a copy back.
              //
              // ⚠️ #26.08 moved Evaluation from `duplication` to here, and it
              // is not a widening for its own sake. The pre-existing report is
              // a promise about the files that are about to be imported; a
              // re-check from Evaluation that left it untouched would carry the
              // previous folder's promise into the new one, and the import loop
              // reads that promise rather than the screen.
              "preexisting";

    if (!_dirHandle) {
      // Fixed in passing (#26.03): this used to return in silence, so a button
      // that had lost its handle would have done nothing at all — no message,
      // no cue — and the user would have been left pressing it.
      //
      // ⚠️ The comment here used to say "no route to it is known: the button
      // only exists at `folder-report`". That stopped being true at #26.04 and
      // is four screens out of date since #26.05 — and one of the four, the
      // Constraints rules screen, is the stage's PRIMARY action rather than a
      // re-check, so it is the press least likely to have been preceded by a
      // successful walk in that stage. Every route still runs through a walk
      // that set `_dirHandle`, so it stays a guard against a future route
      // rather than a fix for a reported bug — but it is now a guard on a
      // button the user presses first, not last.
      setWalkError(t("recheckFailed", { button: tCancel("button") }));
      return;
    }
    await runWalk(_dirHandle, "recheck", target, returnTo);
  }, [runWalk, t, tCancel, phase]);

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
    // Slice #29.08 - and the type gate's answer, for the reason every other
    // line here exists: this function's contract is that every trace of the run
    // is dropped, and a verdict about a folder the wizard no longer holds is as
    // much a trace as a tick.
    setTypeLookup(null);
    setTypeGateBusy(false);
    setTypeGateAttempts(0);
    // Slice #32.05 — "Oprește importul" is this function, so the press that
    // leaves the stop screen is also the press that forgets the waiver.
    setTypeFormsWaived(false);
    // Slice #32.08 — and the identity-scan verdict, for the reason every other
    // line here exists: this function drops every trace of the run.
    setCardVerdict(null);
    setResolvedRun(null);
    setPropertiesTouched(false);
    setTouchedProperties([]);
    setCornersWritten(new Set());
    setDocumentsCreated(false);
    setClassificationSpent(false);
    setRunCompleted(false);
    // Slice #26.10 — a renounced run has no conclusion to report. Left set, the
    // message would open over the Information page of the NEXT import, quoting
    // the statistics of the one the user just walked away from.
    setRunSummary(null);
    setWalkError(null);
    setShowQuiet(false);
    setShowSkipped(false);
    // Slice #26.04 — the Structure screen goes back to how a first-time visitor
    // meets it: rules open, nothing ticked. A tick carried over from a
    // renounced run would let the next one pick a folder without ever having
    // read the rules on the way past.
    setStructureAcknowledged(false);
    setStructureRulesOpen(false);
    // Slice #26.05 — and the same for Constraints, for the same reason.
    setConstraintsAcknowledged(false);
    setConstraintsRulesOpen(false);
    // Slice #26.06 — and Duplication, plus the flag that says its match ran.
    // A cancel drops the entries and the metadata, so leaving this true would
    // claim a check against a walk that no longer exists.
    setDuplicationAcknowledged(false);
    setDuplicationRulesOpen(false);
    setDuplicationChecked(false);
    // Slice #26.08 - and Pre-existing, including the archive's answer. A cancel
    // drops the entries, so leaving the report standing would describe an
    // import of files this wizard no longer holds.
    setPreexisting(null);
    setPreexistingAcknowledged(false);
    setPreexistingNotesOpen(false);
    // Slice #28.02 - and the STR-15 answers. Not currently reachable any other
    // way (a cancel nulls `_dirHandle`, so the only route back to a walk is
    // `handlePickFolder`, which clears these too) - but this function's contract
    // is that every trace of the run is dropped here, and an answer about a
    // folder on a disk is as much a trace as a tick. One invariant held in two
    // places is how it stops being held in either.
    setPropertyAnswers(new Map());
    propertyAnswersRef.current = new Map();
    // Slice #29.02 - the pause, and the setting that produced it. The setting
    // goes back to its DEFAULT with everything else, because this function's
    // contract is that the next import starts exactly as a first one does - and
    // since #32.03 that default is ticked. Read this as "reset", not as "off":
    // the literal here and the initialiser above are one value in two places,
    // and `import-workflow-stages.test.ts` pins both.
    setGate(null);
    stepThroughRef.current = true;
    setStepThrough(true);
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

  /**
   * The three phases the Constraints panel owns.   (Slice #26.05)
   *
   * Same shape as Structure's, one stage later: the rules screen, the check
   * running, and the fix list. `constraints-checking` covers a re-walk as well
   * as the metadata pass, so a check that turns out to break the structure
   * leaves this set and enters `inStructure` — which is the one transition
   * between the two stages that goes backwards, and it is meant to.
   */
  const inConstraints =
    phase === "constraints" ||
    phase === "constraints-checking" ||
    phase === "constraints-report";

  /**
   * The three phases the Duplication panel owns.   (Slice #26.06)
   *
   * Same shape as the other two, one stage later: the explanations, the check
   * running, and the list of what it found. `duplication-checking` covers the
   * re-walk and the metadata pass as well as the match, so a check that turns
   * out to break the structure or a constraint leaves this set and enters
   * `inStructure` or `inConstraints` — the two transitions between stages that
   * go backwards, and both are meant to.
   */
  const inDuplication =
    phase === "duplication" ||
    phase === "duplication-checking" ||
    phase === "duplication-report";

  /**
   * The three phases the Pre-existing panel owns.   (Slice #26.08)
   *
   * Same shape as the other three, one stage later: the explanations, the check
   * running, and what the archive came back with. `preexisting-checking` covers
   * the re-walk, the metadata pass, the duplication match AND the request to
   * the archive, so a check that turns out to break an earlier stage leaves
   * this set — the three transitions between stages that go backwards, and all
   * of them are meant to.
   */
  const inPreexisting =
    phase === "preexisting" ||
    phase === "preexisting-checking" ||
    phase === "preexisting-report";

  /**
   * Is a clean-check account honest RIGHT NOW?   (Slice #29.11)
   *
   * ⚠️ **THE PANEL'S OWN GUARD IS NOT ENOUGH, and an adversarial round is why
   * this flag exists at all.** The card is handed to a stage panel as
   * `resultDetail`, and the panel's own `!busy && verdict.clean` guard cannot
   * see a walk that FAILED — so the whole account stayed on screen at a
   * Structure rest whose re-check had just been unable to open the folder. One
   * expression, read at all three render sites. (It read four until #32.03,
   * when the attributed trail that was the fourth came out.)
   *
   * Three conditions, and each is load-bearing:
   *
   *  - **Inside the four check stages.** Past Pre-existing the classification
   *    has run and the Evaluation screen is the account of the folder; a stack
   *    of green cards beside it would compete with the conclusion the user is
   *    there to read. Written as the four `in*` flags rather than as a list of
   *    phases, so a phase added to any stage is covered without touching this.
   *  - **Nothing running.** Every card is derived from `entries`,
   *    `observations` and `metadata`, all three of which a re-check
   *    repopulates — so during a check the cards describe the PREVIOUS round's
   *    folder, over a check that may be about to refuse this one. That is the
   *    lie each panel's own `!busy && verdict.clean` guard was written for,
   *    across three adversarial rounds.
   *  - **And no walk error standing.** ⚠️ The worse half, and the one the panel
   *    guard misses. A re-check pressed after the user has renamed, moved or
   *    unplugged the chosen folder in File Explorer — which is exactly what
   *    these stages send them away to do — fails in `runWalk`, sets `walkError`
   *    and puts the phase back on the stage it came from, WITHOUT clearing
   *    `entries` or `observations`. The busy test is false by then, so the
   *    cards would come back: nine rows and a list of folder names to go and
   *    rename, describing a folder the wizard has just failed to open, with the
   *    red "the check did not run" alert several screens below them. Before
   *    this slice the equivalent stale claim was the single clause in
   *    `constraints.intro`, which this slice removed — so the card must not
   *    reintroduce it at nine times the size.
   *
   * The busy phases are listed positively rather than tested as "not one of the
   * settled ones": a phase nobody thought of then hides the cards, which is the
   * under-claiming direction.
   */
  const checkAccountsSettled =
    (inStructure || inConstraints || inDuplication || inPreexisting) &&
    phase !== "walking" &&
    phase !== "constraints-checking" &&
    phase !== "duplication-checking" &&
    phase !== "preexisting-checking" &&
    walkError === null;

  /**
   * The four phases the Import panel stands behind.   (Slice #26.09)
   *
   * `ready` is the panel's own screen; the three after it are its modal steps,
   * during which the panel stays on screen underneath and its controls are
   * inert. Listed positively, for the reason the file table below is: a phase
   * nobody thought of cannot make a positive list wrong.
   */
  const inImportStage =
    phase === "ready" ||
    phase === "property" ||
    phase === "tag-dialog" ||
    phase === "importing" ||
    // Slice #26.10 — the run has finished and its result screen is a modal, so
    // this panel is what sits behind it. Leaving `result` out blanked the shell
    // under the scrim for as long as the user read the result, which is the one
    // moment they are most likely to look past it.
    phase === "result";

  /**
   * What the import loop must do INSTEAD of importing, keyed by entry path.
   * (Slice #26.08)
   *
   * Derived from the stored answer rather than stored beside it, so there is
   * exactly one copy of the decision and the screen and the loop cannot come to
   * disagree about it — the same argument every other derived value on this
   * component carries, with one extra edge: this one is a promise the user has
   * already read.
   *
   * ⚠️ **EMPTY when the lookup failed, and that is the honest reading.** A run
   * that could not ask the archive imports everything, which is exactly what an
   * empty map produces — and the screen the user pressed Continuă on said so in
   * as many words.
   */
  const preexistingDecisions = useMemo(
    () =>
      preexisting !== null && preexisting.ok
        ? preexistingDecisionsByPath(preexisting.verdict)
        : new Map<string, PreexistingRow>(),
    [preexisting],
  );

  /**
   * The two numbers the Evaluation screen needs about them.   (Slice #26.08)
   *
   * `total` is how many of the folder's entries the archive already holds;
   * `linked` is the subset that will actually attach one to a Property. They
   * differ for a `floating` document and for a `common` one in a run that
   * resolved no property — rows where nothing whatever happens — and the
   * difference is what stops Continuă offering a journey that ends in "0
   * documente importate". See `FolderForecast`'s prop.
   */
  const alreadyInSystem = useMemo(() => {
    let linked = 0;
    for (const row of preexistingDecisions.values()) if (row.outcome === "link") linked++;
    return { total: preexistingDecisions.size, linked };
  }, [preexistingDecisions]);

  /**
   * The entries this run will actually create a Document for.   (Slice #26.08)
   *
   * ⚠️ **EVERY NUMBER THE EVALUATION SCREEN QUOTES COMES FROM HERE, and the
   * slice's own adversarial review is why.** Without it the screen one click
   * after the Pre-existing report read "Documente care vor fi create: 40"
   * directly under a promise that three of them would not be — the one stage
   * whose whole job is to say what the import will do, contradicted by the next
   * screen, in the numbers the user is being asked to approve.
   *
   * The same list gates the classification pass, which is the expensive half:
   * `startScan` sent every entry, so a folder of 300 images with 80 already in
   * the archive spent 80 billed Haiku calls on documents the loop then refused
   * to create. Nothing read those answers.
   *
   * A `link` or `skip` row is not imported; a `reimport` row is, and is absent
   * from the map for exactly that reason.
   */
  const entriesToImport = useMemo(
    () =>
      preexistingDecisions.size === 0
        ? entries
        : entries.filter((entry) => !preexistingDecisions.has(entry.path)),
    [entries, preexistingDecisions],
  );

  /**
   * "The list could not be read — try again."                   (Slice #29.08)
   *
   * The ONE thing the stop screen offers to repeat, and it repeats nothing that
   * costs money: the classification is already in `scanResults`, so this reads
   * the archive's list of document types again and decides again. It is not a
   * resume — there is no partial run to pick up, and nothing was persisted —
   * which is why it exists on the failed-read branch and nowhere else. A type
   * that has no form does not acquire one because a button was pressed here;
   * that is what DocTypeEngine is for, and the way back from it is a fresh
   * import, as the stop screen says.
   *
   * ⚠️ **It reads `entriesToImport` and `scanResults`, the STATE, and that is
   * correct here where it would be wrong inside `startScan`.** Nothing is in
   * flight at this point: the scan settled before the phase moved, and both
   * values were published in commits that have long since rendered. The reason
   * the scan itself uses a local is that its awaits sit between the writes and
   * the read; there is no such gap here.
   */
  const handleTypeGateRetry = useCallback(async () => {
    if (typeGateBusy) return;
    const token = runTokenRef.current;
    // ⚠️ **THE BUSY FLAG IS `runTypeGate`'S, INCLUDING ON THE CANCELLED PATH,
    // and an adversarial round found what the other arrangement cost.** With
    // the clear here and after an early `return` on cancellation, a run
    // cancelled under the fetch left the flag set and the guard above then
    // refused every later press for the rest of the session. Nothing reached
    // that sequence — the stop screen disables all three of its buttons while
    // this runs — but the invariant was being held up by another component's
    // `disabled` props, which is not where one belongs.
    const lookup = await runTypeGate(entriesToImport, scanResults, token);
    if (token.cancelled || lookup === null) return;
    // Straight to `setPhase`, not through `settle`: this is a button the user
    // pressed, and the table in `workflow-stages.ts` never gates one.
    if (typesAreClean(lookup)) setPhase("folder-report");
  }, [runTypeGate, typeGateBusy, entriesToImport, scanResults]);

  /**
   * "Continuă fără formulare."                                 (Slice #32.05)
   *
   * The second way off the stop screen, and it is the shortest handler in this
   * file on purpose: raise the run's waiver, and land on `folder-report`.
   *
   * ⚠️ **`setPhase`, NOT `settle`, and `handleTypeGateRetry` above states the
   * rule this follows: this is a button the user pressed, and the table in
   * `workflow-stages.ts` never gates one.** `phaseAfterClassification` is not
   * given a third input either — its only caller is the end of `startScan`, it
   * answers what the SCAN decided, and the scan still decides `types-blocked`.
   * `SELF_ADVANCING_TRANSITIONS` gains no row.
   *
   * ⚠️ **AND THE DESTINATION IS `folder-report`, NOT `ready` AND CERTAINLY NOT
   * THE RUN.** The shortest reading of "click a button to continue" is a button
   * that starts the import; that button would skip the property step, which is
   * what attaches a document to anything at all, and the Import screen, which
   * is the one place the run's cost is stated before the click. Continuing here
   * means "stop stopping", not "start writing" — so it lands exactly where a
   * clean verdict lands, and every screen after it happens as it always does.
   *
   * ⚠️ **THE VERDICT GUARD IS THE WIZARD'S, and it is not a second copy of the
   * panel's.** The panel draws this control only inside its verdict fragment;
   * this refuses to raise a waiver over a lookup that carries no verdict at
   * all. They are the same invariant asserted by the two components that each
   * own half of it — the screen owns what is drawn, the wizard owns what the
   * run believes — and the under-claiming direction here is that nothing
   * happens on a screen that has nothing to waive.
   */
  const handleTypeGateContinue = useCallback(() => {
    if (typeGateBusy) return;
    if (typeLookup === null || !typeLookup.ok) return;
    setTypeFormsWaived(true);
    setPhase("folder-report");
  }, [typeGateBusy, typeLookup]);

  /**
   * The two numbers the waiver committed to, or null on an ordinary run.
   *                                                            (Slice #32.05)
   *
   * Counted ONCE, here, off the verdict already in state, and handed to both
   * screens that repeat it — the Evaluation screen, where the run is described,
   * and the Import screen, where it is priced. Two panels each counting for
   * themselves is two places for the arithmetic to drift, and the numbers are
   * `missingForm.length` and the sum of `documentCount` across it, which the
   * gate has already worked out.
   */
  const waivedForms = useMemo(() => {
    if (!typeFormsWaived || typeLookup === null || !typeLookup.ok) return null;
    const types = typeLookup.verdict.missingForm;
    return {
      types: types.length,
      documents: types.reduce((n, type) => n + type.documentCount, 0),
    };
  }, [typeFormsWaived, typeLookup]);

  // Derived at render time rather than copied into state when the walk ends:
  // one copy cannot drift from the list the user is looking at. Cheap — it is
  // a single pass over names, no file contents and no I/O.
  const forecast = useMemo(() => forecastImport(entriesToImport), [entriesToImport]);

  /**
   * How many documents the import run may read with the model.   (Slice #26.09)
   *
   * ⚠️ **An UPPER BOUND, and the panel words it as one.** The loop skips an
   * identity card whose person action can act on it, and whether it can depends
   * on which property the entry belongs to — an answer `PropertyStepDialog`
   * produces two screens after this number is shown. Over-stating the spend is
   * the safe direction; under-stating it is the one that surprises somebody.
   *
   * `shouldInterpretEntry` is the loop's own predicate, called rather than
   * restated — a number on a screen and the loop it describes must be one
   * expression.
   *
   * ⚠️ **Only ONE of its two arguments is guessed, and it is guessed in the
   * safe direction.** `isIdCard` is a fact about the scan and is passed
   * honestly; `canCreatePerson` depends on which property the entry lands in,
   * which `PropertyStepDialog` decides two screens later, so it is answered
   * `false` — the answer that makes the predicate return true more often. An
   * earlier draft passed `isIdCard: false` as well, which short-circuited the
   * whole rule and quietly reduced this to "has a readable page"; the same
   * number, arrived at by asserting something untrue.
   */
  const interpretUpperBound = useMemo(
    () =>
      entriesToImport.filter((entry) =>
        shouldInterpretEntry(entry, {
          isIdCard: isIdCardEntry(scanResults.get(entry.path)),
          canCreatePerson: false,
        }),
      ).length,
    [entriesToImport, scanResults],
  );

  /**
   * How many entries the classification pass actually sent.
   *
   * Over `entriesToImport`, not `entries`, and moved down here from beside
   * `folders` for that reason: it feeds the toolbar's "scan complete" line, and
   * after #26.08 the number of scannable FILES in the folder is no longer the
   * number of files that were scanned. Saying otherwise on the screen that
   * reports the finished scan is a small lie in the same direction as the two
   * this slice's review found in the forecast.
   */
  const scannableCount = entriesToImport.filter(entryScannable).length;

  /**
   * Bytes the run will upload — over the entries it will actually import.
   *
   * `report.uploadBytes` is the same sum over the WHOLE folder, and it stays
   * that way: `checkFolder` is the advisory report about what the walk found,
   * and narrowing its input would silently drop findings about the files this
   * run is not importing. What the two screens SHOW is this number, because
   * both of them are describing the import rather than the folder.
   *
   * `null` when the metadata pass has not run, exactly as `report.uploadBytes`
   * is — the panels already draw that state.
   */
  const uploadBytesToImport = useMemo(
    () =>
      metadata === null
        ? null
        : uploadKeysOf(entriesToImport).reduce(
            (total, key) => total + (metadata.get(key)?.size ?? 0),
            0,
          ),
    [entriesToImport, metadata],
  );

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
    () =>
      observations.length === 0
        ? null
        : checkStructureStage(observations, propertyAnswers),
    // ⚠️ `propertyAnswers`, the STATE, and not the ref: a ref is not a render
    // input, so a memo that read it would keep the previous answer on screen
    // until something else happened to re-render. The ref exists for `runWalk`
    // alone — see its declaration.
    [observations, propertyAnswers],
  );

  /**
   * The Constraints verdict on screen.   (Slice #26.05)
   *
   * Derived, not stored, exactly as the structure verdict and the report are.
   *
   * `metadata === null` is the sound test for "not checked in this run", and it
   * is the reason `runWalk` clears it on the way into the Constraints stage: a
   * folder arrives here with `entries` and `observations` already populated by
   * the structure walk, so neither of those can tell the two states apart. An
   * EMPTY map is a different thing entirely — it means the pass ran and read
   * nothing, and the verdict then refuses the folder rather than passing it.
   *
   * `runWalk` computes the same verdict from its own locals to choose the next
   * phase. Not a second copy of the rule: the same pure function over the same
   * inputs, called once because a phase decision cannot wait for a render and
   * once because a render cannot read a local.
   */
  const constraintVerdict = useMemo(
    () =>
      metadata === null
        ? null
        : checkConstraintsStage({ entries, observations, metadata }),
    [entries, observations, metadata],
  );

  /**
   * The Duplication verdict on screen.   (Slice #26.06)
   *
   * Derived, not stored, exactly as the other two verdicts are — and gated on
   * `duplicationChecked`, which is the one thing that cannot be derived here.
   * `entries` and `metadata` are both populated and complete the moment the
   * Constraints check passes, so they cannot tell "the user is standing on the
   * Duplication explanations, having checked nothing" apart from "the match ran
   * and found nothing". See the flag's own note for why that is the shape of
   * the flow rather than a gap in it.
   *
   * The `metadata === null` half is unreachable while the flag is true — they
   * are set in one commit — and it stays because the alternative is a non-null
   * assertion on a value another branch is allowed to clear.
   *
   * `runWalk` computes the same verdict from its own locals to choose the next
   * phase. Not a second copy of the rule: the same pure function over the same
   * inputs, called once because a phase decision cannot wait for a render and
   * once because a render cannot read a local.
   */
  const duplicationVerdict = useMemo(
    () =>
      !duplicationChecked || metadata === null
        ? null
        : checkDuplicationStage({ entries, metadata }),
    [duplicationChecked, entries, metadata],
  );

  /**
   * What each clean check looked at, ready to render.   (Slice #29.11)
   *
   * ⚠️ **BUILT FROM THE SAME VERDICT THE PHASE DECISION USED, and that is the
   * requirement rather than a convenience.** Each memo starts by asking its own
   * stage's verdict whether it is clean and returns `null` otherwise, so a card
   * cannot exist for a check that did not run or did not pass. `duplicationVerdict`
   * is already `null` unless `duplicationChecked` — the flag that says the match
   * actually ran — so the Duplication card is impossible on a run that skipped
   * it, without this file expressing that rule a second time. Same argument
   * `phaseAfterFileChecks` makes for returning `duplicationRan`/`preexistingRan`
   * instead of letting the caller re-derive them.
   *
   * ⚠️ **ONE NODE PER STAGE SINCE #32.03, AND IT MOUNTS INSIDE ITS OWN STAGE'S
   * PANEL.** Each memo used to return a second, ATTRIBUTED node that was drawn
   * above a LATER stage's panel for a check the user had flown past, and that
   * retrospective trail is gone: with step-through ticked by default every
   * clean check now rests on its own stage, so the account is read where it was
   * produced instead of stacking up as green memos on the screens after it. The
   * node here is handed to the panel as `resultDetail`; there is no second
   * mount point left for it to be confused with.
   *
   * ⚠️ **WHICH MEANS AN UNTICKED RUN SEES ALMOST NO ACCOUNT, and that is the
   * decision rather than an oversight.** Untick the toggle and the three file
   * checks self-advance exactly as they did before #29.11: the panel is replaced
   * in the same commit that moves the phase on, and the only trace a clean check
   * leaves is the clause at the top of the next stage's intro — #29.01's F9,
   * back for that path. (Almost, not entirely: a walk that finds only STR-15
   * violations rests on `structure-report` whatever the toggle says, and the
   * last answer turns the verdict clean there without a re-walk — so the
   * Structure card renders on that route too, gated or not.) The trail was what covered it, and the trail is what
   * made a Duplication or Pre-existing screen carry two or three retrospective
   * green memos above the findings the user was actually there to read. What
   * unticking now means is "do not show me the clean steps", which is what the
   * control says. Do not restore the trail to close this; a slice that wants the
   * account on the unticked path should put it where the user is standing.
   *
   * ⚠️ **THE FACTS ARE THE VERDICT'S OWN ZEROES, not literals.** "Reguli
   * încălcate: 0" reads `verdict.violations.length`. A hard-coded zero would go
   * on printing itself if the guard above ever stopped holding, which is the one
   * failure mode a screen like this must not have.
   */
  const structureResult = useMemo(() => {
    if (structureVerdict === null || !structureVerdict.clean) return null;

    const summary = summariseStructure({ entries, observations });
    const shown = summary.readings.slice(0, MAX_NAME_READINGS_SHOWN);
    const hidden = summary.readings.length - shown.length;

    const facts = [
      { label: tCheck("structure.rules"), value: String(summary.rulesChecked) },
      {
        label: tCheck("structure.violations"),
        value: String(structureVerdict.violations.length),
      },
      {
        label: tCheck("structure.directories"),
        value: String(summary.directoriesWalked),
      },
      {
        label: tCheck("structure.propertyFolders"),
        value: String(summary.propertyFolders),
      },
      {
        label: tCheck("structure.sharedFolders"),
        // The folder names themselves, never translated: they are strings on a
        // disk, which is why `SHARED_FOLDER_DISPLAY_NAMES` is the same in both
        // locales. See its note.
        value:
          summary.sharedFolders.length === 0
            ? tCheck("structure.noSharedFolders")
            : summary.sharedFolders
                .map((id) => SHARED_FOLDER_DISPLAY_NAMES[id])
                .join(", "),
      },
      { label: tCheck("structure.files"), value: String(summary.filesKept) },
      { label: tCheck("structure.documents"), value: String(summary.documents) },
      { label: tCheck("structure.pageGroups"), value: String(summary.pageGroups) },
      { label: tCheck("structure.ignored"), value: String(summary.filesIgnored) },
    ];

    const readings = (
      <PropertyNameReadings
        readings={shown}
        strings={{
          title: tCheck("structure.readingsTitle"),
          rule: tCheck("structure.readingsRule"),
          tarla: tCheck("structure.tarla"),
          parcela: tCheck("structure.parcela"),
          description: tCheck("structure.description"),
          noDescription: tCheck("structure.noDescription"),
          more: hidden > 0 ? tCheck("structure.moreFolders", { count: hidden }) : null,
        }}
      />
    );

    return <ImportCheckResult facts={facts}>{readings}</ImportCheckResult>;
  }, [structureVerdict, entries, observations, tCheck]);

  const constraintsResult = useMemo(() => {
    if (constraintVerdict === null || !constraintVerdict.clean) return null;

    const summary = summariseConstraints(entries);
    const facts = [
      { label: tCheck("constraints.rules"), value: String(summary.rulesChecked) },
      {
        label: tCheck("constraints.violations"),
        value: String(constraintVerdict.violations.length),
      },
      { label: tCheck("constraints.files"), value: String(summary.filesMeasured) },
      { label: tCheck("constraints.documents"), value: String(summary.documents) },
      {
        label: tCheck("constraints.unreadable"),
        value: String(constraintVerdict.unreadable.length),
      },
    ];

    return <ImportCheckResult facts={facts} />;
  }, [constraintVerdict, entries, tCheck]);

  const duplicationResult = useMemo(() => {
    if (duplicationVerdict === null || !duplicationVerdict.clean) return null;

    const summary = summariseDuplication(entries);
    const facts = [
      { label: tCheck("duplication.rules"), value: String(summary.rulesChecked) },
      {
        label: tCheck("duplication.found"),
        value: String(duplicationVerdict.violations.length),
      },
      { label: tCheck("duplication.files"), value: String(summary.filesCompared) },
      { label: tCheck("duplication.documents"), value: String(summary.documents) },
    ];

    return <ImportCheckResult facts={facts} />;
  }, [duplicationVerdict, entries, tCheck]);

  /*
   * ⚠️ **`classificationSpent` USED TO BE DERIVED HERE, and #29.08 moved it up
   * beside `runCompleted` as a fact about the RUN.** The `useMemo` that stood
   * on this line read the scan RESULTS — counting `done` and `error`, because a
   * settled request is a spent one — and its forty-line note argued that at
   * length. The argument was right and its SOURCE stopped being: `runWalk`
   * clears `scanResults` on the way into every walk, and this slice put the
   * Evaluation screen after the classification, so a re-check pressed there
   * erased the evidence. The whole note moved with the state rather than being
   * left here, where the next declaration is `report` and a reader would have
   * taken it for that one's contract.
   */

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
   * Has the Pre-existing screen anything left to ask the user for?
   *                                                            (Slice #32.04)
   *
   * ⚠️ **TWO FACTS, AND THE SECOND IS WHAT KEEPS THIS OUT OF #26.02.** A clean
   * archive verdict is not enough. `ReportSections` below the panel is the
   * FOLDER's own report — a to-do list the user works through in File Explorer,
   * one of whose findings (`walkLoopedOnShortcut`) says every number on the
   * screen is inflated and ends "Nu porniți importul". The only control that
   * re-walks the folder after the user has acted on it is that panel's
   * "Verifică din nou". Prune on the archive's answer alone and a user told to
   * go and fix something has no way to have the fix looked at, while the one
   * live button spends money on a folder the report has already condemned.
   *
   * ⚠️ **AND IT IS COMPUTED HERE, ONCE, FOR BOTH READERS.** The panel prunes on
   * it and the report below is not mounted on it, so a second copy of the same
   * rule — in the panel, say — would agree today and diverge the day either
   * gains a term: a report saying nothing, drawn under a panel that has already
   * said it. `reportHasNothingToSay` is `ReportSections`' own test, exported
   * for exactly this.
   *
   * `phase !== "preexisting-checking"` is the panel's `busy`, written from the
   * same source: a check in flight is not a settled lookup, and the previous
   * round's clean verdict is still standing while it runs.
   */
  const preexistingResultOnly =
    phase !== "preexisting-checking" &&
    preexisting !== null &&
    preexisting.ok &&
    preexisting.verdict.clean &&
    reportHasNothingToSay(report);

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
        // Slice #29.02 - `phase === "scanning"` stopped meaning "requests are
        // in flight" the moment the scan could be HELD on its own screen: at a
        // step-through pause every request has settled and the run is waiting
        // on the user. Left as it was, the Cancel would have promised to stop
        // classification "aflata chiar acum in lucru" over a scan that finished
        // - and suppressed `nothingClassifiedYet` on the way past. This dialog
        // exists to stop the flow lying about what a cancel costs, so a stale
        // flag in it is worse here than anywhere else in the wizard.
        // ⚠️ Slice #29.02 - `phase === "scanning"` ALONE stopped meaning
        // "requests are in flight" the moment the scan could be HELD on its own
        // screen: at a step-through pause every request has settled and the run
        // is waiting on the user. Left as it was, the Cancel promised to stop
        // classification "aflata chiar acum in lucru" over a scan that had
        // finished - and suppressed `nothingClassifiedYet` on the way past.
        // This dialog exists to stop the flow lying about what a cancel costs,
        // so a stale flag in it is worse here than anywhere else in the wizard.
        //
        // ⚠️ **`activeGate` DIRECTLY, NOT THROUGH A REF, and a round of this
        // slice used a ref until `react-hooks/refs` refused it: writing
        // `ref.current` during render is the rule's exact subject, and the rule
        // is right - a ref is not a render input, so a value mirrored into one
        // during render is a value React is entitled to render stale.** The ref
        // was there to keep this callback off `gate`'s identity, which turns
        // out to buy nothing: `activeGate` returns the SAME object as `gate`
        // rather than a fresh one, so its identity changes only when `gate` or
        // `phase` changes - and `phase` is already in this list.
        // ⚠️ Slice #29.08 adds the third term, and it is the same fault #29.02
        // added the second one for. `phase === "scanning"` now spans the type
        // gate's catalogue read as well as the queue: every request has settled
        // by then and nothing is being billed, so without `!typeGateBusy` the
        // dialog promises to stop classification "aflată chiar acum în lucru"
        // for up to the 30 s that read is allowed to take.
        classificationRunning:
          phase === "scanning" && activeGate?.rest !== "scanning" && !typeGateBusy,
        // ⚠️ `propertiesTouched` ALONE, not `resolvedRun !== null ||` it. An
        // adversarial round enumerated the three states: a step that finished
        // with properties has already set this, a step that failed partway has
        // too, and a step that finished with NONE — the legitimate
        // `floating`-only run — is the one case the disjunct changed, by
        // asserting that properties stay behind when the run created none.
        propertyResolved: propertiesTouched,
        documentsCreated,
        savedReportExists: savedSession !== null,
      },
    });
    // `_dirHandle` is a module-level singleton read inside an event handler,
    // never during render, so it needs no dependency and cannot go stale here.
  }, [
    classificationSpent,
    phase,
    activeGate,
    typeGateBusy,
    propertiesTouched,
    documentsCreated,
    savedSession,
  ]);

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
      {/* ⚠️ **PERMANENTLY MOUNTED, AND THAT IS THE ONLY REASON IT WORKS.**
          (Slice #29.02) A `role="status"` inserted into the DOM together with
          its text is not reliably announced — the region has to exist before
          its content changes — so the pause card cannot carry its own. The
          four stage panels already solve it exactly this way, with an sr-only
          status paragraph that is always present and whose TEXT changes; this
          is the same element one level up, because a pause can be raised over
          a screen that does not remount at all (the checklist at the
          preconditions rest, the scan panel at the scanning rest), and those
          are precisely the two where nothing else would tell a screen-reader
          user that the flow has stopped. */}
      {/* ⚠️ **Slice #29.08 gave it a second sentence, and the reason is the
          one the paragraph above states.** The import stopping on its own is
          the only transition in the whole flow that arrives without a press,
          and it was the one nothing announced: the stop screen's own
          `role="status"` is inserted together with its text, which is exactly
          what does not work; and the shell's `StageIndicator` announcement does
          not change either, because `types-blocked` reports the SCANNING stage
          so that no eleventh pill has to exist. This region is already
          permanent, and its text already changes — so it is the one place the
          announcement can be made reliably. Found by the adversarial round. */}
      <p role="status" className="sr-only">
        {/* ⚠️ **Slice #32.08 gave it a third sentence, for the reason #29.08
            gave it a second.** `cards-blocked` arrives without a press, its own
            panel's `role="status"` would be inserted together with its text,
            and it reports the SCANNING stage — so the indicator's announcement
            does not change either. This region is the only channel, and it
            carries two parts: what happened, and what to do about it. The
            second is a sentence of its own rather than a button label, because
            the parts are joined with a space and this screen's answer is not a
            control at all — it is a job in File Explorer. */}
        {phase === "cards-blocked"
          ? [tCardsBlocked("title"), tCardsBlocked("announce")].join(" ")
          : phase === "types-blocked"
          ? // ⚠️ **THE REASON-SPECIFIC SENTENCE, NOT A SHARED TITLE, and a
            // third round found why that matters.** A retry that turns "we
            // could not read the list" into "the list has no default type"
            // replaces the whole red block and removes the button the user was
            // standing on — and with one title for both, the region's text does
            // not change, so nothing is announced at all. The intros differ in
            // every state, so this is the text that is guaranteed to move.
            [
              tTypesBlocked(
                typeLookup?.ok === false ? `failed.${typeLookup.reason}Intro` : "title",
              ),
              // ⚠️ **AND, ON A VERDICT, THE SECOND WAY ON.** (Slice #32.05.)
              // `title` is "Importul s-a oprit: unele tipuri de documente nu au
              // încă formular", which was the whole truth while this screen was
              // a dead end. It is now half of it, and this region is the only
              // channel a non-sighted user gets before Tab reaches the button —
              // so the announcement names the button rather than leaving the
              // reader to discover that stopping is not the only option. Only
              // on the verdict branch, which is the only branch that draws it.
              //
              // ⚠️ **A SENTENCE OF ITS OWN, NOT THE BUTTON'S LABEL.** The parts
              // of this region are joined with a space, so a bare label lands
              // as "…nu au încă formular Continuă fără formulare" — one run-on
              // a screen reader gives no pause in. `announce` is the only
              // string in this group the panel does not draw, and it is here
              // rather than in the panel for the reason the whole region
              // exists: a `role="status"` inserted together with its text is
              // not announced.
              typeLookup?.ok === true ? tTypesBlocked("continueWithoutForms.announce") : "",
              // ⚠️ **THE ATTEMPT NUMBER IS WHAT MAKES A REPEATED FAILURE
              // AUDIBLE.** A retry that comes back with the same reason renders
              // the same sentence, and a live region with no text change
              // announces nothing — so the button reads as dead. See
              // `typeGateAttempts`.
              typeGateAttempts > 1 ? tTypesBlocked("attempt", { n: typeGateAttempts }) : "",
            ]
              .filter(Boolean)
              .join(" ")
          : activeGate !== null
            ? [
                tStepGate(`cleared.${stageForPhase(activeGate.rest)}`),
                // ⚠️ **Slice #32.03 added the second sentence, and it has to be
                // HERE rather than only on the card.** The card's own paragraph
                // is inserted into the DOM together with its text, which is the
                // shape this region exists to replace — and at the preconditions
                // rest the sentence in question is the pointer to the folder
                // picker that `preflight.allGreen` used to carry and that this
                // slice took out of it. Announced nowhere, it would be a
                // pointer a screen-reader user simply stopped getting.
                //
                // The membership test and the interpolation are the CARD'S, not
                // a second copy: `STAGES_WITH_NEXT_ACTION` is imported, and the
                // button's label is built from `advance` exactly as the button
                // builds it. What must never appear on either side is the label
                // written out as a literal.
                STAGES_WITH_NEXT_ACTION.includes(stageForPhase(activeGate.rest))
                  ? tStepGate(`nextAction.${stageForPhase(activeGate.rest)}`, {
                      button: tStepGate("advance", {
                        stage: tStage(`stage.${stageForPhase(activeGate.to)}`),
                      }),
                    })
                  : "",
                // ⚠️ **AND `why`, WHICH IS THE SENTENCE THAT SAYS THE RUN HAS
                // STOPPED.** #32.03 removed the `role="status"` the card had
                // left on its own `cleared` paragraph — it was this region's
                // sentence announced a second time — and that only holds as an
                // improvement if the region carries what the card carries. It
                // did not carry `why`, so a screen-reader user heard which check
                // passed and nothing about the flow having gone quiet. The three
                // sentences here are the card's three paragraphs, in order; the
                // button's label is left out because a button is announced when
                // it is reached.
                tStepGate("why"),
              ]
                .filter(Boolean)
                .join(" ")
            : ""}
      </p>

      <ImportStageBar
        phase={phase}
        onCancel={openCancelDialog}
        stepThrough={stepThrough}
        onStepThroughChange={changeStepThrough}
      />

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
        {/* Slice #26.09 — THE PICKER IS NO LONGER HERE.
            It stood in this row from #21.01 until now, gated on a growing list
            of "…and not during the Structure phases, and not during the
            Constraints ones, and not during Duplication, and not during
            Pre-existing" — one clause per slice that gave a stage its own
            panel, each for the same reason: the panel's picker sits behind that
            stage's tick, and a second copy up here is a way round the gate
            rather than a duplicate of it.

            ⚠️ It was NOT already unreachable — the honest version of this
            note. The remaining phases were `scanning`, `ready` and the three
            modal ones, and at `ready` the button rendered and was live: one
            click there threw away a scan the user had just paid for, with no
            confirmation. `ImportRunStage` carries the replacement, where the
            panel can say what choosing another folder costs. */}

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
            onClick={() => {
              // Slice #29.02 — a pause belongs to the run being walked, and
              // this button leaves it to read a PREVIOUS run's report. The
              // render guard would hide the card either way; dropping it is
              // what stops it reappearing when `onClear` comes back to this
              // very phase.
              setGate(null);
              setPhase("resumed");
            }}
            className="inline-flex items-center rounded-md border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40"
          >
            {t("resumeButton", { folder: savedSession.rootFolderName })}
          </button>
        )}

        {/* ⚠️ **THE REPORT IS NOT OFFERED AS THOUGH IT STILL MATCHED THE
            ARCHIVE.**   (Slice #29.11)

            The button above is left live in every state, deliberately: it is
            also the only route to "Import nou", which is what CLEARS a stale
            report. Taking it away would strand the user with a saved session
            they cannot get rid of. What changes is that the button no longer
            stands alone — a report whose documents are gone says so before it
            is opened, and a lookup that could not be made says THAT rather than
            nothing, because silence beside a live button reads as an all-clear.

            Nothing is said while the answer is in flight, and nothing when the
            report checks out: the user pressing Resume already assumes it is
            fine, and confirming an assumption on a toolbar is noise. */}
        {phase === "structure" && savedSession && savedSessionAudit !== null && (
          !savedSessionAudit.ok ? (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {t("resumeCheckFailed")}
            </span>
          ) : savedSessionAudit.missing.size > 0 ? (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              {t("resumeStale", {
                count: savedSessionAudit.missing.size,
                total: savedSessionAudit.linked,
              })}
            </span>
          ) : null
        )}

        {rootFolderName && (
          <span className="font-mono text-sm text-ink dark:text-zinc-200">
            📁 {rootFolderName}
          </span>
        )}

        {/* Resolved property chips — the run's destinations, always visible
            once chosen so they can't be forgotten mid-import. One per property
            folder since #26.07; a run with none (a chosen folder of `floating`
            only) shows nothing, which is the truth rather than an empty chip. */}
        {touchedProperties.map((property) => (
          <span
            key={property.id}
            className="inline-flex items-center gap-1.5 rounded-full border border-cta/30 bg-cta-pale px-3 py-1 text-xs font-medium text-cta dark:bg-cta/15"
          >
            <span className="font-mono">{property.code}</span>
            <span>{property.nickname ?? t("propertyStep.noNickname")}</span>
            <span className="text-cta/70">
              {t("propertyStep.chipCorners", { count: property.cornerCount })}
            </span>
          </span>
        ))}

        {/* Slice #26.04 — the walking cue used to live here as a toolbar chip.
            It moved into `ImportStructureStage`, because `walking` is now
            always a Structure phase, so a copy up here could only ever say the
            same sentence twice — once in this row's `role="status"` and once
            in the panel's `ActivityCue`, which is also one. The two SENTENCES
            did not move: the panel is handed them already translated, out of
            `adminImport.wizard`, so no key was renamed. */}

        {/* Slice #26.09 — the running scan's count and the finished scan's
            summary both moved into the stage panels below, and the Import
            button with them. A row of loose sentences beside a button pushed to
            the right with `ml-auto` was the shape of the flow before the shell
            existed; what is left here is about the RUN — which folder, and
            which properties — rather than about any one stage. */}

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
          // One sentence now, not two. #26.04 chose between them on
          // `metaProgress.total`, because the metadata pass ran at the end of a
          // clean structure walk; #26.05 moved that pass to the Constraints
          // stage, so this phase is only ever the walk. The conditional went
          // with the pass rather than being left here to pick a branch that can
          // no longer be taken.
          busyLabel={t("walkingFolder")}
          acknowledged={structureAcknowledged}
          onAcknowledgedChange={setStructureAcknowledged}
          onChooseFolder={handlePickFolder}
          onRecheck={() => void handleRecheck()}
          // Slice #29.02 — see the prop. At a pause the emerald card below
          // carries the screen's one primary action, so this panel's own used to
          // drop to a secondary. ⚠️ Since #32.01 it is not rendered at all: a
          // pause is a clean verdict with its account on the page, and the panel
          // hides its whole button row there. What this prop now decides is
          // whether the panel draws its work blocks; the demotion survives only
          // as a ternary that cannot be reached. Read the prop's own note before
          // treating `variant: gated ? …` as live behaviour.
          gated={activeGate?.rest === "structure"}
          rulesOpen={structureRulesOpen}
          onRulesOpenChange={setStructureRulesOpen}
          propertyAnswers={propertyAnswers}
          onPropertyAnswer={setPropertyAnswer}
          // Slice #29.11 — the account of this check, inside this check's own
          // panel. `checkAccountsSettled` rather than the panel's own guard
          // alone: see that flag's note for the failed-re-check case the panel
          // cannot see.
          resultDetail={checkAccountsSettled ? structureResult : undefined}
        />
      )}

      {/* Slice #26.05 — the Constraints stage: the same loop, one stage later,
          against the same folder. One panel across all three of its phases, so
          a check does not swap the screen out from under the reader. */}
      {inConstraints && (
        <ImportConstraintsStage
          verdict={constraintVerdict}
          folderName={rootFolderName}
          busy={phase === "constraints-checking"}
          busyLabel={
            // Two sentences, and which one is true says where the check is: it
            // re-walks the folder first (fast), then pays for the metadata
            // pass, which reports a running count.
            metaProgress.total > 0
              ? t("readingMetadata", { done: metaProgress.done, total: metaProgress.total })
              : t("walkingFolder")
          }
          acknowledged={constraintsAcknowledged}
          onAcknowledgedChange={setConstraintsAcknowledged}
          onCheck={() => void handleRecheck()}
          gated={activeGate?.rest === "constraints"}
          rulesOpen={constraintsRulesOpen}
          onRulesOpenChange={setConstraintsRulesOpen}
          resultDetail={checkAccountsSettled ? constraintsResult : undefined}
        />
      )}

      {/* Slice #26.06 — the Duplication stage: the same loop, one stage later
          again, against the same folder. One panel across all three of its
          phases, so a check does not swap the screen out from under the
          reader. */}
      {inDuplication && (
        <ImportDuplicationStage
          verdict={duplicationVerdict}
          folderName={rootFolderName}
          busy={phase === "duplication-checking"}
          busyLabel={
            // The same two sentences the Constraints panel picks between, and
            // for the same reason: this check re-walks the folder first (fast),
            // then pays for the metadata pass, which reports a running count.
            // The match itself is too quick to have a sentence.
            metaProgress.total > 0
              ? t("readingMetadata", { done: metaProgress.done, total: metaProgress.total })
              : t("walkingFolder")
          }
          acknowledged={duplicationAcknowledged}
          onAcknowledgedChange={setDuplicationAcknowledged}
          onCheck={() => void handleRecheck()}
          gated={activeGate?.rest === "duplication"}
          rulesOpen={duplicationRulesOpen}
          onRulesOpenChange={setDuplicationRulesOpen}
          resultDetail={checkAccountsSettled ? duplicationResult : undefined}
        />
      )}

      {/* Slice #26.08 — the Pre-existing stage: the first question asked of the
          archive, and the first stage that does not block. One panel across all
          three of its phases, so a check does not swap the screen out from
          under the reader. */}
      {inPreexisting && (
        <ImportPreexistingStage
          result={preexisting}
          folderName={rootFolderName}
          busy={phase === "preexisting-checking"}
          busyLabel={
            // The same two sentences the Constraints and Duplication panels
            // pick between, and for the same reason: this check re-walks the
            // folder first (fast), then pays for the metadata pass, which
            // reports a running count. The match and the one request to the
            // archive are both too quick to have a sentence of their own.
            metaProgress.total > 0
              ? t("readingMetadata", { done: metaProgress.done, total: metaProgress.total })
              : t("walkingFolder")
          }
          acknowledged={preexistingAcknowledged}
          onAcknowledgedChange={setPreexistingAcknowledged}
          onCheck={() => void handleRecheck()}
          // The acknowledgement the source document asks for — and, since
          // #29.08, the press that starts the billed classification. It used to
          // change the phase and nothing else; `startScan`'s single caller
          // moved here from the Evaluation screen, because the import cannot
          // promise that every document type has a form until it knows which
          // types this folder holds.
          //
          // ⚠️ **`entries` and `preexistingDecisions`, exactly as the Evaluation
          // screen passed them.** The whole list goes in and the decisions are
          // the skip set: an entry the archive already holds gets a row and a
          // status but is never sent, which is the spend #26.08 stopped and
          // this slice must not quietly restart.
          onContinue={() => void startScan(entries, preexistingDecisions)}
          // …and the number that press will spend, for the sentence above it.
          classificationCalls={forecast.classificationCalls}
          // …and whether it would be spending it for the SECOND time. A
          // re-check pressed on the Evaluation screen lands back here with a
          // paid-for classification already thrown away, and "nothing has been
          // sent yet" would be false in the one place this flow is least
          // allowed to be wrong about money. Found by the adversarial round.
          classificationSpent={classificationSpent}
          // Slice #32.04 — see the const. Nothing is left to ask for, so the
          // panel keeps the all-clear, the cost sentence and the press that
          // leaves, and the report below is not mounted at all.
          resultOnly={preexistingResultOnly}
          notesOpen={preexistingNotesOpen}
          onNotesOpenChange={setPreexistingNotesOpen}
        />
      )}

      {/* ── The folder's own report   (Slice #24.02b, re-homed in #29.08) ───

          ⚠️ **IT MOVED HERE FROM THE EVALUATION SCREEN, AND THE ADVERSARIAL
          ROUND IS WHY.** This is the advisory report about the FOLDER — what
          the walk dropped, what looks odd, and the loud findings that end
          "Nu porniți importul". One of them, `walkLoopedOnShortcut`, says in as
          many words that the AI costs in the forecast are inflated and that the
          user should delete a shortcut and check again. On the Evaluation
          screen that sentence now arrives AFTER the classification has been
          billed — the report's own remedy, a trip to File Explorer, is the one
          thing that stops being worth anything once the money is spent.

          So it stands under the Pre-existing panel, which is the screen that
          carries the press that spends. `FolderForecast` stays where it is: it
          reports what the run will do, which is an Evaluation question.

          ⚠️ **Gated on `preexisting !== null`, not on the phase.** The report
          is a to-do list the user works through in Explorer, and blanking it
          for the thirty seconds of a re-check is exactly what the sibling
          panels refuse to do. Before the archive has been asked there is
          nothing to stand under; after it, the previous round's report stays up
          while the next one runs.

          ⚠️ **AND NOT MOUNTED AT ALL WHEN IT HAS NOTHING TO SAY, since
          #32.04.** In that state this section draws its title and one green
          "Nu s-a găsit nimic neobișnuit în acest folder." — the same green flag
          the panel above has already given about the archive, one section
          lower, on a screen the slice pruned down to its conclusion. The whole
          mount goes rather than its innards, and it goes on the SAME expression
          that prunes the panel: see `preexistingResultOnly`.

          ⚠️ **AND THE SECTION'S OWN "Descarcă raportul" GOES WITH IT, WHICH IS
          DELIBERATE.** Its comment there argues it is offered even when nothing
          was found, because "this folder is clean" is itself worth filing. That
          argument holds on every screen this section is still drawn on; it does
          not survive here, where the panel's own take-away has been taken away
          on exactly the same reasoning. A pruned screen offers no page to save,
          and the two Save buttons disappear together rather than one of them
          being left standing under a section with nothing in it. */}
      {inPreexisting && preexisting !== null && !preexistingResultOnly && (
        <ReportSections
          report={report}
          forecast={forecast}
          uploadBytes={uploadBytesToImport}
          alreadyInSystem={alreadyInSystem.total}
          folderName={rootFolderName}
          showQuiet={showQuiet}
          onShowQuietChange={setShowQuiet}
          showSkipped={showSkipped}
          onShowSkippedChange={setShowSkipped}
        />
      )}

      {/* The classification has run, every type it found has a form, and
          nothing has been written. */}
      {phase === "folder-report" && (
        <>
          <FolderForecast
            rootFolderName={rootFolderName}
            forecast={forecast}
            // Slice #26.08 — what this run will upload, not what the folder
            // holds. See `uploadBytesToImport`.
            uploadBytes={uploadBytesToImport}
            // …and how many of them are already here, so a folder the archive
            // holds in its entirety is not reported as an empty one.
            alreadyInSystem={alreadyInSystem}
            droppedCount={report.droppedCount}
            // Slice #32.05 — null on every run that did not come through the
            // stop screen, which is almost all of them.
            waived={waivedForms}
            // Slice #29.08 — Continuă goes to the Import stage now. The
            // classification it used to start has already run, one screen back,
            // and the gate between the two is what let this screen be reached
            // at all: every document type in the folder has a form.
            //
            // Straight to `setPhase`, like the Pre-existing panel's own
            // hand-over before it: `folder-report → ready` is a button the user
            // presses, and `SELF_ADVANCING_TRANSITIONS` never gates one.
            onContinue={() => setPhase("ready")}
            onRecheck={() => void handleRecheck()}
          />
        </>
      )}

      {/* Slice #26.09 — the Scanning stage. Nothing to press: the scan runs to
          the end and hands over to Import, and the way out is the Cancel in the
          stage bar, as it is everywhere else. */}
      {phase === "scanning" && (
        <ImportScanningStage
          folderName={rootFolderName}
          // Handed in already translated, exactly as the four stage panels
          // before it take their busy label — so `scanningProgress` stays the
          // one place that sentence lives.
          // ⚠️ Slice #29.08 — two sentences, and which one is true says what
          // the wizard is actually doing. The queue settles and then the type
          // gate reads the archive's list of document types, which can take up
          // to 30 s; leaving the running count on screen through that would be
          // a progress line frozen at N of N under a live cue.
          progressLabel={
            typeGateBusy
              ? t("readingDocumentTypes")
              : t("scanningProgress", {
                  done: scanProgress.done,
                  total: scanProgress.total,
                })
          }
          // Slice #29.02 — at a pause the scan has finished, so the panel must
          // stop spinning a cue and stop telling the user to wait for it.
          done={activeGate?.rest === "scanning"}
        />
      )}

      {/* Slice #29.08 — where an import stops. The classification found a
          document type with no form to put a document's information into, or
          the archive's list of types could not be read at all, so nothing goes
          any further.

          ⚠️ **`typeLookup !== null` is a render guard, not a state test.** The
          phase and the verdict are written in one commit — `runTypeGate` sets
          the lookup and `startScan` settles the phase immediately after — so
          the pair is always consistent by the time anything renders. The guard
          is what keeps a blank panel off the screen if a future caller ever
          moves the phase without the answer, which is the under-claiming
          direction this file takes everywhere: at worst the stop screen is
          missing, never a stop screen with nothing on it. */}
      {phase === "types-blocked" && typeLookup !== null && (
        <ImportTypesBlockedStage
          folderName={rootFolderName}
          lookup={typeLookup}
          busy={typeGateBusy}
          busyLabel={t("readingDocumentTypes")}
          attempt={typeGateAttempts}
          onRetry={() => void handleTypeGateRetry()}
          // ⚠️ **A RESET, NOT THE CANCEL CONFIRMATION, and an adversarial round
          // took the confirmation back out.** Reusing it looked right — that
          // dialog is the one thing in the wizard that accounts for what a run
          // leaves behind — but its question is "Renunțați la import?" and its
          // safe answer is "Nu, continui importul", offered over a screen whose
          // heading says the import has stopped. ⚠️ Since #32.05 that screen
          // offers a real "carry on" of its own, one button along — so a
          // confirmation here would put a second, differently-worded "continue"
          // in front of the press that STOPS, and the two would mean different
          // things.
          //
          // Nothing needs accounting for: this phase is reachable only from
          // `scanning`, which is reachable only from the Pre-existing screen's
          // Continuă, and every write in the run happens after `ready` — so no
          // document and no Property can exist. The one thing that HAS been
          // spent is the classification, and `leaveHint` on the panel says so —
          // in the stop route's own sentence since #32.05, because the other
          // route does not pay for it again.
          onLeave={handleCancelConfirmed}
          // Slice #32.05 — the second press. It raises the run's waiver and
          // lands on `folder-report`; see `handleTypeGateContinue`.
          onContinueWithoutForms={handleTypeGateContinue}
        />
      )}

      {/* Slice #32.08 — the OTHER place an import stops, and the import's first
          refusal that comes from looking inside a file rather than at its name
          or its byte count. The classification saw a scan holding more than one
          person's identity document, so nothing goes any further and the user
          is asked to split it: one file, one card.

          ⚠️ **NO "continue anyway", HERE OR ON THE PANEL.** The screen one
          block up has carried one since #32.05, and the distinction is the
          whole reason these are two screens rather than two findings on one: a
          type without a form is a decision a business user may reasonably
          overrule, and a scan of two people's identity cards is not — waiving
          it creates one Person record blended out of two real people, which is
          the exact harm this slice exists to prevent.

          ⚠️ **`cardVerdict !== null` is a render guard, not a state test**, on
          the identical argument the block above makes about `typeLookup`: the
          verdict and the phase are written in one commit at the end of
          `startScan`, so at worst this stop screen is missing, never a stop
          screen with nothing on it. */}
      {phase === "cards-blocked" && cardVerdict !== null && (
        <ImportCardsBlockedStage
          folderName={rootFolderName}
          verdict={cardVerdict}
          // The same reset the type gate's "Oprește importul" uses, and for the
          // same reason: this phase is reachable only from `scanning`, every
          // write in the run happens after `ready`, so there is no document and
          // no Property to account for. What HAS been spent is the
          // classification, and `leaveHint` on the panel says so.
          onLeave={handleCancelConfirmed}
        />
      )}

      {/* Slice #26.09 — the Import stage: the last screen before anything is
          written, and the first place the automatic AI reads are priced. It
          stays mounted behind its own three modal steps, so the shell does not
          go blank under them. */}
      {inImportStage && (
        <ImportRunStage
          folderName={rootFolderName}
          // Three states rather than a `busy` boolean, because the panel has
          // three different true things to say — see `ImportRunState`.
          // Slice #26.10 — `result` is `done` as well: the run is over, and the
          // panel must not go on saying "importul rulează" behind a screen
          // reporting what it produced. `runCompleted` is the same statement
          // made after the dialog has gone.
          state={
            runCompleted || phase === "result"
              ? "done"
              : phase === "ready"
                ? "ready"
                : "running"
          }
          // ⚠️ The property step writes one folder at a time and cancelling
          // returns here, so "nothing has been saved yet" can be false at
          // `ready` too — with this run's own chips visible two rows above it.
          //
          // ⚠️ **`touchedProperties`, NOT `propertiesTouched`**, and the two are
          // deliberately different facts. The boolean is set BEFORE the first
          // request ("a write may have landed"), which is the safe direction for
          // the Cancel's warning about orphans and the unsafe one for a positive
          // claim: a POST that fails would have this screen asserting a Property
          // was created while the toolbar directly above shows no chip for it.
          // The list is filled by `onPropertyResolved`, which fires only on
          // success, and is what draws those chips.
          propertiesCreated={touchedProperties.length > 0}
          scanSummary={
            scannableCount > 0
              ? t("scanComplete", {
                  total: entries.length,
                  scannable: scannableCount,
                  preexisting: preexistingDecisions.size,
                })
              : null
          }
          documentCount={entriesToImport.length}
          interpretUpperBound={interpretUpperBound}
          // Slice #32.05 — the same two numbers the Evaluation screen drew,
          // counted once in `waivedForms` rather than twice.
          waived={waivedForms}
          // The same test the toolbar button carried: a walk that produced
          // nothing has no subject for this button. Note it is `entries` and
          // not `entriesToImport` — a folder the archive already holds in its
          // entirety still has links to write, which is the case #26.08 built
          // `alreadyInSystem.linked` for one screen earlier.
          canImport={entries.length > 0}
          onImport={() => setPhase("property")}
          onChooseFolder={handlePickFolder}
        />
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
          // Slice #29.08 — the stop screen AND the Evaluation screen keep the
          // table, and that is the point of putting it in a positive list. This
          // block's own rule is "the phases where the table has anything to say
          // are exactly the ones from the classification pass onwards", and the
          // reorder moved Evaluation inside that set: it now reports a
          // classification that has happened, so hiding the row-by-row answers
          // under a panel that says "documentele lui au fost clasificate" and
          // quotes the call count would read as a rendering fault. On the stop
          // screen the table is the evidence for the sentence above it — a user
          // told "Contract de arendă has no form" can see which of their files
          // were read as one. Found by the adversarial round.
          phase === "types-blocked" ||
          // Slice #32.08 — and the identity-scan stop, by the same argument
          // one line up: the table is the evidence for the sentence above it.
          // The refused files are named on the panel; the table is where the
          // user sees the OTHER thirty rows of the same folder that were read
          // without trouble, which is what makes "split just this one file"
          // read as a small job rather than as a rejected folder.
          phase === "cards-blocked" ||
          phase === "folder-report" ||
          phase === "ready" ||
          phase === "property" ||
          phase === "tag-dialog" ||
          phase === "importing" ||
          phase === "result") && (
        <div className="rounded-xl border border-card-rim bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <ScanTable
            entries={entries}
            rootFolderName={rootFolderName}
            scanResults={scanResults}
          />
        </div>
      )}

      {/* ── The step-through pause   (Slice #29.02) ─────────────────

          ⚠️ **ONE RENDER SITE FOR EVERY GATE THE TABLE CAN RAISE, and the
          branches above are what make that legal.** (Fixed in passing, #32.03:
          this read "ALL SIX GATES". There were six until #29.08 and there are
          five now, and `SELF_ADVANCING_TRANSITIONS` is the one place that says
          so — a count repeated in prose is a count that goes stale while the
          table stays right. So this sentence no longer carries one.)

          Every panel branch is exclusive on `phase`, so
          whichever one is on screen is the last thing rendered before this
          point — the card always lands directly under the stage it is talking
          about. It sits after `ScanTable` rather than before it for the one
          gate where both are on screen: at the scanning rest the table IS the
          stage's result, and a button to leave the stage does not belong above
          the thing the user is being given the chance to read.

          ⚠️ **`phase === gate.rest` IS THE GUARD, not a tidiness check.** See
          the `gate` state's own note: the pause and the phase are written in
          one commit and a state updater cannot be conditional on itself, so a
          gate left over from a transition that did not land is refused here
          rather than drawn over a screen it does not describe.

          `walkError` renders below this. That is not a gap: a gate exists only
          after a walk that came back clean, and such a walk cleared the error
          on its way in. */}
      {activeGate !== null && (
        <ImportStepGate
          stage={stageForPhase(activeGate.rest)}
          nextStage={stageForPhase(activeGate.to)}
          onAdvance={() => {
            setGate(null);
            setPhase(activeGate.to);
          }}
        />
      )}

      {/* Resumed session view — replaces the file table while active */}
      {phase === "resumed" && savedSession && (
        <ResumedSessionView
          session={savedSession}
          // Slice #29.11 — what the archive said about this report's documents.
          // `null` while the question is in flight; see the state's own note.
          audit={savedSessionAudit}
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
          // Slice #26.07 — the folders the walk saw at depth 0. Without it a
          // property subfolder holding no importable file is invisible to the
          // step while STR-02 counts it, so the two stages disagree about how
          // many properties this import has. Same source STR-02 reads.
          topLevelDirNames={
            observations.find((o) => o.depth === 0)?.dirNames ?? []
          }
          onCancel={() => setPhase("ready")}
          onResolved={(run) => {
            setResolvedRun(run);
            // The completed run is authoritative: `touchedProperties` was
            // filled one Property at a time for the benefit of a run that does
            // NOT complete, and a run that did should not leave two lists free
            // to drift with nothing comparing them.
            //
            // ⚠️ **…authoritative about everything EXCEPT `created`**, and an
            // adversarial round is why. See `keepCreated`: that flag is the
            // only fact here that belongs to the RUN rather than to the
            // attempt, and this assignment is one of the two places a later
            // attempt would otherwise erase it.
            setTouchedProperties((prev) => run.properties.map((p) => keepCreated(prev, p)));
            setPhase("tag-dialog");
          }}
          // Fired per Property, as each one lands — so a step that fails on
          // folder four still tells the Cancel that three are in the archive.
          onPropertyResolved={(property) => {
            setPropertiesTouched(true);
            // Replace rather than append: a retry re-answers the same folder,
            // and two chips for one property folder would be the screen saying
            // the import made two.
            setTouchedProperties((prev) => [
              ...prev.filter((p) => p.folderName !== property.folderName),
              keepCreated(prev, property),
            ]);
          }}
          // …and before the first request too: a POST that commits and loses
          // its response never reports, and the Cancel must say "a write may
          // have landed" rather than wait to be told that one did.
          onWriteStarted={() => setPropertiesTouched(true)}
          cornersWrittenBefore={cornersWritten}
          onCornersWritten={(folderName) =>
            setCornersWritten((prev) => new Set(prev).add(folderName))
          }
        />
      )}

      {/* Tag dialog (modal) */}
      {phase === "tag-dialog" && (
        <TagDialog
          folders={folders}
          // The files this run will create a Document for. `entries.length`
          // counted the ones the Pre-existing stage has already excused.
          totalFiles={entriesToImport.length}
          onCancel={() => setPhase("ready")}
          onConfirm={() => setPhase("importing")}
        />
      )}

      {/* Bulk import dialog (modal).
          `resolvedRun` is non-null by construction — the only route into the
          importing phase runs through the property step — but the guard keeps
          the required props honest rather than asserting. */}
      {/* ⚠️ **`runSummary === null` is what takes this dialog off the screen**,
          not the phase. Its Close hands the summary over and the phase STAYS
          `result` — the run is still what the user is looking at — so without
          this the concluding message would open on top of the result table
          rather than in place of it. It also covers the fatal-error route,
          where Close fires before the run ever finished. */}
      {(phase === "importing" || phase === "result") && runSummary === null && resolvedRun && (
        <BulkImportDialog
          entries={entries}
          rootFolderName={rootFolderName}
          scanResults={scanResults}
          // Slice #26.07 — which Property (or Properties) each entry belongs
          // to. A property folder's entries link to its own; `common` links to
          // every one of them; `floating` and anything the rules forbid link to
          // none. The rule is `assignEntryProperties`, computed once by the
          // property step; nothing here re-derives it.
          propertyIdsByPath={resolvedRun.assignment}
          // Slice #26.08 — the documents the archive already holds, and what
          // the Pre-existing screen promised would happen to each. Absent from
          // the map means "import it normally", which is also what an entry the
          // stage decided to import AGAIN looks like — see
          // `preexistingDecisionsByPath` for why the exceptions are not carried
          // here with a flag.
          preexistingByPath={preexistingDecisions}
          // Slice #32.05 — the user pressed "continue without forms" on the
          // stop screen. The run then buys NO discovery read for a type that is
          // waiting for one, and opens no form-review dialog at the end. It
          // still reports those types as waiting, on every row and in the
          // header: the waiver is a decision about spending, not a different
          // verdict. See `shouldDiscoverType`.
          formsWaived={typeFormsWaived}
          cornerSourceByPath={
            // Slice #23.06.Import, per-folder since #26.07 — which coordinate
            // file's corners actually landed on which Property, so the loop can
            // claim property_corner_source the instant that file's Document
            // exists. A file that was read and NOT adopted is absent, because
            // it is not the origin of anything and must stay free.
            resolvedRun.cornerSourceByPath
          }
          // Slice #26.10 — the Properties this run resolved. The result screen
          // NAMES them: a coordinate row says which one its corners built, the
          // concluding message counts them, and the saved report links to each.
          //
          // ⚠️ **`onPropertyCornersChanged` went with the button that fired
          // it.** Corners can no longer change after the property step — the row
          // describes what that step did rather than offering to redo it — so
          // the chips above cannot go stale and nothing has to tell them so.
          properties={touchedProperties}
          // Slice #26.03 — the first Document of the run has been created, so
          // from now on cancelling leaves records behind and the confirmation
          // has to say so. Fired on the create rather than when this dialog
          // opened: a run that fails on document zero must not send a business
          // user hunting the documents list for rows that were never written.
          onFirstDocumentCreated={() => setDocumentsCreated(true)}
          // Slice #26.10 — the loop has settled and the dialog is now the
          // result screen, which is its own stage. This closes the gap
          // `workflow-stages.ts` recorded in #26.03: the indicator has read
          // "Import — în curs" over a finished run ever since.
          onRunFinished={() => setPhase("result")}
          onClose={(summary) => {
            // Slice #26.10 — the concluding message, which is the only thing
            // that draws while this is set. The phase stays `result`: the run
            // is still what is on screen, and the message's own button is what
            // leaves for the properties list.
            //
            // ⚠️ **`null` means the run never finished** — the fatal-error
            // banner's Close, which fires before a single row has settled. A
            // message headed "the import has finished", over statistics that
            // are all zero, inviting the user to go and check what was
            // imported, is the most confidently wrong screen this slice could
            // have shipped. That path goes back to the Import stage, exactly as
            // it did before this slice.
            if (summary === null) setPhase("ready");
            else setRunSummary(summary);
            // Slice #26.09 — the run is over, and `ready` is the Import stage's
            // own screen. See `runCompleted`: without this the panel re-offers
            // a button that would import the whole folder a second time.
            //
            // ⚠️ **Gated on `documentsCreated`, and an adversarial round is
            // why.** A run that wrote nothing — the session died on document
            // one, or every row errored — has nothing to duplicate, and closing
            // it must leave the button live: the alternative is a screen saying
            // the import finished and its documents are in the archive, over a
            // run that created none, with the only way forward being a re-pick
            // that re-walks and re-scans the folder at full price.
            setRunCompleted(documentsCreated);
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

      {/* The concluding message.   (Slice #26.10)

          Rendered where the run's own dialog was, and for the same reason it
          is inside the `inert` wrapper: it is part of the wizard's screen, not
          a layer over the whole app.

          ⚠️ **Its Close leaves for the properties list**, which the source
          document asks for by name — "ordered creation time so the first three
          or four properties on the list are the ones that we just imported".
          That order is what `/api/properties` already returns (most recently
          created or updated first), so nothing here re-sorts anything; what
          this slice adds is landing the user on it.

          The wizard's own state is put back to a finished Import stage first,
          so a user who navigates back finds the screen it has always been
          rather than a message about a run that is over. */}
      {runSummary !== null && (
        <ImportSummaryDialog
          folderName={rootFolderName}
          summary={runSummary}
          onClose={() => {
            setRunSummary(null);
            setPhase("ready");
            router.push("/properties");
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
