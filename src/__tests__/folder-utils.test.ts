/**
 * Unit tests for src/lib/import/folder-utils.ts
 *
 * Covers: isIgnoredFileName (7.9, #24.04), classifyIgnoredFileName and the walk's
 * observation contract (#24.02b), isPageGroup, parseFolderName,
 * folderNameToTitleHint, tagsForEntry.
 *
 * `walkFolder` used to be excluded here as "an integration-level concern".
 * #24.02b made that untenable: the pre-import report is built entirely from
 * what the walk observes, so an unobserved branch is a silently blind report,
 * and the stub needed is a dozen lines of async generator rather than the
 * integration harness the old note implied.
 */

import { checkFolder } from "@/lib/import/checks";
import {
  classifyIgnoredFileName,
  isIgnoredFileName,
  isPageGroup,
  parseFolderName,
  folderNameToTitleHint,
  tagsForEntry,
  perToSlash,
  walkFolder,
  MAX_WALK_DEPTH,
  MAX_WALK_DIRECTORIES,
  MAX_WALK_ENTRIES,
  type DirectoryObservation,
  type FSDirectoryHandle,
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

// ---------------------------------------------------------------------------
// The walk's observation contract  (Slice #24.02b)
// ---------------------------------------------------------------------------

/**
 * `walkFolder` gained an optional observer. The pre-import report is built
 * ENTIRELY from what it emits, so a directory the walk forgets to report is a
 * directory the report is silently blind to — and the walk has three exits
 * (page-group return, normal emit, and the empty-directory path), which is
 * exactly the shape that grows an unobserved branch.
 */
describe("walkFolder observation (#24.02b)", () => {
  type Child = { kind: "file"; name: string } | { kind: "directory"; name: string; children: Child[] };

  function handleFor(name: string, children: Child[]): FSDirectoryHandle {
    return {
      kind: "directory",
      name,
      async *values() {
        for (const c of children) {
          if (c.kind === "file") {
            yield { kind: "file", name: c.name, getFile: async () => new File([], c.name) } as never;
          } else {
            yield handleFor(c.name, c.children) as never;
          }
        }
      },
    } as unknown as FSDirectoryHandle;
  }

  const tree: Child[] = [
    { kind: "file", name: "contract.pdf" },
    { kind: "file", name: "Thumbs.db" },
    { kind: "directory", name: "Scan", children: [
      { kind: "file", name: "001.jpg" }, { kind: "file", name: "002.jpg" } ] },
    { kind: "directory", name: "Gol", children: [] },
    { kind: "directory", name: "Doar ignorate", children: [{ kind: "file", name: "plan.dwg" }] },
  ];

  it("reports every directory exactly once, including empty ones", async () => {
    const seen: DirectoryObservation[] = [];
    await walkFolder(handleFor("root", tree), [], (o) => seen.push(o));
    expect(seen.map((o) => o.path).sort()).toEqual(["", "Doar ignorate", "Gol", "Scan"]);
  });

  it("marks the page-group directory and only that one", async () => {
    const seen: DirectoryObservation[] = [];
    await walkFolder(handleFor("root", tree), [], (o) => seen.push(o));
    expect(seen.filter((o) => o.becamePageGroup).map((o) => o.path)).toEqual(["Scan"]);
  });

  it("reports dropped files with the rule that dropped them", async () => {
    const seen: DirectoryObservation[] = [];
    await walkFolder(handleFor("root", tree), [], (o) => seen.push(o));
    const root = seen.find((o) => o.path === "")!;
    expect(root.dropped.map((d) => [d.name, d.reason])).toEqual([["Thumbs.db", "system-file"]]);
    const ignored = seen.find((o) => o.path === "Doar ignorate")!;
    expect(ignored.dropped.map((d) => d.reason)).toEqual(["ignored-extension"]);
    // …and that directory contributes no entries at all, so the report is the
    // only place those files are ever mentioned.
    expect(ignored.keptNames).toEqual([]);
  });

  it("returns exactly what it returned before, observer or not", async () => {
    // The observer must be inert. If adding it changed the walk's output, every
    // downstream consumer would shift under a change advertised as diagnostic.
    const withOut = await walkFolder(handleFor("root", tree));
    const withObs = await walkFolder(handleFor("root", tree), [], () => {});
    expect(withObs.map((e) => `${e.kind}:${e.path}`)).toEqual(withOut.map((e) => `${e.kind}:${e.path}`));
  });
});

describe("classifyIgnoredFileName (#24.02b)", () => {
  it("names the rule, in the order the walk applies them", () => {
    expect(classifyIgnoredFileName(".DS_Store")).toBe("hidden");
    expect(classifyIgnoredFileName("Thumbs.db")).toBe("system-file");
    expect(classifyIgnoredFileName("desktop.ini")).toBe("system-file");
    expect(classifyIgnoredFileName("folder.jpg")).toBe("system-file");
    expect(classifyIgnoredFileName("plan.dwg")).toBe("ignored-extension");
    expect(classifyIgnoredFileName("scan.jpg")).toBeNull();
  });

  it("puts hidden ahead of extension, so a dotted .dwg is reported as hidden", () => {
    // Order is the part that matters: the report tells the user WHY a file
    // vanished, and two rules can both apply to one name.
    expect(classifyIgnoredFileName(".backup.dwg")).toBe("hidden");
  });

  it("still agrees with the boolean wrapper for every case", () => {
    for (const n of [".x", "Thumbs.db", "plan.dwg", "scan.jpg", "a.pdf", "folder.jpg"]) {
      expect(isIgnoredFileName(n)).toBe(classifyIgnoredFileName(n) !== null);
    }
  });
});

// ---------------------------------------------------------------------------
// The walk terminates  (Slice #26.00)
// ---------------------------------------------------------------------------

/**
 * These are the only tests in the suite whose failure mode is "the test run
 * never finishes". Before the guards existed, `cyclicHandle` below hung
 * `walkFolder` forever — which is precisely what it did to the wizard, with
 * no timeout, no cancel, and no exit but closing the tab.
 */
describe("walkFolder termination guards (#26.00)", () => {
  /**
   * A directory that contains ITSELF.
   *
   * This is not a contrived shape. A Windows directory junction or shortcut
   * pointing at one of its own ancestors produces exactly this, and the File
   * System Access API reports it as an ordinary subdirectory — there is
   * nothing in the handle to distinguish it from a real folder.
   */
  function cyclicHandle(name: string): FSDirectoryHandle {
    const self = {
      kind: "directory",
      name,
      async *values() {
        yield { kind: "file", name: "act.pdf", getFile: async () => new File([], "act.pdf") } as never;
        yield self as never;      // ← the junction
      },
    };
    return self as unknown as FSDirectoryHandle;
  }

  /** A directory with `width` self-referencing children — a branching cycle. */
  function branchingCycle(name: string, width: number): FSDirectoryHandle {
    const self = {
      kind: "directory",
      name,
      async *values() {
        for (let i = 0; i < width; i++) yield self as never;
      },
    };
    return self as unknown as FSDirectoryHandle;
  }

  function chain(depth: number): FSDirectoryHandle {
    const make = (d: number): FSDirectoryHandle =>
      ({
        kind: "directory",
        name: `d${d}`,
        async *values() {
          yield { kind: "file", name: `f${d}.pdf`, getFile: async () => new File([], "f.pdf") } as never;
          if (d < depth) yield make(d + 1) as never;
        },
      }) as unknown as FSDirectoryHandle;
    return make(0);
  }

  function wideTree(dirs: number): FSDirectoryHandle {
    return {
      kind: "directory",
      name: "root",
      async *values() {
        for (let i = 0; i < dirs; i++) {
          yield {
            kind: "directory",
            name: `sub-${i}`,
            async *values() {
              yield { kind: "file", name: "a.pdf", getFile: async () => new File([], "a.pdf") } as never;
            },
          } as never;
        }
      },
    } as unknown as FSDirectoryHandle;
  }

  /** A single directory that yields entries forever — breadth, not depth. */
  function endlessDirectory(): FSDirectoryHandle {
    return {
      kind: "directory",
      name: "Scanari",
      async *values() {
        for (let i = 0; ; i++) {
          yield { kind: "file", name: `p${i}.jpg`, getFile: async () => new File([], "p.jpg") } as never;
        }
      },
    } as unknown as FSDirectoryHandle;
  }

  it("TERMINATES on ONE folder that never stops yielding files", async () => {
    // The depth and directory guards are both irrelevant here: the walk never
    // returns from a single directory's enumeration, so neither is ever
    // consulted. The first version of this slice missed this entirely and
    // still claimed "the walk cannot hang" — in a browser this is an OOM tab,
    // not a slow read.
    const seen: DirectoryObservation[] = [];
    const entries = await walkFolder(endlessDirectory(), [], (o) => seen.push(o));
    expect(entries.length).toBeLessThanOrEqual(MAX_WALK_ENTRIES);
    expect(seen.some((o) => o.truncated === "breadth")).toBe(true);
  });

  it("keeps the truncation flag on a directory that BECAME a page group", async () => {
    // ⚠️ Slice #26.02. The page-group branch returns before the general
    // observation, and it used to omit `ranOutOfEntries` — so a directory
    // whose surviving names all happened to be numbered scans was reported as
    // a COMPLETE page group even though the walk had stopped part-way through
    // reading it. Nothing downstream could tell: S-17 stayed silent, and the
    // structure check, which suppresses "the pages run 1…n" on a partial
    // listing precisely so it cannot lie, saw no reason to. The user was told
    // to renumber a folder from 1 that was already numbered from 1, on every
    // round of the loop, forever.
    const numbered: FSDirectoryHandle = {
      kind: "directory",
      name: "Scan",
      async *values() {
        for (let i = 1; ; i++) {
          yield { kind: "file", name: `${i}.jpg`, getFile: async () => new File([], "p.jpg") } as never;
        }
      },
    } as unknown as FSDirectoryHandle;

    const seen: DirectoryObservation[] = [];
    await walkFolder(
      { kind: "directory", name: "root", async *values() { yield numbered as never; } } as unknown as FSDirectoryHandle,
      [],
      (o) => seen.push(o),
    );
    const scan = seen.find((o) => o.path === "Scan")!;
    expect(scan.becamePageGroup).toBe(true);
    expect(scan.truncated).toBe("breadth");
  });

  it("TERMINATES on a folder that contains itself", async () => {
    // If this regresses, this test does not fail — it hangs. That is the
    // point: it is the wizard's behaviour reproduced in a millisecond.
    const seen: DirectoryObservation[] = [];
    const entries = await walkFolder(cyclicHandle("Arhiva"), [], (o) => seen.push(o));
    expect(seen.some((o) => o.truncated !== undefined)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.length).toBeLessThan(MAX_WALK_DEPTH + 2);
  });

  it("terminates on a cycle that BRANCHES, where the depth cap alone is not enough", async () => {
    // Three self-links per level is 3^12 paths before the depth cap bites.
    // The directory budget is what actually stops this one.
    const seen: DirectoryObservation[] = [];
    await walkFolder(branchingCycle("Arhiva", 3), [], (o) => seen.push(o));
    expect(seen.filter((o) => o.truncated === "budget").length).toBeGreaterThan(0);
    expect(seen.length).toBeLessThan(MAX_WALK_DIRECTORIES * 4);
  });

  it("says WHY it stopped rather than returning a quietly smaller archive", async () => {
    const seen: DirectoryObservation[] = [];
    const entriesFromCycle = await walkFolder(cyclicHandle("Arhiva"), [], (o) => seen.push(o));
    const stopped = seen.filter((o) => o.truncated !== undefined);
    expect(stopped.length).toBeGreaterThan(0);
    expect(stopped[0].truncated).toBe("depth");
    // A shortcut loop does not SHRINK the archive, it multiplies it — the same
    // files are read again under `Arhiva/Arhiva/…`. The report's numbers come
    // out inflated, which is why its message says "do not import".
    expect(entriesFromCycle.length).toBeGreaterThan(1);
    // A refused directory reports nothing read — the report must not mistake
    // "I could not look" for "there was nothing there".
    expect(stopped[0].keptNames).toEqual([]);
    expect(stopped[0].dirNames).toEqual([]);
  });

  it("reads a chain right up to the limit without complaining", async () => {
    const seen: DirectoryObservation[] = [];
    const entries = await walkFolder(chain(MAX_WALK_DEPTH), [], (o) => seen.push(o));
    expect(seen.some((o) => o.truncated !== undefined)).toBe(false);
    expect(entries).toHaveLength(MAX_WALK_DEPTH + 1);
  });

  it("stops one level past the limit", async () => {
    const seen: DirectoryObservation[] = [];
    await walkFolder(chain(MAX_WALK_DEPTH + 3), [], (o) => seen.push(o));
    expect(seen.filter((o) => o.truncated === "depth").length).toBe(1);
  });

  it("does not put ten thousand near-identical paths in the finding", async () => {
    // A branching cycle truncates in ~10,000 places whose paths are the same
    // folder name in 10,000 combinations. The first version of this rule put
    // every one of them in the finding, which the HTML export then wrote out
    // in full. The count must stay true while the list stays readable.
    const obs: DirectoryObservation[] = [];
    const entries = await walkFolder(branchingCycle("X", 3), [], (o) => obs.push(o));
    const { findings } = checkFolder({ entries, observations: obs });
    const truncation = findings.filter((f) =>
      ["walkLoopedOnShortcut", "walkTooManyFolders", "walkTooManyFiles"].includes(f.kind),
    );
    expect(truncation.length).toBeGreaterThan(0);
    for (const f of truncation) {
      expect(f.paths).toHaveLength(1);
      expect(f.counts.places).toBeGreaterThan(1);   // the total is not hidden
    }
  });

  it("leaves a real archive completely untouched", async () => {
    // The deepest real folder is 5 levels and 118 directories; the guards sit
    // at 12 and 5000. This pins that they are nowhere near ordinary use.
    const seen: DirectoryObservation[] = [];
    const entries = await walkFolder(wideTree(118), [], (o) => seen.push(o));
    expect(seen.some((o) => o.truncated !== undefined)).toBe(false);
    expect(entries).toHaveLength(118);
  });
});
