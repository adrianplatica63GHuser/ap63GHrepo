/**
 * Case:   TC-PROP-06 — Lista proprietăților: fără filtre de importanță și relevanță, fără „Cod", „Câmpuri afișate" fără importanță, relevanță și proveniență
 * Source: docs/testing/cases/TC-PROP-06.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The property carries `TC-E2E-PROP-06` (records.ts).
 *   - A Playwright browser has never chosen, so the columns are the four
 *     defaults and the button reads „Câmpuri afișate 4/4".
 *   - Slice #37.61's pictures, not steps of the case: the list filtered to
 *     this case's property with „Câmpuri afișate" open, at 1366 and 1920 px,
 *     into `playwright-report/property-list/`.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}PROP-06`;
const NAME = `${MARK} Teren de test`;
const SHOTS = "playwright-report/property-list";

async function photograph(page: Page, name: string, target: Locator): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await target.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-PROP-06 — lista proprietăților", () => {
  test("fără filtre, fără „Cod”, „Câmpuri afișate” fără importanță, relevanță și proveniență", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const propertyId = await createProperty(page.request, { nickname: NAME });
    try {
      // Step 1 — the search box and „Câmpuri afișate"; no „Importanță" or „Relevanță".
      await page.goto("/properties");
      const main = page.locator("main");
      const search = main.getByPlaceholder("caută după cod, poreclă, nr. cadastru, carte funciară, tarla sau parcelă");
      await expect(search).toBeVisible({ timeout: 30_000 });
      await expect(main.getByRole("button", { name: /^Câmpuri afișate \d\/4$/ })).toBeVisible();
      await expect(main.locator("select")).toHaveCount(0);
      await expect(main.getByText(/Importanță|Relevanță/)).toHaveCount(0);

      // Step 2 — one row; no „Cod" header; no system ID in the table.
      await search.fill(MARK);
      const table = main.locator("table").first();
      await expect(table.locator("tbody tr").filter({ hasText: NAME })).toHaveCount(1, { timeout: 30_000 });
      await expect(table.getByRole("columnheader", { name: /^cod$/i })).toHaveCount(0);
      expect((await table.innerText()).match(/\bPROP\d{3,}\b/g) ?? []).toEqual([]);

      // Step 3 — the eight fields, and none of the three.
      await main.getByRole("button", { name: /^Câmpuri afișate \d\/4$/ }).click();
      const picker = main.locator("[data-field-chooser]");
      await expect(picker.locator("label")).toHaveText([
        "Poreclă", "Parcelă", "Tarla/Solă", "Nr. cadastru", "Nr. CF", "Oficială (m²)", "Calculată (m²)", "Localitate",
      ]);
      for (const gone of ["Importanță", "Relevanță", "Proveniență"]) {
        await expect(picker.getByText(gone, { exact: true })).toHaveCount(0);
      }
      await photograph(page, "properties-chooser", main);

      // At the end — outside the chooser.
      await page.getByRole("heading", { level: 1 }).first().click();
      await expect(picker.locator("label")).toHaveCount(0);
    } finally {
      await removeRecord(page.request, "property", propertyId);
    }
  });
});
