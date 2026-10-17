/**
 * Case:   TC-PERS-13 — Lista persoanelor juridice filtrată după „Tip” și CUI
 * Source: docs/testing/cases/TC-PERS-13.md, „Last green" 2026-10-16 (Slice #39.62)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The companies carry `TC-E2E-PERS-13` (records.ts); SRL and SA are read from the value list by name.
 */

import { test, expect } from "../helpers/test";
import { E2E_MARKER, createCompany, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}PERS-13`;

test.describe("TC-PERS-13 — filtrele listei persoanelor juridice", () => {
  test("„Tip” și CUI: numărul de lângă fiecare valoare, adresa, „Șterge filtrele”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const types = ((await (await page.request.get("/api/admin/value-lists/judicial-person-types")).json()) as { items: { id: string; name: string }[] }).items;
    const srl = types.find((t) => t.name === "SRL")!;
    const sa = types.find((t) => t.name === "SA")!;
    expect(srl && sa, "„SRL” and „SA” among the types").toBeTruthy();
    const ids: string[] = [];
    try {
      ids.push(await createCompany(page.request, { name: `${MARK} A`, judicialPersonTypeId: srl.id, cuiNumber: "RO99913301" }));
      ids.push(await createCompany(page.request, { name: `${MARK} B`, judicialPersonTypeId: srl.id, cuiNumber: "RO99913302" }));
      ids.push(await createCompany(page.request, { name: `${MARK} C`, judicialPersonTypeId: sa.id, cuiNumber: "RO99913401" }));
      const main = page.locator("main");
      const names = main.locator("table tbody tr td:nth-child(2)");
      const shows = (...ns: string[]) =>
        expect
          .poll(async () => (await names.allInnerTexts()).map((t) => t.trim()).filter((t) => t.includes(MARK)).sort(), { timeout: 30_000 })
          .toEqual(ns.map((n) => `${MARK} ${n}`));
      // A value's row by its name exactly — „SA" is in „SRL"'s neighbours' words, and the count follows the name.
      const value = (name: string) => main.locator("[data-filter-value]").filter({ has: page.locator("span", { hasText: new RegExp(`^${name}$`) }) });

      // Step 1 — the three, by the search.
      await page.goto(`/judicial-persons?q=${MARK}`);
      await shows("A", "B", "C");

      // Step 2 — „Tip": SA with 1, SRL with 2; SRL ticked: A and B.
      await main.locator("[data-filter-add]").selectOption("judicialPersonType");
      await expect(value("SRL").locator("[data-filter-count]")).toHaveText("2", { timeout: 15_000 });
      await expect(value("SA").locator("[data-filter-count]")).toHaveText("1");
      await value("SRL").locator("input").check();
      await shows("A", "B");

      // Step 3 — „Nr. înregistrare (CUI)" containing 13302: B.
      await main.locator("[data-filter-add]").selectOption("cuiNumber");
      await main.locator("[data-filter-text]").fill("13302");
      await shows("B");
      await expect.poll(() => new URL(page.url()).searchParams.get("cuiNumber")).toBe("13302");

      // Step 4 — a reload: B and the two chips.
      await page.reload();
      await shows("B");
      await expect(main.locator("[data-filter-chip]")).toHaveText(["Tip SRL", "Nr. înregistrare (CUI) conține „13302”"], { timeout: 15_000 });

      // Step 5 — „Șterge filtrele": the three, the search alone in the address.
      await main.getByRole("button", { name: "Șterge filtrele", exact: true }).click();
      await shows("A", "B", "C");
      await expect.poll(() => new URL(page.url()).search).toBe(`?q=${MARK}`);
    } finally {
      for (const id of ids) await removeRecord(page.request, "company", id);
    }
  });
});
