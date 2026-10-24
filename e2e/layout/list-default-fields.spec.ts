/**
 * Case:   TC-LAYOUT-03 — „Câmpuri afișate" fără o alegere memorată: Proprietăți cu Tip proprietate, celelalte liste doar coloanele fixe
 * Source: docs/testing/cases/TC-LAYOUT-03.md, „Last green" 2026-10-05 (steps 1 and 5 follow Slice #38.02; 6–8 are 40.45's)
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - This test's browser context is new, so nothing is stored under the four
 *     keys; the spec removes them anyway, and the context is thrown away after.
 *   - The lists show whatever the database holds; the case reads the headers
 *     and the chooser, and from a row only the shape of „Adăugat la" (40.45).
 *   - Playwright's mouse; the hand run pressed by script (FU-290).
 */

import { test, expect, type Page } from "../helpers/test";
import { openFromSidebar } from "../helpers/sidebar";

const KEYS = ["ga40-col-property-v4", "ga40-col-document-v3", "ga40-col-person-v3", "ga40-col-company-v2"];

async function expectList(page: Page, chooser: string, headers: string[]): Promise<void> {
  const main = page.locator("main");
  await expect(main.getByRole("button", { name: chooser, exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(main.locator("table").first().locator("thead th")).toHaveText(headers, { timeout: 30_000 });
}

/** 40.45 — „Adăugat la" is the chooser's last field; ticked, its column follows and the first row's day is dd.mm.yyyy. */
async function tickAddedOn(page: Page, chooser: string, after: string, headers: string[]): Promise<void> {
  const main = page.locator("main");
  await main.getByRole("button", { name: chooser, exact: true }).click();
  const boxes = page.locator("[data-field-chooser]").getByRole("checkbox");
  await expect(boxes.last()).toHaveAccessibleName("Adăugat la");
  await boxes.last().check();
  await expectList(page, after, headers);
  const cell = main.locator("table").first().locator("tbody tr").first().locator("td").nth(headers.indexOf("Adăugat la"));
  await expect(cell).toHaveText(/^\d{2}\.\d{2}\.\d{4}$/, { timeout: 30_000 });
}

test.describe("TC-LAYOUT-03 — „Câmpuri afișate” fără o alegere memorată", () => {
  test("Proprietăți cu Tip proprietate, celelalte trei doar coloanele fixe; o alegere nouă rămâne", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/");
    await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);

    // Step 1 — „Proprietăți": 1/4, Tip proprietate after „Poreclă" (#38.02).
    await openFromSidebar(page, "Proprietăți");
    await expectList(page, "Câmpuri afișate 1/4", ["Poreclă", "Tip Prop.", ""] /* 40.20: short names; 40.24: no empty first column */);

    // Steps 2–4 — the other three lists: 0/4, their fixed columns only.
    await openFromSidebar(page, "Acte");
    await expectList(page, "Câmpuri afișate 0/4", ["Tip", "Titlu", ""]);
    await openFromSidebar(page, "Persoane Fizice");
    await expectList(page, "Câmpuri afișate 0/4", ["Nume", "Poreclă", ""]);
    await openFromSidebar(page, "Persoane Juridice");
    await expectList(page, "Câmpuri afișate 0/4", ["Denumire", "Poreclă", ""]);

    // Step 5 — „Localitate" ticked on „Proprietăți", kept across a reload.
    await openFromSidebar(page, "Proprietăți");
    await page.locator("main").getByRole("button", { name: "Câmpuri afișate 1/4", exact: true }).click();
    await page.locator("[data-field-chooser]").getByRole("checkbox", { name: "Localitate" }).check();
    await page.reload();
    await expectList(page, "Câmpuri afișate 2/4", ["Poreclă", "Tip Prop.", "Localitate", ""]);

    // Steps 6–8 — „Adăugat la" on the three lists that lacked it (40.45).
    await tickAddedOn(page, "Câmpuri afișate 2/4", "Câmpuri afișate 3/4", ["Poreclă", "Tip Prop.", "Localitate", "Adăugat la", ""]);
    await openFromSidebar(page, "Persoane Fizice");
    await tickAddedOn(page, "Câmpuri afișate 0/4", "Câmpuri afișate 1/4", ["Nume", "Poreclă", "Adăugat la", ""]);
    await openFromSidebar(page, "Persoane Juridice");
    await tickAddedOn(page, "Câmpuri afișate 0/4", "Câmpuri afișate 1/4", ["Denumire", "Poreclă", "Adăugat la", ""]);

    // At the end — the keys removed (the context goes with the test too).
    await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);
  });
});
