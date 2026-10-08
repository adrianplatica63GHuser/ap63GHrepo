/**
 * Case:   TC-DOC-03 — Un PAD: „Detalii act" fără panou de emitere; emitentul, numărul și data în „Identificarea actului", „Data" pe un rând
 * Source: docs/testing/cases/TC-DOC-03.md, „Last green" 2026-10-07 (rewritten by Slice #38.32)
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
 *     and 1920 px, into `playwright-report/type-fields-tile/`; since #38.32 the
 *     CVC's „Identificarea actului" with its notarial labels.
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

/** The label above the act's „date" box — on „Identificarea actului" since #38.32. */
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

test.describe("TC-DOC-03 — un PAD: „Detalii act” fără panou de emitere; „Identificarea actului”", () => {
  test("în română și în engleză; „Taxe și onorarii” al CVC-ului ține doar taxele", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const made: string[] = [];
    const label = (field: string) => page.locator("label").filter({ has: page.locator(`[data-width-field="${field}"]`) }).locator("span").first();
    try {
      const padId = await createDocumentOfType(page.request, "PLAN_AMPLASAMENT_DELIMITARE", `${MARK} PAD`);
      made.push(padId);
      const cvcId = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} CVC`);
      made.push(cvcId);

      // Step 1 — the PAD: „Detalii act" with no issue panel; „Emitent", „Nr. document", „Data" on „Identificarea actului".
      await page.goto(`/documents/${padId}`);
      let tile = page.getByRole("region", { name: "Detalii act", exact: true });
      await expect(tile).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("checkbox", { name: "Detalii act", exact: true })).toBeVisible();
      await expect(tile.getByRole("heading", { name: "[Date de emitere]", exact: true })).toHaveCount(0);
      await expect(tile.locator('[data-width-field="dateDocument"]')).toHaveCount(0);
      await expect(page.getByText("Câmpuri specifice")).toHaveCount(0);
      await expect(tile.getByText("Taxe și onorarii")).toHaveCount(0);
      let general = page.getByRole("region", { name: "Identificarea actului", exact: true });
      await expect(general.locator('[data-width-field="dateDocument"]')).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Emitent", exact: true })).toBeVisible(); // a <select> named by <label htmlFor>
      await expect(label("nrDocument")).toHaveText("Nr. document");
      await expect(dateLabel(page)).toHaveText("Data");
      await oneLine(dateLabel(page));
      await photograph(page, "pad-ro", () => page.getByRole("region", { name: "Detalii act", exact: true }));

      // Step 2 — in English: „Document details" with no „[Issue details]"; „Issuer", „Document No.", „Date".
      await language(page, "en-GB");
      await page.goto(`/documents/${padId}`);
      tile = page.getByRole("region", { name: "Document details", exact: true });
      await expect(tile).toBeVisible({ timeout: 30_000 });
      await expect(tile.getByRole("heading", { name: "[Issue details]", exact: true })).toHaveCount(0);
      for (const old of ["Type fields", "Document-type-specific fields"]) await expect(page.getByText(old)).toHaveCount(0);
      await expect(tile.getByText(/\bFees\b/)).toHaveCount(0);
      general = page.getByRole("region", { name: "Document identification", exact: true });
      await expect(general.locator('[data-width-field="dateDocument"]')).toBeVisible();
      await expect(page.getByRole("combobox", { name: "Issuer", exact: true })).toBeVisible(); // a <select> named by <label htmlFor>
      await expect(label("nrDocument")).toHaveText("Document No.");
      await expect(dateLabel(page)).toHaveText("Date");
      await oneLine(dateLabel(page));
      await photograph(page, "pad-en", () => page.getByRole("region", { name: "Document details", exact: true }));

      // Step 3 — the CVC, in English, „All": the notarial set on „Document identification"; „[Taxe și onorarii]" without a date box.
      await page.goto(`/documents/${cvcId}`);
      await allTiles(page, "All");
      const fees = () => page.locator('[data-section="fees"], [data-panel="fees"]').first();
      await expect(dateLabel(page)).toHaveText("Authentication date", { timeout: 30_000 });
      await expect(page.getByRole("combobox", { name: "Notary Office", exact: true })).toBeVisible(); // a <select> named by <label htmlFor>
      await expect(label("nrDocument")).toHaveText("Authentic Deed No.");
      await expect(fees().getByRole("heading", { name: "[Taxe și onorarii]", exact: true })).toBeVisible();
      await expect(fees().locator('[data-width-field="dateDocument"]')).toHaveCount(0);

      // Step 4 — back in Romanian: „Notariat", „Nr. act autentic", „Data autentificării" on one line; the four fees.
      await language(page, "ro-RO");
      await page.goto(`/documents/${cvcId}`);
      await allTiles(page, "Toate");
      await expect(dateLabel(page)).toHaveText("Data autentificării", { timeout: 30_000 });
      await expect(page.getByRole("combobox", { name: "Notariat", exact: true })).toBeVisible(); // a <select> named by <label htmlFor>
      await expect(label("nrDocument")).toHaveText("Nr. act autentic");
      await expect(page.getByRole("region", { name: "Identificarea actului", exact: true }).locator('[data-width-field="dateDocument"]')).toBeVisible();
      await expect(fees().getByRole("heading", { name: "[Taxe și onorarii]", exact: true })).toBeVisible();
      await expect(fees().locator('[data-width-field="dateDocument"]')).toHaveCount(0);
      for (const key of ["timbruJudiciar", "onorariuNotarial", "impozitTransfer", "taxaTimbruPublicitate"]) {
        await expect(fees().locator(`[data-width-field="customFields.${key}"]`)).toBeVisible();
      }
      await oneLine(dateLabel(page));
      await photograph(page, "cvc-fees-ro", fees);
      // The region is the tile's `display: contents` wrapper; the panel is what is drawn.
      await photograph(page, "cvc-identification-ro", () => page.locator('[data-panel="general"]'));
    } finally {
      // At the end — Romanian again, and both documents deleted.
      await language(page, "ro-RO");
      for (const id of made) await removeRecord(page.request, "document", id);
    }
  });
});
