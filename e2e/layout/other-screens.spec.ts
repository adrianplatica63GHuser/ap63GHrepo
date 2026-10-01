/**
 * Case:   TC-LAYOUT-01 — Celelalte ecrane, la lățimi fixe
 * Source: docs/testing/cases/TC-LAYOUT-01.md, „Last green" 2026-10-01
 *
 * Every screen Slice #37.22 put on #37.12's rule, opened at 1400 and at
 * 2400 px: every box (`data-width-field`), panel (`data-panel`) and table
 * column (`data-width-column`) on it is exactly as wide at both, and no fixed
 * column's cell overflows (`expectStableScreen`, e2e/helpers/field-widths.ts).
 * Then one picture of each at 1920 px into playwright-report/layout/, for the
 * slice's handover. Step 5 (Slice #37.34): on each „Asociază …" screen, the
 * three tiles, the unit grid at 1366, 1920 and 2560 px, and the breadcrumb.
 * Step 6 (Slice #37.35): the unit grid on every administration screen too,
 * and (Slice #37.36) on the home page.
 *
 * ⚠️ **THE PICTURES CARRY NO REAL RECORD.** The „Asociază …" screens search for
 * this spec's own marker, so their tables list only its records; a screen that
 * lists the archive's own rows — the dashboard, the users, the groups, the
 * stamps, the tags, the calculations, a group's and a stamp's candidates — has
 * those rows painted over (`photograph`'s `mask`). The layout is the subject.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records the „Asociază …" screens open from are this spec's own,
 *     created through the POST routes their „Adaugă" forms call, and removed
 *     in `finally` — two properties, a natural person, a company, two sale
 *     contracts, a group and a stamp, every one marked TC-E2E-LAYOUT-01.
 *   - The hand run measured in two same-origin frames of the desktop app's
 *     browser pane; here the window itself is resized, which is the case's
 *     own wording.
 *   - „One calculation" is opened only when „Istoricul calculelor" lists a
 *     run: a calculation is not made for this (it creates properties and a
 *     group). The spec says so in its output when there is none.
 */
import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  E2E_MARKER,
  createCompany,
  createNaturalPerson,
  createProperty,
  createSaleContract,
  removeGroupLeftovers,
  removeLeftovers,
  removeStampLeftovers,
} from "../helpers/records";
import { expectStableScreen, expectUnitGrid, photograph } from "../helpers/field-widths";
import { UNIT_GAP_REM, UNIT_REM } from "../../src/lib/ui/field-widths";

const MARK = `${E2E_MARKER}LAYOUT-01`;

/** Open a screen, wait for what shows it is drawn, check its widths, photograph it at 1920. */
async function screen(
  page: Page,
  name: string,
  url: string,
  ready: (page: Page) => Locator,
  opts: {
    mask?: (page: Page) => Locator[];
    prepare?: (page: Page) => Promise<void>;
    mayBeEmpty?: boolean;
    /** Slice #37.35: the screen is a row of unit tiles; check its grid at 1366, 1920 and 2560 px. */
    unitGrid?: boolean;
    /** Slice #37.35: also photograph it at these widths. */
    alsoAt?: number[];
  } = {},
): Promise<void> {
  await test.step(name, async () => {
    await page.goto(url);
    await expect(ready(page)).toBeVisible({ timeout: 90_000 });
    if (opts.prepare) await opts.prepare(page);
    await settled(page);
    await expectStableScreen(page, [1400, 2400], 900, !opts.mayBeEmpty);
    if (opts.unitGrid) await expectScreenUnitGrid(page);
    await photograph(page, `other-${name}`, [1920, ...(opts.alsoAt ?? [])], 1000, opts.mask ? opts.mask(page) : []);
  });
}

/**
 * A screen of unit tiles (Slice #37.35): every tile and panel a whole number of
 * units, and the row as many units as the window holds — 6, 10 and 14 at 1366,
 * 1920 and 2560 px — or, where one tile is wider than that, as wide as it (the
 * row is never narrower than its widest tile, and the page scrolls sideways).
 */
async function expectScreenUnitGrid(page: Page): Promise<void> {
  const widest = await page.evaluate(([u, g]) => {
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const units = [...document.querySelectorAll<HTMLElement>("[data-tile-row] [data-tile], [data-tile-row] [data-panel]")]
      .map((el) => Math.round((el.getBoundingClientRect().width / rem + g) / (u + g)));
    return Math.max(0, ...units);
  }, [UNIT_REM, UNIT_GAP_REM] as const);
  expect(widest, "no tile on the unit row").toBeGreaterThan(0);
  await expectUnitGrid(page, UNIT_REM, UNIT_GAP_REM, { 1366: Math.max(6, widest), 1920: Math.max(10, widest), 2560: Math.max(14, widest) });
}

/**
 * Wait until the screen stops adding marked boxes: a role picker, a panel of
 * candidates, arrives after its list loads, and a width check taken before it
 * would compare two different screens.
 */
async function settled(page: Page): Promise<void> {
  const marks = () => page.locator("[data-width-field], [data-panel], th[data-width-column]").count();
  let last = -1;
  for (let i = 0; i < 20; i++) {
    const now = await marks();
    if (now === last) return;
    last = now;
    await page.waitForTimeout(1500);
  }
}

/** An „Asociază …" screen: search for this spec's marker and wait for its rows. */
function searchMark(page: Page) {
  return async () => {
    const box = page.locator('[data-width-field="searchName"], [data-width-field="searchText"]').first();
    await box.fill(MARK);
    await expect(page.locator("table[data-width-table] tbody tr").first()).toBeVisible({ timeout: 30_000 });
  };
}

test.describe("TC-LAYOUT-01 — Celelalte ecrane, la lățimi fixe", () => {
  test("fiecare ecran are aceleași lățimi la 1400 și la 2400 px", async ({ page }) => {
    test.setTimeout(900_000);
    const req = page.request;
    await removeLeftovers(req, MARK);
    await removeGroupLeftovers(req, MARK);
    await removeStampLeftovers(req, MARK);

    try {
      const propA = await createProperty(req, { nickname: `${MARK} Teren A` });
      // B is what property-associate-reference lists from A.
      await createProperty(req, { nickname: `${MARK} Teren B` });
      const person = await createNaturalPerson(req, { lastName: `${MARK}`, firstName: "Persoană" });
      const company = await createCompany(req, { name: `${MARK} Firmă` });
      const docA = await createSaleContract(req, `${MARK} Contract A`);
      await createSaleContract(req, `${MARK} Contract B`);
      const group = await req.post("/api/groups", { data: { targetType: "PROPERTY", description: `${MARK} Grup` } });
      expect(group.ok(), `POST /api/groups failed (${group.status()})`).toBeTruthy();
      const groupId = ((await group.json()) as { id: string }).id;
      const stamp = await req.post("/api/stamps", { data: { shortDescription: `${MARK} Ștampilă`, notes: MARK } });
      expect(stamp.ok(), `POST /api/stamps failed (${stamp.status()})`).toBeTruthy();
      const stampId = ((await stamp.json()) as { id: string }).id;

      const heading = (p: Page) => p.getByRole("heading", { level: 1 }).first();
      const rows = (p: Page) => [p.locator("tbody")];

      // The home page — its lists are the archive's own.
      await screen(page, "home", "/", heading, {
        mask: (p) => [p.locator('[data-panel="expiring-documents"] tbody'), p.locator('[data-panel="recent-activity"] ul')],
        // Slice #37.36: four unit tiles on the unit row.
        unitGrid: true,
        alsoAt: [1366, 2560],
      });

      // The „Asociază …" screens, from this spec's own records.
      const associate: [string, string][] = [
        ["natural-person-associate-document", `/natural-persons/${person}/associate-document`],
        ["natural-person-associate-person", `/natural-persons/${person}/associate-person`],
        ["natural-person-associate-property", `/natural-persons/${person}/associate-property`],
        ["judicial-person-associate-document", `/judicial-persons/${company}/associate-document`],
        ["judicial-person-associate-person", `/judicial-persons/${company}/associate-person`],
        ["judicial-person-associate-property", `/judicial-persons/${company}/associate-property`],
        ["document-associate-person", `/documents/${docA}/associate-person`],
        ["document-associate-party", `/documents/${docA}/associate-party`],
        ["document-associate-property", `/documents/${docA}/associate-property`],
        ["document-associate-reference", `/documents/${docA}/associate-reference`],
        ["property-associate-document", `/properties/${propA}/associate-document`],
        ["property-associate-person", `/properties/${propA}/associate-person`],
        ["property-associate-reference", `/properties/${propA}/associate-reference`],
      ];
      // Slice #37.34: each is a row of three unit tiles — Căutare, Rezultate, Asociere — on
      // the unit grid at 1366, 1920 and 2560 px, and its breadcrumb names the screen:
      // Acasă › the list › the record › the screen's own title.
      const LIST: Record<string, string> = {
        "natural-persons": "Persoane fizice",
        "judicial-persons": "Persoane juridice",
        documents: "Acte",
        properties: "Proprietăți",
      };
      for (const [name, url] of associate) {
        await screen(page, name, url, heading, { prepare: (p) => searchMark(p)() });
        await test.step(`${name}: three unit tiles, and the breadcrumb`, async () => {
          for (const tile of ["Căutare", "Rezultate", "Asociere"]) {
            await expect(page.getByRole("region", { name: tile, exact: true })).toBeVisible();
          }
          await expectUnitGrid(page, UNIT_REM, UNIT_GAP_REM, { 1366: 6, 1920: 10, 2560: 14 });
          const title = (await heading(page).textContent())?.trim() ?? "";
          const record = (await page.locator("main header p").first().textContent())?.trim() ?? "";
          const crumbs = page.getByRole("navigation", { name: "Fir de navigare" }).locator("a, [aria-current=page]");
          await expect(crumbs).toHaveText(["Acasă", LIST[url.split("/")[1]], record, title], { timeout: 15_000 });
          if (name === "document-associate-person" || name === "property-associate-reference") {
            await photograph(page, `other-${name}`, [1366, 2560], 1000);
          }
        });
      }

      // Administration.
      await screen(page, "settings", "/admin/settings", (p) => p.locator('[data-width-field="timeFrameDays"]').first(), { unitGrid: true, alsoAt: [1366, 2560] });
      await screen(page, "value-lists", "/admin/value-lists", (p) => p.locator("[data-panel]").first(), { unitGrid: true });
      // „Istoric", whose table is there whenever anyone has ever asked for access;
      // with no request at all the screen has nothing fixed to measure but the
      // page itself, which must still not be pushed sideways.
      await screen(page, "users", "/admin/users", heading, {
        mask: rows,
        mayBeEmpty: true,
        unitGrid: true,
        prepare: async (p) => {
          await p.getByRole("button", { name: "Istoric", exact: true }).click();
          await expect(p.locator("table[data-width-table]").or(p.getByText("Nu există istoric."))).toBeVisible({ timeout: 30_000 });
        },
      });
      await screen(page, "groups", "/admin/groups", (p) => p.locator("table[data-width-table]"), { mask: rows, unitGrid: true });
      await screen(page, "group", `/admin/groups/${groupId}`, (p) => p.locator('[data-width-field="groupDescription"]'), {
        // The member panels are open when the editor opens („Ascunde elementele").
        prepare: async (p) => {
          await expect(p.locator('[data-panel="available"]')).toBeVisible({ timeout: 30_000 });
        },
        mask: (p) => [p.locator('[data-panel="available"] ul'), p.locator('[data-panel="in-group"] ul')],
        unitGrid: true,
        alsoAt: [1366, 2560],
      });
      await screen(page, "stamps", "/admin/stamps", (p) => p.locator("table[data-width-table]"), { mask: rows, unitGrid: true });
      await screen(page, "stamp", `/admin/stamps/${stampId}`, (p) => p.locator('[data-panel="available"]'), {
        mask: (p) => [p.locator('[data-panel="available"] ul'), p.locator('[data-panel="stamped"] ul')],
        unitGrid: true,
      });
      await screen(page, "tags", "/admin/tags", heading, {
        mask: (p) => [p.locator('[data-panel="tag-cloud"] > div').last(), p.locator("tbody")],
        unitGrid: true,
      });
      await screen(page, "help-content", "/admin/help-content", (p) => p.locator('[data-panel="help-nav"]'), {
        prepare: async (p) => {
          await p.locator('[data-panel="help-nav"] button').first().click();
          await expect(p.locator('[data-width-field="helpText"]').first()).toBeVisible({ timeout: 30_000 });
        },
        unitGrid: true,
      });
      await screen(page, "calculation", "/admin/calculation", heading, { unitGrid: true, alsoAt: [1366, 2560] });
      // With no calculation yet the history is one sentence, and nothing on it is marked.
      await screen(page, "calculation-history", "/admin/calculation/history", heading, { mask: rows, mayBeEmpty: true, unitGrid: true });
      const run = page.locator('a[href^="/admin/calculation/history/"]').first();
      if (await run.count()) {
        const href = await run.getAttribute("href");
        await screen(page, "calculation-run", href!, (p) => p.locator("table[data-width-table]").first(), {
          // Its header names who made it; its tables and map, whose land.
          mask: (p) => [p.locator("tbody"), p.locator('[data-panel="preview-map"]'), p.locator("main div.flex.flex-wrap.items-center.gap-4").first()],
          unitGrid: true,
        });
      } else {
        test.info().annotations.push({ type: "note", description: "no calculation run to open; „one calculation” not photographed" });
      }
      await screen(page, "doc-type-engine", "/admin/doc-type-engine", (p) => p.locator('[data-width-field="documentType"]'), { unitGrid: true });
      await screen(page, "change-password", "/account/change-password", (p) => p.locator('[data-width-field="password"]').first(), { unitGrid: true });
    } finally {
      await removeLeftovers(req, MARK);
      await removeGroupLeftovers(req, MARK);
      await removeStampLeftovers(req, MARK);
    }
  });
});
