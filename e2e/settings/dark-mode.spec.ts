/**
 * Case:   TC-SET-05 — „Noapte”: bifat sub „GA40”, păstrat la reîncărcare, același în „Setări”
 * Source: docs/testing/cases/TC-SET-05.md, „Last green" 2026-10-21
 *
 * A translation of the case file, step for step (Slice 40.19). Slice 40.28: the box is „Noapte" under „GA40", the
 * flags stacked in the panel's middle, „Setări"'s box „Noapte (Mod Întunecat)"; step 1 measures the header. Slice 40.58:
 * the flags are „RO | EN", one two-part control in the panel's middle; step 7 switches the language with it. It changes only this browser context's cookie, and
 * puts the look back to light in `finally`, so a red run leaves nothing dark behind.
 */
import { test, expect, type Page } from "../helpers/test";
import { lookOnLoad } from "../helpers/theme";

const sidebarBox = (page: Page) => page.locator('[data-theme-toggle="sidebar"]').getByRole("checkbox", { name: "Noapte", exact: true });
const settingsBox = (page: Page) =>
  page.locator('[data-account-appearance]').getByRole("checkbox", { name: "Noapte (Mod Întunecat)", exact: true });
const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("dark"));
const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("TC-SET-05 — „Noapte”", () => {
  test("bifat sub „GA40”, păstrat la reîncărcare, același în „Setări”", async ({ page }) => {
    await lookOnLoad(page, "light");
    await page.setViewportSize({ width: 1366, height: 900 });
    try {
      // Step 1 — the header (40.28): „GA40" over the box, both on the left padding; the two flags one above the other,
      // smaller, their centre on the panel's; the collapse button where it was; the box unticked, the page light.
      await page.goto("/natural-persons");
      await expect(sidebarBox(page)).toBeVisible({ timeout: 30_000 });
      await expect(sidebarBox(page)).not.toBeChecked();
      await expect(page.locator('[data-theme-toggle="sidebar"]')).toHaveAttribute("title", "Noapte (Mod Întunecat)");
      const g = await page.evaluate(() => {
        const r = (el: Element | null) => {
          const b = el!.getBoundingClientRect();
          return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height };
        };
        const head = document.querySelector("[data-sidebar-look]")!;
        return {
          aside: r(document.querySelector("aside")),
          head: r(head),
          name: r(document.querySelector("[data-sidebar-name]")),
          box: r(document.querySelector('[data-theme-toggle="sidebar"]')),
          sw: r(head.querySelector('[data-segmented="locale"]')),
          parts: [...head.querySelectorAll('[data-segmented="locale"] button')].map((b) => ({ ...r(b), text: b.textContent })),
          collapse: r(head.querySelector('button[aria-label="Restrânge bara laterală"]')),
        };
      });
      expect(Math.round(g.head.h)).toBe(56);
      expect(Math.abs(g.box.l - g.name.l)).toBeLessThanOrEqual(1);
      expect(g.box.t).toBeGreaterThanOrEqual(g.name.b - 0.5);
      // 40.58: „RO | EN" side by side, RO first, its centre on the panel's (it was two flags, one above the other).
      expect(g.parts.map((p) => p.text)).toEqual(["RO", "EN"]);
      expect(g.parts[1].l).toBeGreaterThanOrEqual(g.parts[0].r - 1);
      expect(Math.abs(g.parts[0].t - g.parts[1].t)).toBeLessThanOrEqual(0.5);
      const mid = (g.aside.l + g.aside.r) / 2;
      expect(Math.abs((g.sw.l + g.sw.r) / 2 - mid)).toBeLessThanOrEqual(1);
      // The collapse button as it always stood: 30 × 30, on the header's right padding, in its middle.
      expect([Math.round(g.collapse.w), Math.round(g.collapse.h)]).toEqual([30, 30]);
      expect(Math.abs(g.head.r - 12 - g.collapse.r)).toBeLessThanOrEqual(1);
      expect(Math.abs((g.head.t + g.head.b) / 2 - (g.collapse.t + g.collapse.b) / 2)).toBeLessThanOrEqual(1);
      // Nothing overlaps: the left column ends before the flags start, the flags before the button.
      expect(Math.max(g.name.r, g.box.r)).toBeLessThan(g.sw.l);
      expect(g.sw.r).toBeLessThan(g.collapse.l);
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

      // Step 7 (40.58) — „RO | EN": RO pressed and filled, EN outlined; EN turns the screen English; RO back; nothing is
      // asked of flagcdn.com.
      const asked: string[] = [];
      page.on("request", (r) => {
        if (r.url().includes("flagcdn.com")) asked.push(r.url());
      });
      await page.goto("/natural-persons");
      const sw = page.locator('[data-sidebar-look] [data-segmented="locale"]');
      const ro = sw.getByRole("button", { name: "Română", exact: true });
      const en = sw.getByRole("button", { name: "English", exact: true });
      await expect(ro).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
      await expect(en).toHaveAttribute("aria-pressed", "false");
      await expect(ro).toBeEnabled();
      expect(await ro.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(51, 65, 85)"); // slate, --color-cta
      expect(await en.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
      await en.click();
      await expect(en).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
      await expect(page.locator('[data-theme-toggle="sidebar"]').getByRole("checkbox", { name: "Night", exact: true })).toBeVisible({ timeout: 30_000 });
      await ro.click();
      await expect(ro).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
      await expect(sidebarBox(page)).toBeVisible({ timeout: 30_000 });
      expect(asked).toEqual([]);
      expect(await page.locator("aside img").count()).toBe(0);
    } finally {
      await lookOnLoad(page, "light");
      const base = test.info().project.use.baseURL ?? process.env.E2E_BASE_URL ?? "http://localhost:3000";
      await page.context().addCookies([{ name: "NEXT_LOCALE", value: "ro-RO", url: base }]);
    }
  });
});
