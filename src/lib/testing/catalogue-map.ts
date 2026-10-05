/**
 * Route -> business-user test case resolution  (Slice #36.04)
 *
 * WHY THIS FILE EXISTS
 *   `docs/testing/TEST-CATALOGUE.md` is a list of test cases, and a list is a
 *   thing people stop updating. The help system rotted in exactly that way
 *   before Slice #21.10: the whole mechanism was built, ten screens were
 *   registered, and nothing checked that any of them was reachable. The fix
 *   there was a Jest guard over the routes, and it has held since.
 *
 *   This is that mechanism applied to the test catalogue. A new route under
 *   `src/app` must land in one of the three lists below, or
 *   `src/__tests__/test-catalogue-coverage.test.ts` fails — on every push,
 *   because that suite runs inside `npm test` in `.github/workflows/ci.yml`.
 *   Adding a screen therefore forces a decision about testing it, at the moment
 *   the screen is added.
 *
 * THE THREE LISTS, AND WHY THEY ARE THREE AND NOT TWO
 *   CATALOGUE_ROUTE_CASES  — the route is exercised by named cases. Coverage.
 *   CATALOGUE_NOT_YET      — no case yet, and a sentence saying what one would
 *                            be. This is the backlog, in code rather than in a
 *                            document nobody opens, and it is deliberately
 *                            separate from the next list: "not done" and
 *                            "never" are different answers and collapsing them
 *                            loses the only one that is actionable.
 *   CATALOGUE_OPTED_OUT    — this route will never get a business-user case,
 *                            with the reason. Not a default: the guard's whole
 *                            value is that landing here is a decision.
 *
 * PURE MODULE — no React, no DB, no next/navigation. Unit-tested directly.
 */

/** A case id as `docs/testing/TEST-CATALOGUE.md` writes it. */
export type CatalogueCaseId = string;

/**
 * Routes a case drives, keyed by the Next.js route as the page file spells it
 * (`[id]`, not a uuid). A route may be driven by several cases, and a case may
 * appear against several routes — TC-AI-01 reads the result of TC-IMP-01 on the
 * document screen, so `/documents/[id]` carries several.
 */
export const CATALOGUE_ROUTE_CASES: Readonly<Record<string, readonly CatalogueCaseId[]>> = {
  "/":                                     ["TC-AUTH-01", "TC-AUTH-02", "TC-LAYOUT-01"],
  "/login":                                ["TC-AUTH-01"],
  "/properties":                           ["TC-PROP-01", "TC-PROP-03", "TC-AUTH-02", "TC-TILES-06", "TC-SYSID-01", "TC-PROP-06", "TC-TILES-11", "TC-LAYOUT-02"],
  "/properties/new":                       ["TC-PROP-01", "TC-PROP-05"],
  // Slice #37.38: the map opened on a Property from its form. Needs a Google
  // Maps key in .env — the laptop and the runner have one.
  "/properties/map":                       ["TC-MAP-01"],
  "/properties/[id]":                      ["TC-PROP-02", "TC-ASSOC-02", "TC-ASSOC-04", "TC-ASSOC-05", "TC-ASSOC-06", "TC-PROP-03", "TC-TAG-01", "TC-ASSOC-08", "TC-PROP-04", "TC-CALC-01", "TC-TILES-03", "TC-MAP-01", "TC-FOLD-01", "TC-ICON-02", "TC-ICON-03", "TC-ICON-04", "TC-ICON-07", "TC-TILES-07", "TC-SYSID-01", "TC-TILES-08", "TC-TILES-09", "TC-PROP-07", "TC-PROP-08", "TC-TILES-14", "TC-TILES-15", "TC-TILES-18"],
  // Slice #37.42: the list's icon buttons — tooltips by mouse and keyboard, an inactive one too.
  "/natural-persons":                      ["TC-PERS-01", "TC-AUTH-02", "TC-VER-01", "TC-TILES-06", "TC-ICON-01", "TC-SYSID-01", "TC-PERS-04", "TC-TILES-11", "TC-LAYOUT-02"],
  "/natural-persons/new":                  ["TC-PERS-01", "TC-ASSOC-11", "TC-ASSOC-12", "TC-STAMP-01", "TC-VER-01"],
  "/natural-persons/[id]":                 ["TC-PERS-01", "TC-ASSOC-03", "TC-ASSOC-04", "TC-ASSOC-09", "TC-ASSOC-11", "TC-ASSOC-12", "TC-STAMP-01", "TC-VER-01", "TC-TILES-01", "TC-FOLD-01", "TC-ICON-07", "TC-PERS-03", "TC-SYSID-01", "TC-TILES-08", "TC-TILES-09", "TC-PERS-05", "TC-TILES-10", "TC-TILES-12", "TC-TILES-13", "TC-TILES-16", "TC-TILES-17", "TC-TILES-18", "TC-PERS-07"],
  "/documents":                            ["TC-DOC-01", "TC-AUTH-02", "TC-VER-02", "TC-TILES-06", "TC-SYSID-01", "TC-DOC-08", "TC-TILES-11", "TC-LAYOUT-02"],
  "/documents/new":                        ["TC-DOC-01", "TC-ASSOC-07", "TC-ASSOC-10", "TC-ASSOC-12", "TC-VER-02", "TC-DOC-13"],
  "/documents/[id]":                       ["TC-DOC-01", "TC-ASSOC-01", "TC-AI-01", "TC-ASSOC-03", "TC-ASSOC-05", "TC-ASSOC-07", "TC-ASSOC-10", "TC-ASSOC-12", "TC-VER-02", "TC-TILES-04", "TC-TABS-01", "TC-TILES-05", "TC-FOLD-01", "TC-ICON-07", "TC-DOC-02", "TC-DOC-03", "TC-DOC-04", "TC-DOC-05", "TC-DOC-06", "TC-TILES-07", "TC-SYSID-01", "TC-ASSOC-13", "TC-DOC-07", "TC-TILES-08", "TC-TILES-09", "TC-DOC-09", "TC-DOC-10", "TC-DOC-11", "TC-TILES-14", "TC-TILES-15", "TC-DOC-12", "TC-TILES-16", "TC-TILES-17", "TC-DOC-13", "TC-TILES-18"],
  "/documents/[id]/associate-person":      ["TC-ASSOC-01", "TC-LAYOUT-01", "TC-ASSOC-13"],
  "/documents/[id]/associate-property":    ["TC-ASSOC-02", "TC-LAYOUT-01", "TC-ASSOC-13"],
  "/admin/import":                         ["TC-IMP-01", "TC-IMP-02", "TC-IMP-03", "TC-IMP-04", "TC-ICON-06"],
  "/admin/global-search":                  ["TC-SRCH-01", "TC-PROP-03", "TC-GRP-01", "TC-TAG-01", "TC-AUTH-02"],
  "/judicial-persons":                     ["TC-PERS-02", "TC-TILES-06", "TC-SYSID-01", "TC-PERS-04", "TC-TILES-11", "TC-PERS-06", "TC-LAYOUT-02"],
  "/judicial-persons/new":                 ["TC-PERS-02", "TC-ASSOC-10", "TC-ASSOC-11"],
  "/judicial-persons/[id]":                ["TC-PERS-02", "TC-ASSOC-06", "TC-ASSOC-10", "TC-ASSOC-11", "TC-TILES-02", "TC-ICON-07", "TC-SYSID-01", "TC-TILES-08", "TC-TILES-09", "TC-PERS-05", "TC-TILES-12", "TC-TILES-18", "TC-PERS-07"],
  "/natural-persons/[id]/associate-document": ["TC-ASSOC-03", "TC-LAYOUT-01"],
  "/properties/[id]/associate-person":     ["TC-ASSOC-04", "TC-LAYOUT-01", "TC-ICON-03"],
  "/natural-persons/[id]/associate-property": ["TC-ASSOC-04", "TC-LAYOUT-01"],
  "/properties/[id]/associate-document":   ["TC-ASSOC-05", "TC-LAYOUT-01"],
  "/judicial-persons/[id]/associate-property": ["TC-ASSOC-06", "TC-LAYOUT-01"],
  "/documents/[id]/associate-reference":   ["TC-ASSOC-07", "TC-LAYOUT-01"],
  "/admin/groups":                         ["TC-GRP-01", "TC-CALC-01", "TC-LAYOUT-01"],
  "/admin/groups/[id]":                    ["TC-GRP-01", "TC-LAYOUT-01"],
  "/admin/tags":                           ["TC-TAG-01", "TC-HELP-01", "TC-LAYOUT-01", "TC-ICON-05"],
  "/properties/[id]/associate-reference":  ["TC-ASSOC-08", "TC-LAYOUT-01"],
  "/natural-persons/[id]/associate-person": ["TC-ASSOC-09", "TC-LAYOUT-01"],
  // Slice #36.21 — the third wave: nine routes out of CATALOGUE_NOT_YET.
  "/judicial-persons/[id]/associate-document": ["TC-ASSOC-10", "TC-LAYOUT-01"],
  "/judicial-persons/[id]/associate-person": ["TC-ASSOC-11", "TC-LAYOUT-01"],
  "/documents/[id]/associate-party":       ["TC-ASSOC-12", "TC-LAYOUT-01"],
  "/admin/stamps":                         ["TC-STAMP-01", "TC-LAYOUT-01", "TC-ICON-05"],
  "/admin/stamps/[id]":                    ["TC-STAMP-01", "TC-LAYOUT-01", "TC-ICON-05"],
  "/admin/help-content":                   ["TC-HELP-01", "TC-LAYOUT-01"],
  "/admin/calculation":                    ["TC-CALC-01", "TC-LAYOUT-01"],
  "/admin/calculation/history":            ["TC-CALC-01", "TC-LAYOUT-01"],
  "/admin/calculation/history/[id]":       ["TC-CALC-01", "TC-LAYOUT-01"],
  // Slice #37.08 — the last four that need a cleanup rule, each written into
  // its case file before the run.
  "/admin/users":                          ["TC-USERS-01", "TC-LAYOUT-01"],
  "/admin/settings":                       ["TC-SET-01", "TC-LAYOUT-01"],
  "/admin/value-lists":                    ["TC-VL-01", "TC-LAYOUT-01", "TC-DOC-07"],
  "/account/change-password":              ["TC-ACCT-01", "TC-LAYOUT-01"],
};

/**
 * Routes with no case yet. The value is what a case for it would be — one
 * sentence, so the next person writing cases has a starting point rather than a
 * blank page.
 *
 * ⚠️ This list is expected to SHRINK. A row moved from here into
 * CATALOGUE_ROUTE_CASES is the visible shape of the suite growing.
 */
export const CATALOGUE_NOT_YET: Readonly<Record<string, string>> = {
  // TC-LAYOUT-01 (Slice #37.22) opens this route too, but only to measure its
  // widths; what the screen is FOR — distilling a type — still has no case,
  // so the route stays here rather than moving to CATALOGUE_ROUTE_CASES.
  "/admin/doc-type-engine":
    "Distil a document type from samples. Spends AI budget, so it needs the same cost note TC-IMP-01 carries.",
};

/**
 * Routes that will never get a business-user case, and why. Adding a route here
 * is a deliberate decision, not a default.
 */
export const CATALOGUE_OPTED_OUT: Readonly<Record<string, string>> = {
  "/signup":
    "Requesting access writes a pending user row that only an administrator can remove, so a repeatable case would leave a trail of accounts. The account TC-AUTH-01 logs in with is created once, by hand.",
  // Same shape, and the same reason, as this route's entry in HELP_OPTED_OUT
  // (src/lib/help/route-map.ts): it is a bare redirect() to
  // /admin/global-search, kept so old deep-links resolve. It renders no UI, so
  // there is nothing for a person to do on it.
  "/admin/complex-query":
    "A bare redirect to /admin/global-search. It renders no UI, so there is nothing a person can do on it. TC-SRCH-01 covers where it lands.",
};

/**
 * Cases that have a Playwright spec WITHOUT having reached `confirmed`, and why.
 *                                                              (Slice #36.06)
 *
 * The catalogue's rule is that only a `confirmed` case is promoted: a spec is
 * translated from a case file that has survived two hand runs, never from the
 * application. `test-catalogue-coverage.test.ts` enforces it — a row whose
 * `Spec` column names a file must be `confirmed` or `automated` — and this map
 * is the only way past it.
 *
 * ⚠️ **ONE ENTRY, AND IT IS MEANT TO STAY ONE.** An exception written only in
 * prose becomes a precedent the first time somebody is in a hurry; written
 * here, adding a second one is a diff a reviewer sees, with its reason beside
 * it. The same paragraph is in docs/testing/TEST-CATALOGUE.md.
 */
export const PROMOTED_WITHOUT_DRIVING: Readonly<Record<CatalogueCaseId, string>> = {
  "TC-AUTH-01":
    "Claude may not type a password into a field, so the case's login steps can never be driven by hand. " +
    "e2e/auth.setup.ts performs them on every run from E2E_EMAIL / E2E_PASSWORD in .env, and the spec asserts " +
    "what the case asserts after login; its green run is its own proof.",
};

/** Strips a trailing slash and any query/hash, and guarantees a leading slash. */
function normalise(pathname: string): string {
  let p = pathname.split("?")[0].split("#")[0];
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

/** The cases that drive this route, or an empty array. */
export function resolveCatalogueCases(pathname: string): readonly CatalogueCaseId[] {
  return CATALOGUE_ROUTE_CASES[normalise(pathname)] ?? [];
}

/** True when a route is knowingly on the backlog rather than covered. */
export function isCatalogueNotYet(pathname: string): boolean {
  return normalise(pathname) in CATALOGUE_NOT_YET;
}

/** True when a route will never get a business-user case. */
export function isCatalogueOptedOut(pathname: string): boolean {
  return normalise(pathname) in CATALOGUE_OPTED_OUT;
}
