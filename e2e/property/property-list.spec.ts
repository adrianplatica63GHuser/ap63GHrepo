/**
 * Case:   TC-PROP-06 — Lista proprietăților: fără filtre, fără „Cod", Poreclă mereu afișată, „Câmpuri afișate" cu toate câmpurile cadastrale
 * Source: docs/testing/cases/TC-PROP-06.md, „Last green" 2026-10-04 (steps 1 and 2 follow Slice #38.02)
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The property carries `TC-E2E-PROP-06` (records.ts).
 *   - A Playwright browser has never chosen, so the column is the default,
 *     Tip proprietate, and the button reads „Câmpuri afișate 1/4"; it has no
 *     choice to put back at the end.
 *   - The two values' names are read from the same lists the property was
 *     given its ids from.
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

async function firstOf(page: Page, list: string): Promise<{ id: string; name: string }> {
  const res = await page.request.get(`/api/admin/value-lists/${list}`);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { items: { id: string; name: string }[] }).items[0];
}

test.describe("TC-PROP-06 — lista proprietăților", () => {
  test("fără filtre, fără „Cod”, Poreclă mereu, „Câmpuri afișate” cu toate câmpurile cadastrale", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const useCategory = await firstOf(page, "use-categories");
    const propertyType = await firstOf(page, "property-types");
    const propertyId = await createProperty(page.request, { nickname: NAME, useCategoryId: useCategory.id, propertyTypeId: propertyType.id });
    try {
      // Step 1 — the search box and „Câmpuri afișate"; no „Importanță" or „Relevanță".
      await page.goto("/properties");
      const main = page.locator("main");
      const search = main.getByPlaceholder("caută după cod, poreclă, nr. cadastru, carte funciară, tarla sau parcelă");
      await expect(search).toBeVisible({ timeout: 30_000 });
      // #38.02: nothing stored in this browser, so the list's default — Tip proprietate.
      await expect(main.getByRole("button", { name: "Câmpuri afișate 1/4", exact: true })).toBeVisible();
      await expect(main.locator("select")).toHaveCount(0);
      await expect(main.getByText(/Importanță|Relevanță/)).toHaveCount(0);

      // Step 2 — one row; „PORECLĂ" the first header after the tick box; no „Cod"; no system ID.
      await search.fill(MARK);
      const table = main.locator("table").first();
      await expect(table.locator("tbody tr").filter({ hasText: NAME })).toHaveCount(1, { timeout: 30_000 });
      await expect(table.locator("thead th")).toHaveText(["", "Poreclă", "Tip proprietate", ""]);
      await expect(table.getByRole("columnheader", { name: /^cod$/i })).toHaveCount(0);
      expect((await table.innerText()).match(/\bPROP\d{3,}\b/g) ?? []).toEqual([]);

      // Step 3 — the nine fields, and none of Poreclă, Note or the three.
      await main.getByRole("button", { name: /^Câmpuri afișate \d\/4$/ }).click();
      const picker = main.locator("[data-field-chooser]");
      await expect(picker.locator("label")).toHaveText([
        "Tarla/Solă", "Parcelă", "Oficială (m²)", "Calculată (m²)", "Nr. CF", "Nr. cadastru", "Categorie de folosință", "Tip proprietate", "Localitate",
      ]);
      for (const gone of ["Poreclă", "Note", "Importanță", "Relevanță", "Proveniență"]) {
        await expect(picker.getByText(gone, { exact: true })).toHaveCount(0);
      }
      await photograph(page, "properties-chooser", main);

      // Step 4 — every ticked field unticked: „0/4", PORECLĂ alone, the row's name.
      const boxes = picker.getByRole("checkbox");
      for (let i = 0; i < (await boxes.count()); i++) {
        if (await boxes.nth(i).isChecked()) await boxes.nth(i).uncheck();
      }
      await expect(main.getByRole("button", { name: "Câmpuri afișate 0/4", exact: true })).toBeVisible();
      await expect(table.locator("thead th")).toHaveText(["", "Poreclă", ""]);
      await expect(table.locator("tbody tr").filter({ hasText: NAME })).toHaveCount(1);

      // Step 5 — the two new fields ticked: „2/4", their headers, the values' names.
      await picker.getByRole("checkbox", { name: "Categorie de folosință" }).check();
      await picker.getByRole("checkbox", { name: "Tip proprietate" }).check();
      await page.getByRole("heading", { level: 1 }).first().click();
      await expect(main.getByRole("button", { name: "Câmpuri afișate 2/4", exact: true })).toBeVisible();
      await expect(table.locator("thead th")).toHaveText(["", "Poreclă", "Categorie de folosință", "Tip proprietate", ""]);
      const row = table.locator("tbody tr").filter({ hasText: NAME });
      await expect(row.locator("td").nth(2)).toHaveText(useCategory.name);
      await expect(row.locator("td").nth(3)).toHaveText(propertyType.name);
    } finally {
      await removeRecord(page.request, "property", propertyId);
    }
  });
});
