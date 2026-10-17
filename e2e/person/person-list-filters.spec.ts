/**
 * Case:   TC-PERS-12 — Lista persoanelor fizice filtrată după „Tip profesional” și „Decedat”
 * Source: docs/testing/cases/TC-PERS-12.md, „Last green" 2026-10-16 (Slice #39.62)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The persons carry `TC-E2E-PERS-12` (records.ts); T1 and T2 are read from the value list the persons were
 *     given their ids from. A row is read by its name cell, the „†" left out.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}PERS-12`;

async function firstTwo(page: Page, list: string): Promise<{ id: string; name: string }[]> {
  const res = await page.request.get(`/api/admin/value-lists/${list}`);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { items: { id: string; name: string }[] }).items.slice(0, 2);
}

test.describe("TC-PERS-12 — filtrele listei persoanelor fizice", () => {
  test("„Tip profesional” și „Decedat”: numărul de lângă fiecare valoare, adresa, „Șterge filtrele”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const [t1, t2] = await firstTwo(page, "person-types");
    const ids: string[] = [];
    try {
      ids.push(await createNaturalPerson(page.request, { lastName: MARK, firstName: "A", physicalPersonTypeId: t1.id }));
      ids.push(await createNaturalPerson(page.request, { lastName: MARK, firstName: "B", physicalPersonTypeId: t1.id, isDeceased: true, dateOfDeath: "2020-05-01" }));
      ids.push(await createNaturalPerson(page.request, { lastName: MARK, firstName: "C", physicalPersonTypeId: t2.id }));
      const main = page.locator("main");
      const names = main.locator("table tbody tr td:nth-child(2)");
      const shows = (...ns: string[]) =>
        expect
          .poll(async () => (await names.allInnerTexts()).map((t) => t.replace("†", "").trim()).filter((t) => t.includes(MARK)).sort(), { timeout: 30_000 })
          .toEqual(ns.map((n) => `${n} ${MARK}`));
      // A value's row by its name exactly — „SA" is in „SRL"'s neighbours' words, and the count follows the name.
      const value = (name: string) => main.locator("[data-filter-value]").filter({ has: page.locator("span", { hasText: new RegExp(`^${name}$`) }) });

      // Step 1 — the three, by the search.
      await page.goto(`/natural-persons?q=${MARK}`);
      await shows("A", "B", "C");

      // Step 2 — „Tip profesional": T1 with 2, T2 with 1; T1 ticked: A and B.
      await main.locator("[data-filter-add]").selectOption("professionalType");
      await expect(value(t1.name).locator("[data-filter-count]")).toHaveText("2", { timeout: 15_000 });
      await expect(value(t2.name).locator("[data-filter-count]")).toHaveText("1");
      await value(t1.name).locator("input").check();
      await shows("A", "B");

      // Step 3 — „Decedat": „Toți", „În viață", „Decedați"; „În viață": A.
      await main.locator("[data-filter-add]").selectOption("deceased");
      const choice = main.locator("[data-filter-choice] label");
      await expect(choice).toHaveText(["Toți", "În viață", "Decedați"]);
      await choice.filter({ hasText: "În viață" }).locator("input").check();
      await shows("A");
      await expect.poll(() => new URL(page.url()).searchParams.get("deceased")).toBe("alive");

      // Step 4 — a reload: A and the two chips.
      await page.reload();
      await shows("A");
      await expect(main.locator("[data-filter-chip]")).toHaveText([`Tip profesional ${t1.name}`, "Decedat În viață"], { timeout: 15_000 });

      // Step 5 — „Șterge filtrele": the three, the search alone in the address.
      await main.getByRole("button", { name: "Șterge filtrele", exact: true }).click();
      await shows("A", "B", "C");
      await expect.poll(() => new URL(page.url()).search).toBe(`?q=${MARK}`);
    } finally {
      for (const id of ids) await removeRecord(page.request, "person", id);
    }
  });
});
