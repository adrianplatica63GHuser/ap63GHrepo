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
 *
 * ⚠️ NO BROWSER AND NO DATABASE ARE INVOLVED. This suite checks that the
 * catalogue and the application agree about which screens exist. It does not
 * run a single test case, and a green run here says nothing whatever about
 * whether the application works — see `docs/testing/WHAT-WE-TEST.md`.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, relative, sep } from "path";
import {
  CATALOGUE_NOT_YET,
  CATALOGUE_OPTED_OUT,
  CATALOGUE_ROUTE_CASES,
} from "@/lib/testing/catalogue-map";

const ROOT = process.cwd();
const APP = join(ROOT, "src", "app");
const CATALOGUE = join(ROOT, "docs", "testing", "TEST-CATALOGUE.md");
const CASES_DIR = join(ROOT, "docs", "testing", "cases");

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

type Row = { id: string; title: string; area: string; kind: string; state: string; lastGreen: string };

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
    });
  }
  return rows;
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
});
