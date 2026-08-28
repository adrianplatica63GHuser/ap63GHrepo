/**
 * Unit tests for src/lib/import/constraint-check.ts   (Slice #26.05)
 *
 * This is the module that decides whether a folder may proceed, so the tests
 * that matter are the ones about REFUSING for the right reason and — more
 * importantly — about not passing for the wrong one.
 *
 * Three failures it is written against, all of them silent:
 *
 *  1. **A file that could not be read is treated as a file that is fine.**
 *     `readFileMetadata` omits what it could not open rather than guessing, so
 *     a constraint simply does not fire for it. That was harmless while these
 *     rules were advisory. It is the whole game now: silence at a blocking
 *     stage renders as a green tick.
 *
 *  2. **A file that was never going to be uploaded is measured anyway.** The
 *     metadata map deliberately covers DROPPED files, because CON-06 needs a
 *     `folder.jpg`'s size. Anything that iterated the map instead of the upload
 *     set would refuse an import over a 25 MB `.zip` the walk had already
 *     removed.
 *
 *  3. **The list reshuffles between two checks of an unchanged folder.** The
 *     user reads it once before a fix and once after; a list that reorders in
 *     between is unusable, and the enumeration order the walk observes in is
 *     not one this codebase controls.
 */

import {
  checkConstraints,
  checkConstraintsStage,
} from "@/lib/import/constraint-check";
import {
  CONSTRAINT_RULE_BY_ID,
  CONSTRAINT_RULE_IDS,
  MAX_UPLOAD_BYTES,
  THUMBNAIL_BYTES,
  type ConstraintViolation,
} from "@/lib/import/constraint-rules";
import type { FileMeta } from "@/lib/import/checks";
import type {
  DirectoryObservation,
  DroppedFile,
  FSEntry,
  FSFileHandle,
} from "@/lib/import/folder-utils";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const handle = (name: string): FSFileHandle => ({
  kind: "file",
  name,
  getFile: async () => new File([], name),
});

function file(path: string): FSEntry {
  const name = path.split("/").pop()!;
  return {
    kind: "file",
    name,
    path,
    pathParts: path.split("/").slice(0, -1),
    handle: handle(name),
  };
}

/** One multi-page document — one entry, many uploads, and the limit is per FILE. */
function pageGroup(path: string, pages: string[]): FSEntry {
  const parts = path.split("/");
  return {
    kind: "page-group",
    name: parts[parts.length - 1],
    path,
    pathParts: parts,
    handles: pages.map(handle),
    titleHint: parts[parts.length - 1],
  };
}

function obs(over: Partial<DirectoryObservation> = {}): DirectoryObservation {
  const pathParts = over.pathParts ?? [];
  return {
    path: over.path ?? pathParts.join("/"),
    pathParts,
    depth: over.depth ?? pathParts.length,
    keptNames: over.keptNames ?? [],
    dirNames: over.dirNames ?? [],
    dropped: over.dropped ?? [],
    becamePageGroup: over.becamePageGroup ?? false,
  };
}

function dropped(path: string): DroppedFile {
  const name = path.split("/").pop()!;
  return { name, path, reason: "system-file", handle: handle(name) };
}

const meta = (rows: [string, number, string][]) =>
  new Map<string, FileMeta>(rows.map(([p, size, type]) => [p, { size, type }]));

const JPEG = 5_000;

const ids = (violations: readonly ConstraintViolation[]) => violations.map((v) => v.ruleId);
const only = (violations: readonly ConstraintViolation[], id: string): ConstraintViolation => {
  const hit = violations.find((v) => v.ruleId === id);
  if (!hit) throw new Error(`expected a ${id}, got: ${ids(violations).join(", ") || "nothing"}`);
  return hit;
};

/**
 * A folder that satisfies every constraint — a loose PDF, a text note and a
 * two-page scanned document.
 *
 * Reused as the base for the "stays silent" cases, so a rule that starts firing
 * on good data fails several tests at once rather than none.
 */
const COMPLIANT = {
  entries: [
    file("48-50D/Extras CF.pdf"),
    file("48-50D/note.txt"),
    pageGroup("48-50D/Contract vanzare", ["1.jpg", "2.jpg"]),
  ],
  observations: [obs(), obs({ pathParts: ["48-50D"] })],
  metadata: meta([
    ["48-50D/Extras CF.pdf", 900_000, "application/pdf"],
    ["48-50D/note.txt", 400, "text/plain"],
    ["48-50D/Contract vanzare/1.jpg", JPEG, "image/jpeg"],
    ["48-50D/Contract vanzare/2.jpg", JPEG, "image/jpeg"],
  ]),
};

// ---------------------------------------------------------------------------
// The case that matters most
// ---------------------------------------------------------------------------

describe("a compliant folder", () => {
  it("produces no violations at all", () => {
    expect(checkConstraints(COMPLIANT)).toEqual([]);
  });

  it("passes the stage", () => {
    expect(checkConstraintsStage(COMPLIANT)).toEqual({
      violations: [],
      unreadable: [],
      clean: true,
    });
  });

  it("answers for an empty folder rather than throwing", () => {
    // No minimum is a constraint, exactly as #26.01 decided for Structure: an
    // empty folder breaks nothing, and the Evaluation screen that follows
    // already refuses to continue on a forecast of zero documents.
    expect(checkConstraintsStage({ entries: [], observations: [], metadata: new Map() }))
      .toEqual({ violations: [], unreadable: [], clean: true });
  });
});

// ---------------------------------------------------------------------------
// Each rule, on the file it is about
// ---------------------------------------------------------------------------

describe("the rules", () => {
  const one = (name: string, size: number, type: string) =>
    checkConstraints({
      entries: [file(name)],
      observations: [obs()],
      metadata: meta([[name, size, type]]),
    });

  it("CON-01 — a table export cannot be imported at all", () => {
    expect(ids(one("situatie.csv", 4_000, "text/csv"))).toEqual(["CON-01"]);
  });

  it("CON-02 — an iPhone photo uploads and is then read by nothing", () => {
    expect(ids(one("IMG_0421.heic", 2_000_000, ""))).toEqual(["CON-02"]);
  });

  it("CON-03 — an unrecognised file halts the whole run behind a question", () => {
    expect(ids(one("proiect.xyz", 4_000, ""))).toEqual(["CON-03"]);
  });

  it("CON-04 — an empty file", () => {
    expect(ids(one("1.jpg", 0, "image/jpeg"))).toEqual(["CON-04"]);
  });

  it("CON-05 — a file over the upload limit, with the limit in its own counts", () => {
    const v = only(one("1.jpg", MAX_UPLOAD_BYTES + 1, "image/jpeg"), "CON-05");
    expect(v.counts).toEqual({ files: 1, limitMb: 20 });
  });

  it("says nothing about a type Windows did not report", () => {
    // F-11 was drafted here and taken back out — it is a quiet finding in
    // `checks.ts`. `.tif` is the realistic carrier (Chromium falls through to
    // the Windows registry for it), and it must pass this stage.
    expect(one("Plan.tif", 400_000, "")).toEqual([]);
    expect(one("1.jpg", JPEG, "")).toEqual([]);
  });

  it("CON-06 — a real scan named folder.jpg, which the walk removed on sight", () => {
    const violations = checkConstraints({
      entries: [],
      observations: [obs({ pathParts: ["48-50D"], dropped: [dropped("48-50D/folder.jpg")] })],
      metadata: meta([["48-50D/folder.jpg", THUMBNAIL_BYTES + 1, "image/jpeg"]]),
    });
    expect(ids(violations)).toEqual(["CON-06"]);
    expect(only(violations, "CON-06").paths).toEqual(["48-50D/folder.jpg"]);
  });

  it("CON-06 — leaves a genuine Windows folder icon alone", () => {
    expect(
      checkConstraints({
        entries: [],
        observations: [obs({ dropped: [dropped("48-50D/folder.jpg")] })],
        metadata: meta([["48-50D/folder.jpg", 4_000, "image/jpeg"]]),
      }),
    ).toEqual([]);
  });

  it("⚠️ CON-06 — says nothing about a folder.jpg it could not size", () => {
    // `undefined` is not "small" and it is not "unreadable" either. The file is
    // not being imported whichever it is, and blocking here would stop an
    // import over a 4 KB folder icon the user cannot even see in Explorer.
    const input = {
      entries: [],
      observations: [obs({ dropped: [dropped("48-50D/folder.jpg")] })],
      metadata: new Map<string, FileMeta>(),
    };
    expect(checkConstraints(input)).toEqual([]);
    expect(checkConstraintsStage(input).clean).toBe(true);
  });

  it("gives one file ONE violation, however many rules it breaks", () => {
    // A `.heic` is also unrecognised, and the user must not be handed two
    // sentences about one photo. See `firstBrokenRule`.
    expect(ids(one("IMG_0421.heic", 0, ""))).toEqual(["CON-02"]);
  });

  it("groups every offending file under one sentence, not one sentence per file", () => {
    // ⚠️ The shape decision this catalogue makes, and the opposite of
    // `StructureViolation`'s: a constraint's remedy is uniform across the files
    // it names, so forty identical sentences would bury the instruction under
    // its own evidence.
    const names = Array.from({ length: 40 }, (_, i) => `Poze/IMG_${String(i).padStart(3, "0")}.heic`);
    const violations = checkConstraints({
      entries: names.map(file),
      observations: [obs()],
      metadata: meta(names.map((n) => [n, 2_000_000, ""] as [string, number, string])),
    });
    expect(violations).toHaveLength(1);
    const v = only(violations, "CON-02");
    expect(v.counts.files).toBe(40);
    // Complete, never a sample — the count in the sentence and the list under
    // it must agree, which is the defect that made the first downloadable
    // report misleading.
    expect(v.paths).toHaveLength(v.counts.files);
  });

  it("orders the violations by catalogue order, which is fixing order", () => {
    const entries = [file("a.csv"), file("b.heic"), file("c.xyz"), file("d.jpg"), file("e.jpg")];
    const violations = checkConstraints({
      entries,
      observations: [obs()],
      metadata: meta([
        ["a.csv", 100, "text/csv"],
        ["b.heic", 100, ""],
        ["c.xyz", 100, ""],
        ["d.jpg", 0, "image/jpeg"],
        ["e.jpg", MAX_UPLOAD_BYTES + 1, "image/jpeg"],
      ]),
    });
    expect(ids(violations)).toEqual(["CON-01", "CON-02", "CON-03", "CON-04", "CON-05"]);
  });
});

// ---------------------------------------------------------------------------
// What is measured, and what is not
// ---------------------------------------------------------------------------

describe("the upload set", () => {
  it("sizes every PAGE of a multi-page document, not just the document", () => {
    // A page group is one Document and many uploads, and the 20 MB cap is per
    // FILE — so a five-page scan with one enormous page must be reported.
    const violations = checkConstraints({
      entries: [pageGroup("48-50D/CVC", ["1.jpg", "2.jpg"])],
      observations: [obs()],
      metadata: meta([
        ["48-50D/CVC/1.jpg", JPEG, "image/jpeg"],
        ["48-50D/CVC/2.jpg", MAX_UPLOAD_BYTES + 1, "image/jpeg"],
      ]),
    });
    expect(only(violations, "CON-05").paths).toEqual(["48-50D/CVC/2.jpg"]);
  });

  it("reads a page's own NAME, not the group's", () => {
    // The metadata key is `<group path>/<page file>`, so a checker that used
    // the entry's `name` would ask its questions about the folder — and the
    // folder here is called `situatie.csv`, which is a legal folder name and a
    // forbidden file one.
    const violations = checkConstraints({
      entries: [pageGroup("48-50D/situatie.csv", ["1.jpg"])],
      observations: [obs()],
      metadata: meta([["48-50D/situatie.csv/1.jpg", JPEG, "image/jpeg"]]),
    });
    expect(violations).toEqual([]);
  });

  it("⚠️ says nothing about a file the walk already removed", () => {
    // The metadata map covers dropped files for CON-06's sake. A 25 MB archive
    // the walk dropped is not "a file that will fail to upload" — nothing was
    // ever going to upload it — and refusing the import over one would send the
    // user to fix a file that does not matter.
    const input = {
      entries: [file("48-50D/scan.jpg")],
      observations: [obs({ pathParts: ["48-50D"], dropped: [dropped("48-50D/arhiva.zip")] })],
      metadata: meta([
        ["48-50D/scan.jpg", JPEG, "image/jpeg"],
        ["48-50D/arhiva.zip", MAX_UPLOAD_BYTES + 1, ""],
      ]),
    };
    expect(checkConstraints(input)).toEqual([]);
    expect(checkConstraintsStage(input).clean).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// "We could not look" is not "it is fine"
// ---------------------------------------------------------------------------

describe("files that could not be read", () => {
  it("REFUSES the folder, even with no violations at all", () => {
    // THE reason `checkConstraintsStage` exists on top of `checkConstraints`.
    const verdict = checkConstraintsStage({
      entries: [file("a.jpg"), file("b.jpg")],
      observations: [obs()],
      metadata: meta([["a.jpg", JPEG, "image/jpeg"]]),
    });
    expect(verdict.violations).toEqual([]);
    expect(verdict.unreadable).toEqual(["b.jpg"]);
    expect(verdict.clean).toBe(false);
  });

  it("reports the violations AND the unreadable files, never one instead of the other", () => {
    const verdict = checkConstraintsStage({
      entries: [file("tabel.csv"), file("b.jpg")],
      observations: [obs()],
      metadata: meta([["tabel.csv", 100, "text/csv"]]),
    });
    expect(ids(verdict.violations)).toEqual(["CON-01"]);
    expect(verdict.unreadable).toEqual(["b.jpg"]);
    expect(verdict.clean).toBe(false);
  });

  it("⚠️ still answers the NAME rules for a file it could not open", () => {
    // The first draft skipped a file with no metadata entirely, so a `.csv`
    // locked by Excel was reported as "we could not open this — close the
    // program using it". The user closes Excel, presses Verifică din nou, and
    // only then learns the real answer: this is a table and it has to leave the
    // folder. A whole round of the loop spent on a diagnosis that was never the
    // problem — and unboundedly many if the lock never clears.
    const verdict = checkConstraintsStage({
      entries: [file("tabel.csv"), file("IMG_1.heic"), file("b.jpg")],
      observations: [obs()],
      metadata: new Map(),
    });
    expect(ids(verdict.violations)).toEqual(["CON-01", "CON-02"]);
    // …and the two files a rule already names are NOT repeated in the
    // unreadable list, which would hand the user two contradictory sentences
    // about one file.
    expect(verdict.unreadable).toEqual(["b.jpg"]);
    expect(verdict.clean).toBe(false);
  });

  it("treats a pass that read nothing as every file unreadable, not as a clean folder", () => {
    // The wizard hands over an EMPTY map when the metadata pass throws — never
    // `null`, which the panel reads as "not checked yet". Before #26.05 that
    // failure degraded an advisory report and was the right call; at a blocking
    // stage it has to arrive as a measurable fact.
    // Lowercase names throughout: the display order is `localeCompare`, which
    // is case-insensitive, so a fixture mixing "CVC" and "a.jpg" would be
    // asserting a collation rule rather than this module's behaviour.
    const verdict = checkConstraintsStage({
      entries: [file("a.jpg"), pageGroup("cvc", ["1.jpg", "2.jpg"])],
      observations: [obs()],
      metadata: new Map(),
    });
    expect(verdict.violations).toEqual([]);
    expect(verdict.unreadable).toEqual(["a.jpg", "cvc/1.jpg", "cvc/2.jpg"]);
    expect(verdict.clean).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// The same folder, checked twice
// ---------------------------------------------------------------------------

describe("determinism", () => {
  // ⚠️ THE SAME FOLDER, ENUMERATED IN THE OPPOSITE ORDER. Feeding the same
  // literal array twice proves only that the module is pure, which any
  // implementation is. `walkFolder` observes and emits in whatever order the
  // filesystem produced, and reversing is the cheapest fixture for that.
  const rows: [string, number, string][] = [
    ["Poze/b.heic", 100, ""],
    ["Poze/a.heic", 100, ""],
    ["Poze/c.heic", 100, ""],
    ["x.jpg", 0, "image/jpeg"],
  ];
  const build = (order: "asIs" | "reversed") => {
    const put = order === "asIs" ? rows : [...rows].reverse();
    return {
      entries: put.map(([p]) => file(p)),
      observations: [obs()],
      metadata: meta(put),
    };
  };

  it("produces an identical list whichever order the folder was enumerated in", () => {
    expect(checkConstraints(build("reversed"))).toEqual(checkConstraints(build("asIs")));
  });

  it("sorts the files inside a violation", () => {
    for (const order of ["asIs", "reversed"] as const) {
      expect(only(checkConstraints(build(order)), "CON-02").paths).toEqual([
        "Poze/a.heic",
        "Poze/b.heic",
        "Poze/c.heic",
      ]);
    }
  });

  it("sorts the unreadable list too", () => {
    const verdict = checkConstraintsStage({
      entries: [file("z.jpg"), file("a.jpg"), file("m.jpg")],
      observations: [obs()],
      metadata: new Map(),
    });
    expect(verdict.unreadable).toEqual(["a.jpg", "m.jpg", "z.jpg"]);
  });
});

describe("a folder at the walk's own ceiling", () => {
  /**
   * ⚠️ **A GUARD AGAINST THE ALGORITHM COMING BACK, AND SINCE #32.04 IT
   * MEASURES THE ALGORITHM RATHER THAN THE CLOCK.**
   *
   * The defect it exists for: the first draft rebuilt the path array per file
   * (`byRule.set(id, [...(byRule.get(id) ?? []), path])`), which is quadratic in
   * the number of files breaking ONE rule. #26.05's adversarial review clocked
   * it at 3.1 s for 20,000 files and 21 s at `MAX_WALK_ENTRIES` —
   * synchronously, on the UI thread, with no progress cue left moving.
   * `checkConstraints`' `add` carries the comment that records the fix.
   *
   * ⚠️ **IT USED TO BE `expect(elapsed).toBeLessThan(400)`, AND THAT NUMBER
   * COULD NOT SURVIVE LEAVING THE MACHINE IT WAS MEASURED ON.** Calibrated at
   * 30–44 ms for the shipped version on one sandbox, against 2477–2731 ms for
   * the quadratic one — a ruling about a RATIO, written down as a wall-clock
   * constant. On Adrian's Windows box the same shipped code runs it at 450–530
   * ms under jest's transformed CommonJS, so it failed two verification runs in
   * three while the algorithm was entirely correct. A guard that cries wolf is
   * one a reader learns to re-run rather than read, which is worse than no
   * guard: the run it is finally right about looks exactly like the four
   * before it.
   *
   * ⚠️ **AND RAISING THE NUMBER WOULD HAVE BEEN THE SAME MISTAKE AGAIN.** The
   * comment this replaces already recorded that trap from the other side — 1500
   * ms left the quadratic version only 1.7× of headroom, so an ordinary desktop
   * ran the BUG inside the bound and reported the regression as fixed. Any
   * constant is a bet on the hardware, the Node version and what else is
   * running; all three changed between the calibration and this rewrite.
   *
   * So it measures what it always meant: **how the cost grows with the number
   * of files.** Both measurements happen on the same machine in the same run,
   * so the hardware cancels out. Measured by rebuilding the #26.05 defect
   * against the real module and running both:
   *
   *     shipped      10k → 11.8 ms   20k → 23.7 ms   ratio 2.01
   *     quadratic    10k → 140.6 ms  20k → 1937.3 ms ratio 13.78
   *
   * ⚠️ **AND THE BOUND OF 3 IS ARGUED FROM THE ALGORITHM, NOT FROM THOSE
   * MEASUREMENTS — the two sides of it are not equally strong, and the weaker
   * one is the one that matters.**
   *
   * The SHIPPED side is provable. `checkConstraints` is `uploadKeysOf` (Θ(n)),
   * a per-file rule loop (Θ(n)) and `sortedForDisplay` (Θ(n log n)); the CON-06
   * pass is O(1) here because `obs()` carries no `dropped`. So doubling n has a
   * hard ceiling of `2·log(20000)/log(10000)` = **2.151**, and that is reached
   * only if sorting were 100% of the cost. Every row of the table below is
   * under its own ceiling. A bound of 3 therefore sits **1.40× above what the
   * algorithm can produce at all** — a property of the algorithm rather than of
   * the hardware, since no correct implementation can produce more. A machine
   * can still inflate a MEASUREMENT past it, which is what the flake paragraph
   * below is about; it would take 46% on the large minimum with the small
   * minimum clean (39%, if measured against the 2.151 ceiling rather than
   * against the 2.05 observed), on all three interleaved reps.
   *
   * The DEFECT side has no such property, and the comment here used to claim it
   * did. Model the defect as `L·n·log n + Q·n²` with `q` the quadratic share at
   * the small size — `L·n·log n` standing for the WHOLE non-quadratic part,
   * including the two Θ(n) terms named above; treating that part as Θ(n)
   * instead gives `2 + 2q`, a floor of 3.83 and `q ≥ 0.50`, which changes
   * nothing. The ratio is `2.15 + 1.85q`, so the guard needs `q ≥ 0.46`.
   * That is a statement about how expensive array copying is relative to ICU
   * collation ON A GIVEN MACHINE, not about the sizes alone. At 10k/20k the
   * measurements above give q ≈ 0.92 and a MODELLED ratio of **3.85**; the
   * 12–14 actually observed is that plus GC and allocation amplification, which
   * is heap-, Node- and machine-dependent. So the honest margin against a false
   * pass is 3.85 against 3 — 1.28× — and the copying would have to become ~13×
   * cheaper relative to the collator before the guard went blind. (`Q/N` is
   * 10.92 today against 0.85 at the threshold.)
   *
   * ⚠️ **DO NOT SHRINK THE TWO SIZES TO MAKE THIS FASTER — AND NOT BECAUSE
   * SMALLER IS UNIFORMLY WORSE, WHICH IS THE READING THE NUMBERS REFUSE.**
   * Measured on the same two implementations, same warm-up, same interleave:
   *
   *     sizes          shipped ratio   quadratic ratio
   *     2 500/5 000        2.03             4.56
   *     5 000/10 000       2.11             3.35   ← 0.35 above the bound
   *     10 000/20 000      2.05            12.75
   *
   * (The headline pair further up reads 13.78 for the same configuration on a
   * different run — the defect's ratio moves with GC, which is the point made
   * above and the reason no margin is claimed from it.)
   *
   * ⚠️ **THE DEFECT'S RATIO IS NOT MONOTONE IN SIZE.** The middle row is the
   * worst of the three, not the smallest one: halving the folders would cut the
   * runtime by more than half (n log n puts 5k/10k at 0.46 of 10k/20k) and land
   * on **3.35**, a rounding error above the bound — while quartering them lands
   * on 4.56, which is safer again. Two effects fight: `q` rises with n, and GC
   * and allocation amplification switch on above some heap size. The model says
   * so out loud — the implied `q` for the outer rows is 1.30 and 5.73, both
   * impossible since `q ≤ 1` — so at both ends the ratio is dominated by
   * amplification rather than by the quadratic share, and 5k/10k is simply the
   * one regime where amplification has not started yet.
   *
   * So the rule is not "bigger is safer". It is that **you cannot predict which
   * regime a new pair lands in without measuring both implementations again**,
   * and 10 000/20 000 is chosen because it is measured, and far from the worst
   * row. A future slice that wants this faster has to redo the table, not
   * reason about it.
   *
   * ⚠️ **THE WARM-UP IS LOAD-BEARING, AND THE FIRST DRAFT OF THIS REWRITE HAD
   * IT WRONG.** Timing the small folder first and the large one second
   * measured the JIT as much as the algorithm: the small run paid for the
   * compilation and the large run inherited it, giving **ratio 0.8** — the
   * large folder apparently cheaper than half of itself. That biases toward
   * PASSING, which is the dangerous direction: the same bias would deflate a
   * quadratic ratio too. So both sizes are run once untimed before anything is
   * measured, and the timed runs interleave.
   *
   * ⚠️ Costs about 3 s on Adrian's machine — eight calls where the old form
   * made one — against the 0.45 s the single wall-clock run cost. That is the
   * price of a guard that means the same thing on every machine, and of the two
   * sizes the table above says it has to keep. It is paid once per suite.
   *
   * ⚠️ **IF IT EVER FLAKES, THE KNOB IS THE REP COUNT, AND THE FLAKE WILL COME
   * FROM THE FASTEST MACHINE RATHER THAN THE SLOWEST — the opposite of the
   * bound it replaces.** At 11.8/23.7 ms one major GC pause is ~+11.7 ms, which
   * is the whole distance to a ratio of 3; it would have to land on all three
   * large reps with all three small reps clean, which is what interleaving
   * makes unlikely rather than systematic. On a slower box the same threshold
   * is +230 ms per rep and the margin is far wider. Five reps instead of three
   * costs four more calls; do that if a flake actually appears, rather than
   * moving the bound.
   *
   * ⚠️ `performance.now()` under **jsdom**, which is this suite's environment
   * (`jest.config.ts`; no `@jest-environment` docblock here) and the repo's only
   * use of it in a test. Checked rather than assumed: jsdom 26.1.0's
   * `Performance-impl.js` is `now() { return performance.now() -
   * this._nowAtTimeOrigin; }` — a direct delegation to Node's high-resolution
   * clock, with no clamping and no rounding. A reader who adds
   * `@jest-environment node` or upgrades jsdom has no other way to know that
   * was verified.
   */

  /** The smaller folder, and its double. The larger is the walk's own ceiling. */
  const SMALL = 10_000;
  const LARGE = 20_000;

  function inputFor(fileCount: number) {
    const names = Array.from({ length: fileCount }, (_, i) => `Poze/IMG_${i}.heic`);
    return {
      entries: names.map(file),
      observations: [obs()],
      metadata: meta(names.map((n) => [n, 2_000, ""] as [string, number, string])),
    };
  }

  it("⚠️ grows with the folder, not with the folder squared", () => {
    const smallInput = inputFor(SMALL);
    const largeInput = inputFor(LARGE);

    // The warm-up, and the correctness assertion in the same breath: a run that
    // quietly stopped finding anything would otherwise be free to be the
    // fastest one in the sample.
    expect(checkConstraints(smallInput)[0].counts.files).toBe(SMALL);
    expect(checkConstraints(largeInput)[0].counts.files).toBe(LARGE);

    /**
     * The best of three, interleaved, not the mean.
     *
     * Noise on a benchmark is one-sided — a GC pause, a scheduler slice or a
     * background process can only ever ADD time — so the minimum is the closest
     * estimate of what the code costs, and it is what makes a ratio stable
     * enough to assert on. Interleaving is what stops a slow patch of the
     * machine landing entirely on one of the two sizes.
     *
     * `performance.now()` and not `Date.now()`: the millisecond one would need
     * a resolution floor, because on a machine fast enough for the small folder
     * to land in a few whole milliseconds integer rounding alone can produce
     * any ratio at all, a passing one over a quadratic implementation included.
     */
    const smallRuns: number[] = [];
    const largeRuns: number[] = [];
    for (let i = 0; i < 3; i++) {
      let started = performance.now();
      checkConstraints(smallInput);
      smallRuns.push(performance.now() - started);

      started = performance.now();
      checkConstraints(largeInput);
      largeRuns.push(performance.now() - started);
    }
    const small = Math.min(...smallRuns);
    const large = Math.min(...largeRuns);
    const ratio = large / small;

    // ⚠️ Written as an object comparison rather than `expect(ratio)
    // .toBeLessThan(3)` so a failure prints BOTH measurements: "3.4 is not less
    // than 3" tells the next reader nothing about which half of the fraction
    // moved, and that is the first thing they will need to know. `small`,
    // `large` and `ratio` sit on both sides deliberately — they assert nothing
    // and exist to be printed.
    //
    // ⚠️ **`measured` IS NOT DECORATION, AND IT CLOSES A VACUOUS PASS.** With
    // both measurements at 0, `ratio` is `NaN`, `NaN >= 3` is `false`, and
    // jest's `toEqual` compares `NaN` equal to `NaN` — so every field would
    // match and this test would go green over a quadratic implementation.
    // Nothing produces that today: there are no fake timers anywhere in
    // `src/__tests__` and `jest.setup.ts` loads only `@testing-library/jest-dom`.
    // But jest 30's modern fake timers DO fake `performance.now()`, so an
    // ordinary repo-wide `fakeTimers: { enableGlobally: true }` would silently
    // disarm this one test while every suite stayed green.
    //
    // ⚠️ **`unusablySlow` IS A CATASTROPHE DETECTOR, NOT A PERFORMANCE BOUND,
    // and it does NOT exist for the quadratic version** — that one's ratio is
    // 12–14 and `growsQuadratically` fails on it several times over. What it
    // covers is the case the fraction cannot see: a uniform per-file cost added
    // inside the loop, which slows both sizes in the same proportion and leaves
    // the ratio untouched. It is deliberately blunt — on Adrian's box `large`
    // is ~500 ms, so it only fires on a ≥10× uniform slowdown and a 5× one
    // passes — because it is a wall-clock constant and therefore the one part
    // of this test that a slow enough machine could trip on correct code. Blunt
    // is the safe direction for it; tightening it would rebuild the guard this
    // slice replaced.
    expect({
      small: Math.round(small),
      large: Math.round(large),
      ratio: Number(ratio.toFixed(2)),
      measured: small > 0,
      growsQuadratically: ratio >= 3,
      unusablySlow: large >= 5_000,
    }).toEqual({
      small: Math.round(small),
      large: Math.round(large),
      ratio: Number(ratio.toFixed(2)),
      measured: true,
      growsQuadratically: false,
      unusablySlow: false,
    });
  });
});

// ---------------------------------------------------------------------------
// The guards — what a future rule cannot get wrong quietly
// ---------------------------------------------------------------------------

/** One folder that breaks every rule in the catalogue at once. */
const EVERY_VIOLATION = checkConstraints({
  entries: [
    file("situatie.csv"),
    file("IMG_1.heic"),
    file("proiect.xyz"),
    file("gol.jpg"),
    file("urias.jpg"),
  ],
  observations: [obs({ dropped: [dropped("folder.jpg")] })],
  metadata: meta([
    ["situatie.csv", 100, "text/csv"],
    ["IMG_1.heic", 100, ""],
    ["proiect.xyz", 100, ""],
    ["gol.jpg", 0, "image/jpeg"],
    ["urias.jpg", MAX_UPLOAD_BYTES + 1, "image/jpeg"],
    ["folder.jpg", THUMBNAIL_BYTES + 1, "image/jpeg"],
  ]),
});

describe("every rule in the catalogue", () => {
  it("is reachable — no rule was declared and then never emitted", () => {
    // The failure this catches: a rule added to the catalogue, given Romanian
    // text, and never wired into the checker. It would render on the printed
    // listing as a promise the check does not keep.
    expect(ids(EVERY_VIOLATION)).toEqual([...CONSTRAINT_RULE_IDS]);
  });

  it("carries exactly the counts its sentence declares", () => {
    // A violation missing one renders the placeholder verbatim to a Romanian
    // user — or throws inside the screen that exists to explain what is wrong —
    // and nothing else type-checks this.
    for (const v of EVERY_VIOLATION) {
      const rule = CONSTRAINT_RULE_BY_ID.get(v.ruleId)!;
      expect({ id: v.ruleId, counts: Object.keys(v.counts).sort() })
        .toEqual({ id: v.ruleId, counts: [...rule.counts].sort() });
    }
  });

  it("carries at least one real path, and a count that agrees with it", () => {
    for (const v of EVERY_VIOLATION) {
      expect(v.paths.length).toBeGreaterThan(0);
      expect(v.counts.files).toBe(v.paths.length);
      for (const p of v.paths) {
        expect(p.length).toBeGreaterThan(0);
        expect(p.startsWith("/")).toBe(false);
        expect(p.endsWith("/")).toBe(false);
      }
    }
  });

  it("returns exactly what the stage reports, unreduced and unreordered", () => {
    // The verdict must not become a second opinion about the violations. If it
    // ever filtered or re-sorted them, the screen and the saved page would
    // disagree with every test in this file.
    const input = {
      entries: [file("situatie.csv"), file("gol.jpg")],
      observations: [obs()],
      metadata: meta([["situatie.csv", 100, "text/csv"], ["gol.jpg", 0, "image/jpeg"]]),
    };
    expect(checkConstraintsStage(input).violations).toEqual(checkConstraints(input));
  });
});
