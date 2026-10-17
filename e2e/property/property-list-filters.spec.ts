/**
 * Case:   TC-PROP-14 — Lista proprietăților filtrată după „Tip proprietate” și „Categorie de folosință”
 * Source: docs/testing/cases/TC-PROP-14.md, „Last green" 2026-10-16 (Slice #39.61)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The properties carry `TC-E2E-PROP-14` (records.ts); T1, T2, C1 and C2 are read from the value lists the
 *     properties were given their ids from.
 *   - A field is chosen from „+ Filtru" by its option's value, the field's key.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}PROP-14`;

async function firstTwo(page: Page, list: string): Promise<{ id: string; name: string }[]> {
  const res = await page.request.get(`/api/admin/value-lists/${list}`);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { items: { id: string; name: string }[] }).items.slice(0, 2);
}

test.describe("TC-PROP-14 — filtrele listei proprietăților", () => {
  test("tip și categorie de folosință: numărul de lângă fiecare valoare, adresa, „Șterge filtrele”", async ({ page }) => {
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
      const rows = main.locator("table tbody [data-col=\"nickname\"]");
      // The list is newest first; the case names the rows, not their order.
      const shows = (...ns: string[]) =>
        expect.poll(async () => (await rows.allInnerTexts()).map((t) => t.trim()).sort(), { timeout: 30_000 }).toEqual(ns.map((n) => `${MARK} ${n}`));
      // A value's row by its name exactly — „SA" is in „SRL"'s neighbours' words, and the count follows the name.
      const value = (name: string) => main.locator("[data-filter-value]").filter({ has: page.locator("span", { hasText: new RegExp(`^${name}$`) }) });

      // Step 1 — the three, by the search.
      await page.goto(`/properties?q=${MARK}`);
      await shows("A", "B", "C");

      // Step 2 — „Tip proprietate": T1 with 2, T2 with 1; T1 ticked: A and B, the chip, the address.
      await main.locator("[data-filter-add]").selectOption("propertyType");
      await expect(value(t1.name).locator("[data-filter-count]")).toHaveText("2", { timeout: 15_000 });
      await expect(value(t2.name).locator("[data-filter-count]")).toHaveText("1");
      await value(t1.name).locator("input").check();
      await shows("A", "B");
      await expect(main.locator('[data-filter-chip="propertyType"]')).toHaveText(`Tip proprietate ${t1.name}`);
      await expect.poll(() => new URL(page.url()).searchParams.get("propertyType")).toBe(t1.id);

      // Step 3 — „Categorie de folosință": C1 with 1, C2 with 1, counted with the type set; C1 ticked: A.
      await main.locator("[data-filter-add]").selectOption("useCategory");
      await expect(value(c1.name).locator("[data-filter-count]")).toHaveText("1", { timeout: 15_000 });
      await expect(value(c2.name).locator("[data-filter-count]")).toHaveText("1");
      await value(c1.name).locator("input").check();
      await shows("A");

      // Step 4 — a reload: A, and the two chips by the values' names.
      await page.reload();
      await shows("A");
      await expect(main.locator("[data-filter-chip]")).toHaveText([`Tip proprietate ${t1.name}`, `Categorie de folosință ${c1.name}`], { timeout: 15_000 });

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
