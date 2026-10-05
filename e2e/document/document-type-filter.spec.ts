/**
 * Case:   TC-DOC-16 — „Tip document:" numește tipul ales; „Câmp specific" merge doar pentru un singur tip cu formular
 * Source: docs/testing/cases/TC-DOC-16.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The documents carry `TC-E2E-DOC-16` (records.ts).
 *   - Playwright's mouse ticks the boxes and picks the field; the hand run did
 *     by script (FU-290). A tick reloads the address, so the list is opened
 *     again whenever it is not showing.
 *   - Slice #38.07's pictures, not steps of the case: the toolbar with one
 *     type, with two and with all, at 1366 and 1920 px, into
 *     `playwright-report/document-type-filter/`.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-16`;
const SHOTS = "playwright-report/document-type-filter";
const WHEN_ACTIVE =
  "Câmpul specific este activ numai când la „Tip document” este ales un singur tip, iar acel tip are un formular cu câmpuri cu listă închisă de valori.";

async function photograph(page: Page, name: string): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await page.locator("main [data-toolbar]").screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
}

test.describe("TC-DOC-16 — „Tip document:” și „Câmp specific”", () => {
  test("toate, niciunul, unul cu formular, două, unul fără formular", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const ids = [
      await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} Contract de test`),
      await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} Adeverință de test`),
    ];
    try {
      // Step 1 — every type: „Toate tipurile"; „Câmp specific:" drawn, disabled, „Toate"; the ⓘ's italic sentence.
      await page.goto("/documents");
      const main = page.locator("main");
      const typeFilter = main.getByRole("button", { name: /^Tip document:/ });
      const words = typeFilter.locator("[data-type-trigger]");
      await expect(words).toHaveText("Toate tipurile", { timeout: 30_000 });
      const key = main.getByRole("combobox", { name: "Câmp specific:" });
      await expect(key).toBeDisabled();
      expect(await key.locator("option").allTextContents()).toEqual(["Toate"]);
      const note = page.locator("#custom-field-hint em");
      await expect(note).toHaveText(WHEN_ACTIVE);
      await expect(note).toHaveCSS("font-style", "italic");
      await photograph(page, "all-types");

      const tick = async (name: string) => {
        const box = main.getByRole("checkbox", { name, exact: true });
        if (!(await box.isVisible())) await typeFilter.click();
        await box.click();
      };

      // Step 2 — „Toate tipurile" unticked: „Niciun tip", italic; the list's message; disabled.
      await tick("Toate tipurile");
      await expect(words).toHaveText("Niciun tip", { timeout: 30_000 });
      await expect(words).toHaveCSS("font-style", "italic");
      await expect(main.getByText("Selectați cel puțin un tip de document")).toBeVisible();
      await expect(key).toBeDisabled();

      // Step 3 — „Contract de Vânzare": its name, its tooltip; „Câmp specific:" enabled with its closed lists.
      await tick("Contract de Vânzare");
      await expect(words).toHaveText("Contract de Vânzare", { timeout: 30_000 });
      await expect(words).toHaveCSS("font-style", "normal");
      await expect(words).toHaveAttribute("title", "Contract de Vânzare");
      await expect(key).toBeEnabled({ timeout: 30_000 });
      const keys = await key.locator("option").allTextContents();
      expect(keys[0]).toBe("Toate");
      for (const kept of ["Monedă", "Stare plată", "Modalitate plată"]) expect(keys).toContain(kept);
      await page.getByRole("heading", { level: 1 }).first().click();
      await photograph(page, "one-type");

      // Step 4 — „Stare plată" chosen, then „Adeverință" too: „2 tipuri afișate", italic; disabled, back on „Toate".
      await key.selectOption({ label: "Stare plată" });
      const value = main.getByRole("combobox", { name: "Valoarea câmpului specific" });
      await expect(value).toHaveCount(1);
      await tick("Adeverință");
      await expect(words).toHaveText("2 tipuri afișate", { timeout: 30_000 });
      await expect(words).toHaveCSS("font-style", "italic");
      await expect(key).toBeDisabled();
      await expect(key).toHaveValue("");
      await expect(value).toHaveCount(0);
      await page.getByRole("heading", { level: 1 }).first().click();
      await photograph(page, "two-types");

      // Step 5 — only „Adeverință": its name; disabled — it has no form.
      await tick("Contract de Vânzare");
      await expect(words).toHaveText("Adeverință", { timeout: 30_000 });
      await expect(key).toBeDisabled();
    } finally {
      for (const id of ids) await removeRecord(page.request, "document", id);
    }
  });
});
