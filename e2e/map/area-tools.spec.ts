/**
 * Case:   TC-MAP-02 — „Suprafața unei zone delimitate": colțurile unei proprietăți alese pe hartă, aria ei în poligon
 * Source: docs/testing/cases/TC-MAP-02.md, „Last green" 2026-10-11
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The property is a rectangle drawn through the API and carries `TC-E2E-MAP-02` (records.ts). The map opens on
 *     it as „Proprietăți — Hartă" would (`?focus=<id>&z=19`, #37.38).
 *   - A corner is clicked where its red dot is drawn (`data-corner-marker`, Slice #39.07), the dot's centre — within
 *     the Ruler's 12-px snap of the corner itself.
 *   - The area is compared with the property's own, read from its GET route — the area its screen shows.
 *   - The pictures for Slice #39.07's handover go to playwright-report/map-area, invented records only; „Recente"
 *     is painted over.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

test.use({ realMaps: true }); // TC-MAP-02 clicks a property's corners on the map and reads the drawn area

const MARK = `${E2E_MARKER}MAP-02`;
const CORNERS = [
  { lat: 44.381, lon: 25.991 },
  { lat: 44.381, lon: 25.9918 },
  { lat: 44.3814, lon: 25.9918 },
  { lat: 44.3814, lon: 25.991 },
];
const SHOTS = "playwright-report/map-area";
const recent = (page: Page) => page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

async function clickCorner(page: Page, c: { lat: number; lon: number }): Promise<void> {
  const dot = page.locator(`[data-corner-marker="${c.lat},${c.lon}"]`).first();
  await expect(dot).toBeAttached({ timeout: 30_000 });
  const b = (await dot.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}

test.describe("TC-MAP-02 — suprafața unei zone delimitate", () => {
  test("colțurile proprietății alese pe rând: aria ei; celelalte unelte inactive; apăsat din nou, poligonul dispare", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const id = await createProperty(page.request, { nickname: `${MARK} Teren`, corners: CORNERS });
    try {
      const own = ((await (await page.request.get(`/api/properties/${id}`)).json()) as { property: { calculatedAreaMp: string | number | null } }).property.calculatedAreaMp;
      expect(own, "the property's own area").not.toBeNull();

      // Step 1 — the map, on the property; the new button after the Ruler and before „Grupuri".
      await page.goto(`/properties/map?focus=${id}&z=19`);
      const map = page.locator("[data-property-map]");
      await expect(map).toHaveAttribute("data-focus-blink", "done", { timeout: 40_000 });
      const ui = page.locator("[data-map-ui]");
      const button = ui.getByRole("button", { name: "Suprafața unei zone delimitate", exact: true });
      await expect(button).toHaveAttribute("aria-pressed", "false");
      const names = await ui.locator("button").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim() ?? ""));
      const at = (n: string) => names.indexOf(n);
      expect(at("Suprafața unei zone delimitate")).toBeGreaterThan(at("Riglă"));
      expect(at("Suprafața unei zone delimitate")).toBeLessThan(at("Grupuri"));

      // Step 2 — pressed: it stays pressed; the other tools are inactive.
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      for (const other of ["Riglă", "Grupuri"]) await expect(ui.getByRole("button", { name: other, exact: true })).toBeDisabled();

      // Step 3 — the four corners, in order: the polygon's area, written inside it, is the property's within 1 m².
      for (const c of CORNERS) await clickCorner(page, c);
      await expect(page.locator("[data-area-corner]")).toHaveCount(4);
      const label = page.locator("[data-area-label]");
      await expect(label).toHaveAttribute("data-area-label", "area", { timeout: 15_000 });
      const shown = Number(await label.getAttribute("data-area-m2"));
      expect(Math.abs(shown - Number(own)), `shown ${shown} m², the property's ${own} m²`).toBeLessThanOrEqual(1);
      await expect(label).toContainText(" m² (");
      await expect(label).toContainText(" ha)");
      await page.mouse.move(1, 1);
      await page.screenshot({ path: `${SHOTS}/delimited-1366.png`, mask: [recent(page)] });

      // Step 4 — Backspace takes the last corner back: three dots, a triangle's area.
      await page.keyboard.press("Backspace");
      await expect(page.locator("[data-area-corner]")).toHaveCount(3);
      const triangle = Number(await label.getAttribute("data-area-m2"));
      expect(Math.abs(triangle - Number(own) / 2)).toBeLessThanOrEqual(1);

      // Step 5 — a click with no corner near it changes nothing; a click on the map opens no InfoWindow.
      const box = (await map.boundingBox())!;
      await page.mouse.click(box.x + 40, box.y + box.height - 40);
      await expect(page.locator("[data-area-corner]")).toHaveCount(3);
      await expect(page.locator(".gm-style-iw")).toHaveCount(0);

      // Step 6 — pressed again: released, the polygon, its corners and its area gone; the tools back.
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator("[data-area-corner]")).toHaveCount(0);
      await expect(label).toHaveCount(0);
      await expect(ui.getByRole("button", { name: "Riglă", exact: true })).toBeEnabled();
    } finally {
      await removeRecord(page.request, "property", id);
    }
  });
});
