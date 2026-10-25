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

/**
 * Shows every hidden empty field of `tile`, or of every tile on the screen when `tile` is left out. With `wait`, first
 * waits for a link to be there (30 s) — for a screen known to have one, whose values arrive after its first paint —
 * and then keeps pressing until none has come back for a moment, as a document's own fields arrive with its type.
 */
export async function showEmptyFields(scope: Page | Locator, tile?: string, { wait = false }: { wait?: boolean } = {}): Promise<void> {
  const links = tile ? emptyFieldsLink(scope, tile) : scope.locator("[data-empty-fields-show]");
  if (wait) await links.first().waitFor({ state: "visible", timeout: 30_000 });
  for (let quiet = 0; quiet < 2; ) {
    // Pressing one link removes it, so take the first until none is left.
    if ((await links.count()) > 0) {
      await links.first().click();
      quiet = 0;
    } else {
      quiet++;
      if (wait && quiet < 2) await new Promise((r) => setTimeout(r, 400));
    }
  }
}
