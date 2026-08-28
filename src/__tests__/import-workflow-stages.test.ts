/**
 * Unit tests for src/lib/import/workflow-stages.ts   (Slice #26.03)
 *
 * The shell's whole value is that the indicator agrees with the screen. It can
 * disagree in three ways, and each of them is silent:
 *
 *  1. **A stage goes green that nothing did.** A positional "everything before
 *     the current one is done" would tick a stage with no screen behind it — a
 *     system telling the user their files were checked against the archive when
 *     no code looked at them. That is the exact defect this repo recorded after
 *     #26.00: confident output never measured against a realistic input.
 *
 *     (It was four stages until #26.04 gave Structure its screen, #26.05 gave
 *     Constraints its own, #26.06 gave Duplication its own and #26.08 gave
 *     Pre-existing its own. Those four slices are the worked example of what
 *     `plannedIn` is for: one property deleted from one row of the catalogue,
 *     and the stage starts going amber and green. As of #26.08 there is no
 *     planned stage left — see the test that says so, and says what that makes
 *     the two tests after it.)
 *
 *  2. **A phase has no stage, or a stage nobody can reach.** `Record<ImportPhase, …>`
 *     catches the first at compile time; the second needs a test, because a
 *     stage that is merely never mentioned type-checks perfectly.
 *
 *  3. **A label is missing in ro-RO.** `DEFAULT_LOCALE` is `ro-RO`, so a
 *     missing key renders as a raw key path in the SHIPPING locale — the pill
 *     would read `adminImport.workflow.stage.structure`.
 */

import fs from "node:fs";
import path from "node:path";

import {
  IMPORT_PHASES,
  SELF_ADVANCING_TRANSITIONS,
  phaseAfterClassification,
  phaseAfterFileChecks,
  stepThroughRest,
  WORKFLOW_LINE_IDS,
  WORKFLOW_STAGES,
  stageForPhase,
  stageStatuses,
  stagesOnLine,
  type ImportPhase,
  type WorkflowStageId,
} from "@/lib/import/workflow-stages";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IDS = WORKFLOW_STAGES.map((s) => s.id);

function planned(id: WorkflowStageId): boolean {
  return Boolean(WORKFLOW_STAGES.find((s) => s.id === id)?.plannedIn);
}

type Messages = Record<string, unknown>;

function loadWorkflowMessages(file: string): Messages {
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as { adminImport: { workflow: Messages } };
  return raw.adminImport.workflow;
}

/**
 * The longest run of characters two sentences have in common, case- and
 * whitespace-insensitive.   (Slice #29.02)
 *
 * O(n·m) and deliberately so: these are one-line UI strings, and a suffix
 * automaton in a test file is a thing to debug rather than a thing to trust.
 */
function longestSharedRun(a: string, b: string): number {
  const x = a.toLowerCase().replace(/\s+/g, " ");
  const y = b.toLowerCase().replace(/\s+/g, " ");
  let best = 0;
  for (let i = 0; i < x.length; i++) {
    for (let j = 0; j < y.length; j++) {
      let k = 0;
      while (i + k < x.length && j + k < y.length && x[i + k] === y[j + k]) k++;
      if (k > best) best = k;
    }
  }
  return best;
}

/** The step-through pause's own namespace.   (Slice #29.02) */
function loadStepGateMessages(file: string): Messages {
  const raw = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
  ) as { adminImport: { stepGate: Messages } };
  return raw.adminImport.stepGate;
}

const LOCALES = ["ro-RO.json", "en-GB.json"] as const;

// ---------------------------------------------------------------------------
// CSS helpers — enough of a reader to check VALUES rather than spelling
// ---------------------------------------------------------------------------

/**
 * CSS with comments removed.
 *
 * Not a nicety — it is the rule this file lives under. `activity-and-progress.md`:
 * a guard about a NAME may read comments, a guard about rendered BEHAVIOUR must
 * read only code. The pulse guard is the second kind, and without this it is
 * defeated by commenting the real declaration out and leaving a dead one beside
 * it: every assertion below would still find the values it wanted, inside a
 * comment, while the page drew nothing.
 */
function code(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The text between the brace after `from` and its matching close. */
function balancedBlock(css: string, from: number): string {
  const open = css.indexOf("{", from);
  if (open < 0) throw new Error("no block after offset");
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error("unbalanced CSS block");
}

/**
 * `stage-indicator.tsx` with every comment stripped.
 *
 * ⚠️ **A BEHAVIOUR GUARD MUST READ ONLY CODE** (CLAUDE.md → Design habits).
 * The two assertions that use this match Tailwind class SHAPES, and the very
 * comments explaining why those classes must not appear quote the classes
 * themselves — `border-color`, `border-amber-*`. They sit just outside the
 * inspected slice today, which makes this a trap rather than a live bug: move
 * one comment inside the record, which is the natural place to put it, and the
 * guard goes red pointing at prose while the code it protects is perfectly
 * correct. A red test nobody can act on is how a guard gets deleted.
 */
function pillSource(): string {
  return fs
    .readFileSync(path.join(process.cwd(), "src", "components", "stage-indicator.tsx"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

/** The declarations of one keyframe selector, e.g. `50%`, inside one animation. */
function keyframe(css: string, animation: string, selector: string): string {
  // Matched with a boundary, and required to be UNIQUE. A bare `indexOf` finds
  // `@keyframes ga-stage-pulse-soft` when asked for `ga-stage-pulse`, and this
  // file already establishes that naming family (`ga-version-pulse-green` /
  // `-red`) — so a sibling added above, or a second definition of the same name
  // added below (the last one is what the browser uses), would hand this guard
  // a healthy animation to inspect while the real one had been emptied.
  const defs = [
    ...css.matchAll(new RegExp(`@keyframes\\s+${animation}\\s*\\{`, "g")),
  ];
  if (defs.length !== 1) {
    throw new Error(
      `expected exactly one @keyframes ${animation}, found ${defs.length}`,
    );
  }
  const at = defs[0].index;
  const body = balancedBlock(css, at);
  // Normalise whitespace so `0%, 100%` matches `0%,100%`.
  const flat = body.replace(/\s+/g, " ");
  const want = selector.replace(/\s+/g, " ");
  const start = flat.indexOf(want + " {");
  if (start < 0) throw new Error(`no ${selector} frame in ${animation}`);
  return balancedBlock(flat, start);
}

/**
 * Every rule whose selector is exactly `selector`, with the at-rule preludes
 * that enclose it.
 *
 * Rule-scoped rather than block-scoped, and that is the whole point. Reading a
 * whole `@media` body instead lets a sibling rule answer for this one — a decoy
 * `.something-else { animation: none; box-shadow: … }` beside a
 * `.ga-stage-pulse` that has been emptied satisfies every text assertion while
 * the halo is gone. And `enclosing` is what catches the other direction: a
 * perfectly-written rule buried in `@media print` never runs.
 */
function rulesFor(css: string, selector: string): { block: string; enclosing: string[] }[] {
  const out: { block: string; enclosing: string[] }[] = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf(selector, from);
    if (at < 0) return out;
    from = at + selector.length;

    // The selector must be the whole head of the rule: `.foo {`, not `.foo.bar`
    // and not a substring of `.foo-baz`.
    const after = css.slice(from).match(/^\s*\{/);
    const before = css[at - 1];
    if (!after || (before !== undefined && /[\w.#-]/.test(before))) continue;

    out.push({ block: balancedBlock(css, at), enclosing: enclosingAtRules(css, at) });
  }
}

/** The preludes of the at-rules open at `offset`, outermost first. */
function enclosingAtRules(css: string, offset: number): string[] {
  const stack: string[] = [];
  let prelude = "";
  for (let i = 0; i < offset; i++) {
    const ch = css[i];
    if (ch === "{") {
      stack.push(prelude.trim());
      prelude = "";
    } else if (ch === "}") {
      stack.pop();
      prelude = "";
    } else if (ch === ";") {
      prelude = "";
    } else {
      prelude += ch;
    }
  }
  return stack.filter((p) => p.startsWith("@"));
}

/**
 * The spread radius and alpha of the LAST `box-shadow` in a declaration block —
 * last, because that is the declaration that wins, so a decoy above a broken
 * one cannot mask it.
 *
 * Spread is the FOURTH length, per the box-shadow grammar (offset-x, offset-y,
 * blur, spread), so a shadow that grows via blur instead reads as spread 0 and
 * fails loudly rather than being quietly accepted.
 */
function shadowIn(decls: string): { spreadPx: number; alpha: number } {
  const all = [...decls.matchAll(/box-shadow:\s*([^;}]+)/g)];
  if (all.length === 0) {
    throw new Error(`no box-shadow in: ${decls.trim().slice(0, 120)}`);
  }
  const value = all[all.length - 1][1];

  const lengths = [...value.matchAll(/(-?\d*\.?\d+)(px|rem|em)?(?=\s|$)/g)]
    .map((x) => Number(x[1]));

  // ⚠️ **THROWS on a value whose four lengths are not all numbers, rather than
  // reading a missing one as 0.** `lengths[3] ?? 0` was the hole: a spread
  // written `var(--anything)` contains no digit, so it never matched, the
  // fourth length came back `undefined`, and the guard measured a 0px spread —
  // silently, for any frame. That is inert at the peak, where the assertion is
  // `toBe(2)` and a 0 fails loudly. At REST the assertion is `toBe(0)`, so a
  // `var()` there would sail through and a visible ring at rest — the dipping
  // cue this whole block exists to forbid — would ship green. Same argument as
  // `alphaOf`'s: a reader that cannot see the number must say so, not assume a
  // convenient one.
  if (lengths.length < 4 || lengths.some((n) => Number.isNaN(n))) {
    throw new Error(
      "box-shadow must declare four literal lengths — a var() spread is " +
        `unreadable here, see the note in globals.css: ${value.trim().slice(0, 80)}`,
    );
  }

  return { spreadPx: lengths[3]!, alpha: alphaOf(value) };
}

/**
 * The alpha of the first colour in a value.
 *
 * THROWS on a colour function it does not know, rather than assuming opaque.
 * The assumption is the whole danger: a peak rewritten as `oklch(… / 2%)` read
 * as alpha 1 is an invisible halo passing the guard that exists to catch
 * invisible halos. A red test that says "teach me about oklch" is the correct
 * outcome of that rewrite.
 */
function alphaOf(value: string): number {
  if (/(^|[^-\w])transparent([^-\w]|$)/.test(value)) return 0;

  const args = colourArgs(value);
  if (args === null) {
    throw new Error(
      "unrecognised colour — teach alphaOf() about it rather than letting it " +
        `read as opaque: ${value.trim().slice(0, 80)}`,
    );
  }

  const slash = args.split("/");
  const raw =
    slash.length > 1
      ? slash[1].trim()
      : (args.split(",").map((x) => x.trim())[3] ?? "1");

  const alpha = raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
  if (Number.isNaN(alpha)) throw new Error(`unreadable alpha: ${raw}`);
  return alpha;
}

/** The arguments of the first `rgb()`/`rgba()` in a value, parens balanced. */
function colourArgs(value: string): string | null {
  // Parens are BALANCED rather than matched with `[^)]*`, because the colour is
  // `rgb(var(--token) / 0.75)` — a lazy match stops inside `var(` and reports
  // no alpha at all, i.e. it reads a fully transparent ring as a fully opaque
  // one, which is precisely the bug this file exists to catch.
  const at = value.search(/rgba?\(/);
  if (at < 0) return null;
  const open = value.indexOf("(", at);
  let depth = 0;
  for (let i = open; i < value.length; i++) {
    if (value[i] === "(") depth++;
    else if (value[i] === ")") {
      depth--;
      if (depth === 0) return value.slice(open + 1, i);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

describe("the workflow catalogue", () => {
  it("has no duplicate stage ids", () => {
    expect(new Set(IDS).size).toBe(IDS.length);
  });

  it("puts every stage on one of the two lines, and neither line is empty", () => {
    for (const stage of WORKFLOW_STAGES) {
      expect(WORKFLOW_LINE_IDS).toContain(stage.line);
    }
    for (const line of WORKFLOW_LINE_IDS) {
      expect(stagesOnLine(line).length).toBeGreaterThan(0);
    }
  });

  it("partitions the catalogue across the lines, in workflow order", () => {
    const rejoined = WORKFLOW_LINE_IDS.flatMap((line) =>
      stagesOnLine(line).map((s) => s.id),
    );
    // Same members…
    expect(new Set(rejoined)).toEqual(new Set(IDS));
    expect(rejoined.length).toBe(IDS.length);
    // …and each line preserves the catalogue's relative order.
    for (const line of WORKFLOW_LINE_IDS) {
      const onLine = stagesOnLine(line).map((s) => IDS.indexOf(s.id));
      expect([...onLine].sort((a, b) => a - b)).toEqual(onLine);
    }
  });

  it("keeps the two lines contiguous, so the display order is the run order", () => {
    // Reading the pills left-to-right, top-to-bottom must give the order the
    // stages actually run in. Interleaving the lines would break that without
    // breaking any other assertion here.
    const lineOfIndex = WORKFLOW_STAGES.map((s) => WORKFLOW_LINE_IDS.indexOf(s.line));
    expect([...lineOfIndex].sort((a, b) => a - b)).toEqual(lineOfIndex);
  });
});

// ---------------------------------------------------------------------------
// Phase → stage
// ---------------------------------------------------------------------------

describe("stageForPhase", () => {
  it("maps every phase to a stage in the catalogue", () => {
    for (const phase of IMPORT_PHASES) {
      expect(IDS).toContain(stageForPhase(phase));
    }
  });

  it("never lands the user on a stage that has no screen yet", () => {
    // THE invariant of #26.03. A planned stage is a promise about a later
    // slice; reporting the user as standing in one would make the indicator
    // point at a screen that does not exist.
    //
    // ⚠️ **Vacuous since #26.08 deleted the last `plannedIn`** — `planned` is
    // false for every stage, so this filters an empty list for a reason that
    // has nothing to do with `stageForPhase`. It stays because the mechanism
    // does; the TABLE below is what actually pins the map today, and it was
    // added because a round of review pointed out that this test passes with
    // the map inverted, emptied, or pointing every phase at `result`.
    const reached = IMPORT_PHASES.map(stageForPhase);
    expect(reached.filter(planned)).toEqual([]);
  });

  it("⚠️ maps each phase to the ONE stage it belongs to, as a written-out table", () => {
    // Written out rather than derived, which is the whole point: a derived
    // expectation is the implementation twice. Every entry here is a claim
    // about which pill lights while a given screen is on, and getting one wrong
    // is a user told they are somewhere they are not.
    expect(IMPORT_PHASES.map((phase) => [phase, stageForPhase(phase)])).toEqual([
      ["information", "information"],
      ["preflight", "preconditions"],
      ["structure", "structure"],
      ["walking", "structure"],
      ["structure-report", "structure"],
      ["constraints", "constraints"],
      ["constraints-checking", "constraints"],
      ["constraints-report", "constraints"],
      ["duplication", "duplication"],
      ["duplication-checking", "duplication"],
      ["duplication-report", "duplication"],
      ["preexisting", "preexisting"],
      ["preexisting-checking", "preexisting"],
      ["preexisting-report", "preexisting"],
      ["scanning", "scanning"],
      // Slice #29.08 — the stop screen reports the stage that RAN. The
      // classification is what found the answer; Evaluation never happened, and
      // an eleventh pill would put a permanent step in the indicator for a
      // screen most runs never see.
      ["types-blocked", "scanning"],
      ["folder-report", "evaluation"],
      ["ready", "import"],
      ["property", "import"],
      ["tag-dialog", "import"],
      ["importing", "import"],
      // Slice #26.10 — the run is over and its result screen is what is on
      // screen. Until this phase existed the indicator read "Import — în curs"
      // over a finished run, which `workflow-stages.ts` recorded as a known gap
      // for exactly this slice.
      ["result", "result"],
      ["resumed", "result"],
    ]);
  });

  it("⚠️ runs the classification BEFORE the evaluation", () => {
    // Slice #29.08's whole reorder, as one assertion. `WORKFLOW_STAGES` is the
    // only thing in the codebase that encodes the order, so swapping two rows
    // in it is the change — and a later slice "tidying" them back would break
    // the gate silently, because every other test in this suite derives its
    // expectation from the same array.
    const order = WORKFLOW_STAGES.map((s) => s.id);
    expect(order.indexOf("scanning")).toBeLessThan(order.indexOf("evaluation"));
    expect(order.slice(order.indexOf("preexisting"))).toEqual([
      "preexisting",
      "scanning",
      "evaluation",
      "import",
      "result",
    ]);
  });

  it("⚠️ opens the second line with Pre-existing", () => {
    // #26.08 argues at length, on the catalogue row itself, that this stage
    // belongs to "Clasificare și import" although nothing has been classified
    // when the user stands in it — the source document's own grouping. An
    // argument in a comment that no test pins is an argument the next slice
    // silently reverses, and moving the row to `preparation` passed every test
    // in this suite before this one existed.
    expect(stagesOnLine("classification").map((s) => s.id)[0]).toBe("preexisting");
    expect(stagesOnLine("preparation").map((s) => s.id)).toEqual([
      "information",
      "preconditions",
      "structure",
      "constraints",
      "duplication",
    ]);
  });

  it("advances monotonically through the machine's own order", () => {
    // The phases are declared in the order the wizard runs them, so the stage
    // they report must never go backwards — an indicator that retreats while
    // the user moves forward is worse than one that stands still.
    const positions = IMPORT_PHASES.map((p) => IDS.indexOf(stageForPhase(p)));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("starts at information and ends at result", () => {
    expect(stageForPhase("information")).toBe("information");
    expect(stageForPhase("preflight")).toBe("preconditions");
    expect(stageForPhase("result")).toBe("result");
    expect(stageForPhase("resumed")).toBe("result");
  });

  it("⚠️ separates the finished run from the running one", () => {
    // Slice #26.10, and it is the assertion the gap comment asked for. The
    // dialog is the same component in both phases — it is the run's progress
    // table and then the run's result — so a wizard that never moved the phase
    // would look identical and light the wrong pill for the whole time a user
    // spends reading what happened.
    expect(stageForPhase("importing")).toBe("import");
    expect(stageForPhase("result")).toBe("result");

    // …and the Import stage is DONE by then, not merely no longer current. A
    // green tick against Import is the claim the result screen is standing on.
    const statuses = stageStatuses(stageForPhase("result"));
    expect(statuses.import).toBe("done");
    expect(statuses.result).toBe("current");
  });

  it("reports the post-scan screen as import, not as scanning", () => {
    // The map's other judgement call, and the one a later slice is most likely
    // to "correct" without reading why: at `ready` the scan has FINISHED and
    // the only thing left on that screen is the Import button, so reporting
    // `scanning` would pulse amber on a stage that is over. `property`,
    // `tag-dialog` and `importing` are the same stage seen through its modals.
    expect(stageForPhase("ready")).toBe("import");
    expect(stageForPhase("property")).toBe("import");
    expect(stageForPhase("tag-dialog")).toBe("import");
    expect(stageForPhase("importing")).toBe("import");
    expect(stageForPhase("scanning")).toBe("scanning");
  });

  it("reports the whole constraints loop as constraints, including its re-walk", () => {
    // #26.05's split, and the judgement call inside it. `constraints-checking`
    // covers a WALK as well as the metadata pass, and it still reports
    // Constraints — the walk is there because the user has been in File
    // Explorer since the last check, and the stage they are standing in is the
    // one whose button they pressed. When that walk finds the structure broken
    // the phase moves to `structure-report` and the indicator follows it back.
    expect(stageForPhase("constraints")).toBe("constraints");
    expect(stageForPhase("constraints-checking")).toBe("constraints");
    expect(stageForPhase("constraints-report")).toBe("constraints");
  });

  it("reports the whole structure loop as structure, including the walk", () => {
    // #26.04's split, and the judgement call inside it. `walking` reports
    // Structure rather than Evaluation because the walk exists to answer the
    // structure question — including the re-walk started from the Evaluation
    // screen, which really is Structure being asked again and really can fail.
    expect(stageForPhase("structure")).toBe("structure");
    expect(stageForPhase("walking")).toBe("structure");
    expect(stageForPhase("structure-report")).toBe("structure");
  });

  it("reports the folder report as evaluation, reachable only past structure", () => {
    // Today's post-folder-selection screen is what 26.09 renames Evaluation.
    expect(stageForPhase("folder-report")).toBe("evaluation");
  });

  it("reports the whole duplication loop as duplication, including its re-walk", () => {
    // #26.06's split, by the same argument #26.05 made one stage earlier.
    // `duplication-checking` covers a walk AND the metadata pass as well as the
    // match, and it still reports Duplication — the user pressed this stage's
    // button. When that walk finds the structure or a constraint broken the
    // phase moves back and the indicator follows it.
    expect(stageForPhase("duplication")).toBe("duplication");
    expect(stageForPhase("duplication-checking")).toBe("duplication");
    expect(stageForPhase("duplication-report")).toBe("duplication");
  });

  it("reports the whole pre-existing loop as preexisting, including its lookup", () => {
    // #26.08's split, by the same argument the three stages before it made. Its
    // `preexisting-checking` is the longest of the four — a walk, the metadata
    // pass, the duplication match AND one request to the archive — and it still
    // reports Pre-existing, because that is the button the user pressed.
    expect(stageForPhase("preexisting")).toBe("preexisting");
    expect(stageForPhase("preexisting-checking")).toBe("preexisting");
    expect(stageForPhase("preexisting-report")).toBe("preexisting");
  });

  it("⚠️ has nothing planned any more — and this test is what says so", () => {
    // #26.08 deleted the last `plannedIn` in the catalogue. Two tests in this
    // suite are therefore VACUOUS today — "never marks a not-yet-built stage
    // done" iterates an empty list, and the pulse test below it lost its
    // subject — and the mechanism stays in the type because 26.09 and 26.10
    // re-home three screens and build a fourth.
    //
    // This assertion is what makes that vacuum VISIBLE rather than silent. A
    // reader who notices those tests passing over nothing can come here and
    // find out why; and the day a slice adds a `plannedIn` back, the loops go
    // live again with no edit and this line is the one that fails first,
    // pointing at the slice that did it.
    expect(WORKFLOW_STAGES.filter((s) => s.plannedIn !== undefined).map((s) => s.id)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

describe("stageStatuses", () => {
  it("marks exactly one stage current, when the current stage has a screen", () => {
    for (const phase of IMPORT_PHASES) {
      const statuses = stageStatuses(stageForPhase(phase));
      const current = IDS.filter((id) => statuses[id] === "current");
      expect(current).toEqual([stageForPhase(phase)]);
    }
  });

  it("leaves everything pending on the first stage", () => {
    const statuses = stageStatuses("information");
    expect(statuses.information).toBe("current");
    for (const id of IDS.filter((i) => i !== "information")) {
      expect(statuses[id]).toBe("pending");
    }
  });

  it("never marks a not-yet-built stage done, however far past it the user is", () => {
    // The whole reason `plannedIn` exists. At the last stage every earlier
    // stage is behind the user, and the one with no screen must still be grey.
    const statuses = stageStatuses("result");
    for (const id of IDS.filter(planned)) {
      expect(statuses[id]).toBe("pending");
    }
    expect(statuses.evaluation).toBe("done");
    expect(statuses.scanning).toBe("done");
    expect(statuses.import).toBe("done");
    expect(statuses.result).toBe("current");
  });

  it("greens the whole first line AND pre-existing during evaluation", () => {
    // The shape #26.08 produces, and the whole point of the slice: Evaluation
    // is unreachable except through a clean structure check, a clean
    // constraints check, a clean duplication check AND a settled pre-existing
    // report, so all four are genuinely done there. Pre-existing was `pending`
    // on this exact vector one slice ago; the line that changed is the slice.
    //
    // ⚠️ Its green means something slightly different from the other three, and
    // that is argued rather than overlooked: Pre-existing does not BLOCK, so
    // "done" there means the user was told what the import will do and said so,
    // not that a fault was corrected. Both are things that either happened or
    // did not, which is all a green tick has ever claimed here.
    const statuses = stageStatuses("evaluation");
    expect(statuses.information).toBe("done");
    expect(statuses.preconditions).toBe("done");
    expect(statuses.structure).toBe("done");
    expect(statuses.constraints).toBe("done");
    expect(statuses.duplication).toBe("done");
    expect(statuses.preexisting).toBe("done");
    // ⚠️ **`scanning` was `pending` on this vector until #29.08 and is `done`
    // now, and that one line is the reorder.** The Evaluation screen is
    // reachable only through a finished classification whose every document
    // type has a form, so the Scanning pill behind it is green rather than
    // grey — a claim the screen itself is standing on, because the numbers it
    // reports come out of that scan.
    expect(statuses.scanning).toBe("done");
    expect(statuses.evaluation).toBe("current");
  });

  it("greens the first line and pulses pre-existing", () => {
    const statuses = stageStatuses("preexisting");
    expect(statuses.duplication).toBe("done");
    expect(statuses.preexisting).toBe("current");
    expect(statuses.evaluation).toBe("pending");
  });

  it("greens structure and constraints and pulses duplication", () => {
    const statuses = stageStatuses("duplication");
    expect(statuses.structure).toBe("done");
    expect(statuses.constraints).toBe("done");
    expect(statuses.duplication).toBe("current");
    expect(statuses.evaluation).toBe("pending");
  });

  it("greens structure and pulses constraints while the files are being checked", () => {
    const statuses = stageStatuses("constraints");
    expect(statuses.structure).toBe("done");
    expect(statuses.constraints).toBe("current");
    expect(statuses.duplication).toBe("pending");
    expect(statuses.evaluation).toBe("pending");
  });

  it("greens nothing beyond preconditions while the structure is being checked", () => {
    const statuses = stageStatuses("structure");
    expect(statuses.information).toBe("done");
    expect(statuses.preconditions).toBe("done");
    expect(statuses.structure).toBe("current");
    expect(statuses.constraints).toBe("pending");
    expect(statuses.evaluation).toBe("pending");
  });

  it("shows the three finished stages green behind a reopened report — deliberately", () => {
    // `resumed` renders a PREVIOUS run's record, so this vector says: an import
    // was evaluated, scanned and written, and you are looking at its result.
    // The alternative — grey, because the user did none of it in THIS browser
    // session — would put three untouched pills above a screen that is itself
    // the proof they happened. Pinned because it is a judgement call and the
    // next reader should find it argued rather than discover it.
    const statuses = stageStatuses(stageForPhase("resumed"));
    expect(statuses.evaluation).toBe("done");
    expect(statuses.scanning).toBe("done");
    expect(statuses.import).toBe("done");
    expect(statuses.result).toBe("current");
    // Pre-existing joined them in #26.08 and is no longer the exception on this
    // vector — there is no stage without a screen left to be one.
    expect(statuses.preexisting).toBe("done");
    // Structure, Constraints, Duplication and Pre-existing are NOT grey any
    // more: #26.04, #26.05, #26.06 and #26.08 built their screens, and a
    // resumed run's folder did go through all four.
    // These two lines are the ones that would have to change back if either
    // stage were ever un-built.
    //
    // ⚠️ KNOWN AND ACCEPTED, raised by #26.05's adversarial review: the wizard
    // never inspects the saved record, so this is a claim about a run rather
    // than a reading of one — and a session saved BEFORE #26.05 shipped went
    // through no Constraints stage at all, because there was none. The cost is
    // one wrongly-green pill on a screen that is itself a past run's report;
    // the alternative is reversing #26.03's argued decision that a reopened
    // result shows its journey green. Left as it is, deliberately. If a saved
    // session ever needs to be trusted for more than this, version-stamp it and
    // derive the greens from what that run actually completed.
    expect(statuses.structure).toBe("done");
    expect(statuses.constraints).toBe("done");
    expect(statuses.duplication).toBe("done");
  });

  it("⚠️ pulses a built stage when asked to, and refuses for a planned one", () => {
    // This replaces "refuses to make a planned stage current", which #26.08
    // emptied of its subject: Pre-existing was the last stage with no screen,
    // so the vector that test used is now an ordinary stage.
    //
    // Written over `planned(id)` rather than over a hard-coded id, so it says
    // the invariant instead of an example of it: a stage the catalogue lists
    // and a caller names DOES pulse, unless it has no screen, in which case
    // nothing pulses at all — under-claiming rather than a pulse on a stage
    // with nothing behind it. Today every branch on the right is taken and the
    // left is empty; the day 26.09 or 26.10 adds a `plannedIn` back, this test
    // covers it without an edit.
    for (const id of IDS) {
      const statuses = stageStatuses(id);
      expect({ id, status: statuses[id] }).toEqual({
        id,
        status: planned(id) ? "pending" : "current",
      });
      if (planned(id)) expect(IDS.filter((i) => statuses[i] === "current")).toEqual([]);
    }
  });

  it("under-claims rather than throwing on an id that is not in the catalogue", () => {
    const statuses = stageStatuses("nonsense" as WorkflowStageId);
    for (const id of IDS) expect(statuses[id]).toBe("pending");
  });

  it("answers for every stage in the catalogue, every time", () => {
    for (const id of IDS) {
      const statuses = stageStatuses(id);
      expect(Object.keys(statuses).sort()).toEqual([...IDS].sort());
    }
  });
});

// ---------------------------------------------------------------------------
// Both locales
// ---------------------------------------------------------------------------

describe("the indicator's copy", () => {
  it.each(LOCALES)("names every stage and every line in %s", (file) => {
    const w = loadWorkflowMessages(file) as {
      line: Record<string, string>;
      stage: Record<string, string>;
    };

    for (const line of WORKFLOW_LINE_IDS) {
      expect(typeof w.line[line]).toBe("string");
      expect(w.line[line].length).toBeGreaterThan(0);
    }
    for (const id of IDS) {
      expect(typeof w.stage[id]).toBe("string");
      expect(w.stage[id].length).toBeGreaterThan(0);
    }
  });

  it.each(LOCALES)("carries the indicator's own strings in %s", (file) => {
    const w = loadWorkflowMessages(file) as Record<string, unknown>;
    for (const key of [
      "indicatorLabel",
      "announcement",
      "planned",
      "statusPending",
      "statusCurrent",
      "statusDone",
    ]) {
      expect(typeof w[key]).toBe("string");
      expect(String(w[key]).length).toBeGreaterThan(0);
    }
    // The announcement is the only live region in the indicator; without the
    // placeholder it would announce "current step:" and nothing else.
    expect(String(w.announcement)).toContain("{stage}");
  });

  it("keeps the current step's pulse, and its reduced-motion fallback, in globals.css", () => {
    // The pulse ships with no other guard: nothing else in the suite renders
    // the indicator, and the class name alone type-checks whatever the CSS
    // says. Both of its bugs so far were invisible-by-construction rather than
    // absent — the first keyframes animated FROM a zero-spread shadow (which
    // sits under the border box and paints nothing) TO a transparent one, so
    // both authored frames drew nothing at all.
    //
    // So this reads the VALUES rather than matching the text. A regex over the
    // declaration would have to guess at alpha spelling (`0.6` / `.6` / `1` /
    // `60%`), at colour function (`rgba()` / `rgb( / )` / `oklch()`) and at
    // which keyframe was written first, and would fail the next legitimate
    // rewrite while still passing a transparent ring.
    //
    // And it checks the WHOLE chain, not just the keyframes: perfect keyframes
    // draw nothing if the class does not reference them, and the box-shadow is
    // invalid-at-computed-value-time — i.e. `none` — if the custom property it
    // reads has no declaration. Both of those are a deletion 14 lines away from
    // anything this test would otherwise look at.
    const css = code(
      fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8"),
    );

    const pulseRules = rulesFor(css, ".ga-stage-pulse");

    // 1. Exactly one unconditional rule runs the animation. Unconditional
    //    matters: the same rule inside `@media print` reads identically and
    //    never runs.
    const live = pulseRules.filter((r) => r.enclosing.length === 0);
    expect(live).toHaveLength(1);
    //    Lookarounds, not `\b`: `-` is a non-word character, so `\b` would
    //    accept `animation: ga-stage-pulse-soft` and leave the class pointed at
    //    a sibling — or at an animation that does not exist — while the
    //    keyframes assertion below happily inspected the healthy, unused
    //    original. Exactly the hole the `@keyframes` lookup had, on the other
    //    end of the same chain. (`i18n-and-romanian.md` says the same thing for
    //    a different reason: `\b` is rarely the boundary you meant.)
    expect(live[0].block).toMatch(
      /animation(-name)?:[^;]*(?<![\w-])ga-stage-pulse(?![\w-])/,
    );

    // 2. The colour token is declared as the three CHANNELS the `rgb(… / a)`
    //    call sites need — not as a hex, which is the plausible edit and makes
    //    every box-shadow invalid-at-computed-value-time, i.e. nothing paints
    //    in either scheme. And the dark override comes AFTER the light one:
    //    the two sit in their own blocks, apart from the palette's, and
    //    consolidating them the wrong way round silently puts amber-700 on
    //    zinc-900 at 2.5 : 1.
    const CHANNELS = /--ga-stage-halo:\s*\d+\s+\d+\s+\d+\s*;/;
    const light = css.search(/:root\s*\{[^}]*--ga-stage-halo:/);
    expect(light).toBeGreaterThan(-1);
    expect(balancedBlock(css, light)).toMatch(CHANNELS);

    const darkAt = css.search(
      /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{[^}]*--ga-stage-halo:/,
    );
    expect(darkAt).toBeGreaterThan(light);
    expect(balancedBlock(css, darkAt)).toMatch(CHANNELS);

    // 3. The keyframes themselves.
    const rest = shadowIn(keyframe(css, "ga-stage-pulse", "0%, 100%"));
    const peak = shadowIn(keyframe(css, "ga-stage-pulse", "50%"));

    // ⚠️ **THIS PINS #26.11's DESIGN, NOT "EITHER OF THE TWO DESIGNS".** The
    // first rewrite of this block admitted both — a disjunction reading
    // "transparent at rest OR zero-spread at rest" — and the result was a guard
    // that passed on the exact CSS Adrian rejected: #26.03's 6px halo satisfies
    // the first arm, which then skips the colour-constancy check on the second,
    // and nothing capped the spread, so 6px and 2px were indistinguishable to
    // it. A guard that cannot fail on the state it was rewritten because of is
    // not a guard. There is one shipped design; assert it.
    //
    // At rest the ring paints NOTHING, by having no spread: a zero-spread
    // shadow sits exactly under the border box, so the frame at rest is the
    // pill's own 1px border and nothing else. (#26.03 achieved the same end by
    // making a 5px ring transparent. That is gone — see globals.css.) A ring
    // visible at rest would make the animation a DIP rather than a beat, which
    // is the cue this codebase retired.
    expect(rest.spreadPx).toBe(0);

    // ⚠️ **The colour does not move while the spread does.** This is the whole
    // difference between "the frame is getting thicker" — what was asked for —
    // and "a colour is fading in", which is the cue retired above wearing a
    // frame's clothes. Unconditional now: under this design a varying alpha is
    // always the wrong answer.
    expect(rest.alpha).toBe(peak.alpha);
    expect(peak.alpha).toBeGreaterThan(0.3);

    // ⚠️ **THE PEAK SPREAD IS THE ×3 RATIO, TO THE PIXEL, AND `toBe` IS THE
    // POINT.** Adrian specified the amplitude as "between regular frame
    // thickness and three times the regular thickness"; the pill's border is
    // Tailwind's 1px `border`, so the ring outside it is `3 × 1 − 1 = 2`. A
    // `toBeGreaterThan(0)` here is what let the 6px halo through, and 6px was
    // the report ("way too strong … way too thick") this slice answers. If the
    // pill's border width ever changes, this number moves with it — see the
    // note in `stage-indicator.tsx`.
    //
    // It also means the spread must stay a LITERAL in globals.css: `shadowIn`
    // reads lengths out of the declaration text, and `var(--something)` holds
    // no digit, so a custom property here measures 0 and the guard goes blind.
    // That is not a false alarm to work around — it is why the value is spelt
    // out in both places with a comment tying them together.
    expect(peak.spreadPx).toBe(2);

    // ⚠️ **The pill's border colour comes from the same token as the ring.**
    // #26.11's first attempt left `border-amber-400` on the pill in
    // `stage-indicator.tsx` while the ring painted amber-700, so the peak was a
    // pale 1px outline with a dark 2px band swelling outside it — two visibly
    // different ambers, i.e. precisely the "border with something glowing
    // behind it" reading the slice replaced the halo to be rid of. Asserted on
    // the class's own live rule, because that is the only place the two can be
    // made to agree by construction.
    expect(live[0].block).toMatch(/border-color:\s*rgb\(\s*var\(--ga-stage-halo\)/);

    // 4. The reduced-motion fallback is a steady ring at full strength, and it
    //    is the RULE that is asserted, inside the reduced-motion query and
    //    nothing else. Moving it out switches the pulse off for everyone;
    //    asserting the media block instead would let a sibling rule answer for
    //    it while this one was emptied.
    const reduced = pulseRules.filter(
      (r) =>
        r.enclosing.length === 1 &&
        /prefers-reduced-motion:\s*reduce/.test(r.enclosing[0]),
    );
    expect(reduced).toHaveLength(1);
    expect(reduced[0].block).toMatch(/animation:\s*none/);
    const frozen = shadowIn(reduced[0].block);
    // Parked at the thick end — the same ring the animation reaches, not some
    // average of the two frames and not a third value invented here.
    expect(frozen.spreadPx).toBe(peak.spreadPx);
    expect(frozen.alpha).toBe(peak.alpha);
  });

  it("⚠️ keeps the current pill's border at the 1px the ×3 ratio is built on", () => {
    // The peak spread is asserted as exactly 2px above, and 2 is `3 × 1 − 1`.
    // The 1 is Tailwind's bare `border` on the pill's SHARED class list —
    // which is not in the `current:` entry the next test inspects, so nothing
    // read it until now. Change it to `border-2` and the cue silently becomes
    // ×2 (a 2px rest frame growing to 4px) with every other assertion in this
    // file still green. Both `globals.css` and `stage-indicator.tsx` say "change
    // the pill's border width and the spread must move with it"; this is what
    // makes that more than a wish.
    const source = pillSource();
    const shared = source.slice(
      source.indexOf("inline-flex items-center"),
      source.indexOf("PILL[step.status]"),
    );
    expect(shared).toMatch(/(^|\s)border(\s|")/);
    expect(shared).not.toMatch(/(^|\s)border-\d/);
  });

  it("⚠️ leaves the current pill's border colour to .ga-stage-pulse", () => {
    // The other half of the assertion above, and it has to be a separate read:
    // the CSS can set `border-color` perfectly and still be overridden by a
    // `border-amber-*` utility on the same element, because both are single
    // class selectors and the winner is decided by stylesheet order — the exact
    // bet `button-styles.ts` spends its header forbidding.
    //
    // So the current pill must carry NO border-colour utility at all, in either
    // scheme. It still carries the 1px `border` (the width), which is half the
    // ×3 ratio; only the colour is delegated.
    const source = pillSource();
    const currentEntry = source.slice(
      source.indexOf("current:"),
      source.indexOf("done:"),
    );
    // If the record is ever reordered so this slice grabs the wrong text, this
    // line fails loudly rather than letting the assertion below pass vacuously.
    expect(currentEntry).toContain("ga-stage-pulse");
    // Any `border-…` utility, under any variant prefix and in any colour
    // notation: `border-amber-400`, `dark:border-amber-500`,
    // `dark:hover:border-amber-500`, `border-[#B45309]`, `border-transparent`,
    // and the widths too — `border-2` would break the ×3 ratio just as surely
    // as a colour breaks the one-frame reading. Plain `border` (the 1px width
    // the ratio is built on) has no hyphen and is deliberately still allowed,
    // although it lives on the shared class list rather than in here.
    expect(currentEntry).not.toMatch(/(^|[\s"])([a-z0-9-]+:)*border-\S/);
  });

  it.each(LOCALES)("ships no stray stage or line keys in %s", (file) => {
    // A key left behind after a stage is renamed is dead copy that reads as
    // live copy the next time someone greps for a label.
    const w = loadWorkflowMessages(file) as {
      line: Record<string, string>;
      stage: Record<string, string>;
    };
    expect(Object.keys(w.stage).sort()).toEqual([...IDS].sort());
    expect(Object.keys(w.line).sort()).toEqual([...WORKFLOW_LINE_IDS].sort());
  });
});

// ---------------------------------------------------------------------------
// The fork at the end of a walk   (Slice #26.06)
// ---------------------------------------------------------------------------

/**
 * The whole of #26.06's new decision, as a table.
 *
 * It lives in `workflow-stages.ts` rather than inside `runWalk` precisely so
 * these cases can be written: in the wizard it sits behind an awaited ~760-call
 * metadata pass, and this repo has no test that renders `ImportWizard` at all.
 *
 * A wrong cell here is not a crash. It is a user standing on a screen with
 * nothing on it, or the Duplication pill going green over a match that never
 * ran - which is the exact class of failure `plannedIn` and the rest of this
 * module were built to make impossible.
 */
describe("phaseAfterFileChecks", () => {
  /** Every result now carries two flags. Spelt out so a case reads as one line. */
  const at = (phase: string, dup = false, pex = false) => ({
    phase,
    duplicationRan: dup,
    preexistingRan: pex,
  });

  it("sends a broken constraint to the constraints list, whatever was asked for", () => {
    for (const target of ["constraints", "duplication", "preexisting"] as const) {
      expect(
        phaseAfterFileChecks({ target, constraintsClean: false, duplicationClean: null }),
      ).toEqual(at("constraints-report"));
    }
  });

  it("⚠️ never reports a check that did not run, even when everything before it passed", () => {
    // The `plannedIn` argument one layer down, now for two flags. A run that
    // came for Duplication and found a broken constraint has not looked for
    // copies; a run that came for the archive and found copies has not asked
    // the archive. In each case the flag is false, which is what keeps the
    // panel showing its explanations rather than an all-clear nobody earned.
    expect(
      phaseAfterFileChecks({
        target: "duplication",
        constraintsClean: false,
        duplicationClean: null,
      }).duplicationRan,
    ).toBe(false);
    expect(
      phaseAfterFileChecks({
        target: "constraints",
        constraintsClean: true,
        duplicationClean: null,
      }).duplicationRan,
    ).toBe(false);
    expect(
      phaseAfterFileChecks({
        target: "preexisting",
        constraintsClean: true,
        duplicationClean: false,
        preexistingClean: null,
      }).preexistingRan,
    ).toBe(false);
  });

  it("stops a clean constraints run at the Duplication explanations", () => {
    // The stopping point that stage exists for: the user reads what a duplicate
    // is before being shown files to remove.
    expect(
      phaseAfterFileChecks({
        target: "constraints",
        constraintsClean: true,
        duplicationClean: null,
      }),
    ).toEqual(at("duplication"));
  });

  it("⚠️ stops a clean duplication run at the Pre-existing explanations", () => {
    // THE one cell #26.08 changed. It was `folder-report` for two slices — a
    // clean duplication check went straight to Evaluation — and the whole
    // insertion of the new stage is this line. The same stopping point one
    // stage later: the user reads what "already in the system" means before
    // being shown which of their documents are.
    expect(
      phaseAfterFileChecks({
        target: "duplication",
        constraintsClean: true,
        duplicationClean: true,
      }),
    ).toEqual(at("preexisting", true));
  });

  it("sends a failing duplication check to its own fix list", () => {
    expect(
      phaseAfterFileChecks({
        target: "duplication",
        constraintsClean: true,
        duplicationClean: false,
      }),
    ).toEqual(at("duplication-report", true));
  });

  it("⚠️ sends a run that came for the archive but found copies back to Duplication", () => {
    // A run that came to ask the archive and found copies inside the folder has
    // not asked the archive, and must not say it has. The same argument the
    // constraints case makes one stage down.
    expect(
      phaseAfterFileChecks({
        target: "preexisting",
        constraintsClean: true,
        duplicationClean: false,
        preexistingClean: null,
      }),
    ).toEqual(at("duplication-report", true));
  });

  it("⚠️ stops a clean pre-existing check on its own screen too", () => {
    // THE one cell #29.08 changed, and it is the inverse of the sentence that
    // used to be here: "no screen for a clean answer, because a screen reading
    // 'the archive holds none of these, press Continuă' is a click spent on a
    // non-event." That was true while the next billed step stood behind the
    // EVALUATION screen's Continuă. The classification runs before Evaluation
    // now, so this screen carries the press that pays for it — and the click is
    // not spent on a non-event, it IS the authorisation.
    expect(
      phaseAfterFileChecks({
        target: "preexisting",
        constraintsClean: true,
        duplicationClean: true,
        preexistingClean: true,
      }),
    ).toEqual(at("preexisting-report", true, true));
  });

  it("⚠️ answers the same screen whether the archive was happy or not", () => {
    // Written out as a pair rather than left to the two cases above, because
    // the COLLAPSE is the thing worth pinning: `preexistingClean` no longer
    // chooses between two phases, and a later slice re-splitting it would put
    // the cost warning on a screen half of all runs never see.
    const clean = phaseAfterFileChecks({
      target: "preexisting",
      constraintsClean: true,
      duplicationClean: true,
      preexistingClean: true,
    });
    const notClean = phaseAfterFileChecks({
      target: "preexisting",
      constraintsClean: true,
      duplicationClean: true,
      preexistingClean: false,
    });
    expect(clean).toEqual(notClean);
  });

  it("⚠️ shows the report when the archive answered with anything at all — including a failure", () => {
    // `preexistingClean: false` covers three different states and they all land
    // on the same screen: the archive holds some of these documents, some files
    // could not be measured, and the lookup did not answer. That is deliberate
    // — see the note on the parameter. What must NOT happen is any of them
    // being carried past the screen, because the loop reads the answer.
    expect(
      phaseAfterFileChecks({
        target: "preexisting",
        constraintsClean: true,
        duplicationClean: true,
        preexistingClean: false,
      }),
    ).toEqual(at("preexisting-report", true, true));
  });

  it("⚠️ under-claims when a `preexisting` run produced no answer at all", () => {
    // `null` is not `false`. A failure is an answer the stage renders and the
    // user acts on and arrives as `false`; `null` means the lookup never
    // happened, and the honest place for that caller is the explanations with
    // the button still to press. Landing them on the report would draw an empty
    // one and call it the archive's answer.
    expect(
      phaseAfterFileChecks({
        target: "preexisting",
        constraintsClean: true,
        duplicationClean: true,
        preexistingClean: null,
      }),
    ).toEqual(at("preexisting", true));
    // …and the same when the caller omits it entirely, which is what every
    // pre-#26.08 call site does.
    expect(
      phaseAfterFileChecks({
        target: "preexisting",
        constraintsClean: true,
        duplicationClean: true,
      }),
    ).toEqual(at("preexisting", true));
  });

  it("⚠️ ignores a verdict it was handed against a target that did not ask for one", () => {
    // Defensive, and the reason is the caller's shape rather than paranoia:
    // `duplicationClean` and `target` are two expressions of one fact in
    // `runWalk`, and the failure mode if they ever disagree is a stage going
    // green off a verdict computed for a press that never happened. The target
    // is the authority — for both flags.
    expect(
      phaseAfterFileChecks({
        target: "constraints",
        constraintsClean: true,
        duplicationClean: true,
      }),
    ).toEqual(at("duplication"));
    expect(
      phaseAfterFileChecks({
        target: "duplication",
        constraintsClean: true,
        duplicationClean: true,
        preexistingClean: true,
      }),
    ).toEqual(at("preexisting", true));
  });

  it("⚠️ UNDER-claims for a `structure` target rather than carrying it forward", () => {
    // `runWalk` returns at the structure verdict, so this combination does not
    // arise. It is accepted because the caller passes one variable through, and
    // a union that excluded it would push a cast into the call site.
    //
    // The answer is the EARLIEST stage such a run has certainly not finished.
    // An earlier draft answered `duplication`, which the third adversarial
    // round pointed out would carry a future caller two stages forward past a
    // screen it never showed them — the same false-green failure `plannedIn`
    // exists to prevent, one layer up.
    for (const constraintsClean of [true, false]) {
      for (const duplicationClean of [true, false, null]) {
        for (const preexistingClean of [true, false, null]) {
          expect(
            phaseAfterFileChecks({
              target: "structure",
              constraintsClean,
              duplicationClean,
              preexistingClean,
            }),
          ).toEqual(at("constraints"));
        }
      }
    }
  });

  it("only ever names a phase the machine actually has", () => {
    for (const target of ["structure", "constraints", "duplication", "preexisting"] as const) {
      for (const constraintsClean of [true, false]) {
        for (const duplicationClean of [true, false, null]) {
          for (const preexistingClean of [true, false, null]) {
            const { phase } = phaseAfterFileChecks({
              target,
              constraintsClean,
              duplicationClean,
              preexistingClean,
            });
            expect(IMPORT_PHASES).toContain(phase);
          }
        }
      }
    }
  });

  it("⚠️ never claims a later check ran without the earlier one", () => {
    // Two flags can disagree in a way one could not: `preexistingRan` true
    // beside `duplicationRan` false would be the Pre-existing pill going green
    // over a Duplication stage that never ran, which is the exact shape of
    // false green this whole module exists to prevent — and it is invisible in
    // any single case above, because each one asserts a correct pair.
    for (const target of ["structure", "constraints", "duplication", "preexisting"] as const) {
      for (const constraintsClean of [true, false]) {
        for (const duplicationClean of [true, false, null]) {
          for (const preexistingClean of [true, false, null]) {
            const out = phaseAfterFileChecks({
              target,
              constraintsClean,
              duplicationClean,
              preexistingClean,
            });
            if (out.preexistingRan) {
              expect({ target, dup: out.duplicationRan }).toEqual({ target, dup: true });
            }
          }
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The fork at the end of the classification   (Slice #29.08)
// ---------------------------------------------------------------------------

describe("phaseAfterClassification", () => {
  it("goes on to Evaluation when every type this folder holds has a form", () => {
    expect(phaseAfterClassification({ typesClean: true })).toEqual({
      phase: "folder-report",
    });
  });

  it("⚠️ stops the import when one does not — and when nobody could tell", () => {
    // ONE input for both, which is the decision the slice took and the one a
    // later reader is most likely to want to split. A run whose catalogue read
    // failed has not PROVED that every type has a form, and the promise the
    // gate makes is that no document is imported before its type has one. The
    // stop screen says which of the two happened; the PHASE is the same,
    // because what the user has to do next is the same.
    expect(phaseAfterClassification({ typesClean: false })).toEqual({
      phase: "types-blocked",
    });
  });

  it("only ever names a phase the machine actually has", () => {
    for (const typesClean of [true, false]) {
      expect(IMPORT_PHASES).toContain(phaseAfterClassification({ typesClean }).phase);
    }
  });

  it("⚠️ never sends the run backwards, whichever way it answers", () => {
    // Both destinations must be at or after Scanning in the catalogue: the
    // classification has run and been paid for, and an indicator that retreated
    // to a stage the user has finished would say the money bought nothing.
    const order = WORKFLOW_STAGES.map((s) => s.id);
    const scanning = order.indexOf("scanning");
    for (const typesClean of [true, false]) {
      const stage = stageForPhase(phaseAfterClassification({ typesClean }).phase);
      expect({ typesClean, forward: order.indexOf(stage) >= scanning }).toEqual({
        typesClean,
        forward: true,
      });
    }
  });

  it("⚠️ agrees with the step-through table about which of its exits is gated", () => {
    // The clean exit is the scan's self-advancing transition and IS gated; the
    // stop is not, and must not be. Derived from both sources rather than
    // written out, because the failure this catches is the two disagreeing.
    expect(
      stepThroughRest("scanning", phaseAfterClassification({ typesClean: true }).phase),
    ).toBe("scanning");
    expect(
      stepThroughRest("scanning", phaseAfterClassification({ typesClean: false }).phase),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Step-through   (Slice #29.02)
// ---------------------------------------------------------------------------

describe("SELF_ADVANCING_TRANSITIONS", () => {
  it("names only phases the machine actually has", () => {
    for (const t of SELF_ADVANCING_TRANSITIONS) {
      expect(IMPORT_PHASES).toContain(t.from);
      expect(IMPORT_PHASES).toContain(t.to);
      expect(IMPORT_PHASES).toContain(t.rest);
    }
  });

  it("⚠️ rests on the stage that PASSED, never on the one coming next", () => {
    // The whole design in one assertion. Resting on `to` would be what the
    // wizard already does without the setting, which is the behaviour being
    // fixed: the next stage's screen reports the next stage.
    for (const t of SELF_ADVANCING_TRANSITIONS) {
      expect({ from: t.from, restStage: stageForPhase(t.rest) }).toEqual({
        from: t.from,
        restStage: stageForPhase(t.from),
      });
      expect(stageForPhase(t.rest)).not.toBe(stageForPhase(t.to));
    }
  });

  it("⚠️ moves the user forward, never back", () => {
    // A gate must not be a way of re-entering a stage: `rest` reports the stage
    // the user is in, and `to` must be strictly later in the catalogue.
    const order = WORKFLOW_STAGES.map((s) => s.id);
    for (const t of SELF_ADVANCING_TRANSITIONS) {
      expect({
        from: t.from,
        forward: order.indexOf(stageForPhase(t.to)) > order.indexOf(stageForPhase(t.rest)),
      }).toEqual({ from: t.from, forward: true });
    }
  });

  it("lists each (from, to) pair once, so the lookup cannot be ambiguous", () => {
    const keys = SELF_ADVANCING_TRANSITIONS.map((t) => `${t.from}->${t.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("⚠️ covers exactly the transitions the wizard makes on its own", () => {
    // Written out rather than derived, for the reason the phase->stage table is
    // written out: this list is a claim about `import-wizard.tsx`, and a test
    // that recomputed it from the same array would agree with anything.
    expect(SELF_ADVANCING_TRANSITIONS.map((t) => [t.from, t.to, t.rest])).toEqual([
      ["preflight", "structure", "preflight"],
      ["walking", "constraints", "structure"],
      ["constraints-checking", "duplication", "constraints"],
      ["duplication-checking", "preexisting", "duplication"],
      // ⚠️ **`preexisting-checking → folder-report` WAS THE FIFTH ROW UNTIL
      // #29.08.** It gated the one transition a clean archive lookup made on
      // its own; that transition no longer exists, because every settled lookup
      // now lands on `preexisting-report`, which stops on a button.
      //
      // ⚠️ **And the last row's destination moved from `ready` to
      // `folder-report`**, which is the reorder seen from the step-through
      // side: the Evaluation screen comes after the classification now.
      ["scanning", "folder-report", "scanning"],
    ]);
  });
});

describe("stepThroughRest", () => {
  it("answers the table for every pair in it", () => {
    for (const t of SELF_ADVANCING_TRANSITIONS) {
      expect(stepThroughRest(t.from, t.to)).toBe(t.rest);
    }
  });

  it("⚠️ never gates a stage that FOUND something", () => {
    // Those screens already stop, on a violation list ending in "Verifica din
    // nou". A gate there would be a second button for a pause the user is
    // already standing in - and, worse, a green all-clear over a fix list.
    expect(stepThroughRest("walking", "structure-report")).toBeNull();
    expect(stepThroughRest("constraints-checking", "constraints-report")).toBeNull();
    expect(stepThroughRest("duplication-checking", "duplication-report")).toBeNull();
    expect(stepThroughRest("preexisting-checking", "preexisting-report")).toBeNull();
    // Reachable whatever the walk was asked for: a run that came for the
    // archive and found a broken constraint lands on the constraints list.
    expect(stepThroughRest("preexisting-checking", "constraints-report")).toBeNull();
    expect(stepThroughRest("preexisting-checking", "duplication-report")).toBeNull();
  });

  it("⚠️ refuses the pair the one-column version of this table would have gated", () => {
    // `phaseAfterFileChecks` answers `preexisting` twice, and only `from` tells
    // the two apart: from `duplication-checking` it means "no copies, go and
    // read what the archive is about to be asked", which is a real stage to
    // green; from `preexisting-checking` it means the archive produced NO
    // answer at all, which is nothing to green - and resting at `duplication`
    // because that half was clean would put a note about copies in front of a
    // user who had just pressed the archive's own button.
    expect(stepThroughRest("duplication-checking", "preexisting")).toBe("duplication");
    expect(stepThroughRest("preexisting-checking", "preexisting")).toBeNull();
  });

  it("⚠️ agrees with phaseAfterFileChecks on every input it can produce", () => {
    // The wizard passes this function's `to` straight out of that one, so any
    // destination it can return must either be in the table or be deliberately
    // ungated. This is what catches a later slice adding a fifth destination
    // there and nobody noticing the gate silently disappeared - or, worse,
    // silently appearing over a screen with no message written for it.
    const seen = new Set<string>();
    for (const target of ["structure", "constraints", "duplication", "preexisting"] as const) {
      for (const constraintsClean of [true, false]) {
        for (const duplicationClean of [true, false, null]) {
          for (const preexistingClean of [true, false, null]) {
            const from: ImportPhase =
              target === "structure"
                ? "walking"
                : target === "constraints"
                  ? "constraints-checking"
                  : target === "duplication"
                    ? "duplication-checking"
                    : "preexisting-checking";
            const { phase } = phaseAfterFileChecks({
              target,
              constraintsClean,
              duplicationClean,
              preexistingClean,
            });
            const rest = stepThroughRest(from, phase);
            if (rest !== null) {
              expect(stageForPhase(rest)).toBe(stageForPhase(from));
            }
            seen.add(`${from}->${phase}=${rest ?? "null"}`);
          }
        }
      }
    }
    // And the walk-side pairs it can reach, exhaustively, so a change to either
    // function shows up here as a diff rather than as a shrug.
    //
    // ⚠️ **THREE OF THESE ROWS WERE MISSING FROM THE FIRST DRAFT OF THIS LIST,
    // and writing it out by hand is what found them.** Two are
    // `phaseAfterFileChecks` under-claiming with `duplicationClean: null` — the
    // match did not run, so it answers `duplication` for a walk that asked for
    // more — and neither is gated, correctly: there is no stage to green when
    // nothing ran. The third is `walking->constraints`, which the loop reaches
    // only because it feeds `target: "structure"` to a function the wizard
    // never calls with it (a clean structure walk returns two branches earlier,
    // at `setPhase("constraints")`'s own site). The ANSWER is right for the
    // real route anyway — `structure` is where a clean structure walk rests —
    // which is why the row is pinned rather than excluded.
    expect([...seen].sort()).toEqual([
      "constraints-checking->constraints-report=null",
      "constraints-checking->duplication=constraints",
      "duplication-checking->constraints-report=null",
      "duplication-checking->duplication-report=null",
      "duplication-checking->duplication=null",
      "duplication-checking->preexisting=duplication",
      "preexisting-checking->constraints-report=null",
      "preexisting-checking->duplication-report=null",
      "preexisting-checking->duplication=null",
      // ⚠️ `preexisting-checking->folder-report=preexisting` stood here until
      // #29.08. Both archive answers land on `preexisting-report` now, so the
      // row below absorbed it — and it is ungated, correctly: that screen stops
      // on its own button, which is the press that starts the classification.
      "preexisting-checking->preexisting-report=null",
      "preexisting-checking->preexisting=null",
      "walking->constraints=structure",
    ]);
  });

  it("⚠️ does not gate a transition the user already presses a button for", () => {
    // Slice #29.08 — the first two are the same two presses under new names:
    // the one that starts the billed classification moved to the Pre-existing
    // screen, and Evaluation's own Continuă now leads to the Import stage.
    expect(stepThroughRest("preexisting-report", "scanning")).toBeNull();
    expect(stepThroughRest("folder-report", "ready")).toBeNull();
    // …and the stop screen is not a pause. A gate in front of a screen the user
    // cannot leave by pressing on would be a second button for a halt they are
    // already standing in.
    expect(stepThroughRest("scanning", "types-blocked")).toBeNull();
    expect(stepThroughRest("ready", "property")).toBeNull();
    expect(stepThroughRest("property", "tag-dialog")).toBeNull();
    expect(stepThroughRest("importing", "result")).toBeNull();
    expect(stepThroughRest("information", "preflight")).toBeNull();
  });

  it("under-claims rather than throwing on a pair that is not a transition", () => {
    for (const from of IMPORT_PHASES) {
      for (const to of IMPORT_PHASES) {
        const rest = stepThroughRest(from, to);
        if (rest === null) continue;
        expect(SELF_ADVANCING_TRANSITIONS).toContainEqual({ from, to, rest });
      }
    }
  });
});


describe("the pause's copy", () => {
  it.each(LOCALES)("has a sentence for every stage a pause can rest on in %s", (file) => {
    const g = loadStepGateMessages(file) as { cleared: Record<string, string> };
    for (const t of SELF_ADVANCING_TRANSITIONS) {
      const stage = stageForPhase(t.rest);
      expect(typeof g.cleared[stage]).toBe("string");
      expect(g.cleared[stage].length).toBeGreaterThan(0);
    }
  });

  it.each(LOCALES)("ships no sentence no pause can produce in %s", (file) => {
    // The mirror of the test above, and the one that actually bites: a string
    // for a stage that cannot be rested on is a promise of a pause that never
    // happens, and it is invisible from the screen.
    const g = loadStepGateMessages(file) as { cleared: Record<string, string> };
    const rests = SELF_ADVANCING_TRANSITIONS.map((t) => stageForPhase(t.rest));
    expect(Object.keys(g.cleared).sort()).toEqual([...new Set(rests)].sort());
  });

  it.each(LOCALES)("⚠️ does not restate the panel's own all-clear in %s", (file) => {
    // The panel above the card is already showing its emerald `clean` line, so
    // a card that says the same thing reads as a rendering fault.
    //
    // ⚠️ **THREE STAGES, NOT FOUR, SINCE #29.08.** `preexisting` was the
    // fourth; it left both the table and `cleared` when a clean archive lookup
    // stopped being a transition the wizard makes on its own — it lands on the
    // Pre-existing report screen now, which stops on the button that starts the
    // billed classification. The remaining two rest stages, `preconditions` and
    // `scanning`, have never had a `clean` sibling to be confused with, which
    // is why this list has always been shorter than the table.
    //
    // ⚠️ **THE FIRST VERSION OF THIS TEST WAS `not.toBe(clean)`, AND THE
    // ADVERSARIAL ROUND SHOWED IT PASSING ON THE EXACT DEFECT IT NAMES.**
    // Exact inequality only catches a literal copy-paste. The copy it was
    // guarding read "Nu se află nimic de două ori în folderul ales." on the
    // panel and "Nu s-a găsit nimic de două ori în folderul ales." on the card
    // — two different strings, one sentence, 0.89 similar. So the property is
    // the one a reader actually notices: no long run of characters in common.
    // 16 is comfortably above the longest run these six sentences share with
    // their panels today (11, measured across both locales) and far below the
    // ~30 the near-duplicates scored.
    const raw = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "messages", file), "utf8"),
    ) as { adminImport: Record<string, { clean?: string }> };
    const g = loadStepGateMessages(file) as { cleared: Record<string, string> };
    for (const section of ["structure", "constraints", "duplication"]) {
      const clean = raw.adminImport[section]?.clean;
      expect(typeof clean).toBe("string");
      // The section name travels with the number so a failure says WHICH
      // sentence drifted, rather than just "18 is not less than 16".
      const run = longestSharedRun(g.cleared[section], clean!);
      expect({ section, tooSimilar: run >= 16, run }).toEqual({
        section,
        tooSimilar: false,
        run,
      });
    }
  });

  it.each(LOCALES)("⚠️ names the destination as a step, not as a bare label in %s", (file) => {
    // `advance` used to be "Continuă la {stage}", which renders "Continuă la
    // Deja în sistem" — the stage names are pill labels, not objects of a
    // preposition. The word for the unit has to be there, and it has to be the
    // same word the indicator uses ("Pasul curent"), not a second one.
    const g = loadStepGateMessages(file) as Record<string, string>;
    const w = loadWorkflowMessages(file) as Record<string, string>;
    const unit = file.startsWith("ro") ? "pas" : "step";
    expect(g.advance.toLowerCase()).toContain(unit);
    expect(g.toggle.toLowerCase()).toContain(unit);
    expect(w.announcement.toLowerCase()).toContain(unit);
    // And no second word for it. "etapă" is the one that crept in.
    if (file.startsWith("ro")) {
      for (const v of [g.toggle, g.toggleHint, g.why, g.advance]) {
        expect(v.toLowerCase()).not.toContain("etap");
      }
    }
  });

  it.each(LOCALES)("⚠️ tells the preconditions rest where the folder picker is, in %s", (file) => {
    // Slice #32.03. The preconditions screen has no folder picker — `allGreen`
    // stopped promising one in the same slice — so the pause below it is where
    // the user is told that the picker is behind the Continue button.
    //
    // ⚠️ **KEYED PER STAGE, AND ONLY THIS ONE HAS A VALUE.** The card is drawn
    // at every rest `SELF_ADVANCING_TRANSITIONS` names, and a generic "press
    // Continue" at the others would be telling the reader what is already two
    // centimetres below them, so a second key here is a copy defect, not a gap.
    // (No number in that sentence, deliberately: the table is the one place the
    // count lives, and this suite is what pins the table.)
    const g = loadStepGateMessages(file) as {
      nextAction: Record<string, string>;
      cleared: Record<string, string>;
    };
    expect(Object.keys(g.nextAction)).toEqual(["preconditions"]);
    expect(typeof g.nextAction.preconditions).toBe("string");
    // ⚠️ **AND THE CODE'S OWN LIST HAS TO SAY THE SAME THING.**
    // `STAGES_WITH_NEXT_ACTION` in `import-step-gate.tsx` decides which rests
    // RENDER the paragraph, and its note calls itself the one place that rule
    // lives — but nothing joined it to the keys until this assertion. Change it
    // to `["structure"]` and the preconditions rest silently loses the
    // folder-picker pointer while the structure rest renders
    // `t("nextAction.structure")` against a key that does not exist, which in
    // the shipping Romanian is a dotted path on screen. Every other test in the
    // repo stays green through that.
    const card = fs.readFileSync(
      path.join(
        process.cwd(),
        "src", "app", "admin", "import", "_components", "import-step-gate.tsx",
      ),
      "utf8",
    );
    // Matched loosely on purpose: `[^=]*` past the type annotation so adding
    // `as const` or changing the annotation is an innocent edit, and `[^\]]*`
    // spans newlines so a Prettier-wrapped array still matches. SORTED, so a
    // second stage added in a different order in the two files fails by naming
    // the stage rather than by an ordering diff.
    const literal = card.match(/STAGES_WITH_NEXT_ACTION[^=]*=\s*\[([^\]]*)\]/);
    expect(literal).not.toBeNull();
    const rendered = [...literal![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(rendered.slice().sort()).toEqual(Object.keys(g.nextAction).sort());

    // ⚠️ **AND THAT BOTH CONSUMERS ACTUALLY READ IT.** The list agreeing with
    // the keys proves nothing if nothing renders the sentence: delete the
    // paragraph from the card and every assertion above still passes while a
    // SIGHTED user silently loses the only on-screen pointer to the folder
    // picker — the pointer this slice took out of `preflight.allGreen`. And the
    // wizard's sr-only region has to reach the list through the IMPORT, not
    // through a second `=== "preconditions"`, which is the "one rule in two
    // places" the constant's own note forbids.
    expect(card).toContain("STAGES_WITH_NEXT_ACTION.includes(stage)");
    expect(card).toContain("t(`nextAction.${stage}`");
    // Read here rather than reusing the `wizard` const, which belongs to the
    // wizard-source describe further down and is not in scope in this one.
    const wizardSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "src", "app", "admin", "import", "_components", "import-wizard.tsx",
      ),
      "utf8",
    );
    expect(wizardSource).toContain("STAGES_WITH_NEXT_ACTION.includes(");
    expect(wizardSource).toContain("tStepGate(`nextAction.");

    // ⚠️ **IT NAMES THE BUTTON BY INTERPOLATION, NEVER BY A SECOND COPY OF ITS
    // LABEL.** `{button}` is filled with the very string `advance` renders. A
    // literal "Continuă la pasul …" written out here would be two strings with
    // one meaning, and the day `advance` or the stage vocabulary is relabelled
    // this sentence would start naming a button that no longer exists.
    expect(g.nextAction.preconditions).toContain("{button}");
    const advanceStem = (g as unknown as { advance: string }).advance.split("{")[0].trim();
    expect(advanceStem.length).toBeGreaterThan(4);
    expect(g.nextAction.preconditions).not.toContain(advanceStem);
  });

  it.each(LOCALES)("carries the pause's own strings in %s", (file) => {
    const g = loadStepGateMessages(file) as Record<string, unknown>;
    for (const key of ["toggle", "toggleHint", "why", "advance"]) {
      expect(typeof g[key]).toBe("string");
      expect((g[key] as string).length).toBeGreaterThan(0);
    }
    // The button names where it goes, and the name comes from the indicator's
    // own vocabulary — a user stepping through on purpose is reading the pills.
    expect(g.advance as string).toContain("{stage}");
  });
});

describe("the wizard's side of the table", () => {
  /**
   * ⚠️ **EVERY OTHER TEST IN THIS FILE IS ABOUT A PURE FUNCTION, AND THE
   * ADVERSARIAL ROUND'S SHARPEST POINT WAS THAT NONE OF THEM TOUCHES THE
   * WIZARD.** `stepThroughRest` is a five-line `Array.find`; what can actually
   * break is the wizard handing it the wrong `from`. The ternary that computes
   * `fromPhase` from the walk's target is the single point of failure — change
   * one arm and every gate on that branch silently stops appearing, with this
   * whole suite still green.
   *
   * A source scan is the only instrument available: the wizard is a 2,500-line
   * client component with `showDirectoryPicker` in it, and this repo already
   * reads source text in a test where behaviour cannot be executed (the
   * `globals.css` and `stage-indicator.tsx` assertions above). It is a weaker
   * check than rendering, and it is not pretending otherwise — it catches a
   * phase name that stopped matching, not a mis-wired callback.
   */
  const wizard = fs.readFileSync(
    path.join(process.cwd(), "src", "app", "admin", "import", "_components", "import-wizard.tsx"),
    "utf8",
  );

  it("finds the file it is asserting about", () => {
    // The guard that stops every test below passing vacuously on a bad path.
    expect(wizard.length).toBeGreaterThan(50_000);
    expect(wizard).toContain("stepThroughRest");
  });

  it("⚠️ starts the run with the step-through toggle TICKED", () => {
    // Slice #32.03, and it is the one line three of that slice's four changes
    // are invisible without: `stepThroughRest` only produces a rest when the
    // toggle is on, so with it off the screens #32.01 and #32.03 trimmed are
    // screens the phase self-advances past. Nothing else in this repo pins the
    // initial value — no suite renders `ImportStageBar` — and every test in this
    // file would stay green with the default flipped back.
    //
    // Both halves, because they are one value written twice: the STATE is what
    // the checkbox renders from and the REF is what the transitions read, and a
    // slice that changed only the state would ship a ticked box over an
    // unticked run.
    expect(wizard).toContain("const [stepThrough, setStepThrough] = useState(true);");
    expect(wizard).toContain("const stepThroughRef = useRef(true);");
  });

  it("⚠️ puts the toggle back to that same default when a run is cancelled", () => {
    // `handleCancelConfirmed`'s contract is that the next import starts exactly
    // as a first one does. It reset the pair to `false` — correct while `false`
    // was the default, and a silent regression the moment it stopped being one:
    // the box would arrive unticked after a cancel and the whole flow would
    // change under a user who had changed nothing.
    const start = wizard.indexOf("const handleCancelConfirmed = useCallback(() => {");
    expect(start).toBeGreaterThan(0);
    // ⚠️ **THE END MARKER IS ASSERTED, NOT ASSUMED.** `indexOf` returns -1 the
    // moment the dependency list gains an entry or the closing brace is
    // re-indented, and `slice(start, -1)` then hands back the whole rest of the
    // component — 86k characters. The positive assertions below would find the
    // two writes ANYWHERE in the wizard, and the negative ones would still pass
    // because no `= false` write exists in the file at all, so a refactor that
    // moved the reset out of this callback would go green. `body.length > 0`
    // cannot catch that: `start` is already non-zero, so the slice is never
    // empty either way.
    const end = wizard.indexOf("\n  }, [endRun]);", start);
    expect(end).toBeGreaterThan(start);
    const body = wizard.slice(start, end);
    for (const written of ["stepThroughRef.current = true;", "setStepThrough(true);"]) {
      expect({ written, present: body.includes(written) }).toEqual({ written, present: true });
    }
    // And nothing writing the old value beside them.
    for (const stale of ["stepThroughRef.current = false;", "setStepThrough(false);"]) {
      expect({ stale, present: body.includes(stale) }).toEqual({ stale, present: false });
    }
  });

  it("⚠️ still names every `from` in the table", () => {
    for (const t of SELF_ADVANCING_TRANSITIONS) {
      expect({ from: t.from, named: wizard.includes(`"${t.from}"`) }).toEqual({
        from: t.from,
        named: true,
      });
    }
  });

  it("⚠️ maps the four walk targets onto the four checking phases the table expects", () => {
    // The ternary itself. Written as a shape test rather than a string match so
    // reformatting does not fail it, but a CHANGED phase name does.
    const block = wizard.slice(
      wizard.indexOf("const fromPhase: ImportPhase ="),
      wizard.indexOf('setPhase(fromPhase);'),
    );
    expect(block.length).toBeGreaterThan(0);
    const walkRests = SELF_ADVANCING_TRANSITIONS.filter(
      (t) => t.from !== "preflight" && t.from !== "scanning",
    );
    // Three since #29.08, four before it: `preexisting-checking` left the table
    // when a clean archive lookup stopped being a transition the wizard makes on
    // its own. The ternary still names all four checking phases — it has to, it
    // is what `runWalk` sets the phase from — so this test now asserts a subset
    // of it rather than all of it.
    expect(walkRests).toHaveLength(3);
    for (const t of walkRests) {
      expect({ from: t.from, inTernary: block.includes(`"${t.from}"`) }).toEqual({
        from: t.from,
        inTernary: true,
      });
    }
  });

  it("⚠️ calls settle from exactly the four sites that can reach the table", () => {
    // Four call sites, five transitions: the `phaseAfterFileChecks` commit is
    // one site serving three of them. A fifth site means somebody added a
    // transition without adding it to the table, which is the direction that
    // produces a pause with no sentence written for it.
    const calls = wizard.match(/(?<![A-Za-z])settle\(/g) ?? [];
    expect(calls).toHaveLength(4);
    expect(wizard).toContain('settle("preflight", "structure")');
    expect(wizard).toContain('settle(fromPhase, "constraints")');
    expect(wizard).toContain("settle(fromPhase, next.phase)");
    // ⚠️ Slice #29.08 — the scan's hand-over used to read
    // `settle("scanning", "ready")`. It no longer names its destination at all:
    // `phaseAfterClassification` decides between Evaluation and the stop
    // screen, and the wizard holding a literal here would be a second copy of
    // that rule. What is asserted instead is that the call is still made from
    // the scanning phase and still asks that function.
    // Whitespace-tolerant: the call is Prettier-wrapped today and a reformat
    // that changes nothing must not fail this.
    expect(wizard).toMatch(/settle\(\s*"scanning",/);
    expect(wizard).toContain("phaseAfterClassification({ typesClean: typesAreClean(lookup) })");
  });

  it("⚠️ drops the pause when the preconditions come back FAILING", () => {
    // The adversarial round's worst find: at the preconditions rest the
    // checklist stays mounted with a live re-check, and a re-check that fails
    // used to leave the emerald card and its live button standing over a red
    // list. The fix is one early return, and this is what says it is still
    // there.
    const handler = wizard.slice(
      wizard.indexOf("const handlePreflightVerdict"),
      wizard.indexOf('settle("preflight", "structure")'),
    );
    expect(handler).toContain("if (!passed)");
    expect(handler).toContain("setGate(null)");
  });
});

// ---------------------------------------------------------------------------
// The screens that name their next step through the pause's own sentence
// ---------------------------------------------------------------------------

describe("the continue buttons that name the stage they lead to", () => {
  /**
   * ⚠️ **ONE SENTENCE PATTERN FOR "CONTINUE TO THE NAMED STEP", NOT THREE.**
   *                                                            (Slice #32.04)
   *
   * `ImportStepGate` builds its button as `t("advance", { stage:
   * tStage(`stage.${nextStage}`) })`, and #32.04 gave the same construction to
   * the two buttons outside it that lead from one stage to the next: the
   * Pre-existing panel's Continue on a pruned screen, and the Evaluation
   * screen's, which until then read the literal `forecast.continueButton` —
   * "Continuă spre import", with a lower-case stage name in the middle of it.
   *
   * The guard is here rather than in either panel's own suite because the rule
   * spans both: a literal reintroduced at one site is a second name for a
   * button the other still derives, and the day `advance` or the stage
   * vocabulary is relabelled, one of the two screens starts telling a business
   * user to press something that no longer exists under that name. There is no
   * behavioural test either way — nothing in `src/__tests__/` renders React —
   * so a source scan is the instrument available, the same trade the wizard
   * tests above make.
   */
  const SITES = [
    {
      file: "src/app/admin/import/_components/import-preexisting-stage.tsx",
      // `onContinue` here is `startScan`: the press sends the images, so the
      // screen the user arrives at is the Scanning one. Naming Evaluation would
      // be a caption promising a screen one press further on.
      phase: "scanning",
      // No literal to be gone: this button's label was "Continuă", which the
      // panel still renders on every screen that is not pruned. The negative
      // half of this rule is asserted at the other site, where a literal really
      // did exist.
      gone: null,
    },
    {
      // `onContinue` here is `setPhase("ready")`, and `ready` is the Import
      // stage — which is what capitalises "Import" in en-GB, out of the
      // mechanism rather than out of a second typing of the word.
      file: "src/app/admin/import/_components/folder-forecast.tsx",
      phase: "ready",
      gone: "continueButton",
    },
  ] as const;

  /**
   * A component with its comments stripped — see the second test for why.
   *
   * Named apart from the module-level `code()` above, which strips block
   * comments only: that one reads CSS, which has no `//`, and a shadowing
   * helper with a different meaning under the same name is how the wrong one
   * gets called.
   */
  function withoutComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  }

  it.each(SITES)("$file builds its label from the pause's own key", (site) => {
    const source = fs.readFileSync(path.join(process.cwd(), site.file), "utf8");
    expect(source).toContain('useTranslations("adminImport.stepGate")');
    expect(source).toContain('tGate("advance"');
    // ⚠️ Through `stageForPhase`, not as a stage id spelled out. Phase ids and
    // stage ids are different vocabularies — `walking` is the Structure stage —
    // so a hand-written stage id is a second copy of `STAGE_BY_PHASE` that
    // nothing would notice going stale.
    expect(source).toContain(`stageForPhase("${site.phase}")`);
    expect(source).toContain("stage: tStage(`stage.${");
    // …and the literal it replaced is not quietly back beside it.
    if (site.gone !== null) {
      expect(withoutComments(source)).not.toContain(`t("${site.gone}")`);
    }
  });

  it("⚠️ leaves no hand-written stage name in either caption", () => {
    // The failure this is really for: a future edit that "simplifies" the
    // interpolation back into a literal. Romanian is the shipping locale, so
    // the tell is a stage name in Romanian sitting in a component — and the two
    // stage names these buttons could plausibly be given are the two below.
    for (const site of SITES) {
      // ⚠️ **COMMENTS STRIPPED FIRST, and `import-run-stage.test.ts` records
      // why the hard way: its first draft read a prop's prose — a sentence
      // ABOUT a call the caller makes — as code, and failed a component that
      // was entirely correct. Both of these files discuss Scanare and Evaluare
      // by name in their comments, and should; slicing from `return (` does not
      // exclude that (`folder-forecast.tsx`'s first `return (` is the `Row`
      // helper's, near the top), so the strip is what makes the slice mean what
      // it says.
      const jsx = withoutComments(
        fs.readFileSync(path.join(process.cwd(), site.file), "utf8"),
      );
      for (const label of ["Scanare", "Evaluare", "„Import”"]) {
        expect({ file: site.file, label, present: jsx.includes(label) }).toEqual({
          file: site.file,
          label,
          present: false,
        });
      }
    }
  });

  it("⚠️ names a phase the catalogue actually knows", () => {
    // The source scan above proves the SHAPE. This proves the argument: a
    // phase that is not in the machine returns `undefined` from
    // `STAGE_BY_PHASE`, and the caption then renders the raw key path
    // `adminImport.workflow.stage.undefined` on the button — in the shipping
    // locale, on the one control the screen has left.
    for (const site of SITES) {
      expect(IMPORT_PHASES).toContain(site.phase as ImportPhase);
      expect(IDS).toContain(stageForPhase(site.phase as ImportPhase));
    }
  });
});
