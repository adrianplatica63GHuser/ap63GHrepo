/**
 * Unit tests for src/lib/import/checks.ts   (Slice #24.02b, trimmed by #26.02)
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
 * That is also why the loud/quiet cases went with them. The split was measured
 * on those three near-miss rules; with them gone only F-15 and F-17 are quiet,
 * so the one surviving loudness test asserts the ORDER (loud before quiet)
 * rather than where the line sits.
 *
 * Cross-checked against the real archive by running this module over
 * C:\dev\TEST.DATA. One aggregate count reproduces the spec's independent
 * measurement in PRE-IMPORT-RULES.md §6 exactly — 67 Office files (F-17). The
 * other, 8 irregular page groups, measured S-10 and went with it.
 *
 * The spec's third number, "15 gate files", deliberately does NOT reproduce:
 * it counts 0, and that is the correct answer now. Slice #24.04 moved
 * `.dwg/.bak/.zip/.lnk/.dwl/.dwl2` into the `"ignored"` kind, so the walk
 * removes those exact 15 files before `entries` exists. They appear in the
 * Skipped section instead, where the same 15 paths show up as
 * `ignored-extension`. F-05 therefore only fires for extensions the registry
 * has never heard of — which is worth keeping, but is not the archive-wide
 * warning the catalogue described before #24.04 fixed its cause.
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

/** T1 metadata, keyed the way `metadataKeyFor` keys it. Hoisted by #26.02 —
 *  the ordering test needs a loud metadata finding to sort against. */
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

describe("multi-property root (S-01)", () => {
  it("warns when the root holds several property-shaped folders", () => {
    // The archive's `test.data.5props` — five properties silently merged into
    // whichever one the user names in the next step.
    const r = run({
      observations: [
        obs({ pathParts: [], path: "", depth: 0, dirNames: ["10-38per3", "47per2-225", "58-253per1", "46-222", "48-50"] }),
      ],
    });
    expect(find(r, "multipleProperties")!.counts).toMatchObject({ folders: 5 });
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
  it("flags files the provenance gate will stop the run for", () => {
    // F-05, the catalogue's highest-value warning: the import halts behind a
    // modal per file, for the whole run.
    const r = run({ entries: [file("a.xyz"), file("b.qqq"), file("scan.jpg")] });
    expect(find(r, "gateFiles")!.counts).toMatchObject({ files: 2, extensions: 2 });
  });

  it("flags .heic, which passes the gate and is then read by nothing", () => {
    const r = run({ entries: [file("IMG_1.heic")] });
    expect(find(r, "heicFiles")!.loudness).toBe("loud");
  });

  it("reports duplicate basenames across folders, listing every affected file", () => {
    const r = run({ entries: [file("A/fisa.jpg"), file("B/fisa.jpg"), file("C/alt.jpg")] });
    const f = find(r, "duplicateBasenames")!;
    expect(f.counts).toMatchObject({ names: 1, documents: 2 });
    // The path list must agree with `documents`, not with `names` — it used
    // to show one example per group, so a finding claiming 192 affected files
    // listed 86 paths.
    expect(f.paths).toHaveLength(f.counts.documents);
    expect(f.paths).toEqual(["A/fisa.jpg", "B/fisa.jpg"]);
  });
});

// ---------------------------------------------------------------------------
// T1 — metadata
// ---------------------------------------------------------------------------

describe("metadata findings", () => {
  it("flags oversized, empty and type-less files", () => {
    const r = run({
      entries: [file("big.jpg"), file("empty.jpg"), file("mystery.jpg")],
      metadata: meta([
        ["big.jpg", 21 * 1024 * 1024, "image/jpeg"],
        ["empty.jpg", 0, "image/jpeg"],
        ["mystery.jpg", 5000, ""],
      ]),
    });
    expect(find(r, "oversizedFiles")!.counts).toMatchObject({ files: 1, limitMb: 20 });
    expect(find(r, "emptyFiles")!.counts).toMatchObject({ files: 1 });
    expect(find(r, "unknownMimeFiles")!.counts).toMatchObject({ files: 1 });
  });

  it("ignores an empty MIME on a file nothing would have read anyway", () => {
    // F-11 only matters because it disables AI extraction. A .docx was never
    // going to be extracted, so reporting it would be noise.
    const r = run({ entries: [file("nota.docx")], metadata: meta([["nota.docx", 900, ""]]) });
    expect(kinds(r)).not.toContain("unknownMimeFiles");
  });

  it("flags a folder.jpg too big to be a thumbnail", () => {
    // F-02: dropped by NAME, so size is the only way to tell a Windows
    // thumbnail from someone's scan of a land title.
    const r = run({
      observations: [obs({ dropped: [dropped("Acte/folder.jpg", "system-file")] })],
      metadata: meta([["Acte/folder.jpg", 400 * 1024, "image/jpeg"]]),
    });
    expect(find(r, "largeFolderJpg")!.counts).toMatchObject({ files: 1 });
  });

  it("leaves a genuine Windows thumbnail alone", () => {
    const r = run({
      observations: [obs({ dropped: [dropped("Acte/folder.jpg", "system-file")] })],
      metadata: meta([["Acte/folder.jpg", 4 * 1024, "image/jpeg"]]),
    });
    expect(kinds(r)).not.toContain("largeFolderJpg");
  });

  it("skips all four metadata rules when the pass did not run", () => {
    const r = run({ entries: [file("big.jpg")] });
    expect(r.uploadBytes).toBeNull();
    expect(kinds(r)).not.toContain("oversizedFiles");
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
    // F-15 rendered "86 names appear more than once" above exactly five of
    // them. Truncation is a rendering decision — the panel shows four and
    // says how many it hid; the document shows all of them.
    const entries = Array.from({ length: 40 }, (_, i) => file(`F${i}/nota.docx`));
    const f = find(run({ entries }), "officeFiles")!;
    expect(f.paths).toHaveLength(40);
    expect(f.counts.files).toBe(40);
    // The count in the sentence and the list under it must agree — that
    // mismatch is exactly what made the document misleading.
    expect(f.paths).toHaveLength(f.counts.files);
  });

  it("keeps every gate-file path too", () => {
    const entries = Array.from({ length: 30 }, (_, i) => file(`x${i}.zzz`));
    expect(find(run({ entries }), "gateFiles")!.paths).toHaveLength(30);
  });
});

describe("ordering", () => {
  it("puts every loud finding before every quiet one", () => {
    // #26.02 rewrote this case: it used to pair a quiet S-03 against a loud
    // S-04 and both are gone. The pair below is chosen so the sort has
    // something to do — F-17 is quiet and is pushed by `fileFindings`, F-08 is
    // loud and is pushed by `metadataFindings`, several steps later. A
    // no-op sort would leave the quiet one first.
    const r = run({
      entries: [file("nota.docx"), file("scan.jpg")],
      metadata: meta([
        ["nota.docx", 1_000, "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        ["scan.jpg", 40 * 1024 * 1024, "image/jpeg"],
      ]),
    });
    expect(r.findings.map((f) => f.kind)).toEqual(["oversizedFiles", "officeFiles"]);
  });
});
