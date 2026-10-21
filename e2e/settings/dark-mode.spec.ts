/**
 * Case:   TC-SET-05 — „Mod întunecat”: bifat sub steaguri, păstrat la reîncărcare, același în „Setări”
 * Source: docs/testing/cases/TC-SET-05.md, „Last green" 2026-10-21
 *
 * A translation of the case file, step for step (Slice 40.19). It changes only this browser context's cookie, and
 * puts the look back to light in `finally`, so a red run leaves nothing dark behind.
 */
import { test, expect, type Page } from "../helpers/test";
import { lookOnLoad } from "../helpers/theme";

const sidebarBox = (page: Page) => page.locator('[data-theme-toggle="sidebar"]').getByRole("checkbox", { name: "Mod întunecat" });
const settingsBox = (page: Page) =>
  page.locator('[data-account-appearance]').getByRole("checkbox", { name: "Mod întunecat" });
const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("dark"));
const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("TC-SET-05 — „Mod întunecat”", () => {
  test("bifat sub steaguri, păstrat la reîncărcare, același în „Setări”", async ({ page }) => {
    await lookOnLoad(page, "light");
    await page.setViewportSize({ width: 1366, height: 900 });
    try {
      // Step 1 — the flags smaller, the box under them, unticked; the page light.
      await page.goto("/natural-persons");
      await expect(sidebarBox(page)).toBeVisible({ timeout: 30_000 });
      await expect(sidebarBox(page)).not.toBeChecked();
      const flags = await page.locator("[data-sidebar-look] img").evaluateAll((imgs) =>
        imgs.map((i) => [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)]),
      );
      expect(flags).toEqual([[24, 16], [24, 16]]);
      const flagsBottom = await page.locator("[data-sidebar-look] img").first().evaluate((i) => i.getBoundingClientRect().bottom);
      const boxTop = await sidebarBox(page).evaluate((b) => b.getBoundingClientRect().top);
      expect(boxTop).toBeGreaterThanOrEqual(flagsBottom - 0.5);
      expect(await isDark(page)).toBe(false);
      const light = await bodyBg(page);

      // Step 2 — ticked: dark at once, no reload.
      await sidebarBox(page).check();
      expect(await isDark(page)).toBe(true);
      expect(await bodyBg(page)).not.toBe(light);
      expect(await page.evaluate(() => getComputedStyle(document.querySelector("aside")!).backgroundColor)).toBe("rgb(24, 24, 27)");

      // Step 3 — a reload arrives dark: the server's own answer carries the class.
      const html = await (await page.request.get("/natural-persons")).text();
      expect(html).toMatch(/<html[^>]*class="[^"]*\bdark\b/);
      await page.reload();
      await expect(sidebarBox(page)).toBeChecked({ timeout: 30_000 });
      expect(await isDark(page)).toBe(true);

      // Step 4 — „Setări": „Aspect" under „Limba", ticked.
      await page.goto("/admin/settings");
      await expect(settingsBox(page)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("[data-account-appearance] legend")).toHaveText("Aspect");
      const below = await page.evaluate(() => {
        const lang = document.querySelector("[data-account-language]")!;
        const look = document.querySelector("[data-account-appearance]")!;
        return (lang.compareDocumentPosition(look) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      });
      expect(below).toBe(true);
      await expect(settingsBox(page)).toBeChecked();

      // Step 5 — unticked there: light at once, and the sidebar's box with it.
      await settingsBox(page).uncheck();
      expect(await isDark(page)).toBe(false);
      await expect(sidebarBox(page)).not.toBeChecked();

      // Step 6 — a reload stays light.
      await page.reload();
      await expect(settingsBox(page)).not.toBeChecked({ timeout: 30_000 });
      await expect(sidebarBox(page)).not.toBeChecked();
      expect(await isDark(page)).toBe(false);
    } finally {
      await lookOnLoad(page, "light");
    }
  });
});
