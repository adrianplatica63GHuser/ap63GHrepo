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
      coordinateFoldersWithoutDeclared: [],
      filesToImport: 0,
    });
  });

  /**
   * The declared subset — Slice #34.08.
   *
   * ⚠️ **THE TWO LISTS ARE DIFFERENT AND THE EVALUATION SCREEN WAS SHOWING ONLY
   * THE FIRST.** `coordinateCandidates` is the extension test; the property step
   * reads STR-08's `coord….txt` rule. A folder whose only `.txt` is `notite.txt`
   * therefore had a row saying a coordinate file was found and then a Property
   * with no corners that nothing connected back to it.
   */
  /**
   * ⚠️ **EVERY FOLDER NAME IN THESE FIXTURES PARSES UNDER #26.01's GRAMMAR**
   * (`tarla-parcela`, optionally `-description`), because
   * `coordinateFoldersWithoutDeclared` only counts a folder
   * `groupByPropertyFolder` would make a card for. A dashless `47per2` is
   * `unassigned` — no card, no Property — so a fixture using one would assert
   * an ordering over folders the wizard never draws.
   */
  it("⚠️ says nothing about a folder that HAS its coord file, whatever else is in it", () => {
    // The whole point of asking per FOLDER. `candidates − declared` is 1 here,
    // and the first draft printed a warning off that number — over a property
    // that was getting its polygon from the file right beside the notes file,
    // with a remedy („rename each one `coord …`") that would have put two
    // declared files in one folder and tripped STR-08.
    const entries: FSEntry[] = [
      fileEntry("47per2-2716/coord 47per2.txt"),
      fileEntry("47per2-2716/notite.txt"),
      fileEntry("47per2-2716/contract.pdf"),
    ];
    const forecast = forecastImport(entries);
    expect(forecast.coordinateCandidates).toEqual([
      "47per2-2716/coord 47per2.txt",
      "47per2-2716/notite.txt",
    ]);
    expect(forecast.coordinateFoldersWithoutDeclared).toEqual([]);
  });

  it("names the property subfolders that hold a candidate and nothing declared", () => {
    const entries: FSEntry[] = [
      fileEntry("47per2-2716/coord 47per2.txt"),
      fileEntry("47per2-2716/notite.txt"),
      fileEntry("225per3per24-11/puncte.txt"),      // a candidate, undeclared → reported
      fileEntry("18per7-90/contract.pdf"),     // no candidate at all → silent
    ];
    expect(forecastImport(entries).coordinateFoldersWithoutDeclared).toEqual(["225per3per24-11"]);
  });

  it("⚠️ says nothing about a shared folder, a root file, or a folder that is not a property", () => {
    // None of the four produces a Property, so none can produce a Property
    // without corners. A `.txt` under `comune` is business content linked to
    // every property in the run — telling a user to rename it „coord …" would
    // trip STR-09, which forbids a coordinate file there outright. `Acte` has no
    // dash, so #26.01's grammar refuses it and `groupByPropertyFolder` files it
    // under `unassigned`: no card, no Property, nothing to warn about.
    const entries: FSEntry[] = [
      fileEntry("comune/adrese.txt"),
      fileEntry("flotante/nota.txt"),
      // The legacy spellings #26.11 kept accepting, because every archive
      // Ciprian has prepared so far uses them.
      fileEntry("common/vechi.txt"),
      fileEntry("Acte/nota.txt"),
      fileEntry("citeste-ma.txt"),
    ];
    const forecast = forecastImport(entries);
    expect(forecast.coordinateCandidates).toHaveLength(5);
    expect(forecast.coordinateFoldersWithoutDeclared).toEqual([]);
  });

  it("⚠️ reports each folder once, in the order the property CARDS use", () => {
    // `compareForDisplay`, which is NUMERIC — the same comparator
    // `groupByPropertyFolder` orders the cards with, and the order File
    // Explorer shows. A bare `localeCompare` is not numeric and puts `47per2`
    // before `9per1`, so this sentence and the cards one screen later would
    // list the same folders in two different orders.
    const entries: FSEntry[] = [
      fileEntry("47per2-2716/a.txt"),
      fileEntry("9per1-50D/b.txt"),
      fileEntry("225per3per24-11/c.txt"),
      fileEntry("9per1-50D/d.txt"),
    ];
    expect(forecastImport(entries).coordinateFoldersWithoutDeclared).toEqual([
      "9per1-50D",
      "47per2-2716",
      "225per3per24-11",
    ]);
  });

  it("⚠️ the NAME only counts on a file the extension test already accepted", () => {
    // `isDeclaredCoordinateFile` is `coordinateNameConfidence === "strong"`,
    // which requires `isCoordinateFileName` first — so `coord two.pdf` is
    // neither a candidate nor a declared file, and cannot absolve its folder.
    // Getting that backwards would silence the warning for a folder whose
    // property is about to be created without corners.
    const entries: FSEntry[] = [
      fileEntry("47per2-2716/coord two.pdf"),
      fileEntry("47per2-2716/puncte.txt"),
      fileEntry("47per2-2716/plan.jpg"),
    ];
    const forecast = forecastImport(entries);
    expect(forecast.coordinateCandidates).toEqual(["47per2-2716/puncte.txt"]);
    expect(forecast.coordinateFoldersWithoutDeclared).toEqual(["47per2-2716"]);
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
