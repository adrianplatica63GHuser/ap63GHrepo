/**
 * A column filter's editor, as a spec checks where it opened.                                    (Slice #39.82)
 *
 * Since #39.82 a list's filter opens from its column's funnel or from its chip, and its editor opens right under
 * whichever opened it (the header's Ask first 5) — not under the bar, where „+ Filtru" used to stand. This is that
 * check: the editor's top edge a few pixels below the anchor's bottom edge, and its left edge at the anchor's (or
 * held left of it, when the anchor is too near the window's right edge for the editor's width).
 */

import { expect, type Page } from "@playwright/test";

/** The editor `editor` opened right under `anchor` (both CSS selectors, each matching one element on the page). */
export async function expectUnder(page: Page, anchor: string, editor: string): Promise<void> {
  const ed = page.locator(editor);
  await expect(ed).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(async () => {
      const a = await page.locator(anchor).boundingBox();
      const e = await ed.boundingBox();
      if (!a || !e) return "no box";
      const below = e.y - (a.y + a.height);
      const viewport = page.viewportSize()?.width ?? 0;
      const alignedLeft = Math.abs(e.x - a.x) <= 2 || e.x + e.width >= viewport - 12;
      return below >= 0 && below <= 8 && alignedLeft ? "under" : `anchor ${JSON.stringify(a)}, editor ${JSON.stringify(e)}`;
    }, { timeout: 5_000 })
    .toBe("under");
}
