/**
 * Case:   TC-PERS-13 — Lista persoanelor juridice filtrată după „Tip” și „Localitate”
 * Source: docs/testing/cases/TC-PERS-13.md, „Last green" 2026-10-18 (Slice #39.62), rewritten for the column filters (#39.82)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The companies carry `TC-E2E-PERS-13` (records.ts); SRL and SA are read from the value list by name.
 */

import { test, expect } from "../helpers/test";
import { E2E_MARKER, createCompany, removeLeftovers, removeRecord } from "../helpers/records";
import { expectUnder } from "../helpers/filter-editor";
import { listsOnTheirEarlierColumns } from "../helpers/list-columns";

const MARK = `${E2E_MARKER}PERS-13`;

test.describe("TC-PERS-13 — filtrele listei persoanelor juridice", () => {
  test("„Tip” și „Localitate”: numărul de lângă fiecare valoare, adresa, „Șterge filtrele”", async ({ page }) => {
    // 40.66: the lists open on four default columns; these steps were written against the earlier ones.
    await listsOnTheirEarlierColumns(page);
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const types = ((await (await page.request.get("/api/admin/value-lists/judicial-person-types")).json()) as { items: { id: string; name: string }[] }).items;
    const srl = types.find((t) => t.name === "SRL")!;
    const sa = types.find((t) => t.name === "SA")!;
    expect(srl && sa, "„SRL” and „SA” among the types").toBeTruthy();
    const ids: string[] = [];
    try {
      const seat = (locality: string) => [{ kind: "HEADQUARTERS" as const, locality, country: "România" }];
      ids.push(await createCompany(page.request, { name: `${MARK} A`, judicialPersonTypeId: srl.id, addresses: seat("Bragadiru") }));
      ids.push(await createCompany(page.request, { name: `${MARK} B`, judicialPersonTypeId: srl.id, addresses: seat("Măgurele") }));
      ids.push(await createCompany(page.request, { name: `${MARK} C`, judicialPersonTypeId: sa.id, addresses: seat("Bragadiru") }));
      const main = page.locator("main");
      // Slice 40.24: the name is the first cell's text — „Nou!" sits after it in the same cell.
      const names = main.locator("table tbody tr [data-first-cell] > span:first-child");
      const shows = (...ns: string[]) =>
        expect
          .poll(async () => (await names.allInnerTexts()).map((t) => t.trim()).filter((t) => t.includes(MARK)).sort(), { timeout: 30_000 })
          .toEqual(ns.map((n) => `${MARK} ${n}`));
      // A value's row by its name exactly — „SA" is in „SRL"'s neighbours' words, and the count follows the name.
      const value = (name: string) => main.locator("[data-filter-value]").filter({ has: page.locator("span", { hasText: new RegExp(`^${name}$`) }) });

      // Step 1 — the three, by the search.
      await page.goto(`/judicial-persons?q=${MARK}`);
      await shows("A", "B", "C");

      // Step 2 — „Tip" and „Localitate" ticked in „Câmpuri afișate"; the funnel under „Tip": SA with 1, SRL with 2; SRL
      // ticked: A and B.
      await main.getByRole("button", { name: "Câmpuri afișate 0/4", exact: true }).click();
      const picker = main.locator("[data-field-chooser]");
      await picker.getByRole("checkbox", { name: "Tip", exact: true }).check();
      await picker.getByRole("checkbox", { name: "Localitate", exact: true }).check();
      await page.getByRole("heading", { level: 1 }).first().click();
      await main.getByRole("button", { name: "Filtrează după „Tip”", exact: true }).click();
      await expectUnder(page, '[data-filter-funnel="judicialPersonType"]', '[data-filter-editor="judicialPersonType"]');
      await expect(value("SRL").locator("[data-filter-count]")).toHaveText("2", { timeout: 15_000 });
      await expect(value("SA").locator("[data-filter-count]")).toHaveText("1");
      await value("SRL").locator("input").check();
      await shows("A", "B");

      // Step 3 — the column shows each head office's locality; its funnel: Bragadiru with 1, Măgurele with 1, counted
      // with the type set; Măgurele ticked: B.
      const row = (n: string) => main.locator("table tbody tr").filter({ hasText: `${MARK} ${n}` });
      await expect(row("A")).toContainText("Bragadiru");
      await expect(row("B")).toContainText("Măgurele");
      await main.getByRole("button", { name: "Filtrează după „Localitate”", exact: true }).click();
      await expectUnder(page, '[data-filter-funnel="locality"]', '[data-filter-editor="locality"]');
      await expect(value("Bragadiru").locator("[data-filter-count]")).toHaveText("1", { timeout: 15_000 });
      await expect(value("Măgurele").locator("[data-filter-count]")).toHaveText("1");
      await value("Măgurele").locator("input").check();
      await shows("B");
      await expect.poll(() => new URL(page.url()).searchParams.get("locality")).toBe("Măgurele");

      // Step 4 — a reload: B and the two chips; no „+ Filtru".
      await page.reload();
      await shows("B");
      await expect(main.locator("[data-filter-chip]")).toHaveText(["Tip SRL", "Localitate Măgurele"], { timeout: 15_000 });
      await expect(main.locator("[data-filter-add]")).toHaveCount(0);

      // Step 5 — „Șterge filtrele": the three, the search alone in the address.
      await main.getByRole("button", { name: "Șterge filtrele", exact: true }).click();
      await shows("A", "B", "C");
      await expect.poll(() => new URL(page.url()).search).toBe(`?q=${MARK}`);
    } finally {
      for (const id of ids) await removeRecord(page.request, "company", id);
    }
  });
});
