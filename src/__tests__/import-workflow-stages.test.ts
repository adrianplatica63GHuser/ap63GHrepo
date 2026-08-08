/**
 * Unit tests for src/lib/import/workflow-stages.ts   (Slice #26.03)
 *
 * The shell's whole value is that the indicator agrees with the screen. It can
 * disagree in three ways, and each of them is silent:
 *
 *  1. **A stage goes green that nothing did.** One of the ten stages has no
 *     screen until 26.08, and the flow walks straight past it. A positional
 *     "everything before the current one is done" would tick it — a system
 *     telling the user their files were checked against the archive when no
 *     code looked at them. That is the exact defect this repo recorded after
 *     #26.00: confident output never measured against a realistic input.
 *
 *     (It was four until #26.04 gave Structure its screen, #26.05 gave
 *     Constraints its own and #26.06 gave Duplication its own. Those three
 *     slices are the worked example of what `plannedIn` is for: one property
 *     deleted from one row of the catalogue, and the stage starts going amber
 *     and green.)
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
  phaseAfterFileChecks,
  WORKFLOW_LINE_IDS,
  WORKFLOW_STAGES,
  stageForPhase,
  stageStatuses,
  stagesOnLine,
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

  return { spreadPx: lengths[3] ?? 0, alpha: alphaOf(value) };
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
    // THE invariant of this slice. A planned stage is a promise about a later
    // slice; reporting the user as standing in one would make the indicator
    // point at a screen that does not exist.
    const reached = IMPORT_PHASES.map(stageForPhase);
    expect(reached.filter(planned)).toEqual([]);
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
    expect(stageForPhase("resumed")).toBe("result");
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

  it("has no phase for the stage 26.08 will build", () => {
    // The other half of "never land on a planned stage": the phases exist for
    // the stages that are built, and Pre-existing is not among them. #26.06's
    // brief ends at Duplication, and this pins that the next stage was not
    // faked by pointing an existing phase at an empty screen.
    //
    // ⚠️ Duplication left this list in #26.06 and the assertion was DELETED
    // rather than inverted: "reached.has('duplication') === true" is already
    // pinned, twice and more precisely, by the case above and by the
    // exhaustiveness test over IMPORT_PHASES.
    const reached = new Set(IMPORT_PHASES.map(stageForPhase));
    expect(reached.has("preexisting")).toBe(false);
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

  it("greens the whole first line during evaluation, and nothing on the second", () => {
    // The shape #26.06 produces, and the whole point of the slice: Evaluation
    // is unreachable except through a clean structure check, a clean
    // constraints check AND a clean duplication check, so all three are
    // genuinely done there. Duplication was `pending` on this exact vector one
    // slice ago; the line that changed is the slice.
    const statuses = stageStatuses("evaluation");
    expect(statuses.information).toBe("done");
    expect(statuses.preconditions).toBe("done");
    expect(statuses.structure).toBe("done");
    expect(statuses.constraints).toBe("done");
    expect(statuses.duplication).toBe("done");
    expect(statuses.evaluation).toBe("current");
    // Still grey, and it is the one left: being carried past a check is not
    // passing it, and nothing builds Pre-existing until 26.08.
    expect(statuses.preexisting).toBe("pending");
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
    // The stage with no screen stays grey even here — being carried past a
    // check is still not passing it.
    expect(statuses.preexisting).toBe("pending");
    // Structure, Constraints and Duplication are NOT among them any more:
    // #26.04, #26.05 and #26.06 built their screens, and a resumed run's folder
    // did go through all three.
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

  it("refuses to make a planned stage current even if asked to", () => {
    // `stageForPhase` cannot produce this, but a later caller could. The answer
    // is to under-claim: no pulse anywhere rather than a pulse on a stage with
    // nothing behind it.
    const statuses = stageStatuses("preexisting");
    expect(statuses.preexisting).toBe("pending");
    expect(IDS.filter((id) => statuses[id] === "current")).toEqual([]);
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

    // At rest: transparent. A visible ring at 0% makes the animation a DIP
    // rather than a beat, which is the cue this codebase retired.
    expect(rest.alpha).toBe(0);
    // At the peak: a real spread AND a real alpha. Either one at zero is a
    // halo nobody sees.
    expect(peak.spreadPx).toBeGreaterThan(0);
    expect(peak.alpha).toBeGreaterThan(0.3);

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
    expect(frozen.spreadPx).toBeGreaterThan(0);
    expect(frozen.alpha).toBeGreaterThan(0.3);
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
  it("sends a broken constraint to the constraints list, whatever was asked for", () => {
    for (const target of ["constraints", "duplication"] as const) {
      expect(
        phaseAfterFileChecks({ target, constraintsClean: false, duplicationClean: null }),
      ).toEqual({ phase: "constraints-report", duplicationRan: false });
    }
  });

  it("⚠️ never reports a match that did not run, even when the constraints passed", () => {
    // The `plannedIn` argument one layer down. A run that came for Duplication
    // and found a broken constraint has not looked for copies, and a run that
    // came only for the constraints has not either. In both the flag is false,
    // which is what keeps the panel showing its explanations rather than an
    // all-clear nobody earned.
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
  });

  it("stops a clean constraints run at the Duplication explanations", () => {
    // The stopping point the stage exists for: the user reads what a duplicate
    // is before being shown files to remove.
    expect(
      phaseAfterFileChecks({
        target: "constraints",
        constraintsClean: true,
        duplicationClean: null,
      }),
    ).toEqual({ phase: "duplication", duplicationRan: false });
  });

  it("sends a clean duplication check to the folder report", () => {
    expect(
      phaseAfterFileChecks({
        target: "duplication",
        constraintsClean: true,
        duplicationClean: true,
      }),
    ).toEqual({ phase: "folder-report", duplicationRan: true });
  });

  it("sends a failing duplication check to its own fix list", () => {
    expect(
      phaseAfterFileChecks({
        target: "duplication",
        constraintsClean: true,
        duplicationClean: false,
      }),
    ).toEqual({ phase: "duplication-report", duplicationRan: true });
  });

  it("⚠️ ignores a verdict it was handed against a target that did not ask for one", () => {
    // Defensive, and the reason is the caller's shape rather than paranoia:
    // `duplicationClean` and `target` are two expressions of one fact in
    // `runWalk`, and the failure mode if they ever disagree is the Duplication
    // stage going green off a verdict computed for a press that never happened.
    // The target is the authority.
    expect(
      phaseAfterFileChecks({
        target: "constraints",
        constraintsClean: true,
        duplicationClean: true,
      }),
    ).toEqual({ phase: "duplication", duplicationRan: false });
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
        expect(
          phaseAfterFileChecks({ target: "structure", constraintsClean, duplicationClean }),
        ).toEqual({ phase: "constraints", duplicationRan: false });
      }
    }
  });

  it("only ever names a phase the machine actually has", () => {
    for (const target of ["structure", "constraints", "duplication"] as const) {
      for (const constraintsClean of [true, false]) {
        for (const duplicationClean of [true, false, null]) {
          const { phase } = phaseAfterFileChecks({ target, constraintsClean, duplicationClean });
          expect(IMPORT_PHASES).toContain(phase);
        }
      }
    }
  });
});
