/**
 * Case:   TC-DOC-18 — „Identificarea actului": emitentul, numărul, data și câmpurile de identificare ale tipului, păstrate după reîncărcare
 * Source: docs/testing/cases/TC-DOC-18.md, „Last green" 2026-10-07
 *
 * A translation of the case file, step for step (Slice #38.32). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The documents are created through the route, with `TC-E2E-DOC-18`
 *     names (e2e/helpers/records.ts), and removed in `finally`.
 *   - The boxes are read by their field (`data-width-field`), inside the
 *     tile's panel (`[data-panel="general"]`); the labels by their text.
 */

import { test, expect, type Page } from "../helpers/test";
import { editTile, saveTile } from "../helpers/tiles";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-18`;

const tile = (page: Page) => page.locator('[data-panel="general"]');
const box = (page: Page, field: string) => tile(page).locator(`[data-width-field="${field}"]`);

async function save(page: Page, version: string): Promise<void> {
  // 40.75: the open tile's own „Salvează".
  await saveTile(page, "general");
  await expect(page.getByText(version, { exact: true }).first()).toBeVisible({ timeout: 30_000 });
}

test.describe("TC-DOC-18 — „Identificarea actului”, păstrată după reîncărcare", () => {
  test("pe un CVC și pe un PAD", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const made: string[] = [];
    try {
      const cvc = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} CVC`);
      made.push(cvc);
      // 40.90: an Autorizație, where the case had a PAD — Adrian removed the PAD type; any type with the generic
      // „Emitent / Nr. document / Data" proves the same.
      const pad = await createDocumentOfType(page.request, "AUTORIZATIE", `${MARK} PAD`);
      made.push(pad);

      // Step 1 — the CVC's tile: the type, the notarial set and the four identification fields.
      await page.goto(`/documents/${cvc}`);
      // 40.75: a saved document reads as text; „Editează" opens „Identificarea actului", every field drawn.
      await editTile(page, "general");
      await expect(box(page, "customFields.dataContinut")).toBeVisible({ timeout: 30_000 });
      for (const label of ["Tip document", "Notariat", "Nr. act autentic", "Data autentificării", "Calitate exemplar", "Exemplare emise", "Temei autentificare", "Data conținutului"]) {
        await expect(tile(page).getByText(label, { exact: true }).first()).toBeVisible();
      }
      await expect(box(page, "customFields.dataContinut")).toHaveAttribute("type", "date");

      // Step 2 — typed and saved.
      await box(page, "nrDocument").fill("118");
      await box(page, "dateDocument").fill("2020-03-12");
      await tile(page).getByRole("combobox", { name: "Calitate exemplar", exact: true }).selectOption({ label: "Original" });
      await box(page, "customFields.exemplareEmise").fill("3");
      await box(page, "customFields.dataContinut").fill("2019-11-30");
      await save(page, "v 1");

      // Step 3 — after a reload, all five.
      await page.reload();
      // 40.75: read as text first, then open to read the boxes.
      await expect(box(page, "nrDocument")).toHaveText("118", { timeout: 30_000 });
      await expect(box(page, "dateDocument")).toHaveText("12.03.2020");
      await editTile(page, "general");
      await expect(box(page, "nrDocument")).toHaveValue("118", { timeout: 30_000 });
      await expect(box(page, "dateDocument")).toHaveValue("2020-03-12");
      await expect(tile(page).getByRole("combobox", { name: "Calitate exemplar", exact: true })).toHaveValue("ORIGINAL");
      await expect(box(page, "customFields.exemplareEmise")).toHaveValue("3");
      await expect(box(page, "customFields.dataContinut")).toHaveValue("2019-11-30");

      // Step 4 — an Autorizație (the PAD until 40.90): „Nr. document", „Data", kept.
      await page.goto(`/documents/${pad}`);
      await editTile(page, "general"); // 40.75
      await expect(box(page, "nrDocument")).toBeVisible({ timeout: 30_000 });
      await expect(tile(page).getByText("Nr. document", { exact: true })).toBeVisible();
      await expect(tile(page).getByText("Data", { exact: true })).toBeVisible();
      await box(page, "nrDocument").fill("PAD-7");
      await box(page, "dateDocument").fill("2021-05-04");
      await save(page, "v 1");
      await page.reload();
      await expect(box(page, "nrDocument")).toHaveText("PAD-7", { timeout: 30_000 });
      await expect(box(page, "dateDocument")).toHaveText("04.05.2021");
    } finally {
      for (const id of made) await removeRecord(page.request, "document", id);
    }
  });
});
