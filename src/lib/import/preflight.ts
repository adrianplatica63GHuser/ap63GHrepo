/**
 * src/lib/import/preflight.ts
 *
 * Step zero of the import: what must be true before a folder can be picked,
 * and what the import is about to do once one has been.   (Slice #24.02a)
 *
 * WHY THIS EXISTS
 * ───────────────
 *
 * Before this slice, `/admin/import` opened straight onto a folder picker, and
 * picking a folder immediately fired one Claude call per image — automatically,
 * before anything had been validated. A folder that could never import still
 * cost 451 classification calls on Adrian's archive. Worse, the failures that
 * matter most are silent: forty scans that should have been one document become
 * forty documents, and nothing says so.
 *
 * Two gates fix the ordering, and this module holds the pure half of both:
 *
 *  1. **Preconditions.** Nothing can be picked until every one is green. Some
 *     are answered in the browser (is there a folder picker at all), the rest
 *     by GET /api/admin/import/preflight.
 *  2. **The forecast.** Once a folder is walked, the run stops and says what it
 *     is about to create. The AI pass starts on the user's word, not on the
 *     picker's.
 *
 * Client-safe: pure, no DB and no server-only imports. The route imports the
 * types from here; so does the wizard.
 *
 * WHAT IS DELIBERATELY NOT HERE (Slice #24.02b)
 * ─────────────────────────────────────────────
 *
 * The blockers, the skipped list and the warnings. This slice moves the scan
 * behind a button and shows the counts; #24.02b fills the same screen with the
 * findings. Two forecast lines from the spec wait for it too, because both need
 * plumbing this slice does not have an excuse to build:
 *
 *  - **"Fișiere ignorate: N"** needs `walkFolder` to report what it dropped,
 *    and it drops silently today. #24.02b needs the full LIST for its Skipped
 *    section, so the signature changes once, there, rather than twice.
 *  - **"De încărcat: N MB"** needs a `getFile()` per handle — 759 of them on
 *    Adrian's archive — which is a real cost to design rather than to bolt on.
 */

import type { FSEntry, FSFileEntry } from "./folder-utils";
import { isCoordinateFileName } from "./coordinate-file";
import { isImageOrPdf } from "@/lib/files/file-kinds";

// ---------------------------------------------------------------------------
// Preconditions
// ---------------------------------------------------------------------------

/**
 * The preconditions, in the order they are shown.
 *
 * Who answers what, and why it matters:
 *
 *  - `browser` and `pdfReader` are answered IN THE BROWSER. The first is
 *    obvious; the second is not, and getting it wrong bricks the screen.
 *    `public/pdf.worker.min.js` is loaded by the client from a URL, so the
 *    question is whether that URL serves — not whether a file sits on the
 *    server's disk. On Vercel `public/` is served from the CDN and is absent
 *    from the lambda filesystem, so a server-side `fs.access` would answer
 *    "missing" for a worker that loads perfectly, and — since no check may be
 *    overridden — would block every import on the stated production target.
 *    A `HEAD` from the browser asks the question that is actually being asked.
 *  - `session` and `role` are answered by the preflight route's own 401 / 403
 *    rather than by a field in its body: a route that can answer at all has
 *    already proved both.
 *  - The rest come back as booleans from that route.
 */
export type PreflightCheckId =
  | "browser"
  | "session"
  | "role"
  | "documentTypes"
  | "classification"
  | "storage"
  | "pdfReader"
  | "database";

/** Every check, in display order. */
export const PREFLIGHT_CHECK_IDS: readonly PreflightCheckId[] = Object.freeze([
  "browser",
  "session",
  "role",
  "documentTypes",
  "classification",
  "storage",
  "pdfReader",
  "database",
] as const);

/**
 * What the server can answer. Booleans and nothing else, deliberately.
 *
 * No environment variable names, no key fragments, no paths, no status codes:
 * the screen is read by a business user, and a probe result that carries
 * infrastructure detail is one screenshot away from being a leak. Which check
 * failed is enough to choose the message, and every message for 4–8 ends with
 * "anunțați administratorul" anyway.
 */
export type PreflightServerReport = {
  documentTypes: boolean;
  classification: boolean;
  storage: boolean;
  database: boolean;
};

export const SERVER_CHECK_IDS: readonly (keyof PreflightServerReport)[] =
  Object.freeze(["documentTypes", "classification", "storage", "database"] as const);

/**
 * Outcome of one check as the checklist renders it.
 *
 * `"unknown"` is not a third kind of failure — it is what every server check
 * reads while the request is still in flight, and what they all read if the
 * request never arrives. A checklist that showed red for "we have not asked
 * yet" would tell the user to call an administrator about a working system.
 */
export type PreflightStatus = "pass" | "fail" | "unknown";

export type PreflightCheck = {
  id: PreflightCheckId;
  status: PreflightStatus;
};

/** Is the folder picker allowed to exist? Only when every check has passed. */
export function allChecksPass(checks: readonly PreflightCheck[]): boolean {
  return (
    checks.length === PREFLIGHT_CHECK_IDS.length &&
    checks.every((c) => c.status === "pass")
  );
}

/**
 * Fold a browser answer and a server report into the displayed checklist.
 *
 * `server === null` means the request has not answered yet, or failed. Both
 * render the same way — every server-answered line is `"unknown"` — because
 * the user's next action is identical: press Verifică din nou.
 *
 * `session` and `role` are derived, not reported: a 200 from a route that
 * checks both is the proof. Passing `server` at all therefore means they
 * passed, and the caller distinguishes 401 from 403 to decide which of the two
 * to mark failed.
 */
export function buildChecklist(input: {
  /** Client-answered. `null` means "not tested yet", never "fine". */
  browserSupported: boolean | null;
  /** Client-answered: did HEAD /pdf.worker.min.js succeed? */
  pdfWorkerReachable: boolean | null;
  server: PreflightServerReport | null;
  /** Set when the route answered 401 (session) or 403 (role). */
  authFailure?: "session" | "role" | null;
  /**
   * Set when the route answered at all with something other than 401/403 —
   * a 200, or a 500. Both prove the session and the role passed, because
   * `unexpectedError` is only reachable AFTER both gates. Without this a
   * server-side crash would report the user's own credentials as unchecked
   * and offer them a Check again button that can never help.
   */
  authProven?: boolean;
}): PreflightCheck[] {
  const {
    browserSupported,
    pdfWorkerReachable,
    server,
    authFailure = null,
    authProven = false,
  } = input;

  const clientStatus = (value: boolean | null): PreflightStatus =>
    value === null ? "unknown" : value ? "pass" : "fail";

  const authStatus = (id: "session" | "role"): PreflightStatus => {
    if (authFailure === id) return "fail";
    if (authFailure !== null) {
      // A 401 says nothing about the role, so the role line stays unknown
      // rather than claiming a pass it has not earned. A 403 proves the
      // session was fine, so that one IS a pass.
      return id === "role" ? "unknown" : "pass";
    }
    if (authProven || server !== null) return "pass";
    return "unknown";
  };

  return [
    { id: "browser", status: clientStatus(browserSupported) },
    { id: "session", status: authStatus("session") },
    { id: "role", status: authStatus("role") },
    { id: "documentTypes", status: serverStatus(server, "documentTypes") },
    { id: "classification", status: serverStatus(server, "classification") },
    { id: "storage", status: serverStatus(server, "storage") },
    { id: "pdfReader", status: clientStatus(pdfWorkerReachable) },
    { id: "database", status: serverStatus(server, "database") },
  ];
}

function serverStatus(
  server: PreflightServerReport | null,
  id: keyof PreflightServerReport,
): PreflightStatus {
  return server === null ? "unknown" : server[id] ? "pass" : "fail";
}

// ---------------------------------------------------------------------------
// The forecast
// ---------------------------------------------------------------------------

/**
 * What this import is about to do, computed from the walk alone.
 *
 * No file contents, no server call, no AI. Every number here is derived from
 * names and structure.
 *
 * ⚠️ **THAT USED TO BE "…which is the whole reason the screen can be shown
 * before a single call is spent", AND SLICE #29.08 MADE THE CLAUSE FALSE.** The
 * classification now runs BEFORE the Evaluation screen, so the screen this
 * forecast feeds is no longer shown ahead of the first spend — it reports one
 * that has already happened. The PROPERTY is unchanged and still worth stating:
 * these numbers cost nothing to compute, which is why the same forecast can be
 * shown on a screen that comes before any call and on one that comes after.
 * What is gone is the inference from the property to the ordering, and leaving
 * it here would have left a module documenting a rule it no longer has.
 */
export type ImportForecast = {
  /** Documents that will be created — one per walked entry. */
  documents: number;
  /** How many of those are multi-page (a page group rather than a file). */
  pageGroups: number;
  /**
   * Images and PDFs sent for automatic classification — one Claude call each.
   *
   * Before #24.02a these calls were spent by the act of picking a folder; since
   * then they are spent by a decision, and since #29.08 that decision is the
   * Pre-existing screen's Continuă rather than the Evaluation screen's. This is
   * the number that press quotes, and afterwards the number the Evaluation
   * screen reports as spent — one value read from two sides of the same click.
   */
  classificationCalls: number;
  /** Every file that could hold a coordinate export, in walk order. */
  coordinateCandidates: string[];
  /**
   * Files these entries will upload, page-group pages counted one by one.
   *                                                            (Slice #29.11)
   *
   * ⚠️ **NOT `documents`, and the gap between the two is the whole point of the
   * row it feeds.** A folder of scanned pages is many files and one document, so
   * five files can become four documents and three classification calls — three
   * different numbers over one folder, printed one under the other on the
   * Evaluation screen with nothing saying how one becomes the next. #29.01's
   * F10 is that silence. This is the first of the three, and it is the only one
   * the forecast did not already carry.
   *
   * ⚠️ **"TO IMPORT", NOT "KEPT BY THE WALK", AND AN ADVERSARIAL ROUND RENAMED
   * IT.** Every field here is over the entries it was HANDED, and the wizard
   * hands this function `entriesToImport` — the walk's entries minus everything
   * the archive already holds. The first draft named this after the walk and
   * the Evaluation sentence said "fișiere păstrate", which is the same phrase
   * the Structure card uses for `uploadKeysOf(entries)` over the WHOLE walk. Two
   * different numbers under one word, two screens apart, is precisely the F10
   * complaint this sentence was written to answer.
   *
   * Counted in the loop below rather than by calling `checks.ts`'
   * `uploadKeysOf`, which produces exactly the same number for the same input:
   * the loop already visits every entry, and this module is imported by the
   * checker's own neighbours — adding an edge to that graph for one integer is
   * not worth it. If the two ever disagree, `uploadKeysOf` is the definition
   * and this is the bug.
   */
  filesToImport: number;
};

/**
 * Compute the forecast for a walked folder.
 *
 * Deliberately mirrors what the import ACTUALLY does rather than restating it:
 * one Document per entry (`bulk-import-dialog` imports every entry
 * unconditionally and has no skip mechanism), and one classification call per
 * entry the wizard considers scannable. If either of those rules changes, this
 * forecast must change with it — a forecast that quietly disagrees with the
 * run it predicts is worse than no forecast, because it is believed.
 */
export function forecastImport(entries: readonly FSEntry[]): ImportForecast {
  let pageGroups = 0;
  let classificationCalls = 0;
  let filesToImport = 0;
  const coordinateCandidates: string[] = [];

  for (const entry of entries) {
    if (entry.kind === "page-group") {
      pageGroups++;
      // Every page is a file the import will upload, even though the group is
      // one document and is scanned by its first page alone. That is the
      // arithmetic `filesToImport` exists to let the screen explain.
      filesToImport += entry.handles.length;
      // The wizard scans a group by its first page only.
      if (entry.handles.length > 0 && isImageOrPdf(entry.handles[0].name)) {
        classificationCalls++;
      }
      continue;
    }
    const file = entry as FSFileEntry;
    filesToImport++;
    if (isImageOrPdf(file.name)) classificationCalls++;
    if (isCoordinateFileName(file.name)) coordinateCandidates.push(file.path);
  }

  return {
    documents: entries.length,
    pageGroups,
    classificationCalls,
    coordinateCandidates,
    filesToImport,
  };
}
