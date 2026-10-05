/**
 * Case:   TC-DOC-06 — „Fără valoare" în cursive, fără liniuțe; listele derulante ale unui CVC trei pe rând, în română ca în engleză
 * Source: docs/testing/cases/TC-DOC-06.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim, and every English one.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The document carries `TC-E2E-DOC-06` (records.ts).
 *   - Step 2's open list is drawn by the browser outside the page, so no
 *     script and no page screenshot can see it; what is asserted is what the
 *     list is drawn from — each option's computed `font-style`. The hand runs
 *     photographed the list in Chrome on Windows.
 *   - Step 3 chooses „Afirmat" with `selectOption`, a real change; nothing is
 *     saved, as in the case.
 *   - The language is switched with the `NEXT_LOCALE` cookie; „back" is
 *     `ro-RO`, the value `e2e/auth.setup.ts` pins for every spec.
 *   - Slice #37.55's pictures, not steps of the case: the CVC's tiles in
 *     Romanian and in English at 1366 and 1920 px, into
 *     `playwright-report/blank-choice/`, the sidebar's „Recente" list painted over.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-06`;
const SHOTS = "playwright-report/blank-choice";

async function language(page: Page, locale: "ro-RO" | "en-GB"): Promise<void> {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, domain: "localhost", path: "/" }]);
}

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente|Recent/i }) });

/** The type's own dropdowns that are drawn. */
const dropdowns = (page: Page) => page.locator('select[name^="customFields."]:visible');
const circuitCivil = (page: Page) => page.locator('select[name="customFields.inCircuitCivil"]');

/** Each dropdown's shown text and font-style, and its blank option's text. */
async function closedBoxes(page: Page): Promise<{ shown: string; style: string; blank: string }[]> {
  return dropdowns(page).evaluateAll((els) =>
    (els as HTMLSelectElement[]).map((s) => ({
      shown: s.selectedOptions[0]?.text ?? "",
      style: getComputedStyle(s).fontStyle,
      blank: s.options[0]?.text ?? "",
    })),
  );
}

/** The options of „Circuit civil", each with its computed font-style — what the open list is drawn from. */
async function listOf(page: Page): Promise<string[]> {
  return circuitCivil(page).evaluate((s: HTMLSelectElement) =>
    [...s.options].map((o) => `${o.text}: ${getComputedStyle(o).fontStyle}`),
  );
}

/** Boxes per row in the panel headed `name`, top to bottom. */
async function boxesPerRow(page: Page, name: string): Promise<number[]> {
  // #37.90: inside a tile a panel's heading is its name in square brackets.
  const panel = page.locator("section").filter({ has: page.getByRole("heading", { name: `[${name}]`, exact: true }) }).last();
  return panel.locator("[data-width-field]").evaluateAll((els) => {
    const tops = new Map<number, number>();
    for (const el of els) {
      const t = Math.round(el.getBoundingClientRect().top);
      tops.set(t, (tops.get(t) ?? 0) + 1);
    }
    return [...tops.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
  });
}

async function stepFive(page: Page): Promise<void> {
  expect(await boxesPerRow(page, "Declarații și garanții")).toEqual([3, 3, 3, 3, 2]);
  expect(await boxesPerRow(page, "Declarații și obligații legale")).toEqual([2, 3, 3, 2]);
}

async function photograph(page: Page, lang: "ro" | "en"): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.waitForTimeout(300);
    await stepFive(page); // the rows do not depend on the window
    await page.getByRole("heading", { name: "Stare juridică", exact: true }).first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/cvc-tiles-${lang}-${width}.png`, fullPage: true, mask: [recent(page)] });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-DOC-06 — „fără valoare” în cursive, fără liniuțe", () => {
  test("în cursive, fără liniuțe, alegerile reale drepte, trei pe rând — în română și în engleză", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    let id: string | undefined;
    try {
      id = await createSaleContract(page.request, `${MARK} CVC`);

      // Step 1 — in Romanian, „Toate": 36 dropdowns, each „fără valoare" in italics, no „—" around it.
      await language(page, "ro-RO");
      await page.goto(`/documents/${id}`);
      await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
      await expect(dropdowns(page)).toHaveCount(36, { timeout: 30_000 });
      for (const box of await closedBoxes(page)) {
        expect(box).toEqual({ shown: "fără valoare", style: "italic", blank: "fără valoare" });
      }

      // Step 2 — „Circuit civil"'s list: „fără valoare" first, in italics; the others regular.
      await circuitCivil(page).scrollIntoViewIfNeeded();
      expect(await listOf(page)).toEqual([
        "fără valoare: italic",
        "Afirmat: normal",
        "Nu e menționat: normal",
        "Excepție: normal",
      ]);

      // Step 3 — „Afirmat": the box regular; the list unchanged.
      await circuitCivil(page).selectOption({ label: "Afirmat" });
      await expect(circuitCivil(page)).toHaveCSS("font-style", "normal");
      expect(await listOf(page)).toEqual([
        "fără valoare: italic",
        "Afirmat: normal",
        "Nu e menționat: normal",
        "Excepție: normal",
      ]);

      // Step 4 — „fără valoare" again: italic.
      await circuitCivil(page).selectOption({ label: "fără valoare" });
      await expect(circuitCivil(page)).toHaveCSS("font-style", "italic");

      // Step 5 — three to a row.
      await stepFive(page);
      await photograph(page, "ro");

      // Step 6 — English, „All": „no value" in italics, the same rows.
      await language(page, "en-GB");
      await page.goto(`/documents/${id}`);
      await page.getByRole("button", { name: "All", exact: true }).click({ timeout: 30_000 });
      await expect(dropdowns(page)).toHaveCount(36, { timeout: 30_000 });
      for (const box of await closedBoxes(page)) {
        expect(box).toEqual({ shown: "no value", style: "italic", blank: "no value" });
      }
      await stepFive(page);
      await photograph(page, "en");
    } finally {
      // At the end — the language back, and the document deleted.
      await language(page, "ro-RO");
      if (id) await removeRecord(page.request, "document", id);
    }
  });
});
