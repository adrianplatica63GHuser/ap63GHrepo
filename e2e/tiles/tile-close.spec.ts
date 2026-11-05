/**
 * Case:   TC-TILES-29 — Un X în colțul fiecărui panou: „Închide — <panou>" îl ascunde ca „Panouri"
 * Source: docs/testing/cases/TC-TILES-29.md, „Last green" 2026-11-05
 *
 * Slice 41.91. An invented person (created through the route, removed at the end), at 1920 × 1080; then the dashboard
 * and „Grupuri", on what they show. Each tile closed is ticked back, and the dashboard and „Grupuri" are put back with
 * „Implicit". Maps are blocked by default: no map, no Street View, no address look-up.
 */
import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { openTiles, closeTiles, pressTileButton, showTile, tileBox, tilesMenuButton } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-29`;

const box = async (l: Locator) => (await l.boundingBox())!;

/** The X of tile `name`, and the tile. */
const xOf = (page: Page, name: string) => page.getByRole("region", { name, exact: true }).getByRole("button", { name: `Închide — ${name}`, exact: true });

/** How many of „Panouri"'s boxes are ticked. */
async function ticked(page: Page): Promise<number> {
  return page.getByRole("group", { name: "Părți afișate", includeHidden: true }).getByRole("checkbox", { checked: true, includeHidden: true }).count();
}

test.describe("TC-TILES-29 — „Închide — <panou>”", () => {
  test("pe ecranul unei persoane: X-ul în colț, „Editează” în stânga lui; apăsat, panoul pleacă și „Panouri” îl debifează; înapoi bifat; nu în editare; nu pe ultimul", async ({ page }) => {
    test.setTimeout(180_000);
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    let person: string | null = null;
    try {
      person = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Colț" });
      await page.goto(`/natural-persons/${person}`);
      const identity = page.getByRole("region", { name: "Identitate", exact: true });
      await expect(identity.locator("[data-tile-edit]")).toBeVisible({ timeout: 30_000 });

      // Step 1 — „Identitate" at rest: the X in the corner, „Editează" 8 px to its left, on its line.
      const x = xOf(page, "Identitate");
      await expect(x).toBeVisible({ timeout: 15_000 });
      await expect(x).toHaveAttribute("data-tile-close", "identity");
      // Polled: the X is drawn a tick after the tile (the screen's choice registers, then its button loads).
      const corner = async () => {
        const [xb, pb, tb] = [await box(x), await box(identity.locator("[data-tile-edit]")), await box(identity)];
        const penGap = Math.round(xb.x - (pb.x + pb.width));
        const level = Math.round(xb.y - pb.y);
        const square = Math.round(tb.x + tb.width - (xb.x + xb.width) - (xb.y - tb.y));
        return Math.abs(penGap - 8) <= 1 && Math.abs(level) <= 1 && Math.abs(square) <= 1 ? "in the corner" : JSON.stringify({ penGap, level, square });
      };
      await expect.poll(corner, { timeout: 10_000 }).toBe("in the corner");
      const [xb, pb] = [await box(x), await box(identity.locator("[data-tile-edit]"))];
      // „Renunță"'s icon, „Editează"'s size.
      expect(await x.locator("svg").getAttribute("class")).toMatch(/lucide-x\b/);
      expect(Math.round(xb.height)).toBe(Math.round(pb.height));

      // Step 2 — pressed: the tile goes, its box in „Panouri" unticked, the focus on „Panouri".
      const before = await ticked(page);
      await x.click();
      await expect(identity).toBeHidden();
      await expect(tileBox(page, "Identitate")).not.toBeChecked();
      expect(await ticked(page)).toBe(before - 1);
      await expect(tilesMenuButton(page)).toBeFocused();

      // Step 3 — ticked again: it comes back, with its X.
      await showTile(page, "Identitate");
      await expect(xOf(page, "Identitate")).toBeVisible();

      // Step 4 — in edit: no X on that tile; „Renunță" brings it back.
      await identity.locator("[data-tile-edit]").click();
      await expect(identity.locator('[data-tile-edit-bar="identity"]')).toBeVisible();
      await expect(identity.locator("[data-tile-close]")).toHaveCount(0);
      await expect(page.locator("[data-tile-close]").first()).toBeVisible(); // the other tiles keep theirs
      await identity.locator('[data-tile-cancel="identity"]').click();
      await expect(xOf(page, "Identitate")).toBeVisible();

      // Step 5 — the last tile shown has none: „Identitate" stored as the only tile, the screen reloaded. (An empty tile
      // that its screen keeps out of sight while it is ticked cannot be closed by a press, so the choice is stored.)
      await page.evaluate(() => localStorage.setItem("ga40-tiles-natural-person-v1", JSON.stringify(["identity"])));
      await page.reload();
      await expect(identity.locator("[data-tile-edit]")).toBeVisible({ timeout: 30_000 });
      await expect.poll(() => ticked(page), { timeout: 10_000 }).toBe(1);
      await page.waitForTimeout(500);
      await expect(page.locator("[data-tile-close]")).toHaveCount(0);
      await pressTileButton(page, "Implicit");
      await expect(xOf(page, "Identitate")).toBeVisible({ timeout: 15_000 });
    } finally {
      if (person) await removeRecord(page.request, "person", person);
    }
  });

  test("o dată pe panoul principal și o dată pe „Grupuri”", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    for (const path of ["/", "/admin/groups"]) {
      await page.goto(path);
      const x = page.locator("[data-tile-close]").first();
      await expect(x).toBeVisible({ timeout: 30_000 });
      const key = (await x.getAttribute("data-tile-close"))!;
      const before = await ticked(page);
      await x.click();
      await expect(page.locator(`[data-tile="${key}"]`).first()).toBeHidden();
      expect(await ticked(page), `${path}: one box fewer ticked`).toBe(before - 1);
      await expect(tilesMenuButton(page)).toBeFocused();
      // Put back.
      await openTiles(page);
      await closeTiles(page);
      await pressTileButton(page, "Implicit");
      await expect(page.locator(`[data-tile="${key}"]`).first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
