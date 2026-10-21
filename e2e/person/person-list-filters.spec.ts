/**
 * Case:   TC-PERS-12 — Lista persoanelor fizice filtrată după „Tip profesional” și „Data decesului”
 * Source: docs/testing/cases/TC-PERS-12.md, „Last green" 2026-10-18 (Slice #39.62), rewritten for the column filters (#39.82)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The persons carry `TC-E2E-PERS-12` (records.ts); T1 and T2 are read from the value list the persons were
 *     given their ids from. A row is read by its name cell, the „†" left out.
 *   - Step 3 fills the date box as a browser does — `2020-01-01`; the box shows it as the locale writes it.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { expectUnder } from "../helpers/filter-editor";

const MARK = `${E2E_MARKER}PERS-12`;

async function firstTwo(page: Page, list: string): Promise<{ id: string; name: string }[]> {
  const res = await page.request.get(`/api/admin/value-lists/${list}`);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { items: { id: string; name: string }[] }).items.slice(0, 2);
}

test.describe("TC-PERS-12 — filtrele listei persoanelor fizice", () => {
  test("„Tip profesional” și „Data decesului”: numărul de lângă fiecare valoare, adresa, „Șterge filtrele”", async ({ page }) => {
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
      // Slice 40.24: the name is the first cell's text — „Nou!" sits after it in the same cell.
      const names = main.locator("table tbody tr [data-first-cell] > span:first-child");
      const shows = (...ns: string[]) =>
        expect
          .poll(async () => (await names.allInnerTexts()).map((t) => t.replace("†", "").trim()).filter((t) => t.includes(MARK)).sort(), { timeout: 30_000 })
          .toEqual(ns.map((n) => `${n} ${MARK}`));
      // A value's row by its name exactly — „SA" is in „SRL"'s neighbours' words, and the count follows the name.
      const value = (name: string) => main.locator("[data-filter-value]").filter({ has: page.locator("span", { hasText: new RegExp(`^${name}$`) }) });

      // Step 1 — the three, by the search.
      await page.goto(`/natural-persons?q=${MARK}`);
      await shows("A", "B", "C");

      // Step 2 — „Tip profesional" and „Data decesului" ticked in „Câmpuri afișate"; the funnel under „Tip profesional":
      // T1 with 2, T2 with 1; T1 ticked: A and B.
      await main.getByRole("button", { name: "Câmpuri afișate 0/4", exact: true }).click();
      const picker = main.locator("[data-field-chooser]");
      await picker.getByRole("checkbox", { name: "Tip prof." }).check(); // 40.20: the short names; the chips keep the whole ones
      await picker.getByRole("checkbox", { name: "Decedat pe" }).check();
      await page.getByRole("heading", { level: 1 }).first().click();
      await main.getByRole("button", { name: "Filtrează după „Tip profesional”", exact: true }).click();
      await expectUnder(page, '[data-filter-funnel="professionalType"]', '[data-filter-editor="professionalType"]');
      await expect(value(t1.name).locator("[data-filter-count]")).toHaveText("2", { timeout: 15_000 });
      await expect(value(t2.name).locator("[data-filter-count]")).toHaveText("1");
      await value(t1.name).locator("input").check();
      await shows("A", "B");

      // Step 3 — the funnel under „Data decesului", „De la" 01.01.2020: B; the address carries it.
      await main.getByRole("button", { name: "Filtrează după „Data decesului”", exact: true }).click();
      await expectUnder(page, '[data-filter-funnel="dateOfDeath"]', '[data-filter-editor="dateOfDeath"]');
      await main.locator("[data-filter-from]").fill("2020-01-01");
      await shows("B");
      await expect.poll(() => new URL(page.url()).searchParams.get("dateOfDeath")).toBe("2020-01-01..");

      // Step 4 — a reload: B and the two chips; no „+ Filtru".
      await page.reload();
      await shows("B");
      await expect(main.locator("[data-filter-chip]")).toHaveText(["Data decesului din 01.01.2020", `Tip profesional ${t1.name}`], { timeout: 15_000 });
      await expect(main.locator("[data-filter-add]")).toHaveCount(0);

      // Step 5 — „Șterge filtrele": the three, the search alone in the address.
      await main.getByRole("button", { name: "Șterge filtrele", exact: true }).click();
      await shows("A", "B", "C");
      await expect.poll(() => new URL(page.url()).search).toBe(`?q=${MARK}`);
    } finally {
      for (const id of ids) await removeRecord(page.request, "person", id);
    }
  });
});
