/**
 * Case:   TC-MAP-01 — Harta proprietăților deschisă pe proprietatea de pe care vii
 * Source: docs/testing/cases/TC-MAP-01.md, „Last green" 2026-10-01 (rewritten by Slice #37.92: the
 *         address typed, the sidebar link it came from being gone)
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim, and the centre and zoom are read where the case
 * reads them: `data-map-center` / `data-map-zoom` on `[data-property-map]` and
 * on the tile's `[data-mini-map]`, and `data-focus-blink`. The address the map
 * went to is read from Playwright's `framenavigated` events, which fire for a
 * history push as for a load, because the map removes it from the address bar
 * as soon as it arrives. (Not by patching `history.pushState` in an init
 * script: the first run did, and Next's dev overlay counted an issue.)
 *
 * The run fails on any console error or page error — the dev overlay's
 * „Issue" badge is exactly that, and a picture is not where to find one.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - „Poreclă" is `TC-E2E-MAP-01 Teren pe hartă` (e2e/helpers/records.ts).
 *   - The zoom is compared with the tile's at run time rather than with the
 *     case's 19: the case measured 19 at 1920 px, and the runner's window is
 *     the same width only because this spec sets it.
 *   - A blink on a Google map is not asserted pixel by pixel: the case's
 *     `data-focus-blink` goes `on` and then `done`, and the pictures show it.
 *   - Slice #37.38's pictures, not a step of the case: the form with its tile,
 *     the map mid-blink and the map after it, at 1920 px, into
 *     `playwright-report/map-focus/`. The sidebar's „Recente" list is painted
 *     over, as it may name the archive's own records.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";

const MARK = `${E2E_MARKER}MAP-01`;
const NICKNAME = `${MARK} Teren pe hartă`;
const CORNERS = [
  { lat: 44.37, lon: 25.98 },
  { lat: 44.37, lon: 25.9808 },
  { lat: 44.3704, lon: 25.9808 },
  { lat: 44.3704, lon: 25.98 },
];
const CENTER = "44.3702000,25.9804000";
const SHOTS = "playwright-report/map-focus";

const bigMap = (page: Page) => page.locator("[data-property-map]");
const tileMap = (page: Page) => page.locator('[data-tile="map"] [data-mini-map]');
/** Every address the page went to since the last `clear`, path and query only. */
function navigations(page: Page) {
  let seen: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      const u = new URL(frame.url());
      seen.push(u.pathname + u.search);
    }
  });
  return { list: () => seen.slice(), clear: () => void (seen = []) };
}
const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

async function openProperty(page: Page, id: string): Promise<string> {
  await page.goto(`/properties/${id}`);
  await expect(page.getByRole("heading", { name: NICKNAME })).toBeVisible({ timeout: 30_000 });
  await expect(tileMap(page)).toHaveAttribute("data-map-zoom", /\d/, { timeout: 30_000 });
  return (await tileMap(page).getAttribute("data-map-zoom"))!;
}

/** The map opened on the property: the address it was sent, then gone; centre, zoom, blink. */
async function expectFocused(
  page: Page,
  nav: ReturnType<typeof navigations>,
  id: string,
  zoom: string,
  shoot = false,
): Promise<void> {
  await expect(bigMap(page)).toHaveAttribute("data-focus-blink", "on", { timeout: 30_000 });
  if (shoot) {
    await page.waitForTimeout(250); // the first cycle's peak is at 0.4 s
    await page.screenshot({ path: `${SHOTS}/02-map-blink-1920.png`, mask: [recent(page)] });
  }
  await expect(bigMap(page)).toHaveAttribute("data-focus-blink", "done", { timeout: 10_000 });
  expect(nav.list()).toContain(`/properties/map?focus=${id}&z=${zoom}`);
  await expect(page).toHaveURL(/\/properties\/map$/);
  await expect(bigMap(page)).toHaveAttribute("data-map-center", CENTER);
  await expect(bigMap(page)).toHaveAttribute("data-map-zoom", zoom);
  if (shoot) await page.screenshot({ path: `${SHOTS}/03-map-after-1920.png`, mask: [recent(page)] });
}

/**
 * Every console error fails the run. Until FU-275 the headless runner's „Attempted
 * to load a Vector Map, but failed. Falling back to Raster." was let through by
 * name; the maps now ask for raster up front where there is no WebGL 2
 * (`src/lib/ui/map-rendering.ts`), so there is no such message to allow.
 */

test.describe("TC-MAP-01 — Harta proprietăților deschisă pe proprietatea de pe care vii", () => {
  test("harta se deschide pe proprietate, la scara hărții ei, și o face să clipească", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const nav = navigations(page);
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") problems.push(`console.error: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    const id = await createProperty(page.request, { nickname: NICKNAME, corners: CORNERS });
    try {
      // Step 1 — the tile shows the rectangle, centred on it.
      const zoom = await openProperty(page, id);
      await expect(tileMap(page)).toHaveAttribute("data-map-center", CENTER);
      await page.screenshot({ path: `${SHOTS}/01-form-1920.png`, mask: [recent(page)] });

      // Step 2 — the address the sidebar's „Proprietăți — Hartă" used to send (#37.92: FU-306).
      nav.clear();
      await page.goto(`/properties/map?focus=${id}&z=${zoom}`);
      await expectFocused(page, nav, id, zoom, true);

      // Step 3 — a reload is the ordinary map.
      await page.reload();
      await expect(bigMap(page)).toHaveAttribute("data-map-zoom", /\d/, { timeout: 30_000 });
      await expect(bigMap(page)).not.toHaveAttribute("data-focus-blink", /.*/);
      expect(await bigMap(page).getAttribute("data-map-center")).not.toBe(CENTER);

      // Step 4 — „Proprietăți", then „Hartă completă": the ordinary map.
      await openFromSidebar(page, "Proprietăți");
      await expect(page).toHaveURL(/\/properties$/);
      nav.clear();
      await page.getByRole("button", { name: "Hartă completă", exact: true }).click();
      await expect(bigMap(page)).toHaveAttribute("data-map-zoom", /\d/, { timeout: 30_000 });
      expect(nav.list()).toEqual(["/properties/map"]);
      await expect(bigMap(page)).not.toHaveAttribute("data-focus-blink", /.*/);
      expect(problems, "console errors and page errors during the run").toEqual([]);
    } finally {
      // The case's own cleanup: the property, through the route „Șterge" → „Da" calls.
      await removeRecord(page.request, "property", id);
    }
  });
});
