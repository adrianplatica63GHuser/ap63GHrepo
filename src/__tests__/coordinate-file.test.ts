/**
 * Unit tests for src/lib/import/coordinate-file.ts
 *
 * Covers: isCoordinateFileName, coordinateCandidates, nicknameFromFolderName
 * (Slice #23.00.Import), cornersEqual (#23.02.Import), and
 * coordinateNameConfidence + cadastralSuggestionFromFolderName (#23.07.Import).
 *
 * Most of these helpers are boring and predictable on purpose — the folder no
 * longer has to be decoded, because the folder IS the property. The #23.00
 * tests therefore lean hard on the cases the retired digit-prefix heuristic
 * used to get wrong ("3 Calea Victoriei", "2024-Arhiva"): a nickname decodes
 * nothing cadastral, ever.
 *
 * `cadastralSuggestionFromFolderName` is the one helper that reads a folder
 * name cadastrally again, and the tests pin the two things that make it a
 * SUGGESTION rather than the retired inference: it demands the full
 * "<tarla>-<parcela>" shape (so "3 Calea Victoriei" yields nothing at all),
 * and it emits the same slash-separated form the Process route writes, so the
 * two ways into a Property cannot disagree about what "47per2" means.
 */

import {
  COORDINATE_FILE_EXTS,
  CORNER_EPSILON_DEG,
  cadastralSuggestionFromFolderName,
  cornersEqual,
  coordinateNameConfidence,
  isCoordinateFileName,
  coordinateCandidates,
  nicknameFromFolderName,
} from "@/lib/import/coordinate-file";
import type {
  FSEntry,
  FSFileEntry,
  FSFileHandle,
  FSPageGroupEntry,
} from "@/lib/import/folder-utils";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A stub handle — these helpers never call getFile(), only read `name`. */
function handle(name: string): FSFileHandle {
  return {
    kind: "file",
    name,
    getFile: () => Promise.reject(new Error("not used in these tests")),
  };
}

function fileEntry(path: string, pathParts: string[] = []): FSFileEntry {
  const name = path.split("/").pop() ?? path;
  return { kind: "file", name, path, pathParts, handle: handle(name) };
}

function pageGroupEntry(path: string, names: string[]): FSPageGroupEntry {
  const name = path.split("/").pop() ?? path;
  return {
    kind: "page-group",
    name,
    path,
    pathParts: path.split("/"),
    handles: names.map(handle),
    titleHint: name,
  };
}

// ---------------------------------------------------------------------------
// isCoordinateFileName
// ---------------------------------------------------------------------------

describe("isCoordinateFileName", () => {
  it("accepts .txt, the one coordinate-export extension", () => {
    expect(isCoordinateFileName("corners.txt")).toBe(true);
  });

  it("rejects .csv, .dat and .asc, all refused in Slice #24.03", () => {
    // .dat and .asc were candidates and members of no other kind, which made
    // them the only coordinate extensions that could not also infer a
    // provenance — a .dat blocked its own import row at the provenance gate
    // while a .txt sailed through. .csv followed on Adrian's decision that a
    // cadastral export arrives as a .txt and nothing else. All three are still
    // importable as documents; none is OFFERED as a source of corners.
    expect(isCoordinateFileName("corners.csv")).toBe(false);
    expect(isCoordinateFileName("corners.dat")).toBe(false);
    expect(isCoordinateFileName("corners.asc")).toBe(false);
  });

  it("is case-insensitive on the extension", () => {
    expect(isCoordinateFileName("CORNERS.TXT")).toBe(true);
    expect(isCoordinateFileName("Corners.Txt")).toBe(true);
  });

  it("rejects scans, PDFs and Word files", () => {
    expect(isCoordinateFileName("scan.jpg")).toBe(false);
    expect(isCoordinateFileName("contract.pdf")).toBe(false);
    expect(isCoordinateFileName("nota.docx")).toBe(false);
  });

  it("rejects a file with no extension at all", () => {
    expect(isCoordinateFileName("README")).toBe(false);
    expect(isCoordinateFileName("")).toBe(false);
  });

  it("matches only the final extension, not one embedded in the name", () => {
    expect(isCoordinateFileName("coordonate.txt.pdf")).toBe(false);
    expect(isCoordinateFileName("raport.pdf.txt")).toBe(true);
  });

  it("exposes the extension set it uses", () => {
    expect([...COORDINATE_FILE_EXTS].sort()).toEqual([".txt"]);
  });
});

// ---------------------------------------------------------------------------
// coordinateCandidates
// ---------------------------------------------------------------------------

describe("coordinateCandidates", () => {
  it("returns an empty list for a folder with no text files", () => {
    const entries: FSEntry[] = [
      fileEntry("contract.pdf"),
      fileEntry("scan.jpg"),
    ];
    expect(coordinateCandidates(entries)).toEqual([]);
  });

  it("returns an empty list for an empty folder", () => {
    expect(coordinateCandidates([])).toEqual([]);
  });

  it("finds a single candidate among unrelated files", () => {
    const entries: FSEntry[] = [
      fileEntry("contract.pdf"),
      fileEntry("coordonate.txt"),
      fileEntry("scan.jpg"),
    ];
    const found = coordinateCandidates(entries);
    expect(found.map((e) => e.path)).toEqual(["coordonate.txt"]);
  });

  it("finds candidates nested in subfolders", () => {
    const entries: FSEntry[] = [
      fileEntry("Acte/contract.pdf", ["Acte"]),
      fileEntry("Cadastru/puncte.txt", ["Cadastru"]),
    ];
    expect(coordinateCandidates(entries).map((e) => e.path)).toEqual([
      "Cadastru/puncte.txt",
    ]);
  });

  it("returns ALL candidates, in walk order, without picking a winner", () => {
    const entries: FSEntry[] = [
      fileEntry("a.txt"),
      fileEntry("scan.jpg"),
      fileEntry("Sub/b.txt", ["Sub"]),
      fileEntry("c.TXT"),
    ];
    // Choosing between these is the user's job (Slice #23.00.Import) — the
    // helper must not silently prefer one.
    expect(coordinateCandidates(entries).map((e) => e.path)).toEqual([
      "a.txt",
      "Sub/b.txt",
      "c.TXT",
    ]);
  });

  it("never returns a page-group entry", () => {
    const entries: FSEntry[] = [
      pageGroupEntry("CVC_2021", ["001.jpg", "002.jpg"]),
      fileEntry("puncte.txt"),
    ];
    const found = coordinateCandidates(entries);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe("file");
    expect(found[0].name).toBe("puncte.txt");
  });

  it("narrows the return type to file entries", () => {
    const found = coordinateCandidates([fileEntry("puncte.txt")]);
    // `handle` exists only on FSFileEntry — this would not compile if the
    // helper returned a bare FSEntry.
    expect(found[0].handle.name).toBe("puncte.txt");
  });
});

// ---------------------------------------------------------------------------
// nicknameFromFolderName
// ---------------------------------------------------------------------------

describe("nicknameFromFolderName", () => {
  it("replaces underscores with spaces", () => {
    expect(nicknameFromFolderName("Teren_Bragadiru_2024")).toBe(
      "Teren Bragadiru 2024",
    );
  });

  it("collapses whitespace runs and trims", () => {
    expect(nicknameFromFolderName("  3 Calea   Victoriei  ")).toBe(
      "3 Calea Victoriei",
    );
  });

  it("returns an empty string for an empty or blank name", () => {
    expect(nicknameFromFolderName("")).toBe("");
    expect(nicknameFromFolderName("   ")).toBe("");
  });

  it("preserves diacritics and casing exactly", () => {
    expect(nicknameFromFolderName("Livada Mălina")).toBe("Livada Mălina");
    expect(nicknameFromFolderName("PRISECARU")).toBe("PRISECARU");
  });

  it("does NOT expand document abbreviations", () => {
    // folderNameToTitleHint would turn this into "Contract de
    // Vânzare-Cumpărare 2021" — correct for a document title, wrong for a
    // property nickname.
    expect(nicknameFromFolderName("CVC_2021")).toBe("CVC 2021");
    expect(nicknameFromFolderName("TP 1234")).toBe("TP 1234");
  });

  it("does NOT decode anything cadastral out of the name", () => {
    // The retired digit-prefix heuristic read this as tarla "47per2" /
    // parcela "225per3per24". The nickname keeps it verbatim; tarla and
    // parcela are now typed by a human.
    expect(nicknameFromFolderName("47per2-225per3per24-2716 Prisecaru")).toBe(
      "47per2-225per3per24-2716 Prisecaru",
    );
  });

  it("leaves digit-leading names that were never cadastral alone", () => {
    // The two false positives that motivated Slice #23.00.Import.
    expect(nicknameFromFolderName("3 Calea Victoriei")).toBe(
      "3 Calea Victoriei",
    );
    expect(nicknameFromFolderName("2024-Arhiva")).toBe("2024-Arhiva");
  });
});

// ---------------------------------------------------------------------------
// cornersEqual  (Slice #23.02.Import)
// ---------------------------------------------------------------------------

describe("cornersEqual", () => {
  const square = [
    { lat: 44.4, lon: 26.0 },
    { lat: 44.5, lon: 26.0 },
    { lat: 44.5, lon: 26.1 },
    { lat: 44.4, lon: 26.1 },
  ];

  it("matches a list against itself", () => {
    expect(cornersEqual(square, square)).toBe(true);
  });

  it("matches an equal list built independently", () => {
    expect(cornersEqual(square, square.map((c) => ({ ...c })))).toBe(true);
  });

  it("rejects lists of different lengths", () => {
    expect(cornersEqual(square, square.slice(0, 3))).toBe(false);
    expect(cornersEqual(square.slice(0, 3), square)).toBe(false);
  });

  it("rejects a moved corner", () => {
    const moved = square.map((c, i) => (i === 2 ? { ...c, lat: 44.6 } : c));
    expect(cornersEqual(square, moved)).toBe(false);
  });

  it("rejects a REORDERED list — corner order is the polygon's edge order", () => {
    // This is the bow-tie fix: the same points in a different sequence are a
    // different polygon, and re-applying the file's original order is a real
    // change the user is entitled to make.
    expect(cornersEqual(square, [...square].reverse())).toBe(false);
  });

  it("tolerates float noise below the epsilon", () => {
    const nudged = square.map((c) => ({
      lat: c.lat + CORNER_EPSILON_DEG / 2,
      lon: c.lon - CORNER_EPSILON_DEG / 2,
    }));
    expect(cornersEqual(square, nudged)).toBe(true);
  });

  it("rejects a difference just above the epsilon", () => {
    const nudged = square.map((c, i) =>
      i === 0 ? { ...c, lat: c.lat + CORNER_EPSILON_DEG * 10 } : c,
    );
    expect(cornersEqual(square, nudged)).toBe(false);
  });

  it("ignores originalIndex — it is provenance, not geometry", () => {
    const withIndices = square.map((c, i) => ({ ...c, originalIndex: i + 1 }));
    const withOthers = square.map((c, i) => ({ ...c, originalIndex: 100 + i }));
    expect(cornersEqual(withIndices, withOthers)).toBe(true);
  });

  it("treats two empty lists as equal", () => {
    expect(cornersEqual([], [])).toBe(true);
  });

  it("never treats a non-finite coordinate as equal, even to itself", () => {
    // A corner that failed to parse must not compare equal to another failure
    // and be reported as "already applied".
    expect(cornersEqual([{ lat: NaN, lon: 26 }], [{ lat: NaN, lon: 26 }])).toBe(
      false,
    );
    expect(
      cornersEqual([{ lat: Infinity, lon: 26 }], [{ lat: Infinity, lon: 26 }]),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// coordinateNameConfidence  (Slice #23.07.Import)
// ---------------------------------------------------------------------------

describe("coordinateNameConfidence", () => {
  it("is strong for Adrian's real coordinate file", () => {
    // The example from the UAT report: the convention AND the cadastral
    // identifiers, in one name.
    expect(coordinateNameConfidence("coord 47per2-225per3per24-2716.txt")).toBe(
      "strong",
    );
  });

  it("folds case", () => {
    expect(coordinateNameConfidence("COORD_47.TXT")).toBe("strong");
    expect(coordinateNameConfidence("Coord 47.txt")).toBe("strong");
    expect(coordinateNameConfidence("CoOrD.TxT")).toBe("strong");
  });

  it("accepts the written-out Romanian form of the same convention", () => {
    expect(coordinateNameConfidence("coordonate.txt")).toBe("strong");
    expect(coordinateNameConfidence("Coordonate teren.txt")).toBe("strong");
  });

  it("ignores leading whitespace, because foldRomanian trims", () => {
    expect(coordinateNameConfidence("  coord 47.txt")).toBe("strong");
  });

  it("folds Romanian diacritics elsewhere in the name", () => {
    // Both encodings of s-comma-below: U+0219 (correct) and U+015F (the legacy
    // cedilla form some OCR and older fonts still emit). Neither may change
    // the answer, and neither may throw.
    expect(coordinateNameConfidence("coord \u00cemprejmuire Tarla.txt")).toBe("strong");
    expect(coordinateNameConfidence("coord \u0218oseaua.txt")).toBe("strong");
    expect(coordinateNameConfidence("coord \u015eoseaua.txt")).toBe("strong");
  });

  it("is weak when a shortlisted extension carries an unconventional name", () => {
    expect(coordinateNameConfidence("puncte.txt")).toBe("weak");
    expect(coordinateNameConfidence("47per2-225per3.txt")).toBe("weak");
    expect(coordinateNameConfidence("date.txt")).toBe("weak");
  });

  it("requires the convention at the START of the name, not anywhere in it", () => {
    expect(coordinateNameConfidence("documente-coord.txt")).toBe("weak");
    expect(coordinateNameConfidence("export coord final.txt")).toBe("weak");
  });

  it("handles a name that BEGINS with a diacritic", () => {
    // The \b trap in one test: a word-boundary assertion can never match at
    // offset 0 of a string starting with a non-ASCII letter, so an
    // implementation written that way would misbehave here rather than simply
    // answer "weak". (CLAUDE.md: \b is ASCII-only, never use it on Romanian.)
    expect(coordinateNameConfidence("\u00cemprejmuire coord.txt")).toBe("weak");
    expect(coordinateNameConfidence("\u0218tampile.txt")).toBe("weak");
  });

  it("is none when the extension was never a candidate — the name cannot promote it", () => {
    // The convention RANKS candidates; it never creates one. A .pdf named
    // "coord" is still not something coordinateCandidates would offer.
    expect(coordinateNameConfidence("coord 47.pdf")).toBe("none");
    expect(coordinateNameConfidence("coordonate.docx")).toBe("none");
    expect(coordinateNameConfidence("coord.jpg")).toBe("none");
  });

  it("is none for a name with no extension at all", () => {
    expect(coordinateNameConfidence("coord")).toBe("none");
    expect(coordinateNameConfidence("")).toBe("none");
  });

  it("agrees with isCoordinateFileName on exactly which names are none", () => {
    // The two must never disagree: "none" is DEFINED as "not a candidate".
    const names = [
      "coord 47.txt",
      "puncte.csv",   // a document, but never a coordinate candidate -> "none"
      "coord.pdf",
      "scan.jpg",
      "raport.pdf.txt",
      "coordonate.txt.pdf",
      "",
    ];
    for (const name of names) {
      expect(coordinateNameConfidence(name) === "none").toBe(
        !isCoordinateFileName(name),
      );
    }
  });
});

// ---------------------------------------------------------------------------
// cadastralSuggestionFromFolderName  (Slice #23.07.Import)
// ---------------------------------------------------------------------------

describe("cadastralSuggestionFromFolderName", () => {
  it("suggests both identifiers from a real property folder name", () => {
    expect(
      cadastralSuggestionFromFolderName("47per2-225per3per24-2716 Prisecaru"),
    ).toEqual({ tarlaSola: "47/2", parcela: "225/3/24" });
  });

  it("emits the SLASH form, the same one the Process route writes", () => {
    // This is the whole point of the perToSlash step. /api/documents/[id]/
    // process has always applied it before writing tarla_sola / parcela, so
    // suggesting the raw "47per2" here would give two Properties whose
    // cadastral identifiers differ only in encoding — the asymmetry this
    // slice exists to remove, reintroduced one layer down.
    const s = cadastralSuggestionFromFolderName("47per2-225per3");
    expect(s.tarlaSola).toBe("47/2");
    expect(s.parcela).toBe("225/3");
    expect(s.tarlaSola).not.toContain("per");
    expect(s.parcela).not.toContain("per");
  });

  it("suggests nothing for a name with no <tarla>-<parcela> separator", () => {
    // parseFolderName alone would hand back the WHOLE name as the tarla here,
    // which is the #23.00 false positive wearing a different hat.
    expect(cadastralSuggestionFromFolderName("3 Calea Victoriei")).toEqual({
      tarlaSola: "",
      parcela: "",
    });
    expect(cadastralSuggestionFromFolderName("2716 Prisecaru")).toEqual({
      tarlaSola: "",
      parcela: "",
    });
  });

  it("suggests nothing for a name that is not cadastral at all", () => {
    expect(cadastralSuggestionFromFolderName("Documente generale")).toEqual({
      tarlaSola: "",
      parcela: "",
    });
    expect(cadastralSuggestionFromFolderName("Arhiva 2024")).toEqual({
      tarlaSola: "",
      parcela: "",
    });
  });

  it("suggests nothing for an empty or blank name", () => {
    expect(cadastralSuggestionFromFolderName("")).toEqual({
      tarlaSola: "",
      parcela: "",
    });
    expect(cadastralSuggestionFromFolderName("   ")).toEqual({
      tarlaSola: "",
      parcela: "",
    });
  });

  it("still suggests for a digit-led non-cadastral name that HAS a separator", () => {
    // "2024-Arhiva" is the accepted residual false positive, and pinning it
    // is deliberate: the design's answer is not that the guess is always
    // right, it is that the user sees the guess in a labelled, editable field
    // and can clear it before anything is written. If a future change makes
    // this return blanks, that is a behaviour change worth noticing.
    expect(cadastralSuggestionFromFolderName("2024-Arhiva")).toEqual({
      tarlaSola: "2024",
      parcela: "Arhiva",
    });
  });

  it("never returns null or undefined for either field", () => {
    // Both values are bound straight to controlled text inputs; an undefined
    // would flip the input to uncontrolled and React would warn on first edit.
    for (const name of ["", "x", "1-2", "3 Calea Victoriei", "47per2-225per3-rest"]) {
      const s = cadastralSuggestionFromFolderName(name);
      expect(typeof s.tarlaSola).toBe("string");
      expect(typeof s.parcela).toBe("string");
    }
  });

  it("does not disturb the nickname, which still decodes nothing", () => {
    // The two helpers read the same name and must keep answering differently:
    // the nickname is a label the user recognises, the suggestion is data.
    const folder = "47per2-225per3per24-2716 Prisecaru";
    expect(nicknameFromFolderName(folder)).toBe(folder);
    expect(cadastralSuggestionFromFolderName(folder).tarlaSola).toBe("47/2");
  });
});
