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
 * document screen, so `/documents/[id]` carries three.
 */
export const CATALOGUE_ROUTE_CASES: Readonly<Record<string, readonly CatalogueCaseId[]>> = {
  "/":                                     ["TC-AUTH-01"],
  "/login":                                ["TC-AUTH-01"],
  "/properties":                           ["TC-PROP-01", "TC-PROP-03"],
  "/properties/new":                       ["TC-PROP-01"],
  "/properties/[id]":                      ["TC-PROP-02", "TC-ASSOC-02", "TC-ASSOC-04", "TC-ASSOC-05", "TC-ASSOC-06", "TC-PROP-03"],
  "/natural-persons":                      ["TC-PERS-01"],
  "/natural-persons/new":                  ["TC-PERS-01"],
  "/natural-persons/[id]":                 ["TC-PERS-01", "TC-ASSOC-03", "TC-ASSOC-04"],
  "/documents":                            ["TC-DOC-01"],
  "/documents/new":                        ["TC-DOC-01", "TC-ASSOC-07"],
  "/documents/[id]":                       ["TC-DOC-01", "TC-ASSOC-01", "TC-AI-01", "TC-ASSOC-03", "TC-ASSOC-05", "TC-ASSOC-07"],
  "/documents/[id]/associate-person":      ["TC-ASSOC-01"],
  "/documents/[id]/associate-property":    ["TC-ASSOC-02"],
  "/admin/import":                         ["TC-IMP-01", "TC-IMP-02"],
  "/admin/global-search":                  ["TC-SRCH-01", "TC-PROP-03"],
  "/judicial-persons":                     ["TC-PERS-02"],
  "/judicial-persons/new":                 ["TC-PERS-02"],
  "/judicial-persons/[id]":                ["TC-PERS-02", "TC-ASSOC-06"],
  "/natural-persons/[id]/associate-document":["TC-ASSOC-03"],
  "/properties/[id]/associate-person":     ["TC-ASSOC-04"],
  "/natural-persons/[id]/associate-property":["TC-ASSOC-04"],
  "/properties/[id]/associate-document":   ["TC-ASSOC-05"],
  "/judicial-persons/[id]/associate-property":["TC-ASSOC-06"],
  "/documents/[id]/associate-reference":   ["TC-ASSOC-07"],
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
  "/account/change-password":
    "Change a password and log back in with the new one. Needs a throwaway account, because it leaves the tester locked out of the old one.",
  "/properties/map":
    "Open the map, see the property from TC-PROP-01 on it, open it from there. Needs a Google Maps key in .env, so it is not a case every machine can run.",
  "/properties/[id]/associate-reference":
    "Link two properties to each other and check the relationship reads correctly in both directions.",
  "/natural-persons/[id]/associate-person":
    "Link two people (mandatar, mostenitor) and check the relationship reads correctly in both directions.",
  "/judicial-persons/[id]/associate-document":
    "The judicial-person twin of TC-ASSOC-01.",
  "/judicial-persons/[id]/associate-person":
    "A natural person acting for a company — the representative link.",
  "/documents/[id]/associate-party":
    "Add a party to a Certificat de Mostenitor with quality Defunct or Mostenitor. No data folder holds one, and none is needed: a Certificat de Mostenitor made by hand shows „Părți” and „+ Adaugă parte” at once (seen on TC-ASSOC-07's run, Slice #36.08).",
  "/admin/value-lists":
    "Add a value to a closed list and see it offered in the form that consumes it. Writes reference data, so it needs its own cleanup rule.",
  "/admin/tags":
    "Create a tag, apply it, find records by it.",
  "/admin/groups":
    "Create a group and put two properties in it.",
  "/admin/groups/[id]":
    "Open a group and see its members.",
  "/admin/stamps":
    "Create a stamp and apply it to a record.",
  "/admin/stamps/[id]":
    "Open a stamp and see what carries it.",
  "/admin/users":
    "Approve a pending account. Creates a real user, so it needs a decision about cleanup first.",
  "/admin/settings":
    "Change a setting and see it take effect. Global state, so it cannot run beside another case.",
  "/admin/help-content":
    "Author help for a screen and see the ? button show it. Pairs with the help-coverage guard.",
  "/admin/calculation":
    "Run a lateral-road calculation over a known property and check the result against a figure a person computed.",
  "/admin/calculation/history":
    "See the run from the case above in the history list.",
  "/admin/calculation/history/[id]":
    "Open that run and read what it did.",
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
