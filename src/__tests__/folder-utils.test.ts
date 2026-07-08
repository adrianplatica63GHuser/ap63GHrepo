/**
 * Unit tests for src/lib/import/folder-utils.ts
 *
 * Covers: isSystemFile (7.9), isPageGroup, parseFolderName, folderNameToTitleHint,
 * tagsForEntry.  walkFolder is not tested here (requires a real FSDirectoryHandle
 * stub — integration-level concern).
 */

import {
  extOf,
  isImageName,
  isSystemFile,
  isPageGroup,
  parseFolderName,
  folderNameToTitleHint,
  tagsForEntry,
} from "@/lib/import/folder-utils";

// ---------------------------------------------------------------------------
// isSystemFile (fix 7.9)
// ---------------------------------------------------------------------------

describe("isSystemFile", () => {
  it("rejects hidden files (leading dot)", () => {
    expect(isSystemFile(".DS_Store")).toBe(true);
    expect(isSystemFile(".gitkeep")).toBe(true);
    expect(isSystemFile("._metadata")).toBe(true);
  });

  it("rejects known Windows system files (case-insensitive)", () => {
    expect(isSystemFile("Thumbs.db")).toBe(true);
    expect(isSystemFile("thumbs.db")).toBe(true);
    expect(isSystemFile("THUMBS.DB")).toBe(true);
    expect(isSystemFile("desktop.ini")).toBe(true);
    expect(isSystemFile("Desktop.ini")).toBe(true);
    expect(isSystemFile("ehthumbs.db")).toBe(true);
  });

  it("accepts normal image files", () => {
    expect(isSystemFile("001.jpg")).toBe(false);
    expect(isSystemFile("scan.png")).toBe(false);
  });

  it("accepts normal document files", () => {
    expect(isSystemFile("contract.pdf")).toBe(false);
    expect(isSystemFile("titlu.txt")).toBe(false);
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

  // Demonstrates the 7.9 fix: callers pre-filter system files so isPageGroup
  // only sees the real image files.
  it("returns true for filtered list after removing system files", () => {
    const allNames = ["001.jpg", "002.jpg", "003.jpg", "Thumbs.db", ".DS_Store"];
    const filtered = allNames.filter((n) => !isSystemFile(n));
    expect(filtered).toEqual(["001.jpg", "002.jpg", "003.jpg"]);
    expect(isPageGroup(filtered)).toBe(true);
  });

  it("returns false when system files are NOT filtered (pre-7.9 behaviour)", () => {
    const allNames = ["001.jpg", "002.jpg", "Thumbs.db"];
    // Without filtering, Thumbs.db (non-image, non-numeric) breaks the group.
    expect(isPageGroup(allNames)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extOf / isImageName
// ---------------------------------------------------------------------------

describe("extOf", () => {
  it("returns lowercase extension with dot", () => {
    expect(extOf("photo.JPG")).toBe(".jpg");
    expect(extOf("file.tar.gz")).toBe(".gz");
  });

  it("returns empty string for no extension", () => {
    expect(extOf("README")).toBe("");
  });
});

describe("isImageName", () => {
  it("recognises image extensions", () => {
    expect(isImageName("001.jpg")).toBe(true);
    expect(isImageName("img.PNG")).toBe(true);
    expect(isImageName("photo.TIFF")).toBe(true);
  });

  it("rejects non-image extensions", () => {
    expect(isImageName("doc.pdf")).toBe(false);
    expect(isImageName("data.txt")).toBe(false);
  });
});

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
