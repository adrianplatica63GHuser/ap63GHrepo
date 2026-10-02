/**
 * Case:   TC-SYSID-01 — ID-ul de sistem într-un singur loc: colțul din dreapta-sus al primului panou
 * Source: docs/testing/cases/TC-SYSID-01.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-SYSID-01` (records.ts).
 *   - Step 5 also checks the four tables' headers by name (no „Cod").
 *   - Slice #37.57's pictures, not steps of the case: the four first panels
 *     and the four lists — each list filtered by its search box to this case's
 *     record, so no real record is pictured — at 1366 and 1920 px, into
 *     `playwright-report/system-id/`.
 */

import { test, expect, type Page } from "@playwright/test";
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

/** The corner: one, on its panel heading's line, at its right end; the heading one line. */
async function corner(page: Page): Promise<{ heading: string; text: string; gap: number; sameLine: boolean; oneLine: boolean; count: number }> {
  return page.evaluate(() => {
    const all = [...document.querySelectorAll<HTMLElement>("[data-system-id]")].filter((e) => e.getBoundingClientRect().width > 0);
    const c = all[0];
    const h = c.closest("h2")!;
    const p = (c.closest("[data-panel]") ?? c.closest("section"))!;
    const r = c.getBoundingClientRect(), hr = h.getBoundingClientRect(), pr = p.getBoundingClientRect();
    return {
      heading: (h.firstChild?.textContent ?? "").trim(),
      text: c.textContent ?? "",
      gap: Math.round(pr.right - r.right),
      sameLine: Math.abs((r.top + r.bottom) / 2 - (hr.top + hr.bottom) / 2) < 4,
      oneLine: hr.height < 30,
      count: all.length,
    };
  });
}

async function stepScreen(page: Page, url: string, heading: string, prefix: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator("[data-system-id]").first()).toBeVisible({ timeout: 30_000 });
  const c = await corner(page);
  expect(c.count).toBe(1);
  expect(c.heading).toBe(heading);
  expect(c.text).toMatch(new RegExp(`^ID sistem ${prefix}\\d+$`));
  expect(c.gap).toBeLessThanOrEqual(16);
  expect(c.sameLine && c.oneLine).toBe(true);
  const code = c.text.replace("ID sistem ", "");
  expect(await codesOnScreen(page)).toEqual([code]);
  await expect(page.locator('[data-width-field="code"]')).toHaveCount(0);
}

async function photographPanel(page: Page, name: string): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await page.locator("section", { has: page.locator("[data-system-id]") }).first().screenshot({ path: `${SHOTS}/${name}-${width}.png` });
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
  test("colțul din dreapta-sus al primului panou, și nicăieri altundeva; listele fără cod", async ({ page }) => {
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

      // Steps 1–4 — one code on each screen, in the corner of its first panel.
      await stepScreen(page, `/natural-persons/${np}`, "Identitate", "PPERS");
      await photographPanel(page, "natural-person");
      await stepScreen(page, `/judicial-persons/${jp}`, "Persoană juridică", "JPERS");
      await photographPanel(page, "judicial-person");
      await stepScreen(page, `/properties/${pr}`, "Date cadastrale", "PROP");
      await photographPanel(page, "property");
      await stepScreen(page, `/documents/${dc}`, "Date generale", "DOC");
      await photographPanel(page, "document");

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
