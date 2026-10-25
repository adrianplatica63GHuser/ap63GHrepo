/**
 * „Arată N câmpuri goale" as a spec needs it.                                                       (Slice 40.71)
 *
 * Since 40.71 a partly filled form tile hides its empty fields behind one link (src/components/tiles/empty-fields.tsx).
 * A spec that types into an empty field of such a tile presses the link first, through this — the one place that
 * knows the link's markup. Nothing happens where nothing is hidden, so a spec may call it on any record.
 */
import type { Locator, Page } from "@playwright/test";

/** The link of one tile (`data-empty-fields` is the tile's key: identity, contact, home, cadastral, general …). */
export function emptyFieldsLink(scope: Page | Locator, tile: string): Locator {
  return scope.locator(`[data-empty-fields="${tile}"] [data-empty-fields-show]`);
}

/** Shows every hidden empty field of `tile`, or of every tile on the screen when `tile` is left out. */
export async function showEmptyFields(scope: Page | Locator, tile?: string): Promise<void> {
  const links = tile ? emptyFieldsLink(scope, tile) : scope.locator("[data-empty-fields-show]");
  // Pressing one link removes it, so take the first until none is left.
  for (let left = await links.count(); left > 0; left = await links.count()) await links.first().click();
}
