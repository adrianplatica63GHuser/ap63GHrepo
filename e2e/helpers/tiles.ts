/**
 * Tiles, as a spec reaches them.                                (Slice #37.17)
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
 * The Judicial Person, the Document and the Property keep their tabs until
 * #37.18–#37.20; their specs stay on getByRole("tab").
 */

import { expect, type Locator, type Page } from "@playwright/test";

/** The checkbox row's accessible name (shared.tiles.groupLabel). */
export const TILE_GROUP = "Părți afișate";

/** The checkbox for tile `name`. */
export function tileBox(page: Page, name: string): Locator {
  return page.getByRole("group", { name: TILE_GROUP }).getByRole("checkbox", { name, exact: true });
}

/** Tick tile `name` if it is not showing, and return it once it is on the page. */
export async function showTile(page: Page, name: string): Promise<Locator> {
  const box = tileBox(page, name);
  await expect(box).toBeVisible({ timeout: 30_000 });
  if (!(await box.isChecked())) await box.check();
  await expect(box).toBeChecked();
  const tile = page.getByRole("region", { name, exact: true });
  await expect(tile).toBeVisible({ timeout: 30_000 });
  return tile;
}

/** Untick tile `name` if it is showing; the tile leaves the page (a form tile is hidden, a list tile unmounted). */
export async function hideTile(page: Page, name: string): Promise<void> {
  const box = tileBox(page, name);
  if (await box.isChecked()) await box.uncheck();
  await expect(box).not.toBeChecked();
  await expect(page.getByRole("region", { name, exact: true })).toBeHidden();
}
