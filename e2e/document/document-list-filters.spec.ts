/**
 * Case:   TC-DOC-27 — Lista actelor filtrată cu bara de filtre peste „Tip document” și „Câmp specific”
 * Source: docs/testing/cases/TC-DOC-27.md, „Last green" 2026-10-18 (Slice #39.63), step 4 rewritten for the column filters (#39.82)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The documents carry `TC-E2E-DOC-27` (records.ts); a row is read by its title cell.
 *   - Step 3 chooses „Achitat integral" by its label's start: the option carries its count after it.
 *   - Step 4 fills the date box as a browser does — `2026-01-01`; the box shows it as the locale writes it.
 */

import { test, expect } from "../helpers/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";
import { expectUnder } from "../helpers/filter-editor";
import { listsOnTheirEarlierColumns } from "../helpers/list-columns";

const MARK = `${E2E_MARKER}DOC-27`;

test.describe("TC-DOC-27 — filtrele listei actelor", () => {
  test("bara de filtre peste „Tip document” și „Câmp specific”: „Data”, adresa, „Șterge filtrele”", async ({ page }) => {
    // 40.66: the lists open on four default columns; these steps were written against the earlier ones.
    await listsOnTheirEarlierColumns(page);
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    try {
      const contract = (title: string, dateDocument: string, starePlata: string) =>
        createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} ${title}`, { dateDocument, customFields: { starePlata } });
      ids.push(await contract("A", "2026-03-10", "ACHITAT_INTEGRAL"));
      ids.push(await contract("B", "2019-05-01", "ACHITAT_INTEGRAL"));
      ids.push(await contract("C", "2026-04-01", "DE_ACHITAT"));
      ids.push(await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} D`, { dateDocument: "2026-03-15" }));

      const main = page.locator("main");
      // „Titlu" is the second cell since 40.24 took away the empty first column (it was the third).
      const titles = main.locator("table tbody tr td:nth-child(2)");
      const shows = (...ns: string[]) =>
        expect
          .poll(async () => (await titles.allInnerTexts()).map((t) => t.trim()).filter((t) => t.includes(MARK)).sort(), { timeout: 30_000 })
          .toEqual(ns.map((n) => `${MARK} ${n}`));
      const params = () => new URL(page.url()).searchParams;

      // Step 1 — the four, by the search.
      await page.goto(`/documents?q=${MARK}`);
      await shows("A", "B", "C", "D");

      // Step 2 — only „Contract de Vânzare": A, B, C. A tick reloads the address, so each is repeated until it holds
      // (the same toggle as TC-DOC-08's).
      const typeFilter = main.getByRole("button", { name: /^Tip document:/ });
      const tick = async (name: string, want: boolean) => {
        const box = main.getByRole("checkbox", { name, exact: true });
        await expect(async () => {
          if (!(await box.isVisible())) await typeFilter.click();
          if ((await box.isChecked()) !== want) await box.click();
          await expect(box).toBeChecked({ checked: want, timeout: 2_000 });
        }).toPass({ timeout: 30_000 });
      };
      await tick("Toate tipurile", false);
      await tick("Contract de Vânzare", true);
      await expect(main.getByRole("button", { name: /^Tip document:\s*Contract de Vânzare/ })).toBeVisible({ timeout: 30_000 });
      await shows("A", "B", "C");
      await page.getByRole("heading", { level: 1 }).first().click();

      // Step 3 — „Stare plată", „Achitat integral": A, B.
      const key = main.getByRole("combobox", { name: "Câmp specific:" });
      await expect(key).toBeEnabled({ timeout: 30_000 });
      await key.selectOption({ label: "Stare plată" });
      const value = main.getByRole("combobox", { name: "Valoarea câmpului specific" });
      await expect(value).toBeEnabled({ timeout: 30_000 });
      const paid = value.locator("option").filter({ hasText: /^Achitat integral/ });
      await expect(paid).toHaveCount(1, { timeout: 30_000 });
      await value.selectOption({ label: (await paid.textContent())! });
      await shows("A", "B");

      // Step 4 — „Data" ticked in „Câmpuri afișate"; the funnel under it, „De la" 01.01.2026: A; the address carries it
      // beside the type and the field.
      await main.getByRole("button", { name: "Câmpuri afișate 0/4", exact: true }).click();
      await main.locator("[data-field-chooser]").getByRole("checkbox", { name: "Data", exact: true }).check();
      await page.getByRole("heading", { level: 1 }).first().click();
      await main.getByRole("button", { name: "Filtrează după „Data”", exact: true }).click();
      await expectUnder(page, '[data-filter-funnel="dateDocument"]', '[data-filter-editor="dateDocument"]');
      await main.locator("[data-filter-from]").fill("2026-01-01");
      await shows("A");
      await expect.poll(() => params().get("dateDocument")).toBe("2026-01-01..");
      expect(params().get("field")).toBe("starePlata");
      expect(params().get("value")).toBe("ACHITAT_INTEGRAL");
      expect(params().get("documentTypeIds")).toBeTruthy();

      // Step 5 — a reload: A, the chip, the type and the field as they were.
      await page.reload();
      await shows("A");
      await expect(main.locator("[data-filter-chip]")).toHaveText(["Data din 01.01.2026"], { timeout: 15_000 });
      await expect(main.getByRole("button", { name: /^Tip document:\s*Contract de Vânzare/ })).toBeVisible();
      await expect(key).toHaveValue("starePlata");

      // Step 6 — „Șterge filtrele", the toolbar's since 40.49: every filter off — the four, the search kept, no type, no
      // field, no `dateDocument`. (It read „A and B; the type and the field kept".)
      const clear = main.getByRole("button", { name: "Șterge filtrele", exact: true });
      await expect(clear).toBeEnabled();
      await clear.click();
      await shows("A", "B", "C", "D");
      await expect.poll(() => params().has("dateDocument")).toBe(false);
      await expect.poll(() => params().has("documentTypeIds")).toBe(false);
      expect(params().get("q")).toBe(MARK);
      expect(params().has("field")).toBe(false);
      expect(params().has("value")).toBe(false);
      await expect(main.getByRole("button", { name: /^Tip document:\s*Toate tipurile/ })).toBeVisible();
      await expect(clear).toBeDisabled();
    } finally {
      for (const id of ids) await removeRecord(page.request, "document", id);
    }
  });

  // Slice 40.31 — steps 7–10 were a funnel on „Tip", the first column, opening the checklist of „Tip document:".
  // 41.55, Adrian: „Remove the filter funnel for the Type column on the Document list" — inverted in place. The old
  // step 7 read: „the funnel 13 × 13 in the cell's corner, named „Filtrează după „Tip”", not pressed; under it the
  // checklist of „Tip document:"". Now „Tip" has no funnel, and the toolbar's „Tip document:" is the one door.
  test("„Tip” fără pâlnie: tipurile se aleg din „Tip document:”, păstrate la reîncărcare", async ({ page }) => {
    // 40.66: the lists open on four default columns; these steps were written against the earlier ones.
    await listsOnTheirEarlierColumns(page);
    test.slow();
    const TMARK = `${MARK}-T`;
    await removeLeftovers(page.request, TMARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    try {
      ids.push(await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${TMARK} V`, {}));
      ids.push(await createDocumentOfType(page.request, "ADEVERINTA", `${TMARK} A`, {}));
      const main = page.locator("main");
      const titles = main.locator("table tbody tr td:nth-child(2)");
      const shows = (...ns: string[]) =>
        expect
          .poll(async () => (await titles.allInnerTexts()).map((t) => t.trim()).filter((t) => t.includes(TMARK)).sort(), { timeout: 30_000 })
          .toEqual(ns.map((n) => `${TMARK} ${n}`));
      const trigger = main.getByRole("button", { name: /^Tip document:/ });
      const tick = async (name: string, want: boolean) => {
        const box = main.getByRole("checkbox", { name, exact: true });
        await expect(async () => {
          if (!(await box.isVisible())) await trigger.click();
          if ((await box.isChecked()) !== want) await box.click();
          await expect(box).toBeChecked({ checked: want, timeout: 2_000 });
        }).toPass({ timeout: 30_000 });
      };
      const close = () => page.getByRole("heading", { level: 1 }).first().click();

      // Step 7 — „Tip" is a column like the others, but with no funnel; no column filters the type.
      await page.goto(`/documents?q=${TMARK}`);
      await shows("A", "V");
      const typeHead = main.locator("thead th").filter({ has: page.locator("[data-head-text]", { hasText: /^Tip$/ }) });
      await expect(typeHead).toHaveCount(1);
      await expect(typeHead.locator("[data-head-band]")).toHaveAttribute("data-head-band", "plain");
      await expect(typeHead.locator("[data-head-funnel]")).toHaveCount(0);
      await expect(main.locator('[data-filter-funnel="documentType"]')).toHaveCount(0);
      await expect(main.getByRole("button", { name: "Filtrează după „Tip”", exact: true })).toHaveCount(0);

      // Step 8 — „Adeverință" unticked in „Tip document:": the list narrows; the address says so; no chip.
      await tick("Adeverință", false);
      await shows("V");
      await expect.poll(() => new URL(page.url()).searchParams.get("documentTypeIds")).toBeTruthy();
      await expect(trigger).not.toContainText("Toate tipurile");
      await expect(main.locator("[data-filter-chip]")).toHaveCount(0);
      await close();

      // Step 9 — a reload keeps it.
      await page.reload();
      await shows("V");
      await expect(trigger).not.toContainText("Toate tipurile", { timeout: 30_000 });

      // Step 10 — „Toate tipurile" there: both again.
      await tick("Toate tipurile", true);
      await shows("A", "V");
      await close();
      await expect(trigger).toContainText("Toate tipurile");
    } finally {
      for (const id of ids) await removeRecord(page.request, "document", id);
    }
  });
});
