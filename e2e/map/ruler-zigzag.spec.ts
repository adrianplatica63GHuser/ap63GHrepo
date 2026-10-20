/**
 * Case:   TC-MAP-10 — Rigla hărții măsoară un zigzag: un punct la fiecare clic, ultimul punct apăsat din nou termină,
 *         fiecare latură „x din y"
 * Source: docs/testing/cases/TC-MAP-10.md, „Last green" 2026-10-20 (confirmed by two hand runs, Slice 40.07)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The five points are fixed fractions of the map's box, on open ground at the map's opening zoom, so they never
 *     fall on a drop or a corner; a click is a mouse press and release, as the ruler's own listeners read it.
 *   - The labels are read as `[data-ruler-label]` (segment / live).
 *   - The run fails on any console error or page error, as TC-MAP-01's does.
 */

import { test, expect, type Page } from "../helpers/test";

test.use({ realMaps: true }); // TC-MAP-10 clicks points on the map and reads the ruler's labels drawn on it

const POINTS = [
  [0.1, 0.8],
  [0.25, 0.7],
  [0.4, 0.8],
  [0.55, 0.7],
  [0.7, 0.8],
] as const;

const metres = (s: string): number[] => [...s.matchAll(/(\d+\.\d{2}) m/g)].map((m) => Number(m[1]));

async function clickAt(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(400);
}

test.describe("TC-MAP-10 — rigla în zigzag", () => {
  test("cinci puncte, al cincilea din nou: patru laturi „… din …” cu același total, suma lor; încă un clic șterge", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 900 });
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console.error: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

    // Step 1 — the map; „Riglă" pressed, its hint.
    await page.goto("/properties/map");
    const map = page.locator("[data-property-map]");
    await expect(map.locator(".gm-style")).toBeAttached({ timeout: 40_000 });
    const ui = page.locator("[data-map-ui]");
    const ruler = ui.getByRole("button", { name: "Riglă", exact: true });
    await ruler.click();
    await expect(ruler).toHaveAttribute("aria-pressed", "true");
    await expect(ui.getByText("Riglă — apasă punctele pe rând; apasă din nou ultimul punct ca să termini")).toBeAttached();
    const zoom = await map.getAttribute("data-map-zoom");

    // Step 2 — five points: four segments, each its own length; by the cursor „+ … m · total … m".
    const box = (await map.boundingBox())!;
    const at = ([fx, fy]: readonly [number, number]) => [box.x + fx * box.width, box.y + fy * box.height] as const;
    for (const p of POINTS) await clickAt(page, ...at(p));
    const segments = page.locator('[data-ruler-label="segment"]');
    await expect(segments).toHaveCount(4, { timeout: 15_000 });
    for (const text of await segments.allTextContents()) expect(text).toMatch(/^\d+\.\d{2} m$/);
    await expect(page.locator('[data-ruler-label="live"]')).toHaveText(/^\+ \d+\.\d{2} m · total \d+\.\d{2} m$/);

    // Step 3 — the fifth again: no new point, the map not zoomed, four „… m din … m", one total, their sum.
    await clickAt(page, ...at(POINTS[4]));
    await expect(page.locator('[data-ruler-label="live"]')).toHaveCount(0);
    await expect(segments).toHaveCount(4);
    const texts = await segments.allTextContents();
    for (const text of texts) expect(text).toMatch(/^\d+\.\d{2} m din \d+\.\d{2} m$/);
    const parts = texts.map(metres);
    const totals = new Set(parts.map((p) => p[1]));
    expect(totals.size, `one total on all four: ${texts.join(" | ")}`).toBe(1);
    const sum = parts.reduce((s, p) => s + p[0], 0);
    expect(Math.abs(sum - parts[0][1]), `${sum} against ${parts[0][1]}`).toBeLessThanOrEqual(0.01 * parts.length);
    await expect(map).toHaveAttribute("data-map-zoom", zoom ?? "");

    // Step 4 — once more: the zigzag and its labels gone; „Riglă" released.
    await clickAt(page, box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator("[data-ruler-label]")).toHaveCount(0);
    await expect(ruler).toHaveAttribute("aria-pressed", "false");

    expect(problems).toEqual([]);
  });
});
