/**
 * Case:   TC-DOC-16 — „Tip document:" numește tipul ales; „Câmp specific" merge doar pentru un singur tip cu formular
 * Source: docs/testing/cases/TC-DOC-16.md, „Last green" 2026-10-06
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
// #38.18: the sign's two lines — the state, then why.
const ON = "„Câmp specific” se poate folosi";
const OFF = "„Câmp specific” nu se poate folosi";
// The theme's success and danger tokens (globals.css), as the browser computes them.
const GREEN = "rgb(21, 128, 61)";
const RED = "rgb(185, 28, 28)";

/** The toolbar, and — #38.18 — the same with the sign's tooltip open, at 1366 and 1920 px. */
async function photograph(page: Page, name: string): Promise<void> {
  const sign = page.locator("main [data-custom-field-sign]");
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await page.locator("main [data-toolbar]").screenshot({ path: `${SHOTS}/${name}-${width}.png` });
    await sign.hover();
    await expect(page.locator("[role=tooltip][data-icon-tooltip]")).toBeVisible();
    const box = (await page.locator("main [data-toolbar]").boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/${name}-tooltip-${width}.png`, clip: { x: box.x, y: box.y, width: Math.min(box.width, width - box.x), height: box.height + 90 } });
    await page.mouse.move(5, 5);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
}

/** #38.18: the sign — its state, its colour, and its tooltip's two lines on hover. */
async function expectSign(page: Page, on: boolean, why: string): Promise<void> {
  const sign = page.locator("main [data-custom-field-sign]");
  await expect(sign).toHaveAttribute("data-custom-field-sign", on ? "on" : "off", { timeout: 30_000 });
  await expect(sign.locator("svg")).toHaveClass(on ? /lucide-circle-check/ : /lucide-ban/);
  await expect(sign.locator("svg")).toHaveCSS("color", on ? GREEN : RED);
  await expect(sign).toHaveAttribute("aria-label", `${on ? ON : OFF}. ${why}`);
  await sign.hover();
  // The sign's own tooltip — the ⓘ's bubble is a role="tooltip" in the page too.
  const tip = page.locator("[role=tooltip][data-icon-tooltip]");
  await expect(tip).toContainText(on ? ON : OFF);
  await expect(tip).toContainText(why);
  await page.mouse.move(5, 5);
  await expect(tip).toHaveCount(0);
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
      // #38.18: on the second row, „Tip document:", the sign, „Câmp specific:" — in that order; the field looks disabled.
      const row2 = main.locator('[data-toolbar-row="second"]');
      const at = await Promise.all([row2.getByRole("button", { name: /^Tip document:/ }), row2.locator("[data-custom-field-sign]"), row2.getByText("Câmp specific:")].map(async (l) => (await l.boundingBox())!.x));
      expect(at).toEqual([...at].sort((a, b) => a - b));
      const fieldBox = main.locator("[data-custom-field-box]");
      await expect(fieldBox).toHaveCSS("border-top-style", "dashed");
      await expect(row2.getByText("Câmp specific:")).toHaveCSS("font-style", "italic");
      await expectSign(page, false, "Sunt bifate toate tipurile — alegeți la „Tip document” un singur tip.");
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
      await expectSign(page, false, "Nu este bifat niciun tip — alegeți la „Tip document” un singur tip.");

      // Step 3 — „Contract de Vânzare": its name, its tooltip; „Câmp specific:" enabled with its closed lists.
      await tick("Contract de Vânzare");
      await expect(words).toHaveText("Contract de Vânzare", { timeout: 30_000 });
      await expect(words).toHaveCSS("font-style", "normal");
      await expect(words).toHaveAttribute("title", "Contract de Vânzare");
      await expect(key).toBeEnabled({ timeout: 30_000 });
      const keys = await key.locator("option").allTextContents();
      expect(keys[0]).toBe("Toate");
      for (const kept of ["Monedă", "Stare plată", "Modalitate plată"]) expect(keys).toContain(kept);
      await expect(fieldBox).toHaveCSS("border-top-style", "solid");
      await expect(row2.getByText("Câmp specific:")).toHaveCSS("font-style", "normal");
      await page.getByRole("heading", { level: 1 }).first().click();
      await expectSign(page, true, "Oferă câmpurile cu listă închisă ale tipului „Contract de Vânzare”.");
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
      await expectSign(page, false, "Sunt bifate 2 tipuri — alegeți la „Tip document” un singur tip.");
      await photograph(page, "two-types");

      // Step 5 — only „Adeverință": its name; disabled — it has no form.
      await tick("Contract de Vânzare");
      await expect(words).toHaveText("Adeverință", { timeout: 30_000 });
      await expect(key).toBeDisabled();
      await page.getByRole("heading", { level: 1 }).first().click();
      await expectSign(page, false, "Tipul „Adeverință” nu are formular.");
      await photograph(page, "one-type-no-form");
    } finally {
      for (const id of ids) await removeRecord(page.request, "document", id);
    }
  });
});
