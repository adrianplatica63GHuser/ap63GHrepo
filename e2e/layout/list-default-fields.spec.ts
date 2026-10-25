/**
 * Case:   TC-LAYOUT-03 — „Câmpuri afișate" fără o alegere memorată: fiecare listă pe cele patru coloane alese (40.66)
 * Source: docs/testing/cases/TC-LAYOUT-03.md, „Last green" 2026-10-05 — rewritten by Slice 40.66 (it read #38.02's Tip proprietate and three lists of fixed columns only)
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - This test's browser context is new, so nothing is stored under the four
 *     keys; the spec removes them anyway, and the context is thrown away after.
 *   - The lists show whatever the database holds; the case reads the headers
 *     and the chooser, and from a row only the shape of „Modificat la" (40.55; 40.45's „Adăugat la" before it).
 *   - Playwright's mouse; the hand run pressed by script (FU-290).
 *   - „Does not scroll sideways" is read as the table's scrolling frame: its content no wider than the frame.
 */

import { test, expect, type Page } from "../helpers/test";
import { openFromSidebar } from "../helpers/sidebar";

const KEYS = ["ga40-col-property-v5", "ga40-col-document-v4", "ga40-col-person-v4", "ga40-col-company-v3"];

async function expectList(page: Page, chooser: string, headers: string[]): Promise<void> {
  const main = page.locator("main");
  await expect(main.getByRole("button", { name: chooser, exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(main.locator("table").first().locator("thead th")).toHaveText(headers, { timeout: 30_000 });
}

/** The first table's scrolling frame: how far its content is wider than the frame (0 when it does not scroll sideways). */
async function sideways(page: Page): Promise<number> {
  return page.locator("main table").first().evaluate((table) => {
    let frame: HTMLElement | null = table.parentElement;
    while (frame && getComputedStyle(frame).overflowX === "visible") frame = frame.parentElement;
    return frame ? frame.scrollWidth - frame.clientWidth : 0;
  });
}

/** „Modificat la"'s cell on the first row is a day, dd.mm.yyyy. */
async function expectModifiedOn(page: Page, headers: string[]): Promise<void> {
  const cell = page.locator("main table").first().locator("tbody tr").first().locator("td").nth(headers.indexOf("Modificat la"));
  await expect(cell).toHaveText(/^\d{2}\.\d{2}\.\d{4}$/, { timeout: 30_000 });
}

const PROPERTIES = ["Poreclă", "Tarla", "Parcelă", "Tip Prop.", "Localitate", ""]; // 40.20: short names; 40.24: no empty first column
const DOCUMENTS = ["Tip", "Titlu", "#Document", "Data", "Modificat la", ""]; // Inst./Notar dropped: it scrolled sideways
const PERSONS = ["Nume", "Poreclă", "CNP", "Născut pe", "Tip prof.", "Modificat la", ""];
const COMPANIES = ["Denumire", "Poreclă", "Tip", "CUI", "Localitate", "Modificat la", ""];

test.describe("TC-LAYOUT-03 — „Câmpuri afișate” fără o alegere memorată", () => {
  test("fiecare listă pe cele patru coloane alese, fără derulare în lateral la 1366; o alegere nouă rămâne", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/");
    await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);

    // Step 1 — „Proprietăți": 4/4 — Tarla, Parcelă, Tip proprietate, Localitate; nothing to scroll sideways.
    await openFromSidebar(page, "Proprietăți");
    await expectList(page, "Câmpuri afișate 4/4", PROPERTIES);
    expect(await sideways(page)).toBeLessThanOrEqual(1);

    // Steps 2–4 — the other three: 3/4 on Acte, 4/4 on the persons, „Modificat la" last, a day in it; nothing to scroll.
    for (const [list, count, headers] of [["Acte", "3/4", DOCUMENTS], ["Persoane Fizice", "4/4", PERSONS], ["Persoane Juridice", "4/4", COMPANIES]] as const) {
      await openFromSidebar(page, list);
      await expectList(page, `Câmpuri afișate ${count}`, [...headers]);
      await expectModifiedOn(page, [...headers]);
      expect(await sideways(page), list).toBeLessThanOrEqual(1);
    }

    // Step 5 — on „Proprietăți", „Localitate" off and „Modificat la" on, kept across a reload.
    await openFromSidebar(page, "Proprietăți");
    await page.locator("main").getByRole("button", { name: "Câmpuri afișate 4/4", exact: true }).click();
    const chooser = page.locator("[data-field-chooser]");
    await chooser.getByRole("checkbox", { name: "Localitate" }).uncheck();
    await chooser.getByRole("checkbox", { name: "Modificat la" }).check();
    await page.reload();
    const chosen = ["Poreclă", "Tarla", "Parcelă", "Tip Prop.", "Modificat la", ""];
    await expectList(page, "Câmpuri afișate 4/4", chosen);
    await expectModifiedOn(page, chosen);

    // At the end — the keys removed (the context goes with the test too).
    await page.evaluate((keys) => keys.forEach((k) => localStorage.removeItem(k)), KEYS);
  });
});
