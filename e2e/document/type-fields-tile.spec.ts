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

import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";
import { openEmptyTiles, pressTileButton, editTile } from "../helpers/tiles";
import { showEmptyFields } from "../helpers/empty-fields";

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
  // 40.57: the button is in the „Panouri" panel; 40.64: a new contract's empty tiles are one line — „Adaugă" opens them.
  await pressTileButton(page, word);
  await openEmptyTiles(page);
}

test.describe("TC-DOC-03 — un PAD: „Detalii act” fără panou de emitere; „Identificarea actului”", () => {
  test("în română și în engleză; „Taxe și onorarii” al CVC-ului ține doar taxele", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const made: string[] = [];
    const label = (field: string) => page.locator("label").filter({ has: page.locator(`[data-width-field="${field}"]`) }).locator("span").first();
    try {
      const cvcId = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} CVC`);
      made.push(cvcId);

      // Steps 1–2 retired 2026-10-27 (40.90): they read a PAD's „Detalii act", a form with no panels, and Adrian removed
      // the PAD's form on purpose („faulty … I will re-do them"). No other type has such a form today; the generic
      // „Emitent / Nr. document / Data" stay covered by TC-DOC-18 step 4. They come back with a form of that kind.
      // Step 3 opens the interface in English first, as step 2 left it.
      await language(page, "en-GB");

      // Step 3 — the CVC, in English, „All": the notarial set on „Document identification"; „[Taxe și onorarii]" without a date box.
      await page.goto(`/documents/${cvcId}`);
      await allTiles(page, "All");
      await editTile(page, "general"); // 40.75: the document reads as text; open, every field drawn
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
      await showEmptyFields(page, undefined, { wait: true });
      await editTile(page, "general"); // 40.75: the document reads as text; open, every field drawn
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
