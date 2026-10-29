/**
 * Case:   TC-SET-05 — „Noapte”: în antetul barei laterale, păstrat la reîncărcare, același în „Setări”
 * Source: docs/testing/cases/TC-SET-05.md, „Last green" 2026-10-21
 *
 * A translation of the case file, step for step (Slice 40.19). Slice 40.28: the box is „Noapte" under „GA40", the
 * flags stacked in the panel's middle, „Setări"'s box „Noapte (Mod Întunecat)"; step 1 measures the header. Slice 40.58:
 * the flags are „RO | EN", one two-part control in the panel's middle; step 7 switches the language with it. Slice 40.59
 * (Figura 8.3): „Noapte" and „RO | EN" are in the account menu at the bottom of the sidebar; the header holds GA40 and
 * the collapse button only. Slice 40.95: Limba and Aspect are in the header again, beside GA40, smaller — RO | EN and a
 * sun | moon — and in the account menu on the collapsed rail only; step 9 reads a field's label in the header's navy.
 * It changes only this browser context's cookie, and
 * puts the look back to light in `finally`, so a red run leaves nothing dark behind.
 */
import { test, expect, type Page } from "../helpers/test";
import { accountEntry, openAccountMenu } from "../helpers/sidebar";
import { lookOnLoad } from "../helpers/theme";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

// 40.95: the header's „Zi | Noapte" (a sun and a moon) and „RO | EN"; 40.59–40.94 they were the account menu's.
const head = (page: Page) => page.locator("[data-sidebar-look]");
const segment = (page: Page, sw: string, value: string) => head(page).locator(`[data-segmented="${sw}"] [data-segment="${value}"]`);
const MARK = `${E2E_MARKER}SET-05`;
const settingsBox = (page: Page) =>
  page.locator('[data-account-appearance]').getByRole("checkbox", { name: "Noapte (Mod Întunecat)", exact: true });
const isDark = (page: Page) => page.evaluate(() => document.documentElement.classList.contains("dark"));
const bodyBg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe("TC-SET-05 — „Noapte”", () => {
  test("în antetul barei laterale, păstrat la reîncărcare, același în „Setări”", async ({ page }) => {
    test.setTimeout(150_000); // 40.76: step 8 loads the dashboard twice; 40.95: step 9 a person
    await lookOnLoad(page, "light");
    await page.setViewportSize({ width: 1366, height: 900 });
    let person: string | undefined;
    try {
      // Step 1 (40.59; 40.95) — the header holds GA40, in Roboto Slab navy like a tile title, then RO | EN and the sun |
      // moon, small, then the collapse button where it always stood; no box, no „Autentificat ca". The page light.
      await page.goto("/natural-persons");
      await expect(head(page).locator("[data-sidebar-name]")).toHaveText("GA40", { timeout: 30_000 });
      await expect(head(page).locator("input")).toHaveCount(0);
      await expect(head(page).locator("[data-segmented]")).toHaveCount(2);
      await expect(head(page).getByText(/Autentificat ca/)).toHaveCount(0);
      await expect(head(page).getByRole("button")).toHaveCount(5);
      for (const [value, title] of [["light", "Zi"], ["dark", "Noapte"]] as const) {
        await expect(segment(page, "theme", value)).toHaveAttribute("title", title);
        await expect(segment(page, "theme", value).locator("svg")).toHaveCount(1);
      }
      expect(await segment(page, "locale", "ro-RO").evaluate((e) => getComputedStyle(e).fontSize)).toBe("11px");
      const name = head(page).locator("[data-sidebar-name]");
      expect(await name.evaluate((e) => getComputedStyle(e).fontFamily)).toMatch(/Roboto Slab/);
      expect(await name.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(30, 58, 138)"); // navy
      const g = await page.evaluate(() => {
        const r = (el: Element | null) => {
          const b = el!.getBoundingClientRect();
          return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: b.width, h: b.height };
        };
        const h = document.querySelector("[data-sidebar-look]")!;
        return { head: r(h), collapse: r(h.querySelector('button[aria-label="Restrânge bara laterală"]')) };
      });
      expect(Math.round(g.head.h)).toBe(56);
      expect([Math.round(g.collapse.w), Math.round(g.collapse.h)]).toEqual([30, 30]);
      expect(Math.abs(g.head.r - 12 - g.collapse.r)).toBeLessThanOrEqual(1);
      expect(Math.abs((g.head.t + g.head.b) / 2 - (g.collapse.t + g.collapse.b) / 2)).toBeLessThanOrEqual(1);
      expect(await isDark(page)).toBe(false);
      const light = await bodyBg(page);

      // Step 2 (40.59; 40.95) — the account entry at the bottom opens the menu upward: „Autentificat ca" first, then
      // Ieșire — no Limba, no Aspect, which are in the header; Esc closes it, the focus back on the entry. Then the
      // header's moon („Noapte"): dark at once, no reload.
      const menu = await openAccountMenu(page);
      const [entryBox, menuBox] = [await accountEntry(page).boundingBox(), await menu.boundingBox()];
      expect((menuBox?.y ?? 0) + (menuBox?.height ?? 0)).toBeLessThanOrEqual((entryBox?.y ?? 0) + 1);
      await expect(menu.locator("[data-account-signed-in]")).toHaveText(/^Autentificat ca \S+/);
      await expect(menu.locator("[data-segmented]")).toHaveCount(0);
      await expect(menu.getByRole("button", { name: "Ieșire", exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await expect(accountEntry(page)).toBeFocused();
      await expect(segment(page, "theme", "light")).toHaveAttribute("aria-pressed", "true");
      await segment(page, "theme", "dark").click();
      await expect(segment(page, "theme", "dark")).toHaveAttribute("aria-pressed", "true");
      expect(await isDark(page)).toBe(true);
      expect(await bodyBg(page)).not.toBe(light);
      expect(await page.evaluate(() => getComputedStyle(document.querySelector("aside")!).backgroundColor)).toBe("rgb(24, 24, 27)");

      // Step 3 — a reload arrives dark: the server's own answer carries the class; „Noapte" is the one pressed.
      const html = await (await page.request.get("/natural-persons")).text();
      expect(html).toMatch(/<html[^>]*class="[^"]*\bdark\b/);
      await page.reload();
      await expect(segment(page, "theme", "dark")).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
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

      // Step 5 — unticked there: light at once, and the menu's „Zi" pressed with it.
      await settingsBox(page).uncheck();
      expect(await isDark(page)).toBe(false);
      await expect(segment(page, "theme", "light")).toHaveAttribute("aria-pressed", "true");

      // Step 6 — a reload stays light.
      await page.reload();
      await expect(settingsBox(page)).not.toBeChecked({ timeout: 30_000 });
      await expect(segment(page, "theme", "light")).toHaveAttribute("aria-pressed", "true");
      expect(await isDark(page)).toBe(false);

      // Step 7 (40.58; in the header since 40.95) — „RO | EN": RO pressed and filled, EN outlined; EN turns the screen
      // English; RO back; nothing is asked of flagcdn.com.
      const asked: string[] = [];
      page.on("request", (r) => {
        if (r.url().includes("flagcdn.com")) asked.push(r.url());
      });
      await page.goto("/natural-persons");
      const ro = head(page).getByRole("button", { name: "Română", exact: true });
      const en = head(page).getByRole("button", { name: "English", exact: true });
      await expect(ro).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
      await expect(en).toHaveAttribute("aria-pressed", "false");
      await expect(ro).toBeEnabled();
      expect(await ro.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(51, 65, 85)"); // slate, --color-cta
      expect(await en.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
      await en.click();
      await expect(en).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
      await expect(head(page).getByRole("group", { name: "Language", exact: true })).toBeAttached({ timeout: 30_000 });
      await expect(segment(page, "theme", "dark")).toHaveAttribute("title", "Night");
      await ro.click();
      await expect(ro).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
      await expect(segment(page, "theme", "dark")).toHaveAttribute("title", "Noapte", { timeout: 30_000 });
      expect(asked).toEqual([]);
      expect(await page.locator("aside img").count()).toBe(0);

      // Step 8 (40.76) — the dashboard, converted to the role tokens, in both looks: its heading, its line under it and
      // the expiring documents' frame each draw their token's colour, and the colour changes with the look.
      const drawn: Record<string, Record<string, string>> = {};
      for (const look of ["light", "dark"] as const) {
        await lookOnLoad(page, look);
        await page.goto("/");
        await expect(page.getByRole("heading", { level: 1, name: "Tablou de bord" })).toBeVisible({ timeout: 30_000 });
        expect(await isDark(page)).toBe(look === "dark");
        drawn[look] = await page.evaluate(() => {
          const token = (name: string) => {
            const probe = document.createElement("span");
            probe.style.color = `var(--color-${name})`;
            document.body.appendChild(probe);
            const c = getComputedStyle(probe).color;
            probe.remove();
            return c;
          };
          const h1 = [...document.querySelectorAll("h1")].find((h) => h.textContent?.includes("Tablou de bord"))!;
          const under = h1.closest("header")?.querySelector(":scope > p");
          const frame = document.querySelector("[data-expiring-frame]");
          return {
            heading: getComputedStyle(h1).color,
            strong: token("strong"),
            under: under ? getComputedStyle(under).color : "",
            fade: token("fade"),
            frame: frame ? getComputedStyle(frame).borderTopColor : token("card-rim"),
            rim: token("card-rim"),
          };
        });
        expect(drawn[look].heading, `${look}: the heading is --color-strong`).toBe(drawn[look].strong);
        expect(drawn[look].under, `${look}: the line under it is --color-fade`).toBe(drawn[look].fade);
        expect(drawn[look].frame, `${look}: the expiring frame's line is --color-card-rim`).toBe(drawn[look].rim);
      }
      expect(drawn.dark.heading).not.toBe(drawn.light.heading);
      expect(drawn.dark.rim).not.toBe(drawn.light.rim);

      // Step 9 (40.95) — an invented person, light: „Nume"'s label is the tile header's navy, its value is not.
      await lookOnLoad(page, "light");
      await removeLeftovers(page.request, MARK);
      person = await createNaturalPerson(page.request, { lastName: `${MARK} Testescu`, firstName: "Ion" });
      await page.goto(`/natural-persons/${person}`);
      const value = page.locator('[data-read-value="lastName"]').first();
      await expect(value).toContainText("Testescu", { timeout: 30_000 });
      const label = value.locator("xpath=..").locator("span").first();
      expect(await label.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(30, 58, 138)");
      expect(await value.evaluate((e) => getComputedStyle(e).color)).not.toBe("rgb(30, 58, 138)");
    } finally {
      if (person) await removeRecord(page.request, "person", person);
      await lookOnLoad(page, "light");
      const base = test.info().project.use.baseURL ?? process.env.E2E_BASE_URL ?? "http://localhost:3000";
      await page.context().addCookies([{ name: "NEXT_LOCALE", value: "ro-RO", url: base }]);
    }
  });
});
