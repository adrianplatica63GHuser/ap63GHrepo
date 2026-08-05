/**
 * Unit tests for src/lib/import/folder-utils.ts
 *
 * Covers: isIgnoredFileName (7.9, #24.04), isPageGroup, parseFolderName, folderNameToTitleHint,
 * tagsForEntry.  walkFolder is not tested here (requires a real FSDirectoryHandle
 * stub — integration-level concern).
 */

import {
  isIgnoredFileName,
  isPageGroup,
  parseFolderName,
  folderNameToTitleHint,
  tagsForEntry,
  perToSlash,
} from "@/lib/import/folder-utils";

// ---------------------------------------------------------------------------
// isIgnoredFileName (fix 7.9; renamed and extended in Slice #24.04)
// ---------------------------------------------------------------------------

describe("isIgnoredFileName", () => {
  it("rejects hidden files (leading dot)", () => {
    expect(isIgnoredFileName(".DS_Store")).toBe(true);
    expect(isIgnoredFileName(".gitkeep")).toBe(true);
    expect(isIgnoredFileName("._metadata")).toBe(true);
  });

  it("rejects known Windows system files (case-insensitive)", () => {
    expect(isIgnoredFileName("Thumbs.db")).toBe(true);
    expect(isIgnoredFileName("thumbs.db")).toBe(true);
    expect(isIgnoredFileName("THUMBS.DB")).toBe(true);
    expect(isIgnoredFileName("desktop.ini")).toBe(true);
    expect(isIgnoredFileName("Desktop.ini")).toBe(true);
    expect(isIgnoredFileName("ehthumbs.db")).toBe(true);
  });

  it("accepts normal image files", () => {
    expect(isIgnoredFileName("001.jpg")).toBe(false);
    expect(isIgnoredFileName("scan.png")).toBe(false);
  });

  it("accepts normal document files", () => {
    expect(isIgnoredFileName("contract.pdf")).toBe(false);
    expect(isIgnoredFileName("titlu.txt")).toBe(false);
  });

  it("drops the ignored extensions (Slice #24.04)", () => {
    // The list itself is asserted in file-kinds.test.ts — this pins that the
    // walk actually consults it, which is the half that can silently rot.
    for (const n of [
      "T 10 Gore Dima Badea.dwl",
      "T 10 Gore Dima Badea.dwl2",
      "plan T 58 Clinceni padure.bak",
      "adev intrav 3867 CNAIR 2020.jpg - Shortcut.lnk",
      "CLINCENI.zip",
      "arhiva.rar",
      "arhiva.7z",
      "cadastre T 58 Clinceni Anton Doru (1).dwg",
    ]) {
      expect(isIgnoredFileName(n)).toBe(true);
    }
  });

  it("is case-insensitive on the ignored extensions too", () => {
    expect(isIgnoredFileName("PLAN.DWG")).toBe(true);
    expect(isIgnoredFileName("Arhiva.Zip")).toBe(true);
  });

  it("does NOT drop a .csv — forbidden is not ignored", () => {
    // The whole point of two kinds: noise goes quietly, a file that should not
    // be in the folder must reach somebody. Dropping .csv here would make it
    // vanish silently, which is the opposite of what Slice #24.02 will need.
    expect(isIgnoredFileName("inventar.csv")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isPageGroup
// ---------------------------------------------------------------------------

describe("isPageGroup", () => {
  it("accepts all-numeric-name image files", () => {
    expect(isPageGroup(["001.jpg", "002.jpg", "003.png"])).toBe(true);
    expect(isPageGroup(["1.jpg", "2.jpg"])).toBe(true);
  });

  it("rejects empty arrays", () => {
    expect(isPageGroup([])).toBe(false);
  });

  it("rejects non-numeric basenames", () => {
    expect(isPageGroup(["scan.jpg", "001.jpg"])).toBe(false);
    expect(isPageGroup(["page1.jpg"])).toBe(false);
  });

  it("rejects non-image files", () => {
    expect(isPageGroup(["001.pdf", "002.pdf"])).toBe(false);
    expect(isPageGroup(["001.jpg", "002.txt"])).toBe(false);
  });

  // Demonstrates the 7.9 fix: callers pre-filter dropped files so isPageGroup
  // only sees the real image files. Slice #24.04 widened what gets dropped, so
  // a stray .bak beside the scans no longer splits a page group either.
  it("returns true for filtered list after removing dropped files", () => {
    const allNames = ["001.jpg", "002.jpg", "003.jpg", "Thumbs.db", ".DS_Store", "scan.bak"];
    const filtered = allNames.filter((n) => !isIgnoredFileName(n));
    expect(filtered).toEqual(["001.jpg", "002.jpg", "003.jpg"]);
    expect(isPageGroup(filtered)).toBe(true);
  });

  it("returns false when dropped files are NOT filtered (pre-7.9 behaviour)", () => {
    const allNames = ["001.jpg", "002.jpg", "Thumbs.db"];
    // Without filtering, Thumbs.db (non-image, non-numeric) breaks the group.
    expect(isPageGroup(allNames)).toBe(false);
  });
});

// extOf and isImageName moved to src/lib/files/file-kinds.ts in Slice #24.03
// (as `extensionOf` and `isFileKind(name, "image")`); their cases live in
// src/__tests__/file-kinds.test.ts.

// ---------------------------------------------------------------------------
// parseFolderName
// ---------------------------------------------------------------------------

describe("parseFolderName", () => {
  it("rejects non-property folders", () => {
    expect(parseFolderName("Documente generale")).toEqual({ isPropertyFolder: false });
    expect(parseFolderName("CVC_2021")).toEqual({ isPropertyFolder: false });
  });

  it("parses tarla only", () => {
    expect(parseFolderName("47")).toEqual({ isPropertyFolder: true, tarlaSola: "47" });
  });

  it("parses tarla + parcela", () => {
    expect(parseFolderName("47-225")).toEqual({
      isPropertyFolder: true,
      tarlaSola: "47",
      parcela: "225",
    });
  });

  it("parses tarla + parcela + rest", () => {
    expect(parseFolderName("47per2-225per3per24-2716 Prisecaru")).toEqual({
      isPropertyFolder: true,
      tarlaSola: "47per2",
      parcela: "225per3per24",
      rest: "2716 Prisecaru",
    });
  });
});

// ---------------------------------------------------------------------------
// folderNameToTitleHint
// ---------------------------------------------------------------------------

describe("folderNameToTitleHint", () => {
  it("expands uppercase abbreviations", () => {
    expect(folderNameToTitleHint("CVC_2021-04-12")).toBe(
      "Contract de Vânzare-Cumpărare 2021-04-12",
    );
    expect(folderNameToTitleHint("TP_1234")).toBe("Titlu de Proprietate 1234");
  });

  // fix 7.11: case-insensitive abbreviation matching
  it("expands lowercase abbreviations (fix 7.11)", () => {
    expect(folderNameToTitleHint("cvc_2021-04-12")).toBe(
      "Contract de Vânzare-Cumpărare 2021-04-12",
    );
    expect(folderNameToTitleHint("tp_1234")).toBe("Titlu de Proprietate 1234");
  });

  it("expands mixed-case abbreviations (fix 7.11)", () => {
    expect(folderNameToTitleHint("Cvc_2021")).toBe(
      "Contract de Vânzare-Cumpărare 2021",
    );
  });

  it("replaces underscores with spaces", () => {
    expect(folderNameToTitleHint("scan_folder_01")).toBe("scan folder 01");
  });

  it("leaves non-abbreviation words unchanged (does NOT uppercase them)", () => {
    expect(folderNameToTitleHint("dosar_NR_5")).toBe("dosar NR 5");
  });

  // New abbreviations from Adrian's test session
  it("expands new two-word abbreviations", () => {
    expect(folderNameToTitleHint("Inch_Intab_2023")).toBe(
      "Incheiere Intabulare 2023",
    );
    expect(folderNameToTitleHint("PAD_47-225")).toBe(
      "Plan de Amplasament si Delimitare 47-225",
    );
    expect(folderNameToTitleHint("Antec_2020")).toBe("Antecontract 2020");
    expect(folderNameToTitleHint("Cert_urbanism_2024")).toBe(
      "Certificat urbanism 2024",
    );
  });

  it("expands multi-word abbreviations case-insensitively", () => {
    expect(folderNameToTitleHint("inch_intab_2023")).toBe(
      "Incheiere Intabulare 2023",
    );
    expect(folderNameToTitleHint("CERT_URBANISM")).toBe("Certificat urbanism");
  });

  // -------------------------------------------------------------------------
  // Diacritic-insensitive matching (Slice #23.03.Import)
  // -------------------------------------------------------------------------

  it("expands an abbreviation written with diacritics", () => {
    // "Încheiere Intabulare" is normally typed with the Î. Before #23.03 this
    // silently failed to expand, because \b does not treat "Î" as a word
    // character and so never matched at offset 0.
    expect(folderNameToTitleHint("Înch_Intab_2019")).toBe(
      "Incheiere Intabulare 2019",
    );
    expect(folderNameToTitleHint("înch intab")).toBe("Incheiere Intabulare");
  });

  it("accepts both encodings of ș/ț", () => {
    // Comma-below (U+0219, correct Romanian) and cedilla (U+015F, the legacy
    // form some keyboards and OCR still emit) must behave identically.
    expect(folderNameToTitleHint("Pș_1")).toBe("Plan de Situație 1");
    expect(folderNameToTitleHint("Pş_1")).toBe("Plan de Situație 1");
  });

  it("tolerates repeated whitespace inside a multi-word abbreviation", () => {
    expect(folderNameToTitleHint("Inch  Intab  7")).toBe(
      "Incheiere Intabulare 7",
    );
  });

  it("still requires a whole-word match", () => {
    // The diacritic classes must not loosen the boundaries: an abbreviation
    // embedded in a longer word is not an abbreviation.
    expect(folderNameToTitleHint("MyCVCfolder")).toBe("MyCVCfolder");
    expect(folderNameToTitleHint("Cinci acte")).toBe("Cinci acte");
    expect(folderNameToTitleHint("Personal")).toBe("Personal");
  });

  it("matches across non-letter separators, as \\b did", () => {
    expect(folderNameToTitleHint("3-CVC-2021")).toBe(
      "3-Contract de Vânzare-Cumpărare-2021",
    );
  });

  it("does not re-expand its own output", () => {
    // Every expansion value is itself scanned by the remaining keys, so a
    // value containing a standalone abbreviation would expand twice.
    const once = folderNameToTitleHint("CVC");
    expect(folderNameToTitleHint(once)).toBe(once);
    expect(folderNameToTitleHint("Antec")).toBe("Antecontract");
  });
});

// ---------------------------------------------------------------------------
// perToSlash
// ---------------------------------------------------------------------------

describe("perToSlash", () => {
  it("replaces 'per' with '/' (lowercase)", () => {
    expect(perToSlash("47per2")).toBe("47/2");
    expect(perToSlash("225per3per24")).toBe("225/3/24");
  });

  it("replaces 'per' case-insensitively", () => {
    expect(perToSlash("47PER2")).toBe("47/2");
    expect(perToSlash("47Per2")).toBe("47/2");
  });

  it("handles strings without 'per' unchanged", () => {
    expect(perToSlash("47")).toBe("47");
    expect(perToSlash("225")).toBe("225");
  });

  it("handles empty string", () => {
    expect(perToSlash("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// tagsForEntry
// ---------------------------------------------------------------------------

describe("tagsForEntry", () => {
  it("returns root + pathParts for a nested file", () => {
    const entry = {
      kind: "file" as const,
      name: "scan.txt",
      path: "47-225/scan.txt",
      pathParts: ["47-225"],
      handle: {} as never,
    };
    expect(tagsForEntry("casa", entry)).toEqual(["casa", "47-225"]);
  });

  it("returns root only for a top-level file", () => {
    const entry = {
      kind: "file" as const,
      name: "readme.txt",
      path: "readme.txt",
      pathParts: [],
      handle: {} as never,
    };
    expect(tagsForEntry("casa", entry)).toEqual(["casa"]);
  });

  it("includes the group folder name for a page-group entry", () => {
    const entry = {
      kind: "page-group" as const,
      name: "CVC_2021",
      path: "47-225/CVC_2021",
      pathParts: ["47-225", "CVC_2021"],
      handles: [],
      titleHint: "Contract de Vânzare-Cumpărare 2021",
    };
    expect(tagsForEntry("casa", entry)).toEqual(["casa", "47-225", "CVC_2021"]);
  });
});
