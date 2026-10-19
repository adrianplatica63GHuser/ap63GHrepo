/**
 * Case:   TC-MAP-09 — Harta unei proprietăți: colțuri mici albastre; „Hartă extinsă" arată toate proprietățile, pe
 *         aceasta în roșu, la mijloc, la aceeași mărime
 * Source: docs/testing/cases/TC-MAP-09.md, „Last green" 2026-10-19 (confirmed by two hand runs, Slice #39.94)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The two lots are drawn through the API near 45.72 N, 24.44 E, where the archive has no property, and carry
 *     `TC-E2E-MAP-09` (records.ts) — a lot of its own rather than a seed property, so the centre is known.
 *   - A corner dot is read as `[data-mini-map-dot]` (its colour and width), the neighbour's corners as
 *     `[data-corner-marker="<lat>,<lon>"]`, and the centre and zoom as `data-map-center` / `data-map-zoom` on each
 *     map's `[data-mini-map]` — where the case reads them.
 *   - The run fails on any console error or page error, as TC-MAP-01's does.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

test.use({ realMaps: true }); // TC-MAP-09 reads the corner dots, centre and zoom of the tile's map and of „Hartă extinsă"

const MARK = `${E2E_MARKER}MAP-09`;
const NICKNAME = `${MARK} Lotul de pe formular`;
// About 64 m × 44 m at 45.72° N, rounded to the five decimals they are stored with.
const rect = (lon: number) => {
  const east = Number((lon + 0.0008).toFixed(5));
  return [
    { lat: 45.72, lon },
    { lat: 45.72, lon: east },
    { lat: 45.7204, lon: east },
    { lat: 45.7204, lon },
  ];
};
const LOT = rect(24.44);
const NEIGHBOUR = rect(24.441);
const CENTER = "45.7202000,24.4404000";
const BLUE = "rgb(59, 130, 246)";
const RED = "rgb(239, 68, 68)";

const tileMap = (page: Page) => page.locator('[data-tile="map"] [data-mini-map]');
const theater = (page: Page) => page.getByRole("dialog", { name: "Hartă extinsă" });

/** Every corner dot under `scope`: its colour and its width in whole pixels. */
async function dots(page: Page, scope: string): Promise<{ color: string; width: number }[]> {
  return page.locator(`${scope} [data-mini-map-dot]`).evaluateAll((els) =>
    els.map((el) => ({ color: getComputedStyle(el).backgroundColor, width: Math.round(el.getBoundingClientRect().width) })),
  );
}

test.describe("TC-MAP-09 — harta unei proprietăți și „Hartă extinsă”", () => {
  test("colțuri mici albastre pe fișă; „Hartă extinsă” cu vecinul, lotul în roșu, la mijloc, la aceeași scară; Esc", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console.error: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    const ids: string[] = [];
    try {
      ids.push(await createProperty(page.request, { nickname: NICKNAME, corners: LOT }));
      ids.push(await createProperty(page.request, { nickname: `${MARK} Vecinul`, corners: NEIGHBOUR }));

      // Step 1 — the tile shows the lot, centred on it; each of its four corners a small blue dot.
      await page.goto(`/properties/${ids[0]}`);
      await expect(page.getByRole("heading", { name: NICKNAME })).toBeVisible({ timeout: 30_000 });
      await tileMap(page).scrollIntoViewIfNeeded();
      await expect(tileMap(page)).toHaveAttribute("data-map-zoom", /\d/, { timeout: 30_000 });
      await expect(tileMap(page)).toHaveAttribute("data-map-center", CENTER);
      const zoom = (await tileMap(page).getAttribute("data-map-zoom"))!;
      await expect.poll(() => dots(page, '[data-tile="map"]'), { timeout: 15_000 }).toEqual(LOT.map(() => ({ color: BLUE, width: 4 })));

      // Step 2 — „Hartă extinsă": centred on the lot at the tile's zoom; the lot red; „Vecinul" with its corner dots.
      await page.locator('[data-tile="map"]').getByRole("button", { name: "Hartă extinsă", exact: true }).click();
      await expect(theater(page)).toBeVisible();
      const big = theater(page).locator("[data-mini-map]");
      await expect(big).toHaveAttribute("data-map-zoom", zoom, { timeout: 30_000 });
      await expect(big).toHaveAttribute("data-map-center", CENTER);
      await expect.poll(() => dots(page, '[role="dialog"]'), { timeout: 15_000 }).toEqual(LOT.map(() => ({ color: RED, width: 4 })));
      for (const c of NEIGHBOUR)
        await expect(theater(page).locator(`[data-corner-marker="${c.lat},${c.lon}"]`)).toHaveCount(1, { timeout: 15_000 });

      // Step 3 — Esc: the full-screen map is gone; the form as it was, the tile's corners still small blue dots.
      await page.keyboard.press("Escape");
      await expect(theater(page)).toHaveCount(0);
      await expect(page.getByRole("heading", { name: NICKNAME })).toBeVisible();
      expect(await dots(page, '[data-tile="map"]')).toEqual(LOT.map(() => ({ color: BLUE, width: 4 })));
      expect(problems, "console errors and page errors during the run").toEqual([]);
    } finally {
      for (const id of ids) await removeRecord(page.request, "property", id);
    }
  });
});
