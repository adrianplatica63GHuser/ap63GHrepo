/**
 * Unit tests for the provenance value set and the automatic-assignment rules
 * (Slice #21.07.Import).
 *
 * These rules decide what the system records about where a record came from —
 * and, just as importantly, when it must stop and ask the user instead of
 * guessing. Both halves are covered here.
 */

import {
  PROVENANCE_VALUES,
  isProvenanceCode,
  provenanceI18nKey,
  provenanceFromRequestBody,
  type ProvenanceCode,
} from "@/lib/metadata/provenance";
import {
  inferProvenance,
  inferProvenanceForFiles,
  classifyFileSource,
  fileExtension,
} from "@/lib/metadata/provenance-rules";

// ---------------------------------------------------------------------------
// The value set
// ---------------------------------------------------------------------------

describe("PROVENANCE_VALUES", () => {
  it("is exactly the 7 codes Adrian specified", () => {
    expect([...PROVENANCE_VALUES]).toEqual([
      "MANUAL",
      "IMAGE",
      "DOC_FILE",
      "COORDINATE_FILE",
      "ALGORITHM",
      "AI_INTERPRETED",
      "EXTERNAL_FEED",
    ]);
  });

  it("no longer contains any of the pre-migration_067 codes", () => {
    const retired = ["IMAGE_UPLOAD", "TEXT_FILE", "EXTERNAL_IMPORT"];
    for (const code of retired) {
      expect(PROVENANCE_VALUES as readonly string[]).not.toContain(code);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(PROVENANCE_VALUES).size).toBe(PROVENANCE_VALUES.length);
  });
});

describe("isProvenanceCode", () => {
  it("accepts every code in the set", () => {
    for (const code of PROVENANCE_VALUES) {
      expect(isProvenanceCode(code)).toBe(true);
    }
  });

  it("rejects retired codes, near-misses and non-strings", () => {
    for (const bad of ["TEXT_FILE", "manual", "", "DOC-FILE", null, undefined, 7, {}, []]) {
      expect(isProvenanceCode(bad)).toBe(false);
    }
  });
});

describe("provenanceI18nKey", () => {
  it("converts SNAKE_CASE to camelCase", () => {
    expect(provenanceI18nKey("MANUAL")).toBe("manual");
    expect(provenanceI18nKey("IMAGE")).toBe("image");
    expect(provenanceI18nKey("DOC_FILE")).toBe("docFile");
    expect(provenanceI18nKey("COORDINATE_FILE")).toBe("coordinateFile");
    expect(provenanceI18nKey("AI_INTERPRETED")).toBe("aiInterpreted");
    expect(provenanceI18nKey("EXTERNAL_FEED")).toBe("externalFeed");
  });

  it("produces a distinct key for every code", () => {
    const keys = PROVENANCE_VALUES.map(provenanceI18nKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ---------------------------------------------------------------------------
// provenanceFromRequestBody — the network boundary
// ---------------------------------------------------------------------------

describe("provenanceFromRequestBody", () => {
  it("reads a valid code", () => {
    expect(provenanceFromRequestBody({ provenance: "IMAGE" })).toBe("IMAGE");
  });

  it("returns null for an absent field", () => {
    expect(provenanceFromRequestBody({ nickname: "x" })).toBeNull();
  });

  it("returns null rather than trusting an unknown or retired value", () => {
    expect(provenanceFromRequestBody({ provenance: "TEXT_FILE" })).toBeNull();
    expect(provenanceFromRequestBody({ provenance: "HAXX" })).toBeNull();
    expect(provenanceFromRequestBody({ provenance: 42 })).toBeNull();
    expect(provenanceFromRequestBody({ provenance: null })).toBeNull();
  });

  it("survives a non-object body", () => {
    expect(provenanceFromRequestBody(null)).toBeNull();
    expect(provenanceFromRequestBody(undefined)).toBeNull();
    expect(provenanceFromRequestBody("IMAGE")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// inferProvenance — Adrian's three explicit rules first
// ---------------------------------------------------------------------------

describe("inferProvenance — the specified rules", () => {
  it("a Property built from a coordinate file is COORDINATE_FILE", () => {
    expect(inferProvenance("COORDINATE_FILE")).toBe("COORDINATE_FILE");
  });

  it("a Document created from a graphics file is IMAGE", () => {
    expect(inferProvenance("IMAGE_FILE")).toBe("IMAGE");
  });

  it("a Person created from an AI interpretation is AI_INTERPRETED", () => {
    expect(inferProvenance("AI_EXTRACTION")).toBe("AI_INTERPRETED");
  });
});

describe("inferProvenance — the rest of the surface", () => {
  it("an Add-new form is MANUAL", () => {
    expect(inferProvenance("MANUAL_FORM")).toBe("MANUAL");
  });

  it("a PDF/DOC/TXT file is DOC_FILE", () => {
    expect(inferProvenance("DOCUMENT_FILE")).toBe("DOC_FILE");
  });

  it("the Calculation feature is ALGORITHM", () => {
    expect(inferProvenance("CALCULATION")).toBe("ALGORITHM");
  });

  it("returns null for UNKNOWN — the signal to ask the user", () => {
    expect(inferProvenance("UNKNOWN")).toBeNull();
  });

  it("only ever returns a code that is in the value set", () => {
    const sources = [
      "MANUAL_FORM", "COORDINATE_FILE", "IMAGE_FILE",
      "DOCUMENT_FILE", "AI_EXTRACTION", "CALCULATION", "UNKNOWN",
    ] as const;
    for (const source of sources) {
      const code = inferProvenance(source);
      if (code !== null) expect(PROVENANCE_VALUES as readonly string[]).toContain(code);
    }
  });
});

// ---------------------------------------------------------------------------
// File classification
// ---------------------------------------------------------------------------

describe("fileExtension", () => {
  it("lowercases and drops the dot", () => {
    expect(fileExtension("Scan.JPG")).toBe("jpg");
    expect(fileExtension("contract.pdf")).toBe("pdf");
  });

  it("uses the last dot only", () => {
    expect(fileExtension("act.semnat.v2.pdf")).toBe("pdf");
  });

  it("returns empty for a name with no extension", () => {
    expect(fileExtension("README")).toBe("");
  });

  it("does not treat a dotfile's name as an extension", () => {
    expect(fileExtension(".gitignore")).toBe("");
  });

  it("ignores directory separators", () => {
    expect(fileExtension("1-2-livada/001.png")).toBe("png");
    expect(fileExtension("C:\\dev\\scan.tif")).toBe("tif");
  });
});

describe("classifyFileSource", () => {
  it("recognises graphics files", () => {
    for (const n of ["a.jpg", "a.JPEG", "a.png", "a.gif", "a.tif", "a.tiff", "a.bmp", "a.webp"]) {
      expect(classifyFileSource(n)).toBe("IMAGE_FILE");
    }
  });

  it("recognises document files", () => {
    for (const n of ["a.pdf", "a.doc", "a.docx", "a.txt", "a.rtf", "a.odt", "a.xlsx"]) {
      expect(classifyFileSource(n)).toBe("DOCUMENT_FILE");
    }
  });

  it("returns UNKNOWN for anything else, so the user gets asked", () => {
    for (const n of ["plan.dwg", "archive.zip", "mail.msg", "noext"]) {
      expect(classifyFileSource(n)).toBe("UNKNOWN");
    }
  });

  it("no longer treats HEIC as a graphics file (Slice #24.03)", () => {
    // .heic/.heif were images HERE and in no other list, so a HEIC scan was
    // stamped IMAGE while failing page-group detection and the AI gate. They
    // now belong to no kind, which means UNKNOWN — and UNKNOWN means the
    // import gate asks the user instead of guessing.
    expect(classifyFileSource("a.heic")).toBe("UNKNOWN");
    expect(classifyFileSource("a.HEIF")).toBe("UNKNOWN");
  });

  it("treats .xls and .csv as document files", () => {
    // Both were in DOCUMENT_EXTENSIONS and neither was ever asserted.
    expect(classifyFileSource("a.xls")).toBe("DOCUMENT_FILE");
    expect(classifyFileSource("a.csv")).toBe("DOCUMENT_FILE");
  });

  it("never guesses COORDINATE_FILE from a .txt name", () => {
    // A .txt may be a cadastral coordinate file or ordinary prose; only the
    // code path that actually parses coordinates may claim COORDINATE_FILE.
    expect(classifyFileSource("puncte.txt")).toBe("DOCUMENT_FILE");
  });
});

// ---------------------------------------------------------------------------
// Multi-file inference — the "ask the user" boundary
// ---------------------------------------------------------------------------

describe("inferProvenanceForFiles", () => {
  it("infers IMAGE for a page-group of scans", () => {
    expect(inferProvenanceForFiles(["001.jpg", "002.jpg", "003.png"])).toBe("IMAGE");
  });

  it("infers DOC_FILE for a set of documents", () => {
    expect(inferProvenanceForFiles(["a.pdf", "b.docx"])).toBe("DOC_FILE");
  });

  it("infers from a single file", () => {
    expect(inferProvenanceForFiles(["contract.pdf"])).toBe("DOC_FILE");
    expect(inferProvenanceForFiles(["scan.jpg"])).toBe("IMAGE");
  });

  it("asks the user when the selection mixes kinds", () => {
    expect(inferProvenanceForFiles(["scan.jpg", "contract.pdf"])).toBeNull();
  });

  it("asks the user when any file is unrecognised", () => {
    expect(inferProvenanceForFiles(["001.jpg", "plan.dwg"])).toBeNull();
  });

  it("asks the user for an empty list", () => {
    expect(inferProvenanceForFiles([])).toBeNull();
  });

  it("is order-independent", () => {
    expect(inferProvenanceForFiles(["contract.pdf", "scan.jpg"])).toBeNull();
    expect(inferProvenanceForFiles(["scan.jpg", "contract.pdf"])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Type-level guard: every code is reachable from some rule or is user-only
// ---------------------------------------------------------------------------

describe("rule coverage", () => {
  it("every code except EXTERNAL_FEED is produced by some source kind", () => {
    const sources = [
      "MANUAL_FORM", "COORDINATE_FILE", "IMAGE_FILE",
      "DOCUMENT_FILE", "AI_EXTRACTION", "CALCULATION",
    ] as const;
    const produced = new Set<ProvenanceCode>();
    for (const s of sources) {
      const code = inferProvenance(s);
      if (code) produced.add(code);
    }
    const unreachable = PROVENANCE_VALUES.filter((c) => !produced.has(c));
    // EXTERNAL_FEED has no automatic source yet — there is no external feed
    // wired up, so it exists only as a manual pick. If a feed is ever added,
    // this test is the reminder to give it a rule.
    expect(unreachable).toEqual(["EXTERNAL_FEED"]);
  });
});
