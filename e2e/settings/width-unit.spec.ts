/**
 * Case:   TC-SET-06 — „Unitatea de lățime” pe „Setări”: 100 px redesenează ecranul pe loc, formularul unei persoane o ia, 119 o pune la loc
 * Source: docs/testing/cases/TC-SET-06.md, „Last green" 2026-10-31
 *
 * Slice 41.16: the width unit is set on „Setări” and kept by this browser (the `ga40-width-unit` cookie); every tile is
 * drawn in it as the fewest of its units at least as wide as on 119 px (src/lib/ui/field-widths.ts, `atLeastUnitsCss`).
 * Only this browser context's cookie changes, and `finally` writes 119 back. No record is created: step 4 reads
 * „Adaugă persoană”, the form with every box. No map, no Street View, no address look-up.
 */
import { test, expect, type Locator, type Page } from "../helpers/test";

const GAP = 16;
/** `n` units of `px` and the n − 1 gaps between them. */
const unitsPx = (n: number, px: number) => n * px + (n - 1) * GAP;
/** The fewest units of `px` at least `minPx` wide. */
const fewest = (minPx: number, px: number) => {
  let n = 1;
  while (unitsPx(n, px) < minPx) n++;
  return n;
};
const widthOf = async (l: Locator) => (await l.boundingBox())!.width;

const account = (page: Page) => page.locator('main [data-panel="settings-account"]');
const choice = (page: Page) => page.locator("[data-account-width-unit]");
const unitBox = (page: Page) => page.locator("#width-unit-px");
const back = (page: Page) => choice(page).getByRole("button", { name: "Revino la 119 px", exact: true });

test.describe("TC-SET-06 — „Unitatea de lățime”", () => {
  test("100 px redraws „Setări” at once, a person's form takes it, 119 puts it back", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 900 });
    try {
      // Step 1 — 119 until changed: „Contul meu” is 4 units, 524 px.
      await page.goto("/admin/settings");
      await expect(unitBox(page)).toHaveValue("119", { timeout: 30_000 });
      await expect(choice(page).getByText("Un număr întreg de pixeli, între 80 și 200.", { exact: true })).toBeVisible();
      await expect(choice(page).getByRole("button", { name: "Salvează", exact: true })).toBeDisabled();
      await expect(back(page)).toHaveCount(0);
      expect(await widthOf(account(page))).toBe(unitsPx(4, 119));

      // Step 2 — 100: at once, no reload, the fewest 100-px units at least 524 px wide.
      await unitBox(page).fill("100");
      await choice(page).getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(choice(page).getByRole("status")).toHaveText(/^Salvat: 100 px\./);
      const settingsUnits = fewest(unitsPx(4, 119), 100);
      expect(settingsUnits).toBe(5);
      await expect.poll(() => widthOf(account(page))).toBe(unitsPx(settingsUnits, 100));
      await expect(back(page)).toBeVisible();

      // Step 3 — a reload keeps it, from the server's first answer.
      const first = await page.request.get("/admin/settings");
      expect(await first.text()).toMatch(/<html[^>]*style="[^"]*--unit:6\.25rem/);
      await page.reload();
      await expect(unitBox(page)).toHaveValue("100", { timeout: 30_000 });
      expect(await widthOf(account(page))).toBe(unitsPx(settingsUnits, 100));

      // Step 4 — „Adaugă persoană”: Adresă and Contact the fewest 100-px units at least 254 px wide; the fields as they were.
      await page.goto("/natural-persons/new");
      const address = page.locator('[data-panel="addresses.HOME"]');
      await expect(address).toBeVisible({ timeout: 30_000 });
      const two = fewest(unitsPx(2, 119), 100);
      expect(two).toBe(3);
      for (const panel of ["contact", "addresses.HOME"]) {
        const w = await widthOf(page.locator(`[data-panel="${panel}"]`));
        expect([panel, w]).toEqual([panel, unitsPx(two, 100)]);
        expect([panel, Number.isInteger((w + GAP) / (100 + GAP))]).toEqual([panel, true]);
      }
      const box = (await address.boundingBox())!;
      const fields = address.locator("[data-width-field]");
      expect(await fields.count()).toBeGreaterThan(3);
      for (const f of await fields.all()) {
        const b = (await f.boundingBox())!;
        const name = await f.getAttribute("data-width-field");
        expect([name, b.x >= box.x - 0.5 && b.x + b.width <= box.x + box.width + 0.5]).toEqual([name, true]);
      }
      expect(await widthOf(page.locator('[data-width-field="addresses.HOME.locality"]'))).toBe(136);
      expect(await widthOf(page.locator('[data-width-field="addresses.HOME.country"]'))).toBe(80);
      // TILE: the tile's whole inner width — its 12-px padding and 1-px border off each side.
      expect(await widthOf(page.locator('[data-width-field="addresses.HOME.streetLine"]'))).toBe(unitsPx(two, 100) - 2 * 13);

      // Step 5 — „Revino la 119 px”.
      await page.goto("/admin/settings");
      await expect(unitBox(page)).toHaveValue("100", { timeout: 30_000 });
      await back(page).click();
      await expect(unitBox(page)).toHaveValue("119");
      await expect.poll(() => widthOf(account(page))).toBe(unitsPx(4, 119));
      await expect(back(page)).toHaveCount(0);
    } finally {
      await page.evaluate(() => {
        document.cookie = "ga40-width-unit=119; path=/; max-age=31536000; SameSite=Lax";
      });
    }
  });
});
