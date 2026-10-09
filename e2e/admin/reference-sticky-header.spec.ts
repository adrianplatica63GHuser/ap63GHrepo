/**
 * Case:   TC-VL-09 — „Date de referință”: titlurile coloanelor rămân în vedere cât lista derulează
 * Source: docs/testing/cases/TC-VL-09.md, „Last green" 2026-10-09
 *
 * A translation of the case file, step for step. Nothing is created: the lists are read as they are, and
 * the longest one is chosen by asking each list's route how many rows it has.
 */

import { test, expect, type Page } from "@playwright/test";

// Slice #38.62: the lists of „Roluri și legături" — „person-roles", „property-property-roles",
// „document-document-roles", which this list held — have the relationship triangle above them, so on a wide
// screen the page scrolls to them by design; TC-VL-10 step 5 holds their header row. The longest of the rest is read here.
const LISTS = [
  "property-types", "tarla", "use-categories", "person-types", "judicial-person-types", "citizenships",
  "document-types", "institutions",
];

/** The frame, its header row and the page's scroll area, measured. */
async function reading(page: Page) {
  return page.evaluate(() => {
    const table = document.querySelector<HTMLElement>("table[data-width-table]")!;
    const frame = table.parentElement!;
    const head = table.querySelector("thead")!;
    const scroller = frame.closest<HTMLElement>("[data-page-scroll]");
    return {
      frameScrolls: frame.scrollHeight > frame.clientHeight + 1,
      frameTop: Math.round(frame.getBoundingClientRect().top),
      headTop: Math.round(head.getBoundingClientRect().top),
      frameScrollTop: frame.scrollTop,
      frameHeight: Math.round(frame.getBoundingClientRect().height),
      // How far the frame's bottom stands from the window's: the card's and the page's bottom padding.
      bottomGap: Math.round(window.innerHeight - frame.getBoundingClientRect().bottom),
      pageScrolls: scroller ? scroller.scrollHeight > scroller.clientHeight + 1 : false,
      pageScrollTop: scroller?.scrollTop ?? 0,
    };
  });
}

test.describe("TC-VL-09 — titlurile coloanelor rămân în vedere", () => {
  test("pe lista cea mai lungă, la 1920 și la 1366 px", async ({ page }) => {
    test.slow();
    // Before you start — the longest list.
    let longest = { key: "", rows: -1 };
    for (const key of LISTS) {
      const res = await page.request.get(`/api/admin/value-lists/${key}`);
      if (!res.ok()) continue;
      const rows = ((await res.json()) as { total: number }).total;
      if (rows > longest.rows) longest = { key, rows };
    }
    expect(longest.rows).toBeGreaterThan(20);

    for (const width of [1920, 1366]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1000 : 900 });
      await page.goto(`/admin/value-lists?list=${longest.key}`);
      await expect(page.locator("[data-usage]").first()).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => (await reading(page)).frameScrolls, { timeout: 15_000 }).toBe(true);

      // Step 1 (1920 px) — beside the categories, the frame takes the window's height: the page does not scroll.
      if (width === 1920) {
        const r = await reading(page);
        expect({ width, pageScrolls: r.pageScrolls, fills: r.bottomGap < 120 }).toEqual({ width, pageScrolls: false, fills: true });
      }

      // Step 2 — the list scrolled to its end: only the rows moved; the header row is where it was.
      const table = page.locator("table[data-width-table]");
      await table.evaluate((t) => t.scrollIntoView({ block: "start" }));
      const before = await reading(page);
      // Under the categories (1366 px), scrolled to the list: the frame takes most of a screen, not a strip.
      if (width === 1366) expect({ width, tall: before.frameHeight > 500 }).toEqual({ width, tall: true });
      await table.evaluate((t) => { t.parentElement!.scrollTop = t.parentElement!.scrollHeight; });
      await expect.poll(async () => (await reading(page)).frameScrollTop).toBeGreaterThan(0);
      const after = await reading(page);
      expect({ width, head: Math.abs(after.headTop - before.headTop) <= 1, headAtFrameTop: Math.abs(after.headTop - after.frameTop) <= 2, page: after.pageScrollTop === before.pageScrollTop })
        .toEqual({ width, head: true, headAtFrameTop: true, page: true });
    }
  });
});
