/**
 * Case:   TC-MAP-08 — „Instrumente": trei ghiduri ale butoanelor hărții; „OK" deschide harta cu butoanele lor clipind
 * Source: docs/testing/cases/TC-MAP-08.md, „Last green" 2026-10-18
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim. The pulse
 * is read as the class `ga-area-pulse` around each button (globals.css; IconButton puts a class on the button's
 * tooltip wrapper), the gaps as the distance between a box and the one before it in the toolbar's row.
 *
 * No real maps: the boxes, the toolbar and its pulse draw whether or not Google's map loads, so this spec loads none.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - „settled after four seconds" is read once, 4 s after the set was seen pulsing.
 *   - The boxes are photographed at 1366 px into `playwright-report/map-guides/`; the sidebar's „Recente" is painted
 *     over.
 */

import fs from "node:fs";
import { test, expect, type Locator, type Page } from "../helpers/test";
import { openSection, sidebar } from "../helpers/sidebar";

const SHOTS = "playwright-report/map-guides";
const recent = (page: Page) => page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

const MEASURE = ["Unghiuri", "Riglă", "Suprafața unei zone delimitate", "Suprafața unei zone oarecare"];
const GROUPS = ["Tarlale", "Grupuri", "Selectează"];
const ALL_TOOLS = [...MEASURE, ...GROUPS];

async function openGuide(page: Page, name: string): Promise<Locator> {
  await openSection(page, "Instrumente");
  await sidebar(page).getByRole("button", { name, exact: true }).click();
  const box = page.getByRole("dialog", { name, exact: true });
  await expect(box).toBeVisible();
  return box;
}

async function rowNames(box: Locator): Promise<string[]> {
  return (await box.locator("[data-map-guide-row] .font-medium").allInnerTexts()).map((t) => t.trim());
}

/** The set pulsing: exactly these buttons carry the class, and none is pressed. */
async function expectPulsing(page: Page, names: string[]): Promise<void> {
  const ui = page.locator("[data-map-ui]");
  const pulsing = ui.locator(".ga-area-pulse");
  await expect(pulsing).toHaveCount(names.length, { timeout: 30_000 });
  for (const name of ALL_TOOLS) {
    const wrapped = pulsing.filter({ has: page.getByRole("button", { name, exact: true }) });
    await expect(wrapped).toHaveCount(names.includes(name) ? 1 : 0);
  }
  for (const name of names) {
    const button = ui.getByRole("button", { name, exact: true });
    const pressed = await button.getAttribute("aria-pressed");
    expect([name, pressed === "true"]).toEqual([name, false]);
  }
}

/** The gap, in px, between a toolbar box and the box before it in the row. */
async function gapBefore(box: Locator): Promise<number> {
  return box.evaluate((el) => {
    const prev = el.previousElementSibling as HTMLElement | null;
    if (!prev) return -1;
    return Math.round(el.getBoundingClientRect().left - prev.getBoundingClientRect().right);
  });
}

test.describe("TC-MAP-08 — ghidurile din „Instrumente”", () => {
  test.beforeAll(() => {
    fs.mkdirSync(SHOTS, { recursive: true });
  });

  test("„Măsurători pe hartă” și „Grupări de proprietăți”: caseta, apoi harta cu butoanele lor clipind; „Navigare” doar se închide", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/admin/settings");
    const nav = sidebar(page);

    // Step 1 — „Instrumente": the two links, then the three guides; no „Calcul suprafață".
    await openSection(page, "Instrumente");
    expect((await nav.locator("[data-nav-guide]").filter({ visible: true }).allInnerTexts()).map((t) => t.trim())).toEqual([
      "Măsurători pe hartă", "Grupări de proprietăți", "Navigare",
    ]);
    await expect(nav.getByText("Calcul suprafață", { exact: true })).toHaveCount(0);

    // Step 2 — the measuring box: four rows, each with the map's button, and the sentence about OK.
    let box = await openGuide(page, "Măsurători pe hartă");
    expect(await rowNames(box)).toEqual(MEASURE);
    await expect(box.locator("[data-map-guide-button] svg")).toHaveCount(4);
    await expect(box.getByText("La OK se deschide harta tuturor proprietăților, cu aceste butoane clipind.", { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/measure-1366.png`, mask: [recent(page)] });

    // Step 3 — OK: the map, ?pulse=measure, the four pulsing and no other.
    await box.getByRole("button", { name: "OK", exact: true }).click();
    await expect(box).toHaveCount(0);
    await expect(page).toHaveURL((u) => u.pathname === "/properties/map" && u.searchParams.get("pulse") === "measure", { timeout: 30_000 });
    await expect(page.locator("h1").filter({ visible: true }).first()).toHaveText("Toate Proprietățile", { timeout: 30_000 });
    await expectPulsing(page, MEASURE);

    // Step 4 — four seconds later: settled.
    await page.waitForTimeout(4_000);
    await expect(page.locator("[data-map-ui] .ga-area-pulse")).toHaveCount(0);

    // Step 5 — the two wider gaps: before „Tarlale" and before „Setări hartă", twice the row's.
    const ui = page.locator("[data-map-ui]");
    const wrapperOf = (name: string) => ui.locator(":scope > *").filter({ has: page.getByRole("button", { name, exact: true }) });
    const ordinary = await gapBefore(wrapperOf("Suprafața unei zone oarecare"));
    expect(ordinary).toBe(8);
    expect(await gapBefore(wrapperOf("Tarlale"))).toBe(2 * ordinary);
    expect(await gapBefore(wrapperOf("Grupuri"))).toBe(ordinary);
    expect(await gapBefore(wrapperOf("Setări hartă"))).toBe(2 * ordinary);

    // Step 6 — the groupings box: three rows, „Selectează" putting the selection into a group, deleting nothing.
    box = await openGuide(page, "Grupări de proprietăți");
    expect(await rowNames(box)).toEqual(GROUPS);
    await expect(box.locator('[data-map-guide-row="select"]')).toContainText("„Adaugă la grup…”");
    await expect(box.locator('[data-map-guide-row="select"]')).toContainText("Nu șterge nimic.");
    await page.screenshot({ path: `${SHOTS}/groups-1366.png`, mask: [recent(page)] });

    // Step 7 — OK: ?pulse=groups, the three pulsing and no other.
    await box.getByRole("button", { name: "OK", exact: true }).click();
    await expect(page).toHaveURL((u) => u.pathname === "/properties/map" && u.searchParams.get("pulse") === "groups", { timeout: 30_000 });
    await expectPulsing(page, GROUPS);

    // Step 8 — settled; the box again, OK on the same address: the three pulse again.
    await page.waitForTimeout(4_000);
    await expect(page.locator("[data-map-ui] .ga-area-pulse")).toHaveCount(0);
    box = await openGuide(page, "Grupări de proprietăți");
    await box.getByRole("button", { name: "OK", exact: true }).click();
    await expectPulsing(page, GROUPS);

    // Step 9 — „Navigare": one row, „Navighează", where it is.
    const before = page.url();
    box = await openGuide(page, "Navigare");
    expect(await rowNames(box)).toEqual(["Navighează"]);
    await expect(box.locator('[data-map-guide-row="navigate"]')).toContainText("fișa proprietății");
    await expect(box.locator('[data-map-guide-row="navigate"]')).toContainText("clic pe o proprietate pe harta tuturor proprietăților");
    await page.screenshot({ path: `${SHOTS}/navigation-1366.png`, mask: [recent(page)] });

    // Step 10 — OK closes it; nothing else changes.
    await box.getByRole("button", { name: "OK", exact: true }).click();
    await expect(box).toHaveCount(0);
    expect(page.url()).toBe(before);
  });
});
