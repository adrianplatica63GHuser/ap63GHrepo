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
 *
 * Slice 40.57: on the four record screens the bar sits in the „Panouri" panel,
 * closed when the record opens. `showTile`, `hideTile` and `pressTileButton`
 * open it for what they do and close it again when they opened it; `tileBox`
 * finds a box with the panel closed too, so its state can be read (`toBeChecked`)
 * — to click one, `openTiles` first. Setări keeps the open bar (41.02: the home page has „Panouri" too),
 * and there these do exactly what they did.
 */

import { expect, type Locator, type Page } from "@playwright/test";

/** The checkbox row's accessible name (shared.tiles.groupLabel). */
export const TILE_GROUP = "Părți afișate";

/** The checkbox for tile `name` — found with the „Panouri" panel closed as well (40.57). */
export function tileBox(page: Page, name: string): Locator {
  return page
    .getByRole("group", { name: TILE_GROUP, includeHidden: true })
    .getByRole("checkbox", { name, exact: true, includeHidden: true });
}

/** Slice 40.57: a record screen's „Panouri" button — none on Setări (41.02: the home page has one). */
export function tilesMenuButton(page: Page): Locator {
  return page.locator("[data-tiles-menu-button]");
}

/**
 * Open the „Panouri" panel, if the screen has one and it is closed. True when this call opened it. Repeated until it
 * holds, as `showTile`'s tick is: a press before the page is interactive does nothing.
 */
export async function openTiles(page: Page): Promise<boolean> {
  await expect(page.locator("[data-tile-selector]").first()).toBeAttached({ timeout: 30_000 });
  const button = tilesMenuButton(page);
  // 41.08: the button is portalled into the page bar once the page has hydrated, so it is not there at first paint.
  // A screen with „Panouri" draws its panel in the page from the first paint: wait for the button there; none, none.
  if ((await page.locator("[data-tiles-panel]").count()) === 0) return false;
  await expect(button).toBeVisible({ timeout: 30_000 });
  if ((await button.getAttribute("aria-expanded")) === "true") return false;
  await expect(async () => {
    if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
    // The panel's box, not the group's name: the same in either language.
    await expect(page.locator("[data-tiles-panel] > div")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  return true;
}

/** Close the „Panouri" panel, if the screen has one and it is open — by its button. */
export async function closeTiles(page: Page): Promise<void> {
  const button = tilesMenuButton(page);
  if ((await button.count()) === 0) return;
  if ((await button.getAttribute("aria-expanded")) !== "true") return;
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
}

/**
 * Press the bar's „Toate", „Toate sus" or „Implicit" (in English „All", „All up", „Default") — the panel opened for it,
 * and closed after if this opened it.
 */
export async function pressTileButton(page: Page, name: string, options?: { timeout?: number }): Promise<void> {
  const opened = await openTiles(page);
  await page.locator("[data-tile-bar-buttons]").first().getByRole("button", { name, exact: true }).click(options);
  if (opened) await closeTiles(page);
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
  await expect(box).toBeAttached({ timeout: 30_000 });
  const opened = !(await box.isChecked()) && (await openTiles(page));
  await expect(async () => {
    if (!(await box.isChecked())) await box.click();
    await expect(box).toBeChecked({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  if (opened) await closeTiles(page);
  const tile = page.getByRole("region", { name, exact: true });
  await expect(tile).toBeVisible({ timeout: 30_000 });
  return tile;
}

/** Untick tile `name` if it is showing; the tile leaves the page (a form tile is hidden, a list tile unmounted). */
export async function hideTile(page: Page, name: string): Promise<void> {
  const box = tileBox(page, name);
  await expect(box).toBeAttached({ timeout: 30_000 });
  const opened = (await box.isChecked()) && (await openTiles(page));
  // Repeated until it holds, for the reason `showTile` gives.
  await expect(async () => {
    if (await box.isChecked()) await box.click();
    await expect(box).not.toBeChecked({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  if (opened) await closeTiles(page);
  await expect(page.getByRole("region", { name, exact: true })).toBeHidden();
}

/**
 * A one-line row (Slice #37.64): a row of a Document's „Persoane", „Proprietăți"
 * or „Acte corelate" — a radio, one content field and its buttons, on one line.
 * They are list items, not table rows, and have no heading row.
 */
export function lineRow(scope: Page | Locator, text: string): Locator {
  return scope.locator("li[data-one-line-row]").filter({ hasText: text });
}

/**
 * One line tall: a row of buttons at `xs` (26 px) and the row's padding — 34 px
 * measured — never the two or three lines a stacked cell made it.
 */
export async function expectOneLine(row: Locator): Promise<void> {
  const box = await row.boundingBox();
  expect(box, "the row is on the page").not.toBeNull();
  expect(box?.height ?? 0).toBeLessThan(44);
}

/** Press a person row's orange „Cotă" and return the panel with its three boxes. */
export async function openShare(row: Locator): Promise<Locator> {
  await row.getByRole("button", { name: "Cotă", exact: true }).click();
  const panel = row.locator("[data-share-panel]");
  await expect(panel).toBeVisible({ timeout: 15_000 });
  return panel;
}

/**
 * Slice 40.64: on a saved record a form tile with nothing in it is ONE LINE — its title, „necompletat" (or its own
 * state) and „Adaugă" (`src/components/tiles/empty-tile.tsx`). Its fields are in the page but hidden, so a spec that
 * types into an empty tile of an existing record presses „Adaugă" first, through this. `tile` is the line's key
 * (`data-empty-tile`): on the Natural Person `idCard`, `contact`, `home`, `correspondence`; on the Judicial Person
 * `contactPersons`, `headquarters`, `correspondence`; on the Property `address`; on a document the frame's tile key
 * (`tab:<name>`). A tile already open is left as it is, so the call is safe either way.
 */
export function emptyTileLine(page: Page, tile: string): Locator {
  return page.locator(`[data-empty-tile="${tile}"]`);
}

export async function openEmptyTile(page: Page, tile: string): Promise<void> {
  const line = emptyTileLine(page, tile);
  if ((await line.count()) === 0) return;
  await line.locator("[data-empty-tile-add]").click();
  await expect(line).toHaveCount(0);
}

/** Every empty tile on the screen opened — for a spec that fills several of them. The same-as-home line's „Adaugă" unticks its box. */
export async function openEmptyTiles(page: Page): Promise<void> {
  const adds = page.locator("[data-empty-tile] [data-empty-tile-add]");
  while ((await adds.count()) > 0) {
    await adds.first().click();
  }
}

/**
 * Slice 40.72: a saved record's form tile reads as text; „Editează" in its corner opens it. The one place a spec
 * presses it (Ask first 7): `tile` is the tile's key — identity, idCard, contact, addresses. Waits for the tile's
 * „Salvează" and „Renunță", which say it is open.
 */
export async function editTile(page: Page, tile: string): Promise<void> {
  const button = page.locator(`[data-tile-edit="${tile}"]`);
  await expect(button).toBeVisible({ timeout: 30_000 });
  await button.click();
  await expect(page.locator(`[data-tile-edit-bar="${tile}"]`)).toBeVisible();
}

/** The open tile's „Salvează"; waits for the tile to read as text again — the save landed. */
export async function saveTile(page: Page, tile: string): Promise<void> {
  await page.locator(`[data-tile-save="${tile}"]`).click();
  await expect(page.locator(`[data-tile-edit-bar="${tile}"]`)).toHaveCount(0, { timeout: 30_000 });
}

/**
 * Slice 40.75: `editTile` by the tile's heading — for a document's frames, whose keys follow the type's notebook
 * (`tileOfTabIndex`), so a spec names the tile as the screen does.
 */
export async function editTileNamed(page: Page, name: string): Promise<Locator> {
  const region = page.getByRole("region", { name, exact: true });
  const button = region.locator("[data-tile-edit]").first();
  await expect(button).toBeVisible({ timeout: 30_000 });
  await button.click();
  await expect(region.locator("[data-tile-edit-bar]")).toBeVisible();
  return region;
}

/**
 * Slice 40.75: „Identificarea actului" and each of a document's frames on the screen, opened in turn with „Editează"
 * and put back with „Renunță" — for a spec that reads every dropdown of a type, which a saved document draws only in its open tile.
 * A frame already open is used as it is; one with no „Editează" (nothing of its own to edit) is passed over.
 */
export async function forEachFrame(
  page: Page,
  fn: (frame: Locator, tile: string) => Promise<void>,
  { general = true }: { general?: boolean } = {},
): Promise<void> {
  const keys = await page
    .locator("[data-frame]")
    .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => e.getAttribute("data-frame") ?? ""));
  // „Identificarea actului" first: it holds the type's identification group, some of them dropdowns.
  if (general) keys.unshift("general");
  for (const tile of keys) {
    const bar = page.locator(`[data-tile-edit-bar="${tile}"]`);
    if ((await bar.count()) === 0) {
      const button = page.locator(`[data-tile-edit="${tile}"]`);
      if ((await button.count()) === 0) continue;
      await button.click();
      await expect(bar).toBeVisible();
    }
    await fn(page.locator(tile === "general" ? '[data-panel="general"]' : `[data-frame="${tile}"]`), tile);
    await page.locator(`[data-tile-cancel="${tile}"]`).click();
    await expect(bar).toHaveCount(0);
  }
}

/** `saveTile` by the tile's heading. */
export async function saveTileNamed(page: Page, name: string): Promise<void> {
  const region = page.getByRole("region", { name, exact: true });
  await region.locator("[data-tile-save]").click();
  await expect(region.locator("[data-tile-edit-bar]")).toHaveCount(0, { timeout: 30_000 });
}
