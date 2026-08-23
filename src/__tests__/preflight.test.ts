/**
 * Unit tests for src/lib/import/preflight.ts   (Slice #24.02a)
 *
 * Two things worth pinning:
 *
 *  1. **The checklist's three-valued logic.** "Not asked yet" and "asked and
 *     failed" must never render the same, because they send the user to
 *     different places — one to the Check again button, the other to an
 *     administrator. Most of the bugs available here are in that distinction.
 *  2. **The forecast agrees with the run it predicts.** These numbers are the
 *     argument on the Continue button. A forecast that quietly disagrees with
 *     what the import actually does is worse than none, because it is believed.
 */

import {
  PREFLIGHT_CHECK_IDS,
  SERVER_CHECK_IDS,
  allChecksPass,
  buildChecklist,
  forecastImport,
  type PreflightCheck,
  type PreflightServerReport,
} from "@/lib/import/preflight";
import type { FSEntry, FSFileEntry, FSPageGroupEntry } from "@/lib/import/folder-utils";
import { uploadKeysOf } from "@/lib/import/checks";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ALL_GOOD: PreflightServerReport = {
  documentTypes: true,
  classification: true,
  storage: true,
  database: true,
};

/** Every client-answered line green — the "browser is fine" baseline. */
const CLIENT_OK = { browserSupported: true, pdfWorkerReachable: true } as const;

function statusOf(checks: PreflightCheck[], id: string) {
  return checks.find((c) => c.id === id)?.status;
}

function fileEntry(path: string): FSFileEntry {
  const name = path.split("/").pop()!;
  const parts = path.split("/").slice(0, -1);
  return {
    kind: "file",
    name,
    path,
    pathParts: parts,
    handle: { kind: "file", name, getFile: async () => new File([], name) },
  };
}

function pageGroupEntry(path: string, pageNames: string[]): FSPageGroupEntry {
  const parts = path.split("/");
  return {
    kind: "page-group",
    name: parts[parts.length - 1],
    path,
    pathParts: parts,
    handles: pageNames.map((n) => ({
      kind: "file" as const,
      name: n,
      getFile: async () => new File([], n),
    })),
    titleHint: parts[parts.length - 1],
  };
}

// ---------------------------------------------------------------------------
// buildChecklist
// ---------------------------------------------------------------------------

describe("buildChecklist", () => {
  it("returns every check, in the declared order", () => {
    const checks = buildChecklist({ ...CLIENT_OK, server: ALL_GOOD });
    expect(checks.map((c) => c.id)).toEqual([...PREFLIGHT_CHECK_IDS]);
  });

  it("passes everything when the browser is capable and the server is happy", () => {
    const checks = buildChecklist({ ...CLIENT_OK, server: ALL_GOOD });
    expect(checks.every((c) => c.status === "pass")).toBe(true);
    expect(allChecksPass(checks)).toBe(true);
  });

  it("marks every server line unknown — not failed — before the answer arrives", () => {
    // The distinction the whole component turns on: a checklist that showed
    // red for "we have not asked yet" would send the user to an administrator
    // about a working system.
    const checks = buildChecklist({ ...CLIENT_OK, server: null });
    for (const id of SERVER_CHECK_IDS) {
      expect(statusOf(checks, id)).toBe("unknown");
    }
    expect(allChecksPass(checks)).toBe(false);
  });

  it("never renders an unasked CLIENT line as a pass either", () => {
    // The bug this pins: the browser line used to initialise `true`, so
    // Firefox — where it is false and unfixable — showed a green tick for
    // "can open a folder" until the first check completed.
    const checks = buildChecklist({
      browserSupported: null,
      pdfWorkerReachable: null,
      server: null,
    });
    expect(statusOf(checks, "browser")).toBe("unknown");
    expect(statusOf(checks, "pdfReader")).toBe("unknown");
  });

  it("fails only the browser line when the browser cannot pick folders", () => {
    const checks = buildChecklist({
      ...CLIENT_OK,
      browserSupported: false,
      server: ALL_GOOD,
    });
    expect(statusOf(checks, "browser")).toBe("fail");
    expect(checks.filter((c) => c.status === "fail")).toHaveLength(1);
    expect(allChecksPass(checks)).toBe(false);
  });

  it("answers pdfReader from the client, never from the server report", () => {
    // The worker is fetched by the BROWSER from a URL. A server-side fs check
    // reports "missing" on Vercel, where public/ lives on the CDN — and since
    // no check may be overridden, that would block every import in production.
    const checks = buildChecklist({
      ...CLIENT_OK,
      pdfWorkerReachable: false,
      server: ALL_GOOD,
    });
    expect(statusOf(checks, "pdfReader")).toBe("fail");
    expect(SERVER_CHECK_IDS).not.toContain("pdfReader");
  });

  it("reads a 401 as a session failure and says nothing about the role", () => {
    // A 401 means the route never got as far as looking at the role, so
    // claiming the role passed would be an answer nobody gave.
    const checks = buildChecklist({ ...CLIENT_OK, server: null, authFailure: "session" });
    expect(statusOf(checks, "session")).toBe("fail");
    expect(statusOf(checks, "role")).toBe("unknown");
  });

  it("reads a 403 as a role failure and a session PASS", () => {
    // A 403 is proof the session was fine — the route had to identify the user
    // before it could reject their role.
    const checks = buildChecklist({ ...CLIENT_OK, server: null, authFailure: "role" });
    expect(statusOf(checks, "session")).toBe("pass");
    expect(statusOf(checks, "role")).toBe("fail");
  });

  it("treats a 500 as proof the session and role passed", () => {
    // `unexpectedError` is only reachable AFTER both auth gates, so reporting
    // the user's own credentials as unchecked would send them to press Check
    // again about a problem that is not theirs.
    const checks = buildChecklist({ ...CLIENT_OK, server: null, authProven: true });
    expect(statusOf(checks, "session")).toBe("pass");
    expect(statusOf(checks, "role")).toBe("pass");
    for (const id of SERVER_CHECK_IDS) expect(statusOf(checks, id)).toBe("unknown");
  });

  it("fails exactly the server check that came back false", () => {
    const checks = buildChecklist({
      ...CLIENT_OK,
      server: { ...ALL_GOOD, classification: false },
    });
    expect(statusOf(checks, "classification")).toBe("fail");
    expect(checks.filter((c) => c.status === "fail")).toHaveLength(1);
    expect(allChecksPass(checks)).toBe(false);
  });
});

describe("allChecksPass", () => {
  it("refuses a short list even if every entry passes", () => {
    // No partial pass, no override: the picker appears only when all eight
    // have been asked and answered.
    expect(allChecksPass([{ id: "browser", status: "pass" }])).toBe(false);
  });

  it("refuses when a single line is unknown", () => {
    const checks = buildChecklist({ ...CLIENT_OK, server: ALL_GOOD });
    checks[3] = { ...checks[3], status: "unknown" };
    expect(allChecksPass(checks)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// forecastImport
// ---------------------------------------------------------------------------

describe("forecastImport", () => {
  it("counts one document per entry, page groups included", () => {
    const entries: FSEntry[] = [
      fileEntry("contract.pdf"),
      fileEntry("Acte/nota.docx"),
      pageGroupEntry("Acte/CVC_2021", ["001.jpg", "002.jpg", "003.jpg"]),
    ];
    const f = forecastImport(entries);
    expect(f.documents).toBe(3);      // NOT 5 — the group is one document
    expect(f.pageGroups).toBe(1);
  });

  it("counts one classification call per scannable entry, one per GROUP", () => {
    // The wizard scans a page group by its first page only, so a 40-page group
    // is one call, not 40. Getting this wrong in either direction makes the
    // button's number a lie.
    const entries: FSEntry[] = [
      pageGroupEntry("Acte/CVC", ["001.jpg", "002.jpg", "003.jpg"]),
      fileEntry("scan.jpg"),
      fileEntry("contract.pdf"),
      fileEntry("puncte.txt"),        // text: never sent
      fileEntry("nota.docx"),         // Word: never sent
    ];
    expect(forecastImport(entries).classificationCalls).toBe(3);
  });

  it("does not count a page group whose first page is not scannable", () => {
    const entries: FSEntry[] = [pageGroupEntry("Acte/X", ["001.txt", "002.txt"])];
    expect(forecastImport(entries).classificationCalls).toBe(0);
  });

  it("lists coordinate candidates by path, in walk order", () => {
    const entries: FSEntry[] = [
      fileEntry("a.txt"),
      fileEntry("scan.jpg"),
      fileEntry("Sub/b.txt"),
      fileEntry("date.csv"),          // forbidden since #24.04 — never a candidate
    ];
    expect(forecastImport(entries).coordinateCandidates).toEqual(["a.txt", "Sub/b.txt"]);
  });

  it("never treats a page group as a coordinate candidate", () => {
    // A page group is by definition a folder of numbered images, so it cannot
    // hold a text export — and its `name` is a folder name, which could
    // otherwise end in .txt (TEST.DATA has exactly such a directory).
    const entries: FSEntry[] = [pageGroupEntry("CIPI.coord.Clinceni.txt", ["1.jpg", "2.jpg"])];
    expect(forecastImport(entries).coordinateCandidates).toEqual([]);
  });

  it("answers an empty folder with all zeroes", () => {
    expect(forecastImport([])).toEqual({
      documents: 0,
      pageGroups: 0,
      classificationCalls: 0,
      coordinateCandidates: [],
      filesToImport: 0,
    });
  });

  /**
   * `filesToImport` — Slice #29.11.
   *
   * ⚠️ The whole reason the field exists is that it is NOT `documents`. The
   * Evaluation screen prints both, one row under the other, and #29.01's F10 is
   * that nothing said how one becomes the other. A page group is many files and
   * one document, and a test that used only single-file entries would pass on an
   * implementation that returned `entries.length` and left the sentence a lie.
   */
  it("counts every page of a page group as a file, and the group as one document", () => {
    const entries: FSEntry[] = [
      fileEntry("contract.pdf"),
      fileEntry("Acte/nota.docx"),
      pageGroupEntry("Acte/CVC_2021", ["001.jpg", "002.jpg", "003.jpg"]),
    ];
    const f = forecastImport(entries);
    expect(f.filesToImport).toBe(5);   // 2 loose files + 3 pages
    expect(f.documents).toBe(3);       // the group is ONE document
  });

  it("agrees with uploadKeysOf, which is the definition of what is uploaded", () => {
    // The field is counted in `forecastImport`'s own loop rather than by calling
    // `uploadKeysOf`, to keep an import edge out of the module graph for one
    // integer. This is the test that pays for that decision: if the two ever
    // disagree, `uploadKeysOf` is right and the forecast is the bug — the
    // module says so in as many words.
    const entries: FSEntry[] = [
      fileEntry("a.jpg"),
      pageGroupEntry("Grup", ["1.jpg", "2.jpg"]),
      fileEntry("Sub/b.txt"),
      pageGroupEntry("Sub/Alt", ["1.jpg"]),
    ];
    expect(forecastImport(entries).filesToImport).toBe(uploadKeysOf(entries).length);
  });

  it("counts an empty page group as no files at all", () => {
    // ⚠️ **UNREACHABLE THROUGH `walkFolder`, and saying so is the point.** An
    // adversarial round checked: the drop filter runs BEFORE page-group
    // detection, the branch is guarded on `childFiles.length > 0`
    // (`folder-utils.ts`), and `isPageGroup([])` is false — so a folder whose
    // files were all dropped becomes an ordinary directory with no entry at
    // all, and `folder-utils.ts` is the only producer of `kind: "page-group"`
    // in `src/`. This pins `forecastImport`'s own defensiveness, and it is
    // recorded as unreachable because it is the ONLY state in which
    // `documents > filesToImport` — the state the Evaluation screen's
    // `filesToImport > 0` guard would be insufficient for. A later reader who
    // took this for a live case would re-argue that guard from a false premise.
    const entries: FSEntry[] = [pageGroupEntry("Gol", [])];
    const f = forecastImport(entries);
    expect({ files: f.filesToImport, documents: f.documents }).toEqual({
      files: 0,
      documents: 1,
    });
  });
});
