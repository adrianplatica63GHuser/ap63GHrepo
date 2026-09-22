/**
 * Test-catalogue coverage gate  (Slice #36.04)
 *
 * The growth rule for `docs/testing/TEST-CATALOGUE.md`, and the reason it
 * cannot quietly decay into a folder nobody updates.
 *
 * This is deliberately the same mechanism as `help-coverage.test.ts`, which has
 * kept the help system honest since Slice #21.10: walk the routes under
 * `src/app`, and fail when one of them has not been decided about. A guard that
 * makes the right thing happen automatically beats a rule that asks somebody to
 * remember — and the catalogue is exactly the kind of document that gets
 * remembered for two slices and then does not.
 *
 * Five invariants:
 *   1. Every route in src/app is covered by a case, listed as not-yet-covered
 *      with a sentence saying what a case would be, or explicitly opted out.
 *   2. Every case id the route map names exists as a row in the catalogue.
 *   3. Every row in the catalogue has a case file, and drives at least one
 *      route. (The other direction: a case that covers nothing is either a
 *      mistake in the map or a case about nothing.)
 *   4. Every catalogue row carries a legal state, and a `Last green` date
 *      exactly when its state says it has been run.
 *   5. The three route lists do not overlap, and no reason is blank.
 *   6. A row and its spec point at each other  (Slice #36.06): a row whose
 *      `Spec` column names a file names one that exists under e2e/, whose
 *      header names that row back; a row at `automated` has a spec; and only a
 *      `confirmed` or `automated` row — or one of PROMOTED_WITHOUT_DRIVING —
 *      has one at all.
 *   7. Every Playwright spec under e2e/ (auth.setup.ts is not one) names at
 *      least one case in its header, every case it names is a real row, and
 *      that row's `Spec` column names this file. So a spec cannot exist without
 *      a case, and a case cannot be `automated` without a spec.
 *
 * ⚠️ NO BROWSER AND NO DATABASE ARE INVOLVED. This suite checks that the
 * catalogue and the application agree about which screens exist, and that the
 * catalogue and e2e/ agree about which cases are automated — by reading files,
 * so it still runs in CI, where Playwright does not. It does not run a single
 * test case, and a green run here says nothing whatever about whether the
 * application works, or whether a spec passes — see
 * `docs/testing/WHAT-WE-TEST.md`. Only Adrian's `npm run e2e` says that, and
 * only that run moves a row to `automated`.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, relative, sep } from "path";
import {
  CATALOGUE_NOT_YET,
  CATALOGUE_OPTED_OUT,
  CATALOGUE_ROUTE_CASES,
  PROMOTED_WITHOUT_DRIVING,
} from "@/lib/testing/catalogue-map";

const ROOT = process.cwd();
const APP = join(ROOT, "src", "app");
const CATALOGUE = join(ROOT, "docs", "testing", "TEST-CATALOGUE.md");
const CASES_DIR = join(ROOT, "docs", "testing", "cases");
const E2E = join(ROOT, "e2e");

/** Playwright's own default `testMatch`: `*.spec.ts`, `*.test.ts` and their js/mjs/cjs/x twins. */
const SPEC_FILE = /\.(spec|test)\.[cm]?[jt]sx?$/;

/**
 * A case id, and only a case id. The lookbehind keeps the `TC-E2E-` marker a
 * spec writes into its records — `TC-E2E-PROP-01` — from reading as a case:
 * `E2E` is not `[A-Z]+`, and `PROP-01` is preceded by a hyphen.
 */
const CASE_ID = /(?<![A-Z0-9-])TC-[A-Z]+-\d{2}(?!\d)/g;

/** The states a row may be in, in the order a case moves through them. */
const STATES = ["draft", "driven", "confirmed", "automated"] as const;
type State = (typeof STATES)[number];

/** A state at or past `driven` has been run, so it must carry a date. */
const RUN_STATES: readonly State[] = ["driven", "confirmed", "automated"];

/** Recursively collect files under `dir` matching `predicate`. */
function walk(dir: string, predicate: (f: string) => boolean): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      out.push(...walk(full, predicate));
    } else if (predicate(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Turn src/app/properties/[id]/page.tsx into /properties/[id].
 * Route groups — (auth) style folders — are stripped, as Next.js does.
 *
 * Copied in shape from help-coverage.test.ts rather than shared with it: the
 * two suites must keep agreeing with Next.js, not with each other, and a shared
 * helper would let one of them be fixed while the other silently drifted.
 */
function routeFromPageFile(file: string): string {
  const rel = relative(APP, file).split(sep);
  rel.pop(); // drop page.tsx
  const segments = rel.filter((s) => !(s.startsWith("(") && s.endsWith(")")));
  return "/" + segments.join("/");
}

type Row = {
  id: string;
  title: string;
  area: string;
  kind: string;
  state: string;
  lastGreen: string;
  /** Repo-relative path of the spec, `e2e/…`, or "" when the cell is `—`. */
  spec: string;
};

/**
 * Parse the catalogue table.
 *
 * ⚠️ The row shape is matched on the LINK, not on position: a row is a line
 * beginning `| [TC-…](cases/TC-….md) |`. Prose elsewhere in the file that
 * happens to contain pipes is therefore not a row, and a row that loses its
 * link to its case file is not a row either — which is the failure invariant 3
 * would otherwise report as a missing case file.
 */
function readCatalogueRows(): Row[] {
  const text = readFileSync(CATALOGUE, "utf8");
  const rows: Row[] = [];
  for (const line of text.split("\n")) {
    const m = /^\|\s*\[(TC-[A-Z]+-\d+)\]\(cases\/(TC-[A-Z]+-\d+)\.md\)\s*\|(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, id, linkId, rest] = m;
    // The link text and the link target must name the same case, or the table
    // reads correctly and navigates somewhere else.
    expect([id, linkId]).toEqual([id, id]);
    const cells = rest.split("|").map((c) => c.trim());
    rows.push({
      id,
      title: cells[0] ?? "",
      area: cells[1] ?? "",
      kind: cells[2] ?? "",
      state: cells[4] ?? "",
      lastGreen: cells[5] ?? "",
      spec: specCell(cells[6] ?? ""),
    });
  }
  return rows;
}

/**
 * The `Spec` cell: `—`, or a repo-relative path in backticks. Anything else is
 * returned as written, so invariant 6 reports it instead of it vanishing.
 */
function specCell(cell: string): string {
  const bare = cell.replace(/`/g, "").trim();
  return bare === "—" || bare === "" ? "" : bare;
}

/** Repo-relative, forward slashes — the way the catalogue writes a path. */
function repoPath(file: string): string {
  return relative(ROOT, file).split(sep).join("/");
}

type SpecHeader = { caseIds: string[]; sourceLines: string[] };

/**
 * The spec's header: the leading `/** … *\/` block. Only its `Case:` lines
 * count as naming a case, and only its `Source:` lines as saying which case
 * file, of which date, the spec was translated from — a case id mentioned in
 * passing further down a comment is not a claim about coverage.
 */
function readSpecHeader(file: string): SpecHeader {
  const text = readFileSync(file, "utf8");
  const m = /^\s*\/\*\*([\s\S]*?)\*\//.exec(text);
  const header = m ? m[1] : "";
  const lines = header.split("\n").map((l) => l.replace(/^\s*\*\s?/, ""));
  const caseLines = lines.filter((l) => /^Case:/.test(l.trim()));
  const sourceLines = lines.filter((l) => /^Source:/.test(l.trim()));
  const caseIds = [...new Set(caseLines.flatMap((l) => l.match(CASE_ID) ?? []))];
  return { caseIds, sourceLines };
}

describe("test catalogue coverage", () => {
  const pageFiles = walk(APP, (f) => f === "page.tsx");
  const routes = pageFiles.map(routeFromPageFile).sort();
  const rows = readCatalogueRows();
  const rowIds = new Set(rows.map((r) => r.id));

  it("finds the application's page files", () => {
    // Guards against the walker silently returning nothing, which would make
    // every assertion below vacuously pass.
    expect(pageFiles.length).toBeGreaterThan(20);
  });

  it("finds the catalogue's rows", () => {
    // Same guard, for the other input. Ten is the first cut (Slice #36.04);
    // this is a floor, not a target.
    expect(rows.length).toBeGreaterThanOrEqual(10);
  });

  describe("invariant 1 — every route is covered, on the backlog, or opted out", () => {
    it.each(routes)("%s has a decision", (route) => {
      const covered = (CATALOGUE_ROUTE_CASES[route]?.length ?? 0) > 0;
      const notYet = route in CATALOGUE_NOT_YET;
      const optedOut = route in CATALOGUE_OPTED_OUT;

      if (!covered && !notYet && !optedOut) {
        throw new Error(
          `Route "${route}" has no entry in the test catalogue map.\n\n` +
            `A new screen needs a decision about testing it, now, rather than a\n` +
            `note that somebody should look at it later. Pick one, in\n` +
            `src/lib/testing/catalogue-map.ts:\n\n` +
            `  - CATALOGUE_ROUTE_CASES["${route}"] = ["TC-<AREA>-<nn>"]\n` +
            `    ...and add the row to docs/testing/TEST-CATALOGUE.md and the\n` +
            `    case file under docs/testing/cases/.\n\n` +
            `  - CATALOGUE_NOT_YET["${route}"] = "<one sentence: what a case would be>"\n` +
            `    ...if it should be tested and this is not the slice to do it.\n\n` +
            `  - CATALOGUE_OPTED_OUT["${route}"] = "<why it never will be>"\n` +
            `    ...if a person can do nothing on this screen worth a case.\n`,
        );
      }

      expect(covered || notYet || optedOut).toBe(true);
    });
  });

  describe("invariant 2 — every mapped case exists in the catalogue", () => {
    const mapped = [...new Set(Object.values(CATALOGUE_ROUTE_CASES).flat())].sort();

    it.each(mapped)("%s is a row in TEST-CATALOGUE.md", (caseId) => {
      if (!rowIds.has(caseId)) {
        throw new Error(
          `src/lib/testing/catalogue-map.ts names "${caseId}", but\n` +
            `docs/testing/TEST-CATALOGUE.md has no row for it.\n\n` +
            `A route claiming coverage from a case that does not exist is worse\n` +
            `than an uncovered route, because it reads as covered.\n`,
        );
      }
      expect(rowIds.has(caseId)).toBe(true);
    });
  });

  describe("invariant 3 — every catalogue row has a file and drives a route", () => {
    it.each(rows.map((r) => r.id))("%s has a case file", (id) => {
      const file = join(CASES_DIR, `${id}.md`);
      if (!existsSync(file)) {
        throw new Error(
          `docs/testing/TEST-CATALOGUE.md has a row for "${id}", but\n` +
            `docs/testing/cases/${id}.md does not exist.\n`,
        );
      }
      expect(existsSync(file)).toBe(true);
    });

    it.each(rows.map((r) => r.id))("%s drives at least one route", (id) => {
      const drives = Object.values(CATALOGUE_ROUTE_CASES).some((ids) => ids.includes(id));
      if (!drives) {
        throw new Error(
          `Case "${id}" is in the catalogue but no route in\n` +
            `src/lib/testing/catalogue-map.ts names it, so nothing it does is\n` +
            `counted as coverage. Add it to CATALOGUE_ROUTE_CASES against the\n` +
            `route(s) it drives.\n`,
        );
      }
      expect(drives).toBe(true);
    });

    it("has no duplicate case ids", () => {
      const ids = rows.map((r) => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("invariant 4 — every row's state is legal and matches its date", () => {
    it.each(rows.map((r): [string, string, string] => [r.id, r.state, r.lastGreen]))(
      "%s: state %s",
      (id, state, lastGreen) => {
        const bare = state.replace(/`/g, "").trim();
        expect([id, STATES.includes(bare as State)]).toEqual([id, true]);

        // A state past `draft` claims the case has been run, and a run that
        // left no date is a claim nobody can check.
        const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(lastGreen.trim());
        const shouldHaveDate = RUN_STATES.includes(bare as State);
        if (shouldHaveDate !== hasDate) {
          throw new Error(
            `Case "${id}" is at state "${bare}" with "Last green" = "${lastGreen}".\n\n` +
              (shouldHaveDate
                ? `A case at "${bare}" has been run, so it must carry the date it was\n` +
                  `last green, as YYYY-MM-DD.\n`
                : `A case at "draft" has never been run, so it must carry "—" rather\n` +
                  `than a date.\n`),
          );
        }
        expect([id, hasDate]).toEqual([id, shouldHaveDate]);
      },
    );
  });

  describe("invariant 5 — the three lists are disjoint and every reason is real", () => {
    it("no route is in two lists", () => {
      const covered = new Set(Object.keys(CATALOGUE_ROUTE_CASES));
      const notYet = new Set(Object.keys(CATALOGUE_NOT_YET));
      const optedOut = new Set(Object.keys(CATALOGUE_OPTED_OUT));

      const overlaps = [
        ...[...covered].filter((r) => notYet.has(r) || optedOut.has(r)),
        ...[...notYet].filter((r) => optedOut.has(r)),
      ];
      expect(overlaps).toEqual([]);
    });

    it("names no route the application does not have", () => {
      const known = new Set(routes);
      const listed = [
        ...Object.keys(CATALOGUE_ROUTE_CASES),
        ...Object.keys(CATALOGUE_NOT_YET),
        ...Object.keys(CATALOGUE_OPTED_OUT),
      ];
      // A deleted screen must take its catalogue entry with it, or the lists
      // slowly fill with rules about pages that are gone.
      expect(listed.filter((r) => !known.has(r))).toEqual([]);
    });

    it.each(Object.entries(CATALOGUE_NOT_YET))("not-yet %s says what a case would be", (_route, reason) => {
      expect(reason.trim().length).toBeGreaterThan(20);
    });

    it.each(Object.entries(CATALOGUE_OPTED_OUT))("opted-out %s says why", (_route, reason) => {
      expect(reason.trim().length).toBeGreaterThan(20);
    });

    it("gives every covered route at least one case", () => {
      for (const [route, ids] of Object.entries(CATALOGUE_ROUTE_CASES)) {
        expect([route, ids.length > 0]).toEqual([route, true]);
      }
    });
  });
  describe("invariant 6 — a row with a spec, and the spec it names", () => {
    const withSpec = rows.filter((r) => r.spec !== "");

    it.each(rows.map((r): [string, string, string] => [r.id, r.state, r.spec]))(
      "%s (%s): the Spec column is consistent with the state",
      (id, state, spec) => {
        const bare = state.replace(/`/g, "").trim();
        if (bare === "automated" && spec === "") {
          throw new Error(
            `Case "${id}" is at "automated" but its Spec column is "—".\n\n` +
              `"automated" means a Playwright spec runs this case on every npm run e2e.\n` +
              `Name the spec in the Spec column of docs/testing/TEST-CATALOGUE.md as\n` +
              "`e2e/<area>/<name>.spec.ts`, or move the row back to \"confirmed\".\n",
          );
        }
        if (spec !== "" && !["confirmed", "automated"].includes(bare) && !(id in PROMOTED_WITHOUT_DRIVING)) {
          throw new Error(
            `Case "${id}" is at "${bare}" and already names a spec (${spec}).\n\n` +
              `Only a confirmed case is promoted: a spec is translated from a case file that has\n` +
              `held unchanged through two hand runs, never from the application. Drive the case\n` +
              `again until it is confirmed, or — if it can never be driven — add it, with the\n` +
              `reason, to PROMOTED_WITHOUT_DRIVING in src/lib/testing/catalogue-map.ts.\n`,
          );
        }
        expect(id).toBeTruthy();
      },
    );

    it.each(withSpec.map((r): [string, string] => [r.id, r.spec]))("%s names %s, which exists and names it back", (id, spec) => {
      if (!/^e2e\/.+/.test(spec) || !SPEC_FILE.test(spec)) {
        throw new Error(
          `Case "${id}" has Spec = "${spec}". A spec is a Playwright file under e2e/,\n` +
            "written `e2e/<area>/<name>.spec.ts` in backticks.\n",
        );
      }
      const file = join(ROOT, ...spec.split("/"));
      if (!existsSync(file)) {
        throw new Error(
          `Case "${id}" names ${spec} in its Spec column, and that file does not exist.\n` +
            `Fix the path, or put "—" back if the spec was removed.\n`,
        );
      }
      const { caseIds } = readSpecHeader(file);
      if (!caseIds.includes(id)) {
        throw new Error(
          `Case "${id}" names ${spec}, but that spec's header does not name "${id}".\n\n` +
            `Add the line\n  * Case:   ${id} — <title>\nto the spec's leading /** */ comment, so the\n` +
            `spec says which case it was translated from.\n`,
        );
      }
      expect(caseIds).toContain(id);
    });

    it("names only real rows in PROMOTED_WITHOUT_DRIVING, each with a reason", () => {
      for (const [id, reason] of Object.entries(PROMOTED_WITHOUT_DRIVING)) {
        expect([id, rowIds.has(id)]).toEqual([id, true]);
        expect(reason.trim().length).toBeGreaterThan(40);
      }
    });
  });

  describe("invariant 7 — every spec under e2e/ is a case's spec", () => {
    const specFiles = existsSync(E2E)
      ? walk(E2E, (f) => SPEC_FILE.test(f)).filter((f) => !f.split(sep).includes(".auth"))
      : [];
    const specByRow = new Map(rows.map((r) => [r.id, r.spec]));

    it("finds the specs", () => {
      // The walker returning nothing would make every assertion below vacuous.
      // TC-PROP-02's automation predates the catalogue, so there is always one.
      expect(specFiles.length).toBeGreaterThan(0);
    });

    it.each(specFiles.map(repoPath))("%s names its case and is named by it", (spec) => {
      const { caseIds, sourceLines } = readSpecHeader(join(ROOT, ...spec.split("/")));
      if (caseIds.length === 0) {
        throw new Error(
          `${spec} names no case in its header.\n\n` +
            `A spec is a translation of a case file, not a new test. Start the file with\n` +
            `  /**\n   * Case:   TC-<AREA>-<nn> — <title>\n` +
            `   * Source: docs/testing/cases/TC-<AREA>-<nn>.md, „Last green" <YYYY-MM-DD>\n   */\n` +
            `If no case describes what it tests, write the case first (docs/testing/cases/),\n` +
            `and add its row to docs/testing/TEST-CATALOGUE.md.\n`,
        );
      }
      for (const id of caseIds) {
        if (!rowIds.has(id)) {
          throw new Error(`${spec} names "${id}", which is not a row in docs/testing/TEST-CATALOGUE.md.\n`);
        }
        if (specByRow.get(id) !== spec) {
          throw new Error(
            `${spec} names "${id}", but that row's Spec column says ` +
              `"${specByRow.get(id) || "—"}".\n\n` +
              "Put `" + spec + "` in the Spec column of " + id + "'s row in\n" +
              `docs/testing/TEST-CATALOGUE.md, so the catalogue names the spec that runs the case.\n`,
          );
        }
        const source = sourceLines.find((l) => l.includes(`docs/testing/cases/${id}.md`));
        const dated = source !== undefined && /\d{4}-\d{2}-\d{2}/.test(source);
        if (!source || (!dated && !(id in PROMOTED_WITHOUT_DRIVING))) {
          throw new Error(
            `${spec} names "${id}" but has no line\n` +
              `  * Source: docs/testing/cases/${id}.md, „Last green" <YYYY-MM-DD>\n` +
              `in its header. The date is the case file's „Last green" when the spec was\n` +
              `translated from it — what a reader checks against when the two disagree.\n`,
          );
        }
        expect(rowIds.has(id)).toBe(true);
      }
    });
  });
});
