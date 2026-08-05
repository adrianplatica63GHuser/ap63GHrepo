/**
 * Unit tests for src/lib/files/file-kinds.ts   (Slice #24.03)
 *
 * Two jobs:
 *
 *  1. Pin the registry's own contract — the extractor, the kinds, and the two
 *     membership decisions this slice took.
 *  2. Pin the AGREEMENT between the registry and every derived view of it.
 *     Those views (`IMAGE_EXTENSIONS`, `DOCUMENT_EXTENSIONS`,
 *     `COORDINATE_FILE_EXTS`, `isPageGroup`) are what the seven old copies
 *     collapsed into, so a test that only checked the registry would let a
 *     view silently stop deriving and nothing would fail.
 *
 * Wherever a case list can be driven off the exported constants it is, rather
 * than being re-typed here — a hand-copied list in a test is the eighth copy.
 */

import {
  FILE_KINDS,
  KNOWN_EXTENSIONS,
  bareExtensionOf,
  bareExtensionsOfKind,
  extensionOf,
  extensionsOfKind,
  fileKindsOf,
  isFileKind,
  isImageOrPdf,
  isPageGroupMember,
  isUnknownFileKind,
  type FileKind,
} from "@/lib/files/file-kinds";
import { COORDINATE_FILE_EXTS } from "@/lib/import/coordinate-file";
import { isPageGroup } from "@/lib/import/folder-utils";
import {
  DOCUMENT_EXTENSIONS,
  IMAGE_EXTENSIONS,
  classifyFileSource,
  fileExtension,
} from "@/lib/metadata/provenance-rules";

// ---------------------------------------------------------------------------
// extensionOf — the one extractor, replacing extOf and fileExtension
// ---------------------------------------------------------------------------

describe("extensionOf", () => {
  it("returns the lowercase extension with its dot", () => {
    expect(extensionOf("photo.JPG")).toBe(".jpg");
    expect(extensionOf("Scan.JPEG")).toBe(".jpeg");
  });

  it("takes only the final extension", () => {
    expect(extensionOf("file.tar.gz")).toBe(".gz");
    expect(extensionOf("act.semnat.v2.pdf")).toBe(".pdf");
    expect(extensionOf("coordonate.txt.pdf")).toBe(".pdf");
  });

  it("returns empty string when there is no extension", () => {
    expect(extensionOf("README")).toBe("");
    expect(extensionOf("")).toBe("");
  });

  it("strips path segments first, POSIX and Windows alike", () => {
    // Inherited from the former `fileExtension`; the former `extOf` was
    // path-blind and would have read a dot out of a folder name.
    expect(extensionOf("1-2-livada/001.png")).toBe(".png");
    expect(extensionOf("C:\\dev\\scan.tif")).toBe(".tif");
    expect(extensionOf("Arhiva.2024/README")).toBe("");
  });

  it("treats a dotfile as extensionless", () => {
    // `.gitignore` is a file NAMED ".gitignore", not a file with extension
    // ".gitignore" — the former `extOf` disagreed and nothing depended on it.
    expect(extensionOf(".gitignore")).toBe("");
    expect(extensionOf(".DS_Store")).toBe("");
  });
});

describe("bareExtensionOf", () => {
  it("is extensionOf without the dot", () => {
    expect(bareExtensionOf("photo.JPG")).toBe("jpg");
    expect(bareExtensionOf("README")).toBe("");
    expect(bareExtensionOf(".gitignore")).toBe("");
  });

  it("still backs fileExtension in provenance-rules", () => {
    // The expected values are written out, not taken from `bareExtensionOf`:
    // `fileExtension` is a one-line delegation to it, so comparing the two
    // would be `g(x) === g(x)` and could not catch both being wrong. The
    // delegation is then asserted separately.
    const CASES: [string, string][] = [
      ["Scan.JPG", "jpg"],
      ["act.semnat.v2.pdf", "pdf"],
      ["1-2-livada/001.png", "png"],
      ["C:\\dev\\scan.tif", "tif"],
      ["README", ""],
      [".gitignore", ""],
    ];
    for (const [name, expected] of CASES) {
      expect(fileExtension(name)).toBe(expected);
      expect(fileExtension(name)).toBe(bareExtensionOf(name));
    }
  });
});

// ---------------------------------------------------------------------------
// Registry shape — invariants that must hold whatever the membership is
// ---------------------------------------------------------------------------

describe("the registry is well formed", () => {
  it("knows some extensions", () => {
    expect(KNOWN_EXTENSIONS.length).toBeGreaterThan(10);
  });

  it("hands out nothing a caller can write to", () => {
    // Seven private copies became one shared table; a writable shared table
    // would be a worse bug than the drift it replaced, because one stray
    // push() would change what EVERY module believes about EVERY file.
    expect(Object.isFrozen(KNOWN_EXTENSIONS)).toBe(true);
    expect(Object.isFrozen(FILE_KINDS)).toBe(true);
    expect(Object.isFrozen(fileKindsOf("a.jpg"))).toBe(true);
    expect(Object.isFrozen(fileKindsOf("a.dwg"))).toBe(true);   // the empty case

    // A Set cannot be frozen, so extensionsOfKind must hand back a copy.
    const mine = extensionsOfKind("image") as Set<string>;
    mine.add(".heic");
    expect(extensionsOfKind("image").has(".heic")).toBe(false);
    expect(isFileKind("a.heic", "image")).toBe(false);
  });

  it("keys every extension dotted and lowercase", () => {
    for (const ext of KNOWN_EXTENSIONS) {
      expect(ext).toMatch(/^\.[a-z0-9]+$/);
    }
  });

  it("gives every known extension at least one kind", () => {
    for (const ext of KNOWN_EXTENSIONS) {
      expect(fileKindsOf(`file${ext}`).length).toBeGreaterThan(0);
    }
  });

  it("leaves no kind empty", () => {
    for (const kind of FILE_KINDS) {
      expect(extensionsOfKind(kind).size).toBeGreaterThan(0);
    }
  });

  it("puts every kind's extensions back in the known set", () => {
    for (const kind of FILE_KINDS) {
      for (const ext of extensionsOfKind(kind)) {
        expect(KNOWN_EXTENSIONS).toContain(ext);
      }
    }
  });

  it("never makes one extension both an image and a document", () => {
    // classifyFileSource tests image before document; this invariant is what
    // makes that ordering a formality rather than a silent tie-break.
    for (const ext of extensionsOfKind("image")) {
      expect(extensionsOfKind("document").has(ext)).toBe(false);
    }
  });

  it("is case-insensitive on the extension", () => {
    // "photo.TIFF" and "data.txt" come from the isImageName cases that lived in
    // folder-utils.test.ts before Slice #24.03.
    expect(isFileKind("CORNERS.TXT", "coordinate-candidate")).toBe(true);
    expect(isFileKind("photo.JPG", "image")).toBe(true);
    expect(isFileKind("img.PNG", "image")).toBe(true);
    expect(isFileKind("photo.TIFF", "image")).toBe(true);
    expect(isFileKind("Contract.PDF", "pdf")).toBe(true);
    expect(isFileKind("doc.pdf", "image")).toBe(false);
    expect(isFileKind("data.txt", "image")).toBe(false);
  });

  it("answers an unknown extension with no kinds at all", () => {
    for (const n of ["plan.dwg", "archive.zip", "mail.msg", "noext", ""]) {
      expect(fileKindsOf(n)).toEqual([]);
      expect(isUnknownFileKind(n)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// The two membership decisions taken in this slice
// ---------------------------------------------------------------------------

describe("Slice #24.03 membership decisions", () => {
  it("puts .heic and .heif in no kind at all", () => {
    for (const kind of FILE_KINDS) {
      expect(extensionsOfKind(kind).has(".heic")).toBe(false);
      expect(extensionsOfKind(kind).has(".heif")).toBe(false);
    }
    expect(isUnknownFileKind("IMG_0001.heic")).toBe(true);
    expect(isUnknownFileKind("IMG_0001.HEIF")).toBe(true);
  });

  it("puts .dat and .asc in no kind at all", () => {
    for (const kind of FILE_KINDS) {
      expect(extensionsOfKind(kind).has(".dat")).toBe(false);
      expect(extensionsOfKind(kind).has(".asc")).toBe(false);
    }
    expect(isUnknownFileKind("corners.dat")).toBe(true);
    expect(isUnknownFileKind("corners.asc")).toBe(true);
  });

  it("leaves .csv a document but no longer a coordinate candidate", () => {
    // Unlike .dat/.asc it keeps a kind, so it still infers DOC_FILE provenance
    // and imports exactly as before. What it lost is being OFFERED in the
    // property step as a possible source of corners.
    expect(isFileKind("date.csv", "document")).toBe(true);
    expect(isFileKind("date.csv", "coordinate-candidate")).toBe(false);
    expect(classifyFileSource("date.csv")).toBe("DOCUMENT_FILE");
  });

  it("gives a file whose WHOLE name is an extension no kind at all", () => {
    // A consequence of adopting the stricter extractor, not a decision: the
    // former `extOf` called ".txt" a .txt file. Unreachable through the wizard
    // (`isSystemFile` drops every dot-leading name before the walk emits it),
    // pinned here so it stays a known answer rather than a surprise if that
    // filter is ever relaxed.
    for (const n of [".txt", ".jpg", ".pdf", ".csv"]) {
      expect(isUnknownFileKind(n)).toBe(true);
    }
    expect(classifyFileSource(".jpg")).toBe("UNKNOWN");
  });

  it("makes a HEIC ask for provenance rather than be guessed", () => {
    // The point of refusing it: UNKNOWN reaches the import gate as a question,
    // where IMAGE reached it as an answer nothing had verified.
    expect(classifyFileSource("IMG_0001.heic")).toBe("UNKNOWN");
  });
});

// ---------------------------------------------------------------------------
// Derived views must keep deriving
// ---------------------------------------------------------------------------

describe("every derived view still agrees with the registry", () => {
  // Each of these asserts TWO things, and both are needed. The hand-written
  // value is what makes the test capable of failing at all: comparing a view
  // to `extensionsOfKind(...)` alone is `f(x) === f(x)`, true no matter how
  // wrong the registry is. The comparison to the registry is what catches the
  // other direction — a view quietly replaced by a re-typed literal that
  // happens to be right today and drifts tomorrow.

  it("COORDINATE_FILE_EXTS is the coordinate-candidate kind", () => {
    expect([...COORDINATE_FILE_EXTS].sort()).toEqual([".txt"]);
    expect([...COORDINATE_FILE_EXTS].sort()).toEqual(
      [...extensionsOfKind("coordinate-candidate")].sort(),
    );
  });

  it("IMAGE_EXTENSIONS is the image kind, dotless", () => {
    expect([...IMAGE_EXTENSIONS].sort()).toEqual([
      "bmp", "gif", "jpeg", "jpg", "png", "tif", "tiff", "webp",
    ]);
    expect([...IMAGE_EXTENSIONS].sort()).toEqual([...bareExtensionsOfKind("image")].sort());
  });

  it("DOCUMENT_EXTENSIONS is the document kind, dotless", () => {
    expect([...DOCUMENT_EXTENSIONS].sort()).toEqual([
      "csv", "doc", "docx", "odt", "pdf", "rtf", "txt", "xls", "xlsx",
    ]);
    expect([...DOCUMENT_EXTENSIONS].sort()).toEqual([...bareExtensionsOfKind("document")].sort());
  });

  it("classifyFileSource answers every known extension the way this table says", () => {
    // Written out rather than derived on purpose. Deriving `expected` from
    // `isFileKind` would re-implement the function under test — it would pass
    // whatever the registry said, and would not notice the image/document
    // branches being swapped. A hand-written table is the only thing here that
    // can actually disagree, and a new extension arriving without a line in it
    // fails the completeness check below, which is the point.
    const EXPECTED: Record<string, string> = {
      ".jpg": "IMAGE_FILE",
      ".jpeg": "IMAGE_FILE",
      ".png": "IMAGE_FILE",
      ".gif": "IMAGE_FILE",
      ".webp": "IMAGE_FILE",
      ".bmp": "IMAGE_FILE",
      ".tif": "IMAGE_FILE",
      ".tiff": "IMAGE_FILE",
      ".pdf": "DOCUMENT_FILE",
      ".doc": "DOCUMENT_FILE",
      ".docx": "DOCUMENT_FILE",
      ".rtf": "DOCUMENT_FILE",
      ".odt": "DOCUMENT_FILE",
      ".xls": "DOCUMENT_FILE",
      ".xlsx": "DOCUMENT_FILE",
      ".txt": "DOCUMENT_FILE",
      ".csv": "DOCUMENT_FILE",
    };

    expect([...KNOWN_EXTENSIONS].sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const [ext, expected] of Object.entries(EXPECTED)) {
      expect(classifyFileSource(`file${ext}`)).toBe(expected);
    }
  });

  it("isPageGroup accepts exactly the folders whose every file is a member", () => {
    expect(isPageGroup(["001.jpg", "002.jpg", "003.png"])).toBe(true);
    expect(isPageGroup(["001.jpg", "002.txt"])).toBe(false);
    expect(isPageGroup([])).toBe(false);
    // The regression that motivated the slice: a folder of iPhone scans.
    expect(isPageGroup(["001.heic", "002.heic"])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Derived questions
// ---------------------------------------------------------------------------

describe("isImageOrPdf", () => {
  it("accepts every image and the PDF", () => {
    for (const ext of extensionsOfKind("image")) expect(isImageOrPdf(`a${ext}`)).toBe(true);
    for (const ext of extensionsOfKind("pdf"))   expect(isImageOrPdf(`a${ext}`)).toBe(true);
  });

  it("rejects text and Word files, which no model can be shown directly", () => {
    for (const n of ["puncte.txt", "nota.docx", "tabel.xlsx", "corners.csv"]) {
      expect(isImageOrPdf(n)).toBe(false);
    }
  });
});

describe("isPageGroupMember", () => {
  it("accepts a numbered image", () => {
    expect(isPageGroupMember("001.jpg")).toBe(true);
    expect(isPageGroupMember("1.PNG")).toBe(true);
    expect(isPageGroupMember("0012.tiff")).toBe(true);
  });

  it("rejects a named image", () => {
    expect(isPageGroupMember("scan.jpg")).toBe(false);
    expect(isPageGroupMember("001a.jpg")).toBe(false);
    expect(isPageGroupMember("001 (2).jpg")).toBe(false);
  });

  it("rejects a numbered non-image", () => {
    expect(isPageGroupMember("001.pdf")).toBe(false);
    expect(isPageGroupMember("001.txt")).toBe(false);
    expect(isPageGroupMember("001.heic")).toBe(false);
  });

  it("rejects a name with no extension", () => {
    expect(isPageGroupMember("001")).toBe(false);
    expect(isPageGroupMember("")).toBe(false);
  });

  it("accepts exactly the eight image extensions, numbered", () => {
    // Both sides written out. Deriving the two groups from `extensionsOfKind`
    // would reach the same REGISTRY that `isPageGroupMember` reaches through
    // `isFileKind`, so the test would agree with the code by construction
    // however wrong the table was.
    const ACCEPTS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff"];
    const REJECTS = [".pdf", ".doc", ".docx", ".rtf", ".odt", ".xls", ".xlsx", ".txt", ".csv"];

    // Between them they must be the whole registry, or this test is checking
    // a subset and calling it "every".
    expect([...ACCEPTS, ...REJECTS].sort()).toEqual([...KNOWN_EXTENSIONS].sort());

    for (const ext of ACCEPTS) expect(isPageGroupMember(`001${ext}`)).toBe(true);
    for (const ext of REJECTS) expect(isPageGroupMember(`001${ext}`)).toBe(false);
  });

  it("rejects a path, so page ORDER cannot silently become NaN", () => {
    // The old inline rule tested the numeric prefix against the whole string,
    // so "sub/001.jpg" was never a member. `sortNumericFilenames` parseInt()s
    // that same prefix — admitting a path would make the page order inside the
    // document engine-defined rather than 1, 2, 3.
    expect(isPageGroupMember("sub/001.jpg")).toBe(false);
    expect(isPageGroupMember("Sub\\001.jpg")).toBe(false);
    expect(isPageGroup(["sub/001.jpg", "sub/002.jpg"])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Exhaustiveness — a new kind cannot be added without being listed
// ---------------------------------------------------------------------------

describe("FILE_KINDS", () => {
  it("has no duplicates", () => {
    expect(new Set(FILE_KINDS).size).toBe(FILE_KINDS.length);
  });

  it("covers every kind any known extension claims", () => {
    const claimed = new Set<FileKind>();
    for (const ext of KNOWN_EXTENSIONS) {
      for (const kind of fileKindsOf(`file${ext}`)) claimed.add(kind);
    }
    for (const kind of claimed) expect(FILE_KINDS).toContain(kind);
  });
});
