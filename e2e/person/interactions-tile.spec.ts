/**
 * Case:   TC-PERS-07 — „Interacțiuni”, o fișă fixă la dreapta pe persoane; prima fișă a persoanei juridice se numește „Identitate”
 * Source: docs/testing/cases/TC-PERS-07.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-PERS-07` (records.ts).
 *   - The sizes are compared with the document's „Pagini" as measured in this
 *     run, not with the case's 640 × 420 written as numbers alone; both are asserted.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PERS-07`;
const PURPLE = "rgb(246, 240, 254)";
const RIM = "rgb(218, 203, 238)";
const TEXT = "Modulul de gestionare a interacțiunilor va fi dezvoltat în viitor.";

async function size(l: Locator): Promise<{ x: number; y: number; w: number; h: number }> {
  const r = await l.boundingBox();
  return { x: Math.round(r?.x ?? -1), y: Math.round(r?.y ?? -1), w: Math.round(r?.width ?? -1), h: Math.round(r?.height ?? -1) };
}
const clearChoices = (page: Page) =>
  page.evaluate(() => { localStorage.removeItem("ga40-tiles-natural-person-v1"); localStorage.removeItem("ga40-tiles-judicial-person-v1"); });

test.describe("TC-PERS-07 — „Interacțiuni” pe cele două fișe de persoană", () => {
  test("fixă la dreapta, cât „Pagini”, mov; debifată dispare; la 1366 sub formular; „Identitate” pe persoana juridică", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const np = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const jp = await createCompany(page.request, { name: `${MARK} SRL` });
    const doc = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} Act`);
    try {
      await page.setViewportSize({ width: 1920, height: 1080 });
      // Step 1 — the document's „Pagini", no page: 640 × 420.
      await page.goto(`/documents/${doc}`);
      const pages = page.locator('[data-tile="pages"]');
      await expect(pages).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Nicio pagină adăugată")).toBeVisible({ timeout: 30_000 });
      const pages1920 = await size(pages);
      // 420 px in the pane, 422 on the runner's server: the text's line height. Within 4 px is „Pagini"'s height.
      expect(pages1920.w).toBe(640);
      expect(Math.abs(pages1920.h - 420)).toBeLessThanOrEqual(4);

      // Step 2 — the person: the last box ticked in the purple strip; the tile at „Pagini"'s size and place.
      await page.goto(`/natural-persons/${np}`);
      await clearChoices(page);
      await page.reload();
      const tile = page.getByRole("region", { name: "Interacțiuni", exact: true });
      await expect(tile).toBeVisible({ timeout: 30_000 });
      await expect(tileBox(page, "Interacțiuni")).toBeChecked();
      const boxes = page.locator("[data-tile-selector] label");
      await expect(boxes.last()).toHaveText("Interacțiuni");
      await expect(page.locator('[data-tile-group="fixed"] label')).toHaveText(["Interacțiuni"]);
      expect(await page.locator('[data-tile-group="fixed"]').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(PURPLE);
      await expect(tile).toContainText(TEXT);
      expect(await tile.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).borderTopColor])).toEqual([PURPLE, RIM]);
      await expect.poll(async () => {
        const s = await size(tile);
        return { x: s.x, y: s.y, w: s.w, hClose: Math.abs(s.h - pages1920.h) <= 4 };
      }, { timeout: 15_000 }).toEqual({ x: pages1920.x, y: pages1920.y, w: pages1920.w, hClose: true });

      // Step 3 — unticked, the tile and the column go; ticked, it is back.
      await tileBox(page, "Interacțiuni").click();
      await expect(tile).toHaveCount(0);
      await expect(page.locator('[data-tile-area="right"]')).toBeHidden();
      await tileBox(page, "Interacțiuni").click();
      await expect(tile).toBeVisible();

      // Step 4 — 1366: under the left area, still „Pagini"'s size, purple.
      await page.setViewportSize({ width: 1366, height: 1080 });
      await expect.poll(async () => {
        const [l, t] = [await size(page.locator('[data-tile-area="left"]')), await size(tile)];
        return t.y >= l.y + l.h;
      }, { timeout: 15_000 }).toBe(true);
      const at1366 = await size(tile);
      expect(at1366.w).toBe(640);
      expect(Math.abs(at1366.h - pages1920.h)).toBeLessThanOrEqual(4);
      expect(await tile.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(PURPLE);

      // Step 5 — the company: „Identitate" first, „Interacțiuni" at the right, the same size.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/judicial-persons/${jp}`);
      await expect(page.getByRole("region", { name: "Interacțiuni", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(boxes).toHaveText(["Identitate", "Persoane de contact", "Adrese", "Corelate", "Clasificări", "Conexiuni", "Interacțiuni"]);
      await expect(page.locator('[data-panel="identity"] h2').first()).toContainText("Identitate");
      const jpTile = await size(page.getByRole("region", { name: "Interacțiuni", exact: true }));
      expect({ x: jpTile.x, y: jpTile.y, w: jpTile.w, hClose: Math.abs(jpTile.h - pages1920.h) <= 4 }).toEqual({ x: pages1920.x, y: pages1920.y, w: pages1920.w, hClose: true });
    } finally {
      await clearChoices(page).catch(() => undefined);
      await removeRecord(page.request, "person", np);
      await removeRecord(page.request, "company", jp);
      await removeRecord(page.request, "document", doc);
    }
  });
});
