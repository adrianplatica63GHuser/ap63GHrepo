/**
 * Case:   TC-MAP-05 — Harta micșorată: proprietățile mici devin picături, picăturile apropiate o picătură cu număr
 * Source: docs/testing/cases/TC-MAP-05.md, written 2026-10-16 (Slice #39.60)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The four lots are drawn through the API, near 45.70 N, 24.40 E, where the archive has no property, and carry
 *     `TC-E2E-MAP-05` (records.ts). The map opens on the first as „Proprietăți — Hartă" would (`?focus=<id>&z=15`).
 *   - A drop is found by the ids it covers (`data-map-drop-ids`), and clicked on its head, its centre 15 px below the
 *     numbered drop's top.
 *   - „Setări hartă" is cleared from the browser first, so the merge distance is its default, 40 px.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

test.use({ realMaps: true }); // TC-MAP-05 reads the drops the map draws at a zoom, and clicks them

const MARK = `${E2E_MARKER}MAP-05`;
// About 20 m × 20 m at 45.7° N: 0.00018° of latitude, 0.00026° of longitude.
// Rounded to the five decimals they are stored with, so `data-corner-marker` reads them back as written.
const lot = (lon: number) => {
  const east = Number((lon + 0.00026).toFixed(5));
  return [
    { lat: 45.7, lon },
    { lat: 45.7, lon: east },
    { lat: 45.70018, lon: east },
    { lat: 45.70018, lon },
  ];
};
// Three in a row about 47 m apart (14 px at zoom 15, under 40: one numbered drop), a fourth about 780 m east.
const LOTS = [lot(24.4), lot(24.4006), lot(24.4012), lot(24.41)];

const bigMap = (page: Page) => page.locator("[data-property-map]");

test.describe("TC-MAP-05 — picăturile hărții", () => {
  test("de departe, trei loturi într-o picătură cu „3” și un al patrulea singur; clic: bula, apoi harta mărită", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    try {
      for (const [i, corners] of LOTS.entries()) ids.push(await createProperty(page.request, { nickname: `${MARK} Lot ${i + 1}`, corners }));
      await page.goto("/");
      await page.evaluate(() => localStorage.removeItem("ga40.map.mergeDistancePx"));

      // Step 1 — at zoom 15: the three lots one numbered drop „3", the fourth a single drop; no polygon corners.
      await page.goto(`/properties/map?focus=${ids[0]}&z=15`);
      await expect(bigMap(page)).toHaveAttribute("data-focus-blink", "done", { timeout: 40_000 });
      await expect(bigMap(page)).toHaveAttribute("data-map-zoom", "15");
      const numbered = page.locator(`[data-map-drop="3"][data-map-drop-ids~="${ids[0]}"]`);
      await expect(numbered).toHaveCount(1, { timeout: 15_000 });
      for (const id of ids.slice(1, 3)) expect(await numbered.getAttribute("data-map-drop-ids")).toContain(id);
      const single = page.locator(`[data-map-drop="1"][data-map-drop-ids="${ids[3]}"]`);
      await expect(single).toHaveCount(1);
      for (const corners of LOTS)
        await expect(page.locator(`[data-corner-marker="${corners[0].lat},${corners[0].lon}"]`)).toHaveCount(0);

      // Step 2 — the single drop: the bubble with the lot's name and „Deschide".
      const bubble = page.locator(".gm-style-iw");
      const s = (await single.boundingBox())!;
      await page.mouse.click(s.x + s.width / 2, s.y + 11);
      await expect(bubble).toHaveCount(1, { timeout: 15_000 });
      await expect(bubble).toContainText(`${MARK} Lot 4`);
      await expect(bubble.getByRole("link", { name: "Deschide", exact: true })).toHaveAttribute("href", `/properties/${ids[3]}`);

      // Step 3 — the numbered drop: the map zooms in, the „3" is gone, the three lots are polygons with corner dots.
      const n = (await numbered.boundingBox())!;
      await page.mouse.click(n.x + n.width / 2, n.y + 15);
      await expect.poll(async () => Number(await bigMap(page).getAttribute("data-map-zoom")), { timeout: 15_000 }).toBeGreaterThan(17);
      await expect(page.locator(`[data-map-drop="3"][data-map-drop-ids~="${ids[0]}"]`)).toHaveCount(0);
      for (const corners of LOTS.slice(0, 3))
        for (const c of corners) await expect(page.locator(`[data-corner-marker="${c.lat},${c.lon}"]`)).toHaveCount(1);
    } finally {
      for (const id of ids) await removeRecord(page.request, "property", id);
    }
  });
});
