/**
 * Case:   TC-SYSID-01 — ID-ul de sistem într-un singur loc: în bara paginii, la stânga versiunilor
 * Source: docs/testing/cases/TC-SYSID-01.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-SYSID-01` (records.ts).
 *   - Step 5 also checks the four tables' headers by name (no „Cod").
 *   - Pictures, not steps of the case: the page bar of each of the four
 *     screens (41.22; the first panels before it) and the four lists — each
 *     list filtered by its search box to this case's record, so no real record
 *     is pictured — at 1366 and 1920 px, into `playwright-report/system-id/`.
 */

import { test, expect, type Page } from "../helpers/test";
import {
  E2E_MARKER,
  createCompany,
  createNaturalPerson,
  createProperty,
  createSaleContract,
  removeLeftovers,
  removeRecord,
  type RecordKind,
} from "../helpers/records";

const MARK = `${E2E_MARKER}SYSID-01`;
const SHOTS = "playwright-report/system-id";
const CODE = /\b(DOC|PPERS|JPERS|PROP)\d{3,}\b/g;

/** Every code in the page's text, less the „Vezi și" hint's example. */
async function codesOnScreen(page: Page): Promise<string[]> {
  return page.evaluate((src) => document.body.innerText.replace(/PPERS00001/g, "").match(new RegExp(src, "g")) ?? [], CODE.source);
}

/**
 * 41.22 — the ID: one, in the page bar's versions slot, its first child; the versions pill right after it with the
 * bar's gap, on one line with it; „Panouri" after both; none inside a tile.
 */
async function inBar(page: Page) {
  return page.evaluate(() => {
    const all = [...document.querySelectorAll<HTMLElement>("[data-system-id]")].filter((e) => e.getBoundingClientRect().width > 0);
    const c = all[0];
    const slot = c?.closest<HTMLElement>("[data-page-bar] [data-version-slot]") ?? null;
    const pill = c?.nextElementSibling as HTMLElement | null;
    const menu = document.querySelector<HTMLElement>("[data-page-bar] [data-tiles-menu-button]");
    const r = c.getBoundingClientRect();
    const pr = pill?.getBoundingClientRect();
    const mr = menu?.getBoundingClientRect();
    return {
      count: all.length,
      text: c.textContent ?? "",
      inSlot: slot !== null,
      first: slot?.firstElementChild === c,
      gap: pr ? Math.round(pr.left - r.right) : null,
      sameLine: pr ? Math.abs((r.top + r.bottom) / 2 - (pr.top + pr.bottom) / 2) < 4 : null,
      oneLine: r.height < 24,
      beforeMenu: mr ? r.right <= mr.left : null,
      inTile: document.querySelectorAll("[data-tile] [data-system-id], [data-panel] [data-system-id], section [data-system-id]").length,
    };
  });
}

async function stepScreen(page: Page, url: string, prefix: string): Promise<void> {
  await page.goto(url);
  const id = page.locator("[data-page-bar] [data-version-slot] [data-system-id]");
  await expect(id).toBeVisible({ timeout: 30_000 });
  // The versions pill lands once the versions have loaded — then it stands right of the ID.
  await expect(page.locator("[data-page-bar] [data-version-slot] > *")).toHaveCount(2, { timeout: 30_000 });
  const c = await inBar(page);
  expect(c.count).toBe(1);
  expect(c.inSlot && c.first).toBe(true);
  expect(c.text).toMatch(new RegExp(`^ID sistem ${prefix}\\d+$`));
  expect(c.gap).toBeGreaterThanOrEqual(8);
  expect(c.gap).toBeLessThanOrEqual(16);
  expect(c.sameLine && c.oneLine && c.beforeMenu).toBe(true);
  expect(c.inTile).toBe(0);
  const code = c.text.replace("ID sistem ", "");
  expect(await codesOnScreen(page)).toEqual([code]);
  await expect(page.locator('[data-width-field="code"]')).toHaveCount(0);
  // One click selects it for copying.
  await id.locator(".select-all").click();
  expect(await page.evaluate(() => window.getSelection()?.toString().trim())).toBe(code);
}

async function photographBar(page: Page, name: string): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await page.locator("[data-page-bar]").screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

async function listStep(page: Page, url: string, name: string): Promise<void> {
  await page.goto(url);
  const table = page.locator("main table").first();
  await expect(table).toBeVisible({ timeout: 30_000 });
  // Filtered to this case's record, so the picture holds no real one.
  await page.getByPlaceholder(/caută după/).first().fill(MARK);
  await expect(table.locator("tbody tr").filter({ hasText: MARK })).toHaveCount(1, { timeout: 30_000 });
  await expect(table.getByRole("columnheader", { name: /^cod$/i })).toHaveCount(0);
  expect((await table.innerText()).match(CODE) ?? []).toEqual([]);
  expect(((await page.locator("aside").first().innerText()).match(CODE) ?? [])).toEqual([]);
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await table.screenshot({ path: `${SHOTS}/list-${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-SYSID-01 — ID-ul de sistem într-un singur loc", () => {
  test("în bara paginii, la stânga versiunilor, și nicăieri altundeva; listele fără cod", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const made: { kind: RecordKind; id: string }[] = [];
    try {
      const np = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
      made.push({ kind: "person", id: np });
      const jp = await createCompany(page.request, { name: `${MARK} Firmă de test SRL` });
      made.push({ kind: "company", id: jp });
      const pr = await createProperty(page.request, { nickname: `${MARK} Teren de test` });
      made.push({ kind: "property", id: pr });
      const dc = await createSaleContract(page.request, `${MARK} Act de test`);
      made.push({ kind: "document", id: dc });

      // Steps 1–4 — one code on each screen, in the page bar, left of the versions pill (41.22).
      await stepScreen(page, `/natural-persons/${np}`, "PPERS");
      await photographBar(page, "natural-person");
      await stepScreen(page, `/judicial-persons/${jp}`, "JPERS");
      await photographBar(page, "judicial-person");
      await stepScreen(page, `/properties/${pr}`, "PROP");
      await photographBar(page, "property");
      await stepScreen(page, `/documents/${dc}`, "DOC");
      await photographBar(page, "document");

      // Step 5 — the four lists: no „Cod", no code, this case's record among the rows.
      await listStep(page, "/natural-persons", "natural-persons");
      await listStep(page, "/judicial-persons", "judicial-persons");
      await listStep(page, "/properties", "properties");
      await listStep(page, "/documents", "documents");
    } finally {
      for (const m of made) await removeRecord(page.request, m.kind, m.id);
    }
  });
});
