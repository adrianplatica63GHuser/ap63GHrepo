/**
 * Case:   TC-MAP-04 — O legătură veche `?area=1`: harta tuturor proprietăților, cu cele două butoane de suprafață arătate
 * Source: docs/testing/cases/TC-MAP-04.md, „Last green" 2026-10-18
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim. The pulse
 * is read as the class `ga-area-pulse` around each button (globals.css; IconButton puts a class on the button's
 * tooltip wrapper): what the eye sees is that class's animation.
 *
 * No real maps (Slice #39.78): the buttons and their pulse are the toolbar's, drawn whether or not Google's map
 * loads, so this spec loads none.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - „not after four seconds" is read once, 4 s after both were seen pulsing.
 */

import { test, expect } from "../helpers/test";
import { openSection, sidebar } from "../helpers/sidebar";

test.describe("TC-MAP-04 — o legătură veche ?area=1", () => {
  test("harta „Toate”, cele două butoane de suprafață pulsează împreună trei secunde, niciunul apăsat", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const nav = sidebar(page);

    // Step 1 — the old address: the map of all properties, „Proprietăți" the active item, no „Calcul suprafață".
    await page.goto("/properties/map?area=1");
    await expect(page.locator("h1").filter({ visible: true }).first()).toHaveText("Toate Proprietățile", { timeout: 30_000 });
    await expect(nav.locator('[aria-current="page"]')).toHaveText("Proprietăți");
    await openSection(page, "Instrumente");
    await expect(nav.getByText("Calcul suprafață", { exact: true })).toHaveCount(0);

    // Step 2 — both area buttons pulse, at once, and nothing else does; neither is pressed.
    const ui = page.locator("[data-map-ui]");
    const delimited = ui.getByRole("button", { name: "Suprafața unei zone delimitate", exact: true });
    const free = ui.getByRole("button", { name: "Suprafața unei zone oarecare", exact: true });
    const pulsing = ui.locator(".ga-area-pulse");
    await expect(pulsing).toHaveCount(2, { timeout: 30_000 });
    // `has` is read inside each wrapper, so the buttons are named from there, not through [data-map-ui].
    await expect(pulsing.filter({ has: page.getByRole("button", { name: "Suprafața unei zone delimitate", exact: true }) })).toHaveCount(1);
    await expect(pulsing.filter({ has: page.getByRole("button", { name: "Suprafața unei zone oarecare", exact: true }) })).toHaveCount(1);
    await expect(delimited).toHaveAttribute("aria-pressed", "false");
    await expect(free).toHaveAttribute("aria-pressed", "false");

    // Step 3 — four seconds later: settled, still not pressed, the address unchanged.
    await page.waitForTimeout(4_000);
    await expect(pulsing).toHaveCount(0);
    await expect(delimited).toHaveAttribute("aria-pressed", "false");
    await expect(free).toHaveAttribute("aria-pressed", "false");
    expect(new URL(page.url()).searchParams.get("area")).toBe("1");

    // Step 4 — a reload points them out again.
    await page.reload();
    await expect(pulsing).toHaveCount(2, { timeout: 30_000 });
  });
});
