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
  it("finishes without the quadratic accumulation the first draft had", () => {
    // ⚠️ Measured, not reasoned. The first draft rebuilt the path array per
    // file (`[...(get() ?? []), path]`), which is quadratic in the number of
    // files breaking ONE rule: the slice's adversarial review clocked 3.1 s at
    // 20,000 files and 21 s at `MAX_WALK_ENTRIES` — synchronously, on the UI
    // thread, with no progress cue left moving.
    //
    // ⚠️ The threshold is chosen from the FIX's runtime, not the defect's, and
    // the first draft got that backwards: 1500 ms left the quadratic version
    // only 1.7× of headroom, so an ordinary desktop would have run the bug in
    // under the bound and reported the regression as fixed.
    //
    // ⚠️ AND IT HAS TO BE RE-MEASURED WHEN THE COMPARATOR CHANGES, which is not
    // hypothetical — it happened inside this slice. `compareForDisplay` gained
    // `{ numeric: true }` in the same round this bound was tightened, and the
    // three-argument `localeCompare` builds an `Intl.Collator` per comparison:
    // the linear implementation went from 29–56 ms to 138–192 ms, leaving 2.1×
    // rather than the headroom the comment claimed. Hoisting the collator
    // (`folder-utils.ts`) put it back. Numbers on the review sandbox, in order:
    // linear 30–44 ms, linear with a per-call collator 138–192 ms, quadratic
    // 2477–2731 ms. 400 ms is ~10× for the shipped version on a loaded box and
    // unreachable by the quadratic one on hardware six times faster.
    //
    // It is a guard against the ALGORITHM coming back, not a benchmark.
    const names = Array.from({ length: 20_000 }, (_, i) => `Poze/IMG_${i}.heic`);
    const input = {
      entries: names.map(file),
      observations: [obs()],
      metadata: meta(names.map((n) => [n, 2_000, ""] as [string, number, string])),
    };
    const started = Date.now();
    const violations = checkConstraints(input);
    expect(Date.now() - started).toBeLessThan(400);
    expect(violations[0].counts.files).toBe(20_000);
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
