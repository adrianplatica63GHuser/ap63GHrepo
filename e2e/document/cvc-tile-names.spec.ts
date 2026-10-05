/**
 * Case:   TC-DOC-05 — Filele și panourile unui CVC, fiecare cu un singur nume; „Taxă timbru și publicitate" ultima
 * Source: docs/testing/cases/TC-DOC-05.md, „Last green" 2026-10-02 (steps rewritten by Slice #37.90)
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The document carries `TC-E2E-DOC-05` (records.ts).
 *   - The remembered tiles are set in this test's own browser context, which
 *     is thrown away after it, so there is nothing of anybody's to put back.
 *   - Slice #37.54's pictures, not steps of the case: the four tiles at 1366
 *     and 1920 px, into `playwright-report/cvc-tile-names/`, the sidebar's
 *     „Recente" list painted over.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}DOC-05`;
const SHOTS = "playwright-report/cvc-tile-names";
const STORE = "ga40-tiles-document-CONTRACT_VANZARE-v1";

const TILES: [string, string[]][] = [
  ["Preț și taxe", ["Financiar", "Taxe și onorarii"]],
  ["Cadastru și CF", ["Dosar și exemplar", "Excepție cadastru", "Obiect declarat"]],
  ["Stare juridică", ["Declarații și garanții"]],
  ["Formalități", ["Declarații și obligații legale"]],
];
const OLD = ["Instrument", "Antet instrument", "Stare juridică afirmată", "Conformitate", "Conformitate și formalități", "Cadastru și carte funciară"];

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

/** A fee's box and the label above it, by the box's field name. */
function fee(page: Page, key: string) {
  const box = page.locator(`[data-width-field="customFields.${key}"]`);
  const label = page.locator("label, div.row-span-3").filter({ has: box }).last().locator("span").first();
  return { box, label };
}

test.describe("TC-DOC-05 — filele și panourile unui CVC", () => {
  test("un singur nume fiecare, alegerea veche păstrată, taxele în ordinea nouă", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    let id: string | undefined;
    try {
      id = await createSaleContract(page.request, `${MARK} CVC`);
      // Before you start — a choice remembered under the old key.
      await page.goto("/documents");
      await page.evaluate(
        (key) => localStorage.setItem(key, JSON.stringify(["general", "pages", "tab:Conformitate", "tab:Cadastru și carte funciară"])),
        STORE,
      );

      // Step 1 — Date generale, Pagini, Cadastru și CF and Formalități ticked; the other two not.
      await page.goto(`/documents/${id}`);
      for (const name of ["Date generale", "Pagini", "Cadastru și CF", "Formalități"]) await expect(tileBox(page, name)).toBeChecked({ timeout: 30_000 });
      for (const name of ["Preț și taxe", "Stare juridică"]) await expect(tileBox(page, name)).not.toBeChecked();

      // Step 2 — „Toate": the four tiles and their panels, each in brackets (#37.90), none of the old names.
      await page.getByRole("button", { name: "Toate", exact: true }).click();
      for (const [tile, panels] of TILES) {
        const region = page.getByRole("region", { name: tile, exact: true });
        await expect(region).toBeVisible({ timeout: 30_000 });
        for (const panel of panels) {
          await expect(region.getByRole("heading", { name: `[${panel}]`, exact: true })).toBeVisible();
          await expect(region.getByRole("heading", { name: panel, exact: true })).toHaveCount(0);
        }
      }
      for (const old of OLD) {
        await expect(page.getByRole("region", { name: old, exact: true })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: old, exact: true })).toHaveCount(0);
        await expect(page.getByRole("checkbox", { name: old, exact: true })).toHaveCount(0);
      }

      // Step 3 — the fees: three on one row, „Taxă timbru și publicitate" alone below, one line.
      const tops: number[] = [];
      for (const key of ["timbruJudiciar", "onorariuNotarial", "impozitTransfer", "taxaTimbruPublicitate"]) {
        const b = await fee(page, key).box.boundingBox();
        tops.push(Math.round(b!.y));
      }
      expect(tops[0]).toBe(tops[1]);
      expect(tops[1]).toBe(tops[2]);
      expect(tops[3]).toBeGreaterThan(tops[2]);
      const ttp = fee(page, "taxaTimbruPublicitate").label;
      await expect(ttp).toHaveText("Taxă timbru și publicitate");
      const [height, line] = await ttp.evaluate((el) => [el.getBoundingClientRect().height, parseFloat(getComputedStyle(el).lineHeight)]);
      expect(height).toBeLessThanOrEqual(line + 1);

      for (const width of [1366, 1920]) {
        await page.setViewportSize({ width, height: 1080 });
        await page.waitForTimeout(300);
        await page.screenshot({ path: `${SHOTS}/cvc-tiles-${width}.png`, fullPage: true, mask: [recent(page)] });
      }
    } finally {
      // At the end — the document deleted; the context, and its remembered tiles, go with the test.
      if (id) await removeRecord(page.request, "document", id);
    }
  });
});
