/**
 * Unit tests for src/lib/import/coordinate-file.ts  (Slice #23.00.Import)
 *
 * Covers: isCoordinateFileName, coordinateCandidates, nicknameFromFolderName,
 * and cornersEqual (added by Slice #23.02.Import).
 *
 * The point of these helpers is that they are boring and predictable — the
 * folder no longer has to be decoded, because the folder IS the property. So
 * the tests lean hard on the cases the retired digit-prefix heuristic used to
 * get wrong ("3 Calea Victoriei", "2024-Arhiva"): nothing cadastral may be
 * inferred from a folder name any more.
 */

import {
  COORDINATE_FILE_EXTS,
  CORNER_EPSILON_DEG,
  cornersEqual,
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
  it("accepts the four coordinate-export extensions", () => {
    expect(isCoordinateFileName("corners.txt")).toBe(true);
    expect(isCoordinateFileName("corners.csv")).toBe(true);
    expect(isCoordinateFileName("corners.dat")).toBe(true);
    expect(isCoordinateFileName("corners.asc")).toBe(true);
  });

  it("is case-insensitive on the extension", () => {
    expect(isCoordinateFileName("CORNERS.TXT")).toBe(true);
    expect(isCoordinateFileName("Corners.Csv")).toBe(true);
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
    expect([...COORDINATE_FILE_EXTS].sort()).toEqual([
      ".asc",
      ".csv",
      ".dat",
      ".txt",
    ]);
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
      fileEntry("Sub/b.csv", ["Sub"]),
      fileEntry("c.dat"),
    ];
    // Choosing between these is the user's job (Slice #23.00.Import) — the
    // helper must not silently prefer one.
    expect(coordinateCandidates(entries).map((e) => e.path)).toEqual([
      "a.txt",
      "Sub/b.csv",
      "c.dat",
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
