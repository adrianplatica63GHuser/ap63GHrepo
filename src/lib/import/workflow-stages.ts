/**
 * The import workflow, as one list.   (Slice #26.03)
 *
 * WHAT THIS IS
 * ------------
 * The shell at /admin/import shows the whole journey on two lines —
 * "Pregătire și verificare" and "Clasificare și import" — so the user can see
 * where they are and what is still ahead. This module is the only place that
 * says what those stages are, what order they run in, and which line each one
 * belongs to. The component that draws them owns no list of its own.
 *
 * WHY SOME STAGES CARRY `plannedIn`
 * ---------------------------------
 * The redesign (26.01 → 26.12) builds the stages one slice at a time, and this
 * slice ships the shell before four of them exist. Two ways to handle that were
 * available, and both of the obvious ones lie:
 *
 *   - Leave them out until they are built → the user never sees the journey,
 *     which is the one thing the shell exists to show.
 *   - List them and let the flow mark them green on its way past → a tick
 *     against work that nobody did. That is exactly the failure this codebase
 *     records after #26.00: confident output never measured against reality.
 *
 * So a stage that has no screen yet is listed, is drawn grey, carries a visible
 * "în curând" note, and **can never be reported as current or done** —
 * `stageForPhase` never returns one, and a test pins that. When 26.04 gives
 * Structure its screen, that slice deletes the stage's `plannedIn` and adds its
 * phases to the map; nothing else has to move.
 *
 * THE STATE MODEL IS THE THREE THE SLICE NAMES, and no more: `pending` (grey),
 * `current` (amber, pulsing) and `done` (green). `plannedIn` is a property of
 * the STAGE, not a fourth status — a planned stage is simply always `pending`.
 */

// ---------------------------------------------------------------------------
// The two lines
// ---------------------------------------------------------------------------

export const WORKFLOW_LINE_IDS = ["preparation", "classification"] as const;

export type WorkflowLineId = (typeof WORKFLOW_LINE_IDS)[number];

// ---------------------------------------------------------------------------
// The stages
// ---------------------------------------------------------------------------

export type WorkflowStageId =
  | "information"
  | "preconditions"
  | "structure"
  | "constraints"
  | "duplication"
  | "preexisting"
  | "evaluation"
  | "scanning"
  | "import"
  | "result";

export type WorkflowStage = {
  id: WorkflowStageId;
  line: WorkflowLineId;
  /**
   * The slice that gives this stage its own screen. Present = not built yet:
   * drawn grey with a note, and unreachable by `stageForPhase`.
   */
  plannedIn?: string;
};

/** Declaration order IS the workflow order. Nothing else encodes it. */
export const WORKFLOW_STAGES: readonly WorkflowStage[] = [
  { id: "information", line: "preparation" },
  { id: "preconditions", line: "preparation" },
  { id: "structure", line: "preparation", plannedIn: "26.04" },
  { id: "constraints", line: "preparation", plannedIn: "26.05" },
  { id: "duplication", line: "preparation", plannedIn: "26.06" },
  { id: "preexisting", line: "classification", plannedIn: "26.08" },
  { id: "evaluation", line: "classification" },
  { id: "scanning", line: "classification" },
  { id: "import", line: "classification" },
  { id: "result", line: "classification" },
];

/** The stages on one line, in workflow order. */
export function stagesOnLine(line: WorkflowLineId): WorkflowStage[] {
  return WORKFLOW_STAGES.filter((s) => s.line === line);
}

// ---------------------------------------------------------------------------
// The wizard's phases, and which stage each one means
// ---------------------------------------------------------------------------

/**
 * ImportWizard's phase machine. It lives here rather than in the component so
 * that the phase → stage map can be tested without rendering anything, and so
 * that the two can never drift into disagreeing about which phases exist.
 *
 *  information   → the Information page; nothing has started      (Slice #26.03)
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
 */
export const IMPORT_PHASES = [
  "information",
  "preflight",
  "idle",
  "walking",
  "folder-report",
  "scanning",
  "ready",
  "property",
  "tag-dialog",
  "importing",
  "resumed",
] as const;

export type ImportPhase = (typeof IMPORT_PHASES)[number];

/**
 * Which stage the user is actually standing in.
 *
 * Read this map as a statement about TODAY, not about the finished design:
 *
 *  - `idle` / `walking` / `folder-report` all report **evaluation**, because
 *    today's post-folder-selection screen is what 26.09 renames Evaluation.
 *    `idle` is the arguable one — no folder has been chosen there yet — and it
 *    reports evaluation anyway, because the alternatives are worse: the stage
 *    that comes next in the list is Structure, which has no screen and may
 *    never be reported, and leaving nothing current at all would show a bar
 *    with no amber pill on the one screen whose whole content is a button.
 *    Structure, Constraints and Duplication sit between Preconditions and it in
 *    the list, and they stay grey through all three phases — which is the
 *    truth: nothing checks the folder's structure yet. When 26.04–26.06 land,
 *    those phases split off and this map grows the rows to say so.
 *  - `ready` reports **import**, not scanning: the scan is finished and the one
 *    thing left on that screen is the Import button.
 *  - `resumed` reports **result** — the resumed view is a previous run's
 *    result, and it is the only way to reach that screen today.
 *
 * KNOWN GAP, left for 26.10. Closing `BulkImportDialog` returns the wizard to
 * `ready`, so after a finished run the indicator still reads "Import — în
 * curs". That is not a false green tick — the Import screen and its button are
 * genuinely what is on screen, and the user can import again from there — but
 * it is not the Result screen either, and `result` therefore only lights when a
 * saved report is reopened. 26.10 builds the real result screen and gives it
 * its own phase; until then the wizard at least refreshes the saved report on
 * close, so the report is reachable without a page reload.
 */
const STAGE_BY_PHASE: Record<ImportPhase, WorkflowStageId> = {
  information: "information",
  preflight: "preconditions",
  idle: "evaluation",
  walking: "evaluation",
  "folder-report": "evaluation",
  scanning: "scanning",
  ready: "import",
  property: "import",
  "tag-dialog": "import",
  importing: "import",
  resumed: "result",
};

export function stageForPhase(phase: ImportPhase): WorkflowStageId {
  return STAGE_BY_PHASE[phase];
}

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

export type StageStatus = "pending" | "current" | "done";

/**
 * The status of every stage, given where the user is.
 *
 * "Done" is positional — everything before the current stage — with one
 * exception that is the whole point of `plannedIn`: a stage with no screen is
 * never marked done, however far past it the user has walked. Being carried
 * past a check is not the same as passing it, and a green tick that means the
 * former is worse than no tick at all.
 *
 * An unknown current id (impossible through `stageForPhase`, possible through a
 * future caller) leaves every stage `pending` rather than throwing: a broken
 * indicator should under-claim, not take the screen down.
 */
export function stageStatuses(
  current: WorkflowStageId,
): Record<WorkflowStageId, StageStatus> {
  const currentIndex = WORKFLOW_STAGES.findIndex((s) => s.id === current);

  const out = {} as Record<WorkflowStageId, StageStatus>;
  WORKFLOW_STAGES.forEach((stage, index) => {
    if (stage.plannedIn) {
      // Unconditional, and deliberately not "unless it is the current one":
      // the invariant a reader needs is "a stage with no screen is never
      // anything but grey", and an invariant with an escape hatch is a default.
      out[stage.id] = "pending";
    } else if (currentIndex < 0) {
      out[stage.id] = "pending";
    } else if (index === currentIndex) {
      out[stage.id] = "current";
    } else if (index < currentIndex) {
      // No `&& !stage.plannedIn` here: the branch above already consumed every
      // planned stage, so repeating the test would read as a second guard while
      // being unconditionally true — and a guard that cannot fire is the kind a
      // later reader deletes the real one instead of.
      out[stage.id] = "done";
    } else {
      out[stage.id] = "pending";
    }
  });
  return out;
}
