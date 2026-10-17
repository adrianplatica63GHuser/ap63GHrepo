/**
 * Case:   TC-MAP-06 — Stratul „Tarlale”: conturul unei tarlale din proprietățile ei, codul pe contur, clic spre pagina tarlalei
 * Source: docs/testing/cases/TC-MAP-06.md, „Last green" 2026-10-17 (confirmed by two hand runs, Slice #39.68)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The lots carry `TC-E2E-MAP-06` (records.ts); the tarla keeps the case's `TCM6`, and one left by an interrupted
 *     run is deleted first.
 *   - An outline is found by `data-tarla-outline` and its kind by `data-tarla-outline-kind`; the code by
 *     `data-tarla-label`, clicked by script inside the map's marker (a marker's content is not a page element
 *     Playwright can click through the map's own layers).
 */

import { test, expect, type APIRequestContext } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

test.use({ realMaps: true }); // TC-MAP-06 reads the outline and the code the map draws, and clicks the code

const MARK = `${E2E_MARKER}MAP-06`;
const CODE = "TCM6";
const TARLA = "/api/admin/value-lists/tarla";
// About 20 m × 20 m at 45.6° N: 0.00018° of latitude, 0.00026° of longitude; the second lot 200 m east.
const lot = (lon: number) => [
  { lat: 45.6, lon },
  { lat: 45.6, lon: Number((lon + 0.00026).toFixed(5)) },
  { lat: 45.60018, lon: Number((lon + 0.00026).toFixed(5)) },
  { lat: 45.60018, lon },
];

async function removeTarla(request: APIRequestContext): Promise<void> {
  const res = await request.get(TARLA);
  if (!res.ok()) return;
  for (const t of ((await res.json()) as { items: { id: string; indicativ: string }[] }).items) {
    if (t.indicativ === CODE) await request.delete(`${TARLA}/${t.id}`);
  }
}

test.describe("TC-MAP-06 — stratul „Tarlale”", () => {
  test("conturul din proprietăți, codul pe el, clic spre pagina tarlalei", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await removeTarla(page.request);
    await page.setViewportSize({ width: 1366, height: 900 });
    const created = await page.request.post(TARLA, { data: { indicativ: CODE, locality: "Testeni" } });
    expect(created.ok()).toBeTruthy();
    const tarlaId = ((await created.json()) as { id: string }).id;
    const lots: string[] = [];
    try {
      lots.push(await createProperty(page.request, { nickname: `${MARK} Lot 1`, tarlaId, corners: lot(24.5) }));
      lots.push(await createProperty(page.request, { nickname: `${MARK} Lot 2`, tarlaId, corners: lot(24.50256) }));

      // Step 1 — the map on the first lot at zoom 15: „Tarlale" not pressed, no outline.
      await page.goto(`/properties/map?focus=${lots[0]}&z=15`);
      const layer = page.locator('[data-map-layer="tarlale"]');
      await expect(layer).toBeVisible({ timeout: 60_000 });
      await expect(layer).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator(`[data-tarla-outline="${CODE}"]`)).toHaveCount(0);

      // Step 2 — pressed: one outline around both lots, the shape around them; the code on it.
      await layer.click();
      await expect(layer).toHaveAttribute("aria-pressed", "true");
      const outline = page.locator(`[data-tarla-outline="${CODE}"]`);
      await expect(outline).toHaveCount(1, { timeout: 30_000 });
      await expect(outline).toHaveAttribute("data-tarla-outline-kind", "hull");
      const label = page.locator(`[data-tarla-label="${CODE}"]`);
      await expect(label).toHaveCount(1, { timeout: 30_000 });

      // Step 3 — the code opens the tarla's page; its map shows the same outline and its code.
      await label.evaluate((el) => (el as HTMLElement).click());
      await expect(page).toHaveURL(new RegExp(`/tarlale/${tarlaId}$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Tarla ${CODE} — Testeni`, { timeout: 30_000 });
      const pageMap = page.locator("[data-tarla-map]");
      await expect(pageMap).toHaveAttribute("data-tarla-map-outline", "hull", { timeout: 30_000 });
      await expect(pageMap.locator(`[data-tarla-outline="${CODE}"]`)).toHaveCount(1);

      // Step 4 — back on the map: off, no outline; pressed twice, on and then off again.
      await page.goBack();
      await expect(layer).toBeVisible({ timeout: 60_000 });
      await expect(layer).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator(`[data-tarla-outline="${CODE}"]`)).toHaveCount(0);
      await layer.click();
      await expect(layer).toHaveAttribute("aria-pressed", "true");
      await layer.click();
      await expect(layer).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator(`[data-tarla-outline="${CODE}"]`)).toHaveCount(0);
    } finally {
      await page.waitForLoadState("networkidle").catch(() => {});
      for (const id of lots) await removeRecord(page.request, "property", id);
      await removeLeftovers(page.request, MARK);
      await removeTarla(page.request);
    }
  });
});
