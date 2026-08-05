/**
 * Unit tests for src/lib/import/checks.ts   (Slice #24.02b)
 *
 * The report's whole value is that a user believes it, so the tests that
 * matter are the ones pinning DISCRIMINATION: loud vs quiet, and near-miss vs
 * folder-behaving-correctly. A checker that shouts at everything is the same
 * as no checker, and these are the cases where the line actually sits.
 *
 * Cross-checked against the real archive by running this module over
 * C:\dev\TEST.DATA. Two aggregate counts reproduce the spec's independent
 * measurements in PRE-IMPORT-RULES.md §6 exactly — 8 irregular page groups
 * (S-10) and 67 Office files (F-17).
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
// Page-group near-misses — the class this screen exists for
// ---------------------------------------------------------------------------

describe("near-miss classification", () => {
  it("is LOUD when a stray file breaks an otherwise-numbered folder", () => {
    // S-04. The user numbered the scans correctly; one stray turns 5 pages
    // into 6 documents, and the fix is to move one file.
    const r = run({
      observations: [obs({ keptNames: ["001.jpg", "002.jpg", "003.jpg", "004.jpg", "plan.jpg"] })],
    });
    const f = find(r, "nearMissStrayFile")!;
    expect(f.loudness).toBe("loud");
    expect(f.counts).toMatchObject({ numbered: 4, total: 5, strays: 1, documentsNow: 5 });
    expect(f.paths).toContain("plan.jpg");
  });

  it("is QUIET when a subfolder is what disqualified the folder", () => {
    // S-03. On the real archive this is overwhelmingly a property folder
    // behaving exactly as designed — and it is where the BIGGEST folders are,
    // which is why a size threshold would have got this backwards.
    const r = run({
      observations: [
        obs({ keptNames: ["001.jpg", "002.jpg"], dirNames: ["Anexe"] }),
      ],
    });
    expect(find(r, "nearMissSubfolder")!.loudness).toBe("quiet");
  });

  it("is LOUD for names that read as a page sequence", () => {
    // The real case from the archive: "CVC 1 pg 1.jpg" / "CVC 1 pg 2.jpg".
    const r = run({ observations: [obs({ keptNames: ["CVC 1 pg 1.jpg", "CVC 1 pg 2.jpg"] })] });
    expect(find(r, "nearMissNaming")!.loudness).toBe("loud");
  });

  it("is LOUD for a Romanian recto/verso pair", () => {
    // "TP 36034 fata.jpg" / "TP 36034 verso.jpg" are two sides of one sheet.
    const r = run({ observations: [obs({ keptNames: ["TP 36034 fata.jpg", "TP 36034 verso.jpg"] })] });
    expect(find(r, "nearMissNaming")!.loudness).toBe("loud");
  });

  it("is QUIET for unrelated images that merely share a folder", () => {
    // "Google aeroport.jpg" + "PAD teren aeroport.jpg" ARE two documents and
    // are meant to be. Shouting here is what would make the list unreadable —
    // it is half of all S-05 hits on the real archive.
    const r = run({
      observations: [obs({ keptNames: ["Google aeroport.jpg", "PAD teren aeroport.jpg"] })],
    });
    expect(find(r, "nearMissNaming")!.loudness).toBe("quiet");
  });

  it("says nothing about a folder holding a single image", () => {
    const r = run({ observations: [obs({ keptNames: ["contract.jpg"] })] });
    expect(kinds(r)).toEqual([]);
  });

  it("says nothing about a folder that DID become one document", () => {
    const r = run({
      observations: [obs({ keptNames: ["1.jpg", "2.jpg", "3.jpg"], becamePageGroup: true })],
    });
    expect(kinds(r)).toEqual([]);
  });

  it("warns loudly when numbered scans sit at the PICKED ROOT", () => {
    // S-07. Depth 0 can never be a page group however perfect the names, so
    // the user almost certainly picked the scan folder instead of its parent.
    const r = run({
      observations: [obs({ pathParts: [], path: "", depth: 0, keptNames: ["001.jpg", "002.jpg", "003.jpg"] })],
    });
    const f = find(r, "rootIsScanFolder")!;
    expect(f.loudness).toBe("loud");
    expect(f.counts).toMatchObject({ numbered: 3, total: 3 });
    // …and it must not ALSO be reported as an ordinary near-miss.
    expect(kinds(r)).not.toContain("nearMissNaming");
  });
});

// ---------------------------------------------------------------------------
// Page order inside a document that did form
// ---------------------------------------------------------------------------

describe("page-order hazards", () => {
  it("flags two pages that parse to the same number", () => {
    // S-09: "1.jpg" and "01.jpg" both parseInt to 1; the comparator returns 0
    // and the resulting order is whatever the sort happened to do — yet it is
    // written as an authoritative pageNumber.
    const r = run({
      observations: [obs({ keptNames: ["1.jpg", "01.jpg", "2.jpg"], becamePageGroup: true })],
    });
    expect(find(r, "pageOrderAmbiguous")!.counts).toMatchObject({ collisions: 1, pages: 3 });
  });

  it("flags scanner counters masquerading as page numbers", () => {
    // S-10, from the archive: 5449.jpg beside 31316.jpg.
    const r = run({
      observations: [obs({ keptNames: ["5449.jpg", "31316.jpg"], becamePageGroup: true })],
    });
    expect(find(r, "pageNumbersIrregular")!.counts).toMatchObject({ lowest: 5449, highest: 31316 });
  });

  it("leaves a clean 1..N group alone", () => {
    const r = run({
      observations: [obs({ keptNames: ["1.jpg", "2.jpg", "3.jpg"], becamePageGroup: true })],
    });
    expect(kinds(r)).toEqual([]);
  });
});

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

  it("reports duplicate basenames across folders", () => {
    const r = run({ entries: [file("A/fisa.jpg"), file("B/fisa.jpg"), file("C/alt.jpg")] });
    expect(find(r, "duplicateBasenames")!.counts).toMatchObject({ names: 1, documents: 2 });
  });
});

// ---------------------------------------------------------------------------
// T1 — metadata
// ---------------------------------------------------------------------------

describe("metadata findings", () => {
  const meta = (entries: [string, number, string][]) =>
    new Map<string, FileMeta>(entries.map(([p, size, type]) => [p, { size, type }]));

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

describe("ordering", () => {
  it("puts every loud finding before every quiet one", () => {
    const r = run({
      entries: [file("a.xyz")],
      observations: [
        obs({ pathParts: ["Q"], keptNames: ["x.jpg", "y.jpg"], dirNames: ["sub"] }),
        obs({ pathParts: ["L"], keptNames: ["001.jpg", "002.jpg", "stray.jpg"] }),
      ],
    });
    const loudness = r.findings.map((f) => f.loudness);
    expect(loudness).toEqual([...loudness].sort((a, b) => (a === b ? 0 : a === "loud" ? -1 : 1)));
    expect(loudness[0]).toBe("loud");
  });
});
