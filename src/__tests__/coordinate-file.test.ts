/**
 * Unit tests for src/lib/import/coordinate-file.ts
 *
 * Covers: isCoordinateFileName (Slice #23.00.Import), cornersEqual
 * (#23.02.Import) and coordinateNameConfidence (#23.07.Import).
 *
 * ⚠️ Three suites left with Slice #26.07.fix, and it is worth saying why they
 * are not simply missing. `coordinateCandidates`, `nicknameFromFolderName` and
 * `cadastralSuggestionFromFolderName` served the property step's old
 * create-new branch — the free-text nickname, the editable tarla/parcela
 * suggestion, and the radio list of `.txt` files to choose corners from. #26.07
 * removed all three questions from the screen: a folder's identity now comes
 * from its name under #26.01's grammar, its corners from the one file STR-08
 * declares, and its nickname is the folder. The helpers went with the questions,
 * and their tests went with them rather than pinning behaviour nothing can
 * reach.
 */

import {
  COORDINATE_FILE_EXTS,
  CORNER_EPSILON_DEG,
  cornersEqual,
  coordinateNameConfidence,
  isCoordinateFileName,
} from "@/lib/import/coordinate-file";

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
    // "coord" is still not something `isCoordinateFileName` would accept.
    // (It used to say `coordinateCandidates`, which #26.07.fix deleted — a
    // comment naming a function that no longer exists sends the next reader
    // looking for it.)
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
      "puncte.csv",   // forbidden since #24.04, never a candidate -> "none"
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
