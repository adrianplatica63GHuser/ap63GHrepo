/**
 * Case:   TC-PROP-09 — „Hartă": desenarea și harta extinsă pe rândul de sus; harta extinsă se închide și păstrează desenul
 * Source: docs/testing/cases/TC-PROP-09.md, „Last green" 2026-10-05 (steps 1–3 follow Slice #38.09)
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim; an icon is read as the case reads it, the Lucide
 * class on the button's <svg>.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The property carries `TC-E2E-PROP-09` (records.ts): „Poreclă"
 *     `TC-E2E-PROP-09 Teren`, the case's three corners.
 *   - „Hartă" and „Puncte de contur" are ticked through `showTile`.
 *   - The hand run pressed the buttons by script (FU-290); here it is
 *     Playwright's real mouse throughout, and the map click lands on the
 *     full-screen map's top-left quarter, away from the triangle at its centre.
 *   - The full-screen map is read through its „Restrânge": the dialog's own
 *     element has no box (its children are fixed), so it never reads visible.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PROP-09`;
const PROPERTY = `${MARK} Teren`;
const CORNERS = [
  { lat: 44.37, lon: 25.98 },
  { lat: 44.3702, lon: 25.9806 },
  { lat: 44.3697, lon: 25.9808 },
];

async function iconOf(button: Locator): Promise<string> {
  const cls = (await button.locator("svg").first().getAttribute("class")) ?? "";
  return cls.split(" ").find((c) => c.startsWith("lucide-") && c !== "lucide") ?? "";
}

/** The map's top row: the three controls on one line, left to right, at the map's top right. */
async function expectTopRow(map: Locator, names: readonly string[]): Promise<void> {
  const box = await map.locator("[data-mini-map]").boundingBox();
  const row = await map.locator("[data-map-top-row]").boundingBox();
  expect(box && row).toBeTruthy();
  expect(box!.x + box!.width - (row!.x + row!.width)).toBeLessThanOrEqual(16);
  expect(row!.y - box!.y).toBeLessThanOrEqual(16);
  const centres: number[] = [];
  const lefts: number[] = [];
  for (const name of names) {
    const b = await map.getByRole("button", { name, exact: true }).boundingBox();
    centres.push(b!.y + b!.height / 2);
    lefts.push(b!.x);
  }
  for (const c of centres) expect(Math.abs(c - centres[0])).toBeLessThanOrEqual(2);
  expect([...lefts].sort((a, b) => a - b)).toEqual(lefts);
}

async function noButtonBottomLeft(map: Locator): Promise<void> {
  const box = (await map.locator("[data-mini-map]").boundingBox())!;
  for (const b of await map.locator("button").all()) {
    const r = await b.boundingBox();
    if (!r) continue;
    expect(r.y + r.height > box.y + box.height - 60 && r.x < box.x + 60).toBe(false);
  }
}

function fullScreen(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Hartă extinsă" });
  return { dialog, restore: dialog.getByRole("button", { name: "Restrânge", exact: true }) };
}

test.describe("TC-PROP-09 — „Hartă”: rândul de sus și harta extinsă", () => {
  test("trei butoane pe un rând sus în dreapta; harta extinsă se deschide, se închide și păstrează desenul", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    let id: string | undefined;
    try {
      id = await createProperty(page.request, { nickname: PROPERTY, corners: CORNERS });

      // Step 1 — 1920: „Hartă extinsă" (Maximize), „Desenează" (PenTool), „HARTĂ" „SATELIT", on one line, top right.
      await page.goto(`/properties/${id}`);
      await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });
      const corners = await showTile(page, "Puncte de contur");
      const map = await showTile(page, "Hartă");
      const open = map.getByRole("button", { name: "Hartă extinsă", exact: true });
      await expect(open).toBeVisible({ timeout: 30_000 });
      expect(await iconOf(open)).toBe("lucide-maximize");
      expect(await iconOf(map.getByRole("button", { name: "Desenează", exact: true }))).toBe("lucide-pen-tool");
      await expectTopRow(map, ["Hartă extinsă", "Desenează", "Arată Unghiuri", "HARTĂ", "SATELIT"]);
      await noButtonBottomLeft(map);
      await expect(corners.getByRole("button", { name: "Hartă extinsă", exact: true })).toHaveCount(0);
      // Slice #38.09: the corners tile keeps only „+ Adaugă punct"; the angles toggle is the map's.
      expect(await iconOf(map.getByRole("button", { name: "Arată Unghiuri", exact: true }))).toBe("lucide-drafting-compass");
      for (const gone of ["Arată Unghiuri", "Arată Street View", "Ascunde Street View"]) {
        await expect(corners.getByRole("button", { name: gone, exact: true })).toHaveCount(0);
      }

      // Step 2 — 1366: the same three, on one line at the top right.
      await page.setViewportSize({ width: 1366, height: 900 });
      await map.scrollIntoViewIfNeeded();
      await expectTopRow(map, ["Hartă extinsă", "Desenează", "Arată Unghiuri", "HARTĂ", "SATELIT"]);

      // Step 3 — „Hartă extinsă": the full-screen map, „Restrânge" (Minimize), „Desenează" and the toggle, no second door.
      await open.click();
      const big = fullScreen(page);
      await expect(big.restore).toBeVisible();
      expect(await iconOf(big.restore)).toBe("lucide-minimize");
      await expectTopRow(big.dialog, ["Desenează", "Arată Unghiuri", "HARTĂ", "SATELIT"]);
      await expect(big.dialog.getByRole("button", { name: "Hartă extinsă", exact: true })).toHaveCount(0);

      // Step 4 — „Restrânge": gone; the tile's map in place.
      await big.restore.click();
      await expect(big.restore).toHaveCount(0);
      await expect(map.locator("[data-mini-map]")).toBeVisible();

      // Step 5 — „Hartă extinsă", then Escape.
      await open.click();
      await expect(big.restore).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(big.restore).toHaveCount(0);

      // Step 6 — full screen, „Desenează", one click away from the triangle, „Gata", „Restrânge": four corners.
      await open.click();
      await expect(big.restore).toBeVisible();
      await big.dialog.getByRole("button", { name: "Desenează", exact: true }).click();
      const done = big.dialog.getByRole("button", { name: "Gata", exact: true });
      await expect(done).toBeVisible();
      await expect(big.dialog.locator("[data-map-draw-hint]")).toBeVisible();
      const area = (await big.dialog.locator("[data-mini-map]").boundingBox())!;
      // The map needs its tiles before a click is a map click.
      await page.waitForTimeout(1500);
      await page.mouse.click(area.x + area.width * 0.2, area.y + area.height * 0.4);
      await done.click();
      await big.restore.click();
      await expect(big.restore).toHaveCount(0);
      await expect(corners.locator("tbody tr")).toHaveCount(4);
    } finally {
      // At the end — nothing saved; the property deleted.
      if (id) await removeRecord(page.request, "property", id);
    }
  });
});
