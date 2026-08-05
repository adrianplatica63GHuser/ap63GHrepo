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
    });
  });
});
