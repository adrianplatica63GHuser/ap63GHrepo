/**
 * Case:   TC-MAP-03 — „Suprafața unei zone oarecare": un poligon desenat liber pe hartă, aria lui în el
 * Source: docs/testing/cases/TC-MAP-03.md, „Last green" 2026-10-11
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The map is opened on the invented property `TC-E2E-MAP-03 Teren` (records.ts), only so its camera is
 *     known: the drawing does not use it.
 *   - The expected area is computed here from the four clicks' pixels and the map's zoom (Web Mercator's ground
 *     scale), and held within 10 % — the case reads the number off the screen.
 *   - The picture at 1366 px goes to `playwright-report/map-area/`; the sidebar's „Recente" is painted over.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

test.use({ realMaps: true }); // TC-MAP-03 draws a polygon on the map, drags its corner and reads the area drawn in it

const MARK = `${E2E_MARKER}MAP-03`;
const CORNERS = [
  { lat: 44.3821, lon: 25.9931 },
  { lat: 44.3821, lon: 25.9935 },
  { lat: 44.3823, lon: 25.9935 },
  { lat: 44.3823, lon: 25.9931 },
];
const SHOTS = "playwright-report/map-area";
const recent = (page: Page) => page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

/** Web Mercator's ground metres per screen pixel at `zoom`, at latitude `lat` (256-pixel tiles). */
const metresPerPixel = (zoom: number, lat: number) => (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** zoom);

test.describe("TC-MAP-03 — suprafața unei zone oarecare", () => {
  test("patru clicuri, închis pe primul colț: aria; un colț tras: altă arie; apăsat din nou, dispare", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const id = await createProperty(page.request, { nickname: `${MARK} Teren`, corners: CORNERS });
    try {
      // Step 1 — the map; the new button after „Suprafața unei zone delimitate", before „Grupuri".
      await page.goto(`/properties/map?focus=${id}&z=19`);
      const map = page.locator("[data-property-map]");
      await expect(map).toHaveAttribute("data-focus-blink", "done", { timeout: 40_000 });
      const ui = page.locator("[data-map-ui]");
      const free = ui.getByRole("button", { name: "Suprafața unei zone oarecare", exact: true });
      const delimited = ui.getByRole("button", { name: "Suprafața unei zone delimitate", exact: true });
      await expect(free).toHaveAttribute("aria-pressed", "false");
      const names = await ui.locator("button").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim() ?? ""));
      const at = (n: string) => names.indexOf(n);
      expect(at("Suprafața unei zone oarecare")).toBe(at("Suprafața unei zone delimitate") + 1);
      expect(at("Suprafața unei zone oarecare")).toBeLessThan(at("Grupuri"));

      // Step 2 — „delimitate" pressed, then „oarecare": the first released, the second pressed, „Gata" shown.
      await delimited.click();
      await expect(delimited).toHaveAttribute("aria-pressed", "true");
      await free.click();
      await expect(free).toHaveAttribute("aria-pressed", "true");
      await expect(delimited).toHaveAttribute("aria-pressed", "false");
      for (const other of ["Riglă", "Grupuri"]) await expect(ui.getByRole("button", { name: other, exact: true })).toBeDisabled();
      const done = ui.getByRole("button", { name: "Gata", exact: true });
      await expect(done).toBeVisible();

      // Step 3 — three clicks, the cursor at the fourth: the area already shows (the cursor counts as a corner).
      const box = (await map.boundingBox())!;
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2 + 40;
      const pts = [
        { x: cx - 200, y: cy - 100 },
        { x: cx + 200, y: cy - 100 },
        { x: cx + 200, y: cy + 100 },
        { x: cx - 200, y: cy + 100 },
      ];
      // One click at a time, at a person's pace: two clicks inside Google's double-click window are a double click
      // to the map — it zooms, and the second click is no corner — however far apart they land. Measured: three
      // quick clicks placed two corners (run 20261011T214446Z-8955), two placed one (20261011T220959Z-1629).
      for (const [i, p] of pts.slice(0, 3).entries()) {
        await page.mouse.move(p.x, p.y);
        await page.waitForTimeout(700);
        await page.mouse.click(p.x, p.y);
        await expect(page.locator("[data-area-draw-corner]")).toHaveCount(i + 1);
      }
      await page.mouse.move(pts[3]!.x, pts[3]!.y, { steps: 5 });
      const label = page.locator("[data-area-label]");
      await expect(label).toHaveAttribute("data-area-label", "area", { timeout: 15_000 });

      // Step 4 — the fourth corner, then the first again: closed, „Gata" gone, the area of the rectangle drawn.
      await page.waitForTimeout(700);
      await page.mouse.click(pts[3]!.x, pts[3]!.y);
      await expect(page.locator("[data-area-draw-corner]")).toHaveCount(4);
      const first = page.locator('[data-area-draw-corner="0"]');
      const fb = (await first.boundingBox())!;
      await page.waitForTimeout(700);
      await page.mouse.click(fb.x + fb.width / 2, fb.y + fb.height / 2);
      await expect(done).toHaveCount(0);
      await expect(page.locator("[data-area-draw-corner]")).toHaveCount(4);
      const zoom = Number(await map.getAttribute("data-map-zoom"));
      const center = ((await map.getAttribute("data-map-center")) ?? "").split(",").map(Number);
      const mpp = metresPerPixel(zoom, center[0] ?? 44.38);
      const expected = 400 * mpp * (200 * mpp);
      const drawn = Number(await label.getAttribute("data-area-m2"));
      expect(Math.abs(drawn - expected) / expected, `drawn ${drawn} m², expected about ${expected.toFixed(0)} m²`).toBeLessThan(0.1);
      await expect(label).toContainText(" m² (");
      await page.mouse.move(1, 1);
      await page.screenshot({ path: `${SHOTS}/free-1366.png`, mask: [recent(page)] });

      // Step 5 — the third corner dragged 100 px to the right: a larger area.
      const third = page.locator('[data-area-draw-corner="2"]');
      const tb = (await third.boundingBox())!;
      await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
      await page.mouse.down();
      await page.mouse.move(tb.x + tb.width / 2 + 50, tb.y + tb.height / 2, { steps: 5 });
      await page.mouse.move(tb.x + tb.width / 2 + 100, tb.y + tb.height / 2, { steps: 5 });
      await page.mouse.up();
      await expect
        .poll(async () => Number(await label.getAttribute("data-area-m2")), { timeout: 10_000 })
        .toBeGreaterThan(drawn * 1.05);

      // Step 6 — pressed again: released; the polygon, its corners and its area gone; the tools back.
      await free.click();
      await expect(free).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator("[data-area-draw-corner]")).toHaveCount(0);
      await expect(label).toHaveCount(0);
      await expect(ui.getByRole("button", { name: "Riglă", exact: true })).toBeEnabled();
    } finally {
      await removeRecord(page.request, "property", id);
    }
  });
});
