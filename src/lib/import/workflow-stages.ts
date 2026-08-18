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
  // #26.08 built its screen, so `plannedIn` is gone here too - the fourth time
  // this row has been a one-line change rather than a refactor. What is left
  // planned is nothing: every stage in this list now has a screen, so
  // `plannedIn` has no current holder. It stays in the type because 26.09 and
  // 26.10 re-home three screens and build a fourth, and a property with no
  // holder is cheaper to keep than to re-derive.
  //
  // ⚠️ **`line: "classification"` although nothing has been classified when the
  // user stands here, and it is the source document's own grouping rather than
  // an oversight.** That document names a second line, "Classification and
  // Import", and makes Pre-existing its FIRST phase - the stage is where the
  // archive enters the story, which is what the second line is about. The cost
  // is that the pill sits under a heading naming work that has not started;
  // the alternative - moving it to "Preparation & verification" - would put a
  // stage that reads the database on the line the source document reserves for
  // looking only inside the chosen folder. The panel's own intro says which
  // it is, in the first sentence, for exactly this reason.
  { id: "preexisting", line: "classification" },
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
 *  preexisting      → what "already in the system" means, and the tick; nothing
 *                     asked of the archive yet (#26.08)
 *  preexisting-checking → the re-walk, the metadata pass and the archive lookup
 *  preexisting-report   → the archive already holds some of these; what will
 *                     happen to each. Read and acknowledged, never fixed
 *  folder-report    → structure, constraints, duplication and pre-existing all
 *                     settled, nothing spent; the forecast awaits Continuă
 *  scanning         → concurrent Haiku AI scans running in background
 *  ready            → scan complete; scan-table rendered + "Import" CTA visible
 *  property         → PropertyStepDialog is open (resolve the run's Property)
 *  tag-dialog       → TagDialog is open (animated tag-prep step)
 *  importing        → BulkImportDialog is running
 *  result           → the run has finished and BulkImportDialog is now the
 *                     result screen; then the concluding message  (Slice #26.10)
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
  "preexisting",
  "preexisting-checking",
  "preexisting-report",
  "folder-report",
  "scanning",
  "ready",
  "property",
  "tag-dialog",
  "importing",
  "result",
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
 *  - `preexisting` / `preexisting-checking` / `preexisting-report` all report
 *    **preexisting**, by the argument the three stages before it made: the
 *    explanations, the check and what it found are three views of one stage.
 *    `preexisting-checking` covers the walk, the metadata pass, the duplication
 *    match AND the archive lookup, and it still reports Pre-existing — the user
 *    pressed this stage's button, and if the re-walk finds an earlier stage
 *    broken again the phase moves back and the indicator moves back with it.
 *
 *    ⚠️ **This is the first stage that does not BLOCK, and the indicator treats
 *    it exactly like the ones that do.** Nothing here is a violation and there
 *    is nothing for the user to put right — the archive holding a document is
 *    an ordinary state of affairs. What the green tick means for this stage is
 *    "the user was told what will happen and said so", which is a real thing
 *    that either happened or did not, and is therefore honest to draw.
 *  - `folder-report` reports **evaluation**: today's post-folder-selection
 *    screen is what 26.09 renames Evaluation, and since #26.08 it is reachable
 *    only through a clean structure check, a clean constraints check, a clean
 *    duplication check AND a settled pre-existing report — all four of which
 *    one press of Verifică din nou from that screen re-runs, in that order.
 *  - `ready` reports **import**, not scanning: the scan is finished and the one
 *    thing left on that screen is the Import button.
 *  - `resumed` reports **result** too — a resumed view is a previous run's
 *    result screen, read from the saved report rather than from the run.
 *
 * ⚠️ **And now there is no planned stage left at all.** #26.04 wrote
 * "Constraints cannot begin, because 26.05 builds it"; #26.05 rewrote it for
 * Duplication; #26.06 rewrote it for Pre-existing. #26.08 has deleted the last
 * `plannedIn` in the file, so the amber runs from Information to Result without
 * a gap and every green tick in the indicator now stands for a screen somebody
 * actually looked at. The mechanism stays — see the note on the catalogue row —
 * because 26.09 and 26.10 are still to come.
 *
 * ⚠️ **THE 26.09 GAP IS CLOSED.** Until this slice the indicator read
 * "Import — în curs" over a finished run, because closing `BulkImportDialog`
 * returned the wizard to `ready` and there was no phase that meant "the run is
 * over and its result is on screen". `result` now has one: the dialog announces
 * the moment its loop settles (`onRunFinished`), the wizard moves the phase,
 * and the indicator turns Import green and Result amber over the very screen
 * the source document calls the result. It stays amber through the concluding
 * message, which is still that stage, and the message's own button leaves the
 * wizard entirely for the properties list.
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
  preexisting: "preexisting",
  "preexisting-checking": "preexisting",
  "preexisting-report": "preexisting",
  "folder-report": "evaluation",
  scanning: "scanning",
  ready: "import",
  property: "import",
  "tag-dialog": "import",
  importing: "import",
  result: "result",
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
// Where a walk ends up   (Slice #26.06, extended by #26.08)
// ---------------------------------------------------------------------------

/**
 * How far a walk goes, and therefore what it costs.
 *
 * `structure` stops at the structure verdict and spends nothing beyond the
 * walk. The other three run the ~760-call metadata pass; `duplication` runs the
 * match on top of it, and `preexisting` adds one request to the archive.
 */
export type WalkTarget = "structure" | "constraints" | "duplication" | "preexisting";

/**
 * The fork at the END of a walk that got as far as the file checks - which
 * screen the user lands on, and which of the two optional checks actually ran.
 *
 * ⚠️ **HERE RATHER THAN IN THE WIZARD, and that is the whole reason it
 * exists.** This is the entire new decision #26.06 made and #26.08 extended, it
 * has more meaningful input combinations than anyone can hold in their head,
 * and inside `runWalk` it sits behind an `await`ed 760-call I/O pass and a
 * network request with no way to reach it from a test. A wrong cell in this
 * table is not a crash: it is a user standing on a screen that has nothing on
 * it, or a stage going green that nobody ran. `import-wizard.tsx` calls this
 * and holds no copy of the rule.
 *
 * `duplicationRan` and `preexistingRan` are returned rather than left to the
 * caller to re-derive, because the wizard publishes both as state beside
 * `entries` and `metadata` and a second expression of the same condition is a
 * second thing to keep in step.
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
 *  - **Duplication broke** -> `duplication-report`, whatever the target beyond
 *    it. Same argument one stage down: a run that came to ask the archive and
 *    found copies inside the folder has not asked the archive.
 *  - **Duplication clean, target was `duplication`** -> `preexisting`, the
 *    explanations, nothing asked. The same stopping point one stage later, and
 *    it is the ONE case #26.08 changed: this used to be `folder-report`.
 *  - **Duplication clean, target was `preexisting`** -> `folder-report` when
 *    the archive holds none of them and nothing was left unchecked, and
 *    `preexisting-report` otherwise.
 *
 * ⚠️ **A CLEAN PRE-EXISTING CHECK SHOWS NO SCREEN, exactly as a clean
 * duplication check shows none.** There is nothing to tell the user, and a
 * screen reading "the archive holds none of these, press Continuă" is a click
 * spent on a non-event. The stage still goes green behind them, which is true:
 * the comparison ran.
 *
 * `target: "structure"` never reaches here - `runWalk` returns at the structure
 * verdict - which is why it is not a case below. It is accepted as an input
 * rather than being made unrepresentable, because the caller passes the same
 * variable through and a union that excluded it would push a cast into the one
 * place this function is meant to keep simple. It is answered by UNDER-CLAIMING:
 * `constraints`, the earliest stage such a run has certainly not finished. An
 * earlier draft answered `duplication`, which would have carried a future
 * caller two stages forward past a screen it never showed them - the same
 * false-green failure `plannedIn` existed to prevent, one layer up.
 */
export function phaseAfterFileChecks(input: {
  target: WalkTarget;
  constraintsClean: boolean;
  /** `null` when the match did not run - see `duplicationRan` in the result. */
  duplicationClean: boolean | null;
  /**
   * `null` when the archive was never asked - see `preexistingRan`.
   *
   * ⚠️ **`false` means "there is something to say", NOT "something is wrong".**
   * It covers both a document the archive already holds and a file that could
   * not be fingerprinted, because both are things the report has to show and
   * neither is a violation. See `PreexistingVerdict.clean`.
   */
  preexistingClean?: boolean | null;
}): { phase: ImportPhase; duplicationRan: boolean; preexistingRan: boolean } {
  const { target, constraintsClean, duplicationClean } = input;
  const preexistingClean = input.preexistingClean ?? null;

  const stop = (phase: ImportPhase) => ({
    phase,
    duplicationRan: false,
    preexistingRan: false,
  });

  if (target === "structure") return stop("constraints");
  if (!constraintsClean) return stop("constraints-report");
  if (target === "constraints" || duplicationClean === null) return stop("duplication");
  if (!duplicationClean) {
    return { phase: "duplication-report", duplicationRan: true, preexistingRan: false };
  }
  if (target === "duplication" || preexistingClean === null) {
    // ⚠️ `preexistingClean === null` under `target: "preexisting"` means the
    // lookup did not produce an answer at all, which is not the same as a
    // FAILED lookup: a failure is an answer the stage renders and the user acts
    // on, and it arrives as `false`. This branch is the under-claim for a
    // caller that asked for the whole walk and handed back nothing, and it
    // lands them on the explanations with the check still to press.
    return { phase: "preexisting", duplicationRan: true, preexistingRan: false };
  }
  return {
    phase: preexistingClean ? "folder-report" : "preexisting-report",
    duplicationRan: true,
    preexistingRan: true,
  };
}

// ---------------------------------------------------------------------------
// Step-through mode   (Slice #29.02)
// ---------------------------------------------------------------------------

/**
 * The transitions the wizard makes ON ITS OWN, and where it rests when the user
 * has asked to be stopped at each one.
 *
 * WHAT THIS IS FOR
 * ----------------
 * Adrian, walking the import: several stages "just fly to the next phase
 * without any pause", so the one thing they exist to tell the user — that a
 * real check ran and found nothing — is the thing that never gets shown. Every
 * OTHER stage in the flow ends on a button, and the next screen's button is not
 * a substitute: it reports the next stage, not the one that just passed.
 *
 * So the Information page carries a control, unchecked by default, and with it
 * checked each of these six transitions comes to rest on the stage it has just
 * FINISHED, holding that stage's own screen with its own all-clear on it, and
 * waits for a button.
 *
 * ⚠️ **`rest` IS THE STAGE THAT PASSED, NOT THE ONE COMING NEXT, and that is
 * the whole design.** Landing early on the next stage's screen is what the
 * wizard already does; it is precisely the behaviour Adrian reported, because
 * the Structure screen never says "the structure is fine" — it is replaced by
 * Constraints the instant the walk comes back clean. Resting at `structure`
 * with a clean verdict renders the emerald line those panels already carry, and
 * three of the four have carried it as an unreachable branch until now.
 *
 * ⚠️ **A TRANSITION THAT IS NOT IN THIS TABLE IS NEVER GATED**, and the
 * omissions are load-bearing rather than an oversight:
 *
 *  - Every `*-report` destination. A stage that FOUND something already stops,
 *    on a violation list ending in "Verifică din nou". A gate there would be a
 *    second button for a pause the user is already standing in.
 *  - `preexisting-checking → preexisting`, which `phaseAfterFileChecks` answers
 *    when the archive produced no answer at all. The walk got as far as the
 *    archive and came back with nothing, so there is no stage to green — and
 *    resting at `duplication` because the duplication half was clean would put
 *    a note about copies in front of a user who pressed the archive's button.
 *  - `folder-report → scanning`, `ready → property` and everything after them.
 *    Those are already buttons the user presses.
 *
 * ⚠️ **KEYED ON `from` AS WELL AS `to`, and one pair is why.** `to` alone
 * looks sufficient — the six destinations are distinct — but `preexisting` is
 * reachable from two different places with two different meanings (the clean
 * duplication check above, and the under-claim in the bullet before it), and
 * only `from` tells them apart. A one-column table would have gated both.
 */
export const SELF_ADVANCING_TRANSITIONS: readonly {
  /** The phase the wizard is in when it decides. */
  from: ImportPhase;
  /** Where it goes when nobody asked it to stop. */
  to: ImportPhase;
  /** Where it rests instead, when somebody did. */
  rest: ImportPhase;
}[] = [
  // The preconditions checklist reports its verdict and the phase moves in the
  // same tick. Resting is `preflight` itself: the checklist stays mounted with
  // all eight lines green and its own "all green" line under them, which is
  // the screen #26.11's three-second floor was added to let the user see at
  // all. The floor still runs — see `phase-dwell.ts`.
  { from: "preflight", to: "structure", rest: "preflight" },
  // A clean structure walk shows no report screen whatsoever today.
  { from: "walking", to: "constraints", rest: "structure" },
  { from: "constraints-checking", to: "duplication", rest: "constraints" },
  { from: "duplication-checking", to: "preexisting", rest: "duplication" },
  // `phaseAfterFileChecks`'s own header states it: a clean pre-existing check
  // shows no screen. This is the transition that makes that false on request.
  { from: "preexisting-checking", to: "folder-report", rest: "preexisting" },
  // The scan ends when the last request settles. Its results DO stay on screen
  // afterwards — `ScanTable` is rendered for both phases — but the stage still
  // hands over without a pause, and the panel says "wait until it finishes"
  // over a scan that has finished.
  { from: "scanning", to: "ready", rest: "scanning" },
];

/**
 * Where the wizard should rest if step-through is on, or `null` to move on.
 *
 * Answers `null` for every transition not in the table above, which is the
 * under-claiming direction: an unlisted transition behaves exactly as it does
 * today, so a future phase pair added to the machine cannot accidentally
 * acquire a gate nobody designed a message for.
 *
 * The caller checks the user's setting; this function only knows the shape of
 * the flow. Keeping the two apart is what lets the whole rule be tested without
 * rendering a component or faking a checkbox.
 */
export function stepThroughRest(
  from: ImportPhase,
  to: ImportPhase,
): ImportPhase | null {
  const match = SELF_ADVANCING_TRANSITIONS.find(
    (t) => t.from === from && t.to === to,
  );
  return match ? match.rest : null;
}

/*
 * ⚠️ **THERE IS DELIBERATELY NO `isGateRestPhase` HELPER**, and one was written
 * and deleted rather than never considered. The wizard needs to know whether
 * the pause it is holding belongs to the screen it is drawing, and the honest
 * test for that is `phase === gate.rest` — nothing else. A second test asking
 * "and is that a phase a pause is allowed to rest on?" cannot fail, because the
 * only writer of `gate.rest` is `stepThroughRest`, which only ever answers from
 * the table above. This file's own rule, stated at `stageStatuses`, is that a
 * guard which cannot fire is the kind a later reader deletes the real one
 * instead of.
 */
