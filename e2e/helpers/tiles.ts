/**
 * Tiles, as a spec reaches them.                     (Slices #37.17–#37.20)
 *
 * A Natural Person has no tab row any more: a row of checkboxes named after the
 * tiles picks what shows (`src/components/tiles/tile-selector.tsx`). A spec
 * that used to click a tab ticks the tile instead:
 *
 *   await showTile(page, "Acte");          // was getByRole("tab", { name: "Acte" }).click()
 *
 * It returns the tile — a region named like its checkbox — so a spec can scope
 * to it when two tiles show the same buttons. Ticking is idempotent: a tile
 * already showing (the defaults, or a `?tab=` visit) is left as it is.
 *
 * The Judicial Person has tiles too since #37.18, the Property since #37.19,
 * the Document since #37.20 — where every notebook tab of the type is a tile,
 * named as the tab is („Instrument", „Cadastru" …).
 */

import { expect, type Locator, type Page } from "@playwright/test";

/** The checkbox row's accessible name (shared.tiles.groupLabel). */
export const TILE_GROUP = "Părți afișate";

/** The checkbox for tile `name`. */
export function tileBox(page: Page, name: string): Locator {
  return page.getByRole("group", { name: TILE_GROUP }).getByRole("checkbox", { name, exact: true });
}

/**
 * Tick tile `name` if it is not showing, and return it once it is on the page.
 *
 * ⚠️ **A TICK BEFORE THE PAGE IS INTERACTIVE CAN BE UNDONE.** Measured in full
 * 20260928T235308Z-29109 (TC-STAMP-01): on a loaded machine the box was clicked
 * while the page was still hydrating, React then drew the checkbox from its own
 * state, and Playwright reported „Clicking the checkbox did not change its
 * state". The same race the login form has (helpers/login-form.ts). So the tick
 * is repeated until it holds.
 */
export async function showTile(page: Page, name: string): Promise<Locator> {
  const box = tileBox(page, name);
  await expect(box).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    if (!(await box.isChecked())) await box.click();
    await expect(box).toBeChecked({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  const tile = page.getByRole("region", { name, exact: true });
  await expect(tile).toBeVisible({ timeout: 30_000 });
  return tile;
}

/** Untick tile `name` if it is showing; the tile leaves the page (a form tile is hidden, a list tile unmounted). */
export async function hideTile(page: Page, name: string): Promise<void> {
  const box = tileBox(page, name);
  // Repeated until it holds, for the reason `showTile` gives.
  await expect(async () => {
    if (await box.isChecked()) await box.click();
    await expect(box).not.toBeChecked({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByRole("region", { name, exact: true })).toBeHidden();
}
