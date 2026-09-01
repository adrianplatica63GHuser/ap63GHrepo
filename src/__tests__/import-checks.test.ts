/**
 * Unit tests for src/lib/import/checks.ts   (Slice #24.02b, trimmed by #26.02 and #26.05)
 *
 * The report's whole value is that a user believes it, so the tests that
 * matter are the ones pinning what a finding CLAIMS: that its counts and its
 * path list agree, and that a rule stays silent on a folder behaving as
 * intended. A checker that shouts at everything is the same as no checker.
 *
 * ⚠️ **What #26.02 removed from this file, and why nothing replaced it here.**
 * Two describe blocks are gone — the near-miss classification (S-03, S-04,
 * S-05, S-07) and the page-order hazards (S-09, S-10) — along with the S-16
 * duplicate-archive block. Those rules now live as STR-01 and STR-10 … STR-14
 * in `structure-rules.ts`, and their tests as
 * `src/__tests__/import-structure-check.test.ts`. They did not merely move:
 * each was an ADVISORY guess about a folder shape nobody had agreed on, and
 * each is now a rule that blocks until the folder complies. A test asserting
 * "this is loud" would be testing the wrong contract.
 *
 * ⚠️ **And what #26.05 removed, for the same reason one stage later.** F-08,
 * F-09 and F-02 from the T1 block, and two of the file rules (F-05, F-07), are
 * now CON-01 … CON-06 in `constraint-rules.ts`, tested in
 * `import-constraint-check.test.ts`.
 *
 * F-11 was in that list and came back, which is the case worth a test rather
 * than a comment: a constraint blocks, and a file whose type Windows does not
 * report is stored, served and merely never auto-extracted — F-17's situation
 * exactly. It is quiet here now, and there is a test below that it did not
 * follow the others.
 *
 * That is also why the loud/quiet cases went with them. The split was measured
 * on the three near-miss rules; with them gone only F-11 and F-17 are quiet,
 * so the one surviving loudness test asserts the ORDER (loud before quiet)
 * rather than where the line sits — it had to be rewritten in #26.05, because
 * the loud finding it used to sort against was F-08, and again in #26.06, which
 * deleted F-15.
 *
 * Cross-checked against the real archive by running this module over
 * C:\dev\TEST.DATA. One aggregate count reproduces the spec's independent
 * measurement in PRE-IMPORT-RULES.md §6 exactly — 67 Office files (F-17). The
 * other, 8 irregular page groups, measured S-10 and went with it.
 *
 * The spec's third number, "15 gate files", never reproduced — it counted 0
 * from #24.04 onwards, once `.dwg/.bak/.zip/.lnk/.dwl/.dwl2` became the
 * `"ignored"` kind and the walk started removing those exact 15 files before
 * `entries` existed. They appear in the Skipped section instead. The rule that
 * counted them is CON-03 now, and it fires only for extensions the registry has
 * never heard of.
 */

import { checkFolder, type FileMeta } from "@/lib/import/checks";
import type { DirectoryObservation, DroppedFile, FSEntry } from "@/lib/import/folder-utils";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function obs(over: Partial<DirectoryObservation> = {}): DirectoryObservation {
  const pathParts = over.pathParts ?? ["Acte"];
  return {
    path: over.path ?? pathParts.join("/"),
    pathParts,
    depth: over.depth ?? pathParts.length,
    keptNames: over.keptNames ?? [],
    dirNames: over.dirNames ?? [],
    dropped: over.dropped ?? [],
    becamePageGroup: over.becamePageGroup ?? false,
    // Spread rather than defaulted: `truncated` is ABSENT on a normal
    // observation, and a fixture setting it to `undefined` explicitly would
    // still satisfy `"truncated" in obs`.
    ...(over.truncated === undefined ? {} : { truncated: over.truncated }),
  };
}

function file(path: string): FSEntry {
  const name = path.split("/").pop()!;
  return {
    kind: "file",
    name,
    path,
    pathParts: path.split("/").slice(0, -1),
    handle: { kind: "file", name, getFile: async () => new File([], name) },
  };
}

/** T1 metadata, keyed the way `metadataKeyFor` keys it. */
const meta = (entries: [string, number, string][]) =>
  new Map<string, FileMeta>(entries.map(([p, size, type]) => [p, { size, type }]));

function dropped(path: string, reason: DroppedFile["reason"]): DroppedFile {
  const name = path.split("/").pop()!;
  return {
    name,
    path,
    reason,
    handle: { kind: "file", name, getFile: async () => new File([], name) },
  };
}

function run(input: {
  entries?: FSEntry[];
  observations?: DirectoryObservation[];
  metadata?: Map<string, FileMeta>;
}) {
  return checkFolder({
    entries: input.entries ?? [],
    observations: input.observations ?? [],
    metadata: input.metadata,
  });
}

const kinds = (r: ReturnType<typeof run>) => r.findings.map((f) => f.kind);
const find = (r: ReturnType<typeof run>, kind: string) =>
  r.findings.find((f) => f.kind === kind);

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe("multi-property root (S-01, retired)", () => {
  // S-01 warned that every document in the picked folder would be merged into
  // one Property. #26.07 made that false — one Property per property
  // subfolder — and it was finally retired rather than reworded, because the
  // shape it detected is now the intended one. These two tests are the guard
  // against it coming back: STR-02 permits five property folders, and five
  // must be silent here.
  it("stays silent for a root full of property-shaped folders", () => {
    const r = run({
      observations: [
        obs({ pathParts: [], path: "", depth: 0, dirNames: ["10-38per3", "47per2-225", "58-253per1", "46-222", "48-50"] }),
      ],
    });
    expect(kinds(r)).not.toContain("multipleProperties");
  });

  it("stays silent for ordinary named subfolders", () => {
    const r = run({
      observations: [obs({ pathParts: [], path: "", depth: 0, dirNames: ["Acte", "Planuri"] })],
    });
    expect(kinds(r)).not.toContain("multipleProperties");
  });
});

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

describe("file findings", () => {
  it("⚠️ says NOTHING about two files sharing a name, since #26.06", () => {
    // F-15 lived here from #24.02b until #26.06 moved the question to the
    // Duplication stage, which blocks and matches on name AND size. This is
    // the negative half of that move, and it is worth a test because the
    // failure it guards is silent: a report that quietly grew the finding back
    // would put an advisory sentence about copies on the Evaluation screen,
    // one stage AFTER a blocking stage has already refused every folder that
    // holds any — advice about a state the user cannot be in.
    //
    // The paths below share a name and would have been F-15; nothing here may
    // mention them.
    const r = run({ entries: [file("A/fisa.jpg"), file("B/fisa.jpg"), file("C/alt.jpg")] });
    expect(kinds(r)).toEqual([]);
  });

  it("keeps the Office note ADVISORY, and says nothing about a plain text file", () => {
    // ⚠️ THE decision #26.05 made about this file. Every other file rule became
    // a blocking constraint; this one did not, because an Office file imports
    // faithfully — it is stored and downloadable, and only its TEXT is
    // unreadable. A blocking version would tell a business user to delete every
    // Word document in their archive before importing anything.
    const r = run({ entries: [file("nota.docx"), file("contacte.txt"), file("acte.pdf")] });
    const f = find(r, "officeFiles")!;
    expect(f.loudness).toBe("quiet");
    expect(f.paths).toEqual(["nota.docx"]);
  });

  it("no longer speaks for the rules that became constraints", () => {
    // The other half of #26.02's warning about drift, applied to #26.05: a rule
    // that moved must STOP answering here, or the user meets the same file
    // twice — once as a blocking constraint at the Constraints stage and once
    // as advice on the Evaluation screen it has already passed.
    const r = run({
      entries: [file("a.xyz"), file("IMG_1.heic"), file("big.jpg"), file("gol.jpg")],
      metadata: meta([
        ["a.xyz", 100, "application/octet-stream"],
        ["IMG_1.heic", 100, "application/octet-stream"],
        ["big.jpg", 40 * 1024 * 1024, "image/jpeg"],
        ["gol.jpg", 0, "image/jpeg"],
      ]),
      observations: [obs({ dropped: [dropped("Acte/folder.jpg", "system-file")] })],
    });
    expect(kinds(r)).toEqual(
      expect.not.arrayContaining([
        "gateFiles",
        "heicFiles",
        "oversizedFiles",
        "emptyFiles",
        "largeFolderJpg",
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// T1 — what is left of it
// ---------------------------------------------------------------------------

describe("F-11 — the one T1 rule that stayed", () => {
  it("reports a file whose type Windows did not give, QUIETLY", () => {
    // ⚠️ `.tif` and not `.jpg`, and the difference is the whole reason this
    // rule is not a constraint. `File.type` comes from the extension by way of
    // the OS registry — Chromium hard-codes `.jpg`, and falls through to the
    // registry for `.tif`/`.bmp`. A `.jpg` with an empty type is a state the
    // browser does not produce, so a test built on one proves nothing; a `.tif`
    // on a machine with no registry entry is the case that actually happens,
    // and it is a perfectly good archival scan that must NOT block an import.
    const f = find(run({
      entries: [file("Plan.tif")],
      metadata: meta([["Plan.tif", 400_000, ""]]),
    }), "unknownMimeFiles")!;
    expect(f.loudness).toBe("quiet");
    expect(f.counts).toMatchObject({ files: 1 });
    expect(f.paths).toEqual(["Plan.tif"]);
  });

  it("ignores an empty type on a file nothing would have read anyway", () => {
    // It only matters because it disables automatic extraction. A Word file was
    // never going to be extracted, so reporting it would be noise.
    const r = run({ entries: [file("nota.docx")], metadata: meta([["nota.docx", 900, ""]]) });
    expect(kinds(r)).not.toContain("unknownMimeFiles");
  });

  it("says nothing about a dropped file, which nothing was going to read", () => {
    // The metadata map covers dropped files because CON-06 needs a
    // `folder.jpg`'s size. A rule that iterated the map instead of the upload
    // set would argue about an import that is not going to happen.
    const r = run({
      observations: [obs({ dropped: [dropped("Acte/folder.jpg", "system-file")] })],
      metadata: meta([["Acte/folder.jpg", 400_000, ""]]),
    });
    expect(kinds(r)).not.toContain("unknownMimeFiles");
  });
});

describe("uploadBytes", () => {
  it("sums every file the run will upload", () => {
    const r = run({
      entries: [file("a.jpg"), file("b.jpg")],
      metadata: meta([["a.jpg", 1000, "image/jpeg"], ["b.jpg", 2500, "image/jpeg"]]),
    });
    expect(r.uploadBytes).toBe(3500);
  });

  it("ignores a dropped file, which nothing is going to upload", () => {
    // The metadata map deliberately covers dropped files — CON-06 needs a
    // `folder.jpg`'s size — so the sum has to restrict itself to the upload
    // set or it overstates the total. Measured on Adrian's archive: 27 of 759
    // sized files are drops, worth 11.3 MB.
    const r = run({
      entries: [file("a.jpg")],
      observations: [obs({ dropped: [dropped("Acte/plan.dwg", "ignored-extension")] })],
      metadata: meta([["a.jpg", 1000, "image/jpeg"], ["Acte/plan.dwg", 999_000, ""]]),
    });
    expect(r.uploadBytes).toBe(1000);
  });

  it("is null when the metadata pass has not run", () => {
    // Since #26.05 that is the normal state of this report until the
    // Constraints stage has been through: nothing else here reads a size.
    expect(run({ entries: [file("big.jpg")] }).uploadBytes).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Skipped
// ---------------------------------------------------------------------------

describe("skipped files", () => {
  it("groups by reason, most surprising first", () => {
    // A file the user deliberately put there outranks one they never see.
    const r = run({
      observations: [
        obs({
          dropped: [
            dropped("a/.DS_Store", "hidden"),
            dropped("a/Thumbs.db", "system-file"),
            dropped("a/plan.dwg", "ignored-extension"),
          ],
        }),
      ],
    });
    expect(r.skipped.map((g) => g.reason)).toEqual(["ignored-extension", "system-file", "hidden"]);
    expect(r.droppedCount).toBe(3);
  });

  it("reports nothing skipped for a clean folder", () => {
    expect(run({ observations: [obs()] }).skipped).toEqual([]);
  });
});

describe("paths are complete, not a sample", () => {
  it("keeps EVERY path on the finding, however many there are", () => {
    // Each rule used to cap itself with a `.slice(0, 5)`, which made the
    // downloadable report a truncated copy advertising itself as exhaustive:
    // the since-deleted F-15 rendered "86 names appear more than once" above
    // exactly five of them. Truncation is a rendering decision — the panel shows four and
    // says how many it hid; the document shows all of them.
    const entries = Array.from({ length: 40 }, (_, i) => file(`F${i}/nota.docx`));
    const f = find(run({ entries }), "officeFiles")!;
    expect(f.paths).toHaveLength(40);
    expect(f.counts.files).toBe(40);
    // The count in the sentence and the list under it must agree — that
    // mismatch is exactly what made the document misleading.
    expect(f.paths).toHaveLength(f.counts.files);
  });
});

describe("ordering", () => {
  it("puts every loud finding before every quiet one", () => {
    // #26.05 rewrote this case for the second time: it used to pair the quiet
    // F-17 against the loud F-08, and F-08 is now a constraint. The pair below
    // is chosen so the sort still has something to do — F-17 is quiet and is
    // pushed by `fileFindings`, S-17 is loud and is pushed by
    // `truncationFindings`, after it. A no-op sort would leave the quiet one
    // first.
    const r = run({
      entries: [file("nota.docx")],
      observations: [obs({ truncated: "breadth" })],
    });
    expect(r.findings.map((f) => f.kind)).toEqual(["walkTooManyFiles", "officeFiles"]);
  });
});
