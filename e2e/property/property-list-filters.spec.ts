/**
 * Case:   TC-PROP-14 — Lista proprietăților filtrată după „Tip proprietate” și „Categorie de folosință”
 * Source: docs/testing/cases/TC-PROP-14.md, „Last green" 2026-10-18 (Slice #39.61), rewritten for the column filters (#39.82)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The properties carry `TC-E2E-PROP-14` (records.ts); T1, T2, C1 and C2 are read from the value lists the
 *     properties were given their ids from.
 *   - A Playwright browser has never changed „Câmpuri afișate", so the list opens on its default, Tip proprietate
 *     (#38.02); step 3 ticks „Categorie de folosință" beside it.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { expectUnder } from "../helpers/filter-editor";
import { listsOnTheirEarlierColumns } from "../helpers/list-columns";

const MARK = `${E2E_MARKER}PROP-14`;

async function firstTwo(page: Page, list: string): Promise<{ id: string; name: string }[]> {
  const res = await page.request.get(`/api/admin/value-lists/${list}`);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { items: { id: string; name: string }[] }).items.slice(0, 2);
}

test.describe("TC-PROP-14 — filtrele listei proprietăților", () => {
  test("tip și categorie de folosință: numărul de lângă fiecare valoare, adresa, „Șterge filtrele”", async ({ page }) => {
    // 40.66: the lists open on four default columns; these steps were written against the earlier ones.
    await listsOnTheirEarlierColumns(page);
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const [t1, t2] = await firstTwo(page, "property-types");
    const [c1, c2] = await firstTwo(page, "use-categories");
    const ids: string[] = [];
    try {
      for (const [n, t, c] of [["A", t1, c1], ["B", t1, c2], ["C", t2, c1]] as const) {
        ids.push(await createProperty(page.request, { nickname: `${MARK} ${n}`, propertyTypeId: t.id, useCategoryId: c.id }));
      }
      const main = page.locator("main");
      // Slice 40.24: the nickname is its cell's text — „Nou!" sits after it in the same cell.
      const rows = main.locator("table tbody [data-col=\"nickname\"] [data-first-cell] > span:first-child");
      // The list is newest first; the case names the rows, not their order.
      const shows = (...ns: string[]) =>
        expect.poll(async () => (await rows.allInnerTexts()).map((t) => t.trim()).sort(), { timeout: 30_000 }).toEqual(ns.map((n) => `${MARK} ${n}`));
      // A value's row by its name exactly — „SA" is in „SRL"'s neighbours' words, and the count follows the name.
      const value = (name: string) => main.locator("[data-filter-value]").filter({ has: page.locator("span", { hasText: new RegExp(`^${name}$`) }) });

      // Step 1 — the three, by the search.
      await page.goto(`/properties?q=${MARK}`);
      await shows("A", "B", "C");

      // Step 2 — the funnel under „Tip proprietate": T1 with 2, T2 with 1; T1 ticked: A and B, the chip, the address.
      await main.getByRole("button", { name: "Filtrează după „Tip proprietate”", exact: true }).click();
      await expect(value(t1.name).locator("[data-filter-count]")).toHaveText("2", { timeout: 15_000 });
      await expect(value(t2.name).locator("[data-filter-count]")).toHaveText("1");
      // #39.82: the editor opens right under the funnel that opened it.
      await expectUnder(page, '[data-filter-funnel="propertyType"]', '[data-filter-editor="propertyType"]');
      await value(t1.name).locator("input").check();
      await shows("A", "B");
      await expect(main.locator('[data-filter-chip="propertyType"]')).toHaveText(`Tip proprietate ${t1.name}`);
      await expect.poll(() => new URL(page.url()).searchParams.get("propertyType")).toBe(t1.id);

      // Step 3 — „Categorie de folosință" ticked in „Câmpuri afișate", its funnel: C1 with 1, C2 with 1, counted with the
      // type set; C1 ticked: A.
      await page.getByRole("heading", { level: 1 }).first().click();
      await main.getByRole("button", { name: "Câmpuri afișate 1/4", exact: true }).click();
      await main.locator("[data-field-chooser]").getByRole("checkbox", { name: "Categ.Folos." }).check(); // 40.20: the short name; the chip keeps the whole one
      await page.getByRole("heading", { level: 1 }).first().click();
      await main.getByRole("button", { name: "Filtrează după „Categorie de folosință”", exact: true }).click();
      await expect(value(c1.name).locator("[data-filter-count]")).toHaveText("1", { timeout: 15_000 });
      await expect(value(c2.name).locator("[data-filter-count]")).toHaveText("1");
      await value(c1.name).locator("input").check();
      await shows("A");

      // Step 4 — a reload: A, and the two chips by the values' names, in the chooser's order (#39.82).
      await page.reload();
      await shows("A");
      await expect(main.locator("[data-filter-chip]")).toHaveText([`Categorie de folosință ${c1.name}`, `Tip proprietate ${t1.name}`], { timeout: 15_000 });
      // #39.82: no „+ Filtru"; a chip opens its filter under itself.
      await expect(main.locator("[data-filter-add]")).toHaveCount(0);
      await main.locator('[data-filter-chip="propertyType"] button').first().click();
      await expectUnder(page, '[data-filter-chip="propertyType"]', '[data-filter-editor="propertyType"]');
      await page.keyboard.press("Escape");

      // Step 5 — „Șterge filtrele": the three, no chip, the search alone in the address.
      await main.getByRole("button", { name: "Șterge filtrele", exact: true }).click();
      await shows("A", "B", "C");
      await expect(main.locator("[data-filter-chip]")).toHaveCount(0);
      await expect.poll(() => new URL(page.url()).search).toBe(`?q=${MARK}`);
    } finally {
      for (const id of ids) await removeRecord(page.request, "property", id);
    }
  });
});
