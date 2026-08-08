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
 * The redesign (26.01 → 26.12) builds the stages one slice at a time, and
 * #26.03 shipped the shell before four of them existed (#26.04 built Structure
 * and #26.05 built Constraints, leaving two). Two ways to handle that were
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
 * `stageForPhase` never returns one, and a test pins that. When a slice gives a
 * stage its screen, it deletes that stage's `plannedIn` and adds its phases to
 * the map; nothing else has to move. #26.04 and #26.05 have each now done
 * exactly that, which is the promise kept twice.
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
  // #26.04 built its screen, so `plannedIn` is gone and Structure goes amber
  // and green like any other stage — exactly the one-line change the header
  // above promised this slice would be.
  { id: "structure", line: "preparation" },
  // #26.05 built its screen, so `plannedIn` is gone here too — the second time
  // this row has been a one-line change rather than a refactor.
  { id: "constraints", line: "preparation" },
  // #26.06 built its screen, so `plannedIn` is gone here too - the third time
  // this row has been a one-line change rather than a refactor, which is the
  // promise this file made once and has now kept three times.
  { id: "duplication", line: "preparation" },
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
 *  information      → the Information page; nothing has started   (Slice #26.03)
 *  preflight        → the preconditions checklist; no folder picker exists yet
 *  structure        → the Structure rules, the tick, and the picker (#26.04)
 *  walking          → walkFolder() running (fast, <1 s) — the structure check
 *  structure-report → the folder broke rules; the fix-and-re-check loop (#26.04)
 *  constraints      → the Constraints rules and the tick; nothing checked (#26.05)
 *  constraints-checking → the re-walk AND the ~760-call metadata pass, running
 *  constraints-report   → files broke constraints; the same fix-and-re-check loop
 *  duplication      → what counts as a duplicate, and the tick; nothing checked (#26.06)
 *  duplication-checking → the re-walk, the metadata pass and the match, running
 *  duplication-report   → the folder holds copies; the same fix-and-re-check loop
 *  folder-report    → structure, constraints and duplication clean, nothing
 *                     spent; the forecast awaits Continuă
 *  scanning         → concurrent Haiku AI scans running in background
 *  ready            → scan complete; scan-table rendered + "Import" CTA visible
 *  property         → PropertyStepDialog is open (resolve the run's Property)
 *  tag-dialog       → TagDialog is open (animated tag-prep step)
 *  importing        → BulkImportDialog is running
 *  resumed          → ResumedSessionView is showing a previous run's record
 *
 * ⚠️ `idle` was renamed to `structure` in #26.04, and it is a rename rather
 * than an addition: the phase has always meant "the preconditions passed and no
 * folder has been walked yet", and that is precisely where the Structure screen
 * now stands. Leaving it called `idle` would have left the machine's own name
 * for the phase disagreeing with the only screen it renders.
 */
export const IMPORT_PHASES = [
  "information",
  "preflight",
  "structure",
  "walking",
  "structure-report",
  "constraints",
  "constraints-checking",
  "constraints-report",
  "duplication",
  "duplication-checking",
  "duplication-report",
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
 *  - `structure` / `walking` / `structure-report` all report **structure**.
 *    #26.04 split them off from Evaluation, which is where #26.03 had to park
 *    them: the rules listing, the walk that checks them and the violation list
 *    are three views of one stage, and the walk belongs to Structure rather
 *    than to Evaluation because checking the structure is the only reason it
 *    runs. That includes a re-walk started from the Evaluation screen — the
 *    indicator goes back to amber on Structure while it runs, which is the
 *    truth: the folder is being re-checked against the structure rules, and it
 *    may well fail this time.
 *  - `constraints` / `constraints-checking` / `constraints-report` all report
 *    **constraints**, by the same argument #26.04 made for Structure: the rules
 *    listing, the check and the violation list are three views of one stage.
 *    `constraints-checking` covers a WALK as well as the metadata pass, and it
 *    still reports Constraints rather than Structure — the walk is there because
 *    the user has been in File Explorer since the last check, and the stage they
 *    are standing in is the one whose button they pressed. When that re-walk
 *    finds the structure broken again the phase moves to `structure-report` and
 *    the indicator moves back with it, which is the truth rather than a glitch.
 *  - `duplication` / `duplication-checking` / `duplication-report` all report
 *    **duplication**, by the argument #26.04 made for Structure and #26.05
 *    repeated for Constraints: the rules listing, the check and the list of
 *    what it found are three views of one stage. `duplication-checking` covers
 *    the walk AND the metadata pass as well as the match itself, and it still
 *    reports Duplication — the user pressed this stage's button, and if the
 *    re-walk finds the structure or the constraints broken again the phase
 *    moves back to `structure-report` or `constraints-report` and the indicator
 *    moves back with it, which is the truth rather than a glitch.
 *  - `folder-report` reports **evaluation**: today's post-folder-selection
 *    screen is what 26.09 renames Evaluation, and since #26.06 it is reachable
 *    only through a clean structure check, a clean constraints check AND a
 *    clean duplication check — all three of which one press of Verifică din nou
 *    from that screen re-runs, in that order.
 *  - `ready` reports **import**, not scanning: the scan is finished and the one
 *    thing left on that screen is the Import button.
 *  - `resumed` reports **result** — the resumed view is a previous run's
 *    result, and it is the only way to reach that screen today.
 *
 * ⚠️ **The paragraph that stood here for three slices is gone, and that is what
 * it was for.** #26.04 wrote "Constraints cannot begin, because 26.05 builds
 * it"; #26.05 rewrote it for Duplication with one stage's name changed and
 * nothing else. Both are now done, `plannedIn` is off both rows, and the amber
 * runs from Information to Evaluation without a gap. What is left on the second
 * line is Pre-existing, and 26.08 deletes its `plannedIn` the same way.
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
  structure: "structure",
  walking: "structure",
  "structure-report": "structure",
  constraints: "constraints",
  "constraints-checking": "constraints",
  "constraints-report": "constraints",
  duplication: "duplication",
  "duplication-checking": "duplication",
  "duplication-report": "duplication",
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

// ---------------------------------------------------------------------------
// Where a walk ends up   (Slice #26.06)
// ---------------------------------------------------------------------------

/**
 * How far a walk goes, and therefore what it costs.
 *
 * `structure` stops at the structure verdict and spends nothing beyond the
 * walk. The other two run the ~760-call metadata pass, and `duplication` runs
 * the match on top of it.
 */
export type WalkTarget = "structure" | "constraints" | "duplication";

/**
 * The fork at the END of a walk that got as far as the file checks - which
 * screen the user lands on, and whether the duplication match ran.
 *
 * ⚠️ **HERE RATHER THAN IN THE WIZARD, and that is the whole reason it
 * exists.** This is the entire new decision #26.06 makes, it has eight
 * meaningful input combinations, and inside `runWalk` it sat behind an
 * `await`ed 760-call I/O pass with no way to reach it from a test. A wrong cell
 * in this table is not a crash: it is a user standing on a screen that has
 * nothing on it, or a stage going green that nobody ran. `import-wizard.tsx`
 * calls this and holds no copy of the rule.
 *
 * `duplicationRan` is returned rather than left to the caller to re-derive,
 * because the wizard publishes it as state beside `entries` and `metadata` and
 * a second expression of the same condition is a second thing to keep in step.
 *
 * The cases, in the order the flow meets them:
 *
 *  - **Constraints broke** -> `constraints-report`, whatever the target. A run
 *    that came for Duplication and found a broken constraint has not checked
 *    for duplicates and must not say it has.
 *  - **Constraints clean, target was `constraints`** -> `duplication`, the
 *    explanations, nothing checked. This is the stopping point the stage exists
 *    for: the user reads what a duplicate is before being shown files to
 *    remove.
 *  - **Constraints clean, target was `duplication`** -> `folder-report` or
 *    `duplication-report`, on the match.
 *
 * `target: "structure"` never reaches here - `runWalk` returns at the structure
 * verdict - which is why it is not a case below. It is accepted as an input
 * rather than being made unrepresentable, because the caller passes the same
 * variable through and a union that excluded it would push a cast into the one
 * place this function is meant to keep simple. It is answered by UNDER-CLAIMING:
 * `constraints`, the earliest stage such a run has certainly not finished. An
 * earlier draft answered `duplication`, which would have carried a future
 * caller two stages forward past a screen it never showed them - the same
 * false-green failure `plannedIn` exists to prevent, one layer up.
 */
export function phaseAfterFileChecks(input: {
  target: WalkTarget;
  constraintsClean: boolean;
  /** `null` when the match did not run - see `duplicationRan` in the result. */
  duplicationClean: boolean | null;
}): { phase: ImportPhase; duplicationRan: boolean } {
  const { target, constraintsClean, duplicationClean } = input;

  if (target === "structure") return { phase: "constraints", duplicationRan: false };
  if (!constraintsClean) return { phase: "constraints-report", duplicationRan: false };
  if (target !== "duplication" || duplicationClean === null) {
    return { phase: "duplication", duplicationRan: false };
  }
  return {
    phase: duplicationClean ? "folder-report" : "duplication-report",
    duplicationRan: true,
  };
}
