/**
 * Case:   TC-DOC-03 — Un PAD: „Detalii act", „Date de emitere", fără „Câmpuri specifice tipului de document", „Data autentificării" pe un rând
 * Source: docs/testing/cases/TC-DOC-03.md, „Last green" 2026-10-02 (headings bracketed by Slice #37.90)
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim, and every English one.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The documents carry `TC-E2E-DOC-03` (records.ts): `TC-E2E-DOC-03 PAD`
 *     and `TC-E2E-DOC-03 CVC`.
 *   - The language is switched with the same `NEXT_LOCALE` cookie the hand run
 *     set, added to this context; „back to Romanian" is `ro-RO`, the value
 *     `e2e/auth.setup.ts` pins for every spec, where the hand run removed it.
 *   - Slice #37.52's pictures, not steps of the case: the PAD's tile in
 *     Romanian and in English, and the CVC's „Taxe și onorarii" panel, at 1366
 *     and 1920 px, into `playwright-report/type-fields-tile/`.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-03`;
const SHOTS = "playwright-report/type-fields-tile";

/** The same cookie, on the same domain, that `e2e/auth.setup.ts` pins to `ro-RO`. */
async function language(page: Page, locale: "ro-RO" | "en-GB"): Promise<void> {
  await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, domain: "localhost", path: "/" }]);
}

/** „One line": the label no taller than its line height. */
async function oneLine(label: Locator): Promise<void> {
  const [height, line] = await label.evaluate((el) => [el.getBoundingClientRect().height, parseFloat(getComputedStyle(el).lineHeight)]);
  expect(height).toBeLessThanOrEqual(line + 1);
}

/** The label above the „date" box of the issue panel. */
const dateLabel = (page: Page) => page.locator("label").filter({ has: page.locator('[data-width-field="dateDocument"]') }).locator("span").first();

async function photograph(page: Page, name: string, target: () => Locator): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.waitForTimeout(300);
    await target().screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

async function allTiles(page: Page, word: "Toate" | "All"): Promise<void> {
  await page.getByRole("button", { name: word, exact: true }).click();
}

test.describe("TC-DOC-03 — un PAD: „Detalii act”, „Date de emitere”", () => {
  test("în română și în engleză; „Taxe și onorarii” al CVC-ului rămâne", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const made: string[] = [];
    try {
      const padId = await createDocumentOfType(page.request, "PLAN_AMPLASAMENT_DELIMITARE", `${MARK} PAD`);
      made.push(padId);
      const cvcId = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} CVC`);
      made.push(cvcId);

      // Step 1 — the PAD: „Detalii act", „Date de emitere", no old names, „Data autentificării" on one line.
      await page.goto(`/documents/${padId}`);
      let tile = page.getByRole("region", { name: "Detalii act", exact: true });
      await expect(tile).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("checkbox", { name: "Detalii act", exact: true })).toBeVisible();
      await expect(tile.getByRole("heading", { name: "[Date de emitere]", exact: true })).toBeVisible();
      await expect(page.getByText("Câmpuri specifice")).toHaveCount(0);
      await expect(tile.getByText("Taxe și onorarii")).toHaveCount(0);
      await expect(dateLabel(page)).toHaveText("Data autentificării");
      await oneLine(dateLabel(page));
      await photograph(page, "pad-ro", () => page.getByRole("region", { name: "Detalii act", exact: true }));

      // Step 2 — in English: „Document details", „Issue details", none of the old names, „Authentication date" on one line.
      await language(page, "en-GB");
      await page.goto(`/documents/${padId}`);
      tile = page.getByRole("region", { name: "Document details", exact: true });
      await expect(tile).toBeVisible({ timeout: 30_000 });
      await expect(tile.getByRole("heading", { name: "[Issue details]", exact: true })).toBeVisible();
      for (const old of ["Type fields", "Document-type-specific fields"]) await expect(page.getByText(old)).toHaveCount(0);
      await expect(tile.getByText(/\bFees\b/)).toHaveCount(0);
      await expect(dateLabel(page)).toHaveText("Authentication date");
      await oneLine(dateLabel(page));
      await photograph(page, "pad-en", () => page.getByRole("region", { name: "Document details", exact: true }));

      // Step 3 — the CVC, in English, „All": „Taxe și onorarii" over „Authentication date".
      await page.goto(`/documents/${cvcId}`);
      await allTiles(page, "All");
      const fees = () => page.locator("section").filter({ has: page.locator('[data-width-field="dateDocument"]') }).last();
      await expect(dateLabel(page)).toHaveText("Authentication date", { timeout: 30_000 });
      await expect(fees().getByRole("heading", { name: "[Taxe și onorarii]", exact: true })).toBeVisible();

      // Step 4 — back in Romanian: „Taxe și onorarii", „Data autentificării" on one line.
      await language(page, "ro-RO");
      await page.goto(`/documents/${cvcId}`);
      await allTiles(page, "Toate");
      await expect(dateLabel(page)).toHaveText("Data autentificării", { timeout: 30_000 });
      await expect(fees().getByRole("heading", { name: "[Taxe și onorarii]", exact: true })).toBeVisible();
      await oneLine(dateLabel(page));
      await photograph(page, "cvc-fees-ro", fees);
    } finally {
      // At the end — Romanian again, and both documents deleted.
      await language(page, "ro-RO");
      for (const id of made) await removeRecord(page.request, "document", id);
    }
  });
});
