/**
 * Case:   TC-MAP-11 — „Caută pe hartă": un singur loc, găsit și arătat la mijloc, după un zbor de 4 secunde
 * Source: docs/testing/cases/TC-MAP-11.md (Slice 41.70)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The two lots are drawn through the API near 45.76 N, 24.48 E and 45.78 N, 24.52 E, where the archive has no
 *     property, and carry `TC-E2E-MAP-11` (records.ts). The map opens on the first as „Proprietăți — Hartă" would
 *     (`?focus=<id>&z=15`).
 *   - A property's number is read from the map's own data (GET /api/properties/map), as the box reads it.
 *   - The flight is read from `data-map-search-flight` on the map's box, and the landed lot from its four corner dots
 *     (`data-corner-marker`), whose box is the lot's.
 *   - No address is looked up (no `realAddressLookups`): that branch is jest's and the hand check's.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

test.use({ realMaps: true }); // TC-MAP-11 flies the real map and reads where the lot lands

const MARK = `${E2E_MARKER}MAP-11`;
const ONE = `${MARK} Lotul unu`;
const TWO = `${MARK} Lotul doi`;
// About 64 m × 44 m, rounded to the five decimals they are stored with.
const rect = (lat: number, lon: number) => {
  const north = Number((lat + 0.0004).toFixed(5));
  const east = Number((lon + 0.0008).toFixed(5));
  return [
    { lat, lon },
    { lat, lon: east },
    { lat: north, lon: east },
    { lat: north, lon },
  ];
};
const LOT_ONE = rect(45.76, 24.48);
const LOT_TWO = rect(45.78, 24.52);

const bigMap = (page: Page) => page.locator("[data-property-map]");

/** Searches `text` in the box and waits for the flight to land. */
async function search(page: Page, text: string): Promise<void> {
  await page.locator("button[data-map-search-button]").click();
  const box = page.locator("[data-map-search]");
  await expect(box).toBeVisible();
  await box.locator("input[data-map-search-input]").fill(text);
  await box.locator("input[data-map-search-input]").press("Enter");
  // The box closes on a find with no other matches; the map flies for four seconds, then lands.
  await expect(box).toHaveCount(0, { timeout: 15_000 });
  await expect(bigMap(page)).toHaveAttribute("data-map-search-flight", "flying", { timeout: 5_000 });
  const flewFrom = Date.now();
  await expect(bigMap(page)).toHaveAttribute("data-map-search-flight", "landed", { timeout: 15_000 });
  expect(Date.now() - flewFrom, "the flight takes about four seconds").toBeGreaterThan(2_500);
}

/** Where the lot landed: its corner dots' box against the map's, as shares of the map. */
async function landed(page: Page, corners: { lat: number; lon: number }[]): Promise<{ dx: number; dy: number; share: number }> {
  for (const c of corners) await expect(page.locator(`[data-corner-marker="${c.lat},${c.lon}"]`)).toHaveCount(1, { timeout: 15_000 });
  return page.evaluate((cs) => {
    const map = (document.querySelector("[data-property-map]") as HTMLElement).getBoundingClientRect();
    const rs = cs.map((c) => (document.querySelector(`[data-corner-marker="${c.lat},${c.lon}"]`) as HTMLElement).getBoundingClientRect());
    const xs = rs.map((r) => r.left + r.width / 2);
    const ys = rs.map((r) => r.top + r.height / 2);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    return {
      dx: Math.abs(cx - (map.left + map.width / 2)) / map.width,
      dy: Math.abs(cy - (map.top + map.height / 2)) / map.height,
      share: Math.max(w / map.width, h / map.height),
    };
  }, corners);
}

test.describe("TC-MAP-11 — „Caută pe hartă”", () => {
  test("numărul și porecla zboară la lot, la mijloc, la o zecime din hartă; linkul deschide „Căutare globală”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    try {
      ids.push(await createProperty(page.request, { nickname: ONE, corners: LOT_ONE }));
      ids.push(await createProperty(page.request, { nickname: TWO, corners: LOT_TWO }));
      const res = await page.request.get("/api/properties/map");
      expect(res.ok(), `GET /api/properties/map: ${res.status()}`).toBeTruthy();
      const { items } = (await res.json()) as { items: { id: string; code: string }[] };
      const codeOf = (id: string) => items.find((p) => p.id === id)?.code ?? "";
      const numberTwo = String(Number(codeOf(ids[1]).replace(/^PROP/, "")));
      expect(numberTwo).toMatch(/^[1-9]\d*$/);

      // Step 1 — the magnifier opens the box, its message above the field, „Căutarea globală" a link.
      await page.goto(`/properties/map?focus=${ids[0]}&z=15`);
      await expect(bigMap(page)).toHaveAttribute("data-focus-blink", "done", { timeout: 40_000 });
      const button = page.getByRole("button", { name: "Caută pe hartă", exact: true });
      await expect(button).toBeVisible();
      await button.click();
      const box = page.locator("[data-map-search]");
      await expect(box.locator("[data-map-search-intro]")).toHaveText(
        "Această căutare găsește un singur loc: o adresă, un nume de pe hartă sau numărul unei proprietăți. Pentru mai multe proprietăți deodată, folosiți Căutarea globală.",
      );
      await expect(box.getByRole("link", { name: "Căutarea globală", exact: true })).toHaveAttribute("href", "/admin/global-search");
      await page.keyboard.press("Escape");
      await expect(box).toHaveCount(0);

      // Step 2 — „Lotul doi"'s number: it lands in the middle, at about a tenth of the map.
      await search(page, numberTwo);
      let at = await landed(page, LOT_TWO);
      expect(at.dx, "centred across").toBeLessThanOrEqual(0.05);
      expect(at.dy, "centred down").toBeLessThanOrEqual(0.05);
      expect(at.share, "a tenth of the map").toBeGreaterThanOrEqual(0.07);
      expect(at.share, "a tenth of the map").toBeLessThanOrEqual(0.13);

      // Step 3 — „Lotul unu"'s nickname: the same.
      await search(page, ONE);
      at = await landed(page, LOT_ONE);
      expect(at.dx).toBeLessThanOrEqual(0.05);
      expect(at.dy).toBeLessThanOrEqual(0.05);
      expect(at.share).toBeGreaterThanOrEqual(0.07);
      expect(at.share).toBeLessThanOrEqual(0.13);

      // Step 4 — „Căutarea globală" opens the global search.
      await button.click();
      await page.locator("[data-map-search]").getByRole("link", { name: "Căutarea globală", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/global-search/, { timeout: 30_000 });
    } finally {
      for (const id of ids) await removeRecord(page.request, "property", id);
    }
  });
});
