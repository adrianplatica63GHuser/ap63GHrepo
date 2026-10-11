/**
 * Case:   TC-MAP-04 — „Instrumente → Calcul suprafață": harta tuturor proprietăților, cu cele două butoane de suprafață arătate
 * Source: docs/testing/cases/TC-MAP-04.md, „Last green" 2026-10-11
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim. The pulse
 * is read as the class `ga-area-pulse` on each button (globals.css): what the eye sees is that class's animation.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - „not after four seconds" is read once, 4 s after both were seen pulsing.
 *   - The picture at 1366 px, mid-pulse, goes to `playwright-report/map-area/`; the sidebar's „Recente" is painted
 *     over, and the map draws only the archive's shapes, never a name.
 */

import { test, expect, type Page } from "../helpers/test";
import { openSection, sidebar } from "../helpers/sidebar";

test.use({ realMaps: true }); // TC-MAP-04 opens the map of all properties and reads its toolbar's two area buttons

const SHOTS = "playwright-report/map-area";
const recent = (page: Page) => page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

test.describe("TC-MAP-04 — Calcul suprafață", () => {
  test("din bara laterală: harta „Toate”, cele două butoane pulsează împreună trei secunde, niciunul apăsat", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/");
    const nav = sidebar(page);

    // Step 1 — „Instrumente" → „Calcul suprafață", right after „Calcul drum lateral".
    await openSection(page, "Instrumente");
    const item = nav.getByRole("link", { name: "Calcul suprafață", exact: true });
    await expect(item).toHaveAttribute("href", "/properties/map?area=1");
    const labels = (await nav.getByRole("link").filter({ visible: true }).allInnerTexts()).map((t) => t.trim());
    expect(labels.indexOf("Calcul suprafață")).toBe(labels.indexOf("Calcul drum lateral") + 1);
    await item.click();

    // Step 2 — the map of all properties, „Toate", the item active.
    await expect(page).toHaveURL((u) => u.pathname === "/properties/map" && u.searchParams.get("area") === "1", { timeout: 30_000 });
    await expect(page.locator("h1").filter({ visible: true }).first()).toHaveText("Toate Proprietățile", { timeout: 30_000 });
    await expect(item).toHaveAttribute("aria-current", "page");
    // „Proprietăți" is not: one active item, and its section („Domeniu") closed.
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);

    // Step 3 — both buttons pulse, at once; neither is pressed.
    const ui = page.locator("[data-map-ui]");
    const delimited = ui.getByRole("button", { name: "Suprafața unei zone delimitate", exact: true });
    const free = ui.getByRole("button", { name: "Suprafața unei zone oarecare", exact: true });
    await expect(delimited).toHaveClass(/(^|\s)ga-area-pulse(\s|$)/, { timeout: 30_000 });
    await expect(free).toHaveClass(/(^|\s)ga-area-pulse(\s|$)/);
    await expect(delimited).toHaveAttribute("aria-pressed", "false");
    await expect(free).toHaveAttribute("aria-pressed", "false");
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SHOTS}/area-calculation-1366.png`, mask: [recent(page)] });

    // Step 4 — four seconds later: settled, still not pressed, the address unchanged.
    await page.waitForTimeout(4_000);
    await expect(delimited).not.toHaveClass(/(^|\s)ga-area-pulse(\s|$)/);
    await expect(free).not.toHaveClass(/(^|\s)ga-area-pulse(\s|$)/);
    await expect(delimited).toHaveAttribute("aria-pressed", "false");
    await expect(free).toHaveAttribute("aria-pressed", "false");
    expect(new URL(page.url()).searchParams.get("area")).toBe("1");

    // Step 5 — a reload points them out again.
    await page.reload();
    await expect(ui.getByRole("button", { name: "Suprafața unei zone delimitate", exact: true })).toHaveClass(/(^|\s)ga-area-pulse(\s|$)/, { timeout: 30_000 });
  });
});
