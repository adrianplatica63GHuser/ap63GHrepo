/**
 * Case:   TC-VL-10 — „Roluri și legături”: triunghiul legăturilor deasupra listelor
 * Source: docs/testing/cases/TC-VL-10.md, „Last green" 2026-10-09
 *
 * A translation of the case file, step for step. Nothing is created: the tile describes the code.
 */

import { test, expect } from "@playwright/test";

const SIX = [
  ["personPerson", "Persoană → Persoană", "configurat în aplicație"],
  ["propertyProperty", "Proprietate → Proprietate", "configurat în aplicație"],
  ["documentDocument", "Document → Document", "configurat în aplicație"],
  ["personProperty", "Persoană – Proprietate", "configurat în aplicație"],
  ["personDocument", "Persoană – Document", "configurat în aplicație"],
  ["documentProperty", "Document – Proprietate", "neconfigurat, intenționat"],
] as const;

test.describe("TC-VL-10 — triunghiul legăturilor", () => {
  for (const width of [1366, 1920]) {
    test(`la ${width} px: deasupra listei, șase legături, o latură deschide lista ei`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width, height: 1000 });

      // Step 1 — „Roluri Persoane": the tile above the list, its drawing and its six entries.
      await page.goto("/admin/value-lists?list=person-roles");
      const tile = page.locator("[data-relationship-triangle]");
      const list = page.getByRole("region", { name: "Roluri Persoane", exact: true });
      await expect(tile).toBeVisible({ timeout: 30_000 });
      await expect(list).toBeVisible({ timeout: 30_000 });
      const tileBox = (await tile.boundingBox())!;
      const listBox = (await list.boundingBox())!;
      expect(tileBox.y + tileBox.height).toBeLessThanOrEqual(listBox.y + 1);
      await expect(tile.getByRole("img")).toBeVisible();
      for (const k of ["Persoană", "Proprietate", "Document"]) await expect(tile.locator("svg text", { hasText: new RegExp(`^${k}$`) })).toHaveCount(1);

      // Step 2 — the six, in order, each with its status in words.
      const entries = tile.locator("[data-relationship-entry]");
      await expect(entries).toHaveCount(6);
      for (const [i, [id, name, status]] of SIX.entries()) {
        const e = entries.nth(i);
        await expect(e).toHaveAttribute("data-relationship-entry", id);
        await expect(e).toContainText(name);
        await expect(e.locator("[data-status]")).toHaveText(status);
      }
      await expect(entries.nth(5)).toContainText("Nu există o listă „Document → Proprietate”");
      await expect(entries.nth(4)).toContainText("Nu are o coloană în lista „Roluri Persoane”");
      // The side that is not configured is dashed, and opens nothing.
      await expect(tile.locator('[data-side="documentProperty"]')).toHaveAttribute("stroke-dasharray", "6 5");
      await expect(tile.locator('a[data-relationship="documentProperty"]')).toHaveCount(0);
      // #34.05's note is not printed above the list any more: it is entry 6.
      await expect(page.getByText("Nu există o listă „Document → Proprietate”")).toHaveCount(1);

      // Step 3 — the Proprietate → Proprietate corner opens its list; the tile stays above it.
      await tile.locator('a[data-relationship="propertyProperty"]').click();
      await expect(page).toHaveURL(/\?list=property-property-roles$/, { timeout: 15_000 });
      await expect(page.getByRole("region", { name: "Legături Proprietate → Proprietate", exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("[data-relationship-triangle]")).toBeVisible();

      // Step 4 — a side: Persoană – Proprietate opens „Roluri Persoane".
      await page.locator('[data-relationship-triangle] a[data-relationship="personProperty"]').click();
      await expect(page).toHaveURL(/\?list=person-roles$/, { timeout: 15_000 });
      await expect(page.getByRole("region", { name: "Roluri Persoane", exact: true })).toBeVisible({ timeout: 15_000 });

      // Step 5 — the list under the tile keeps #38.56's frame: scrolled to the list, it takes most of a screen, and
      // scrolled to its last row its header row stays at the frame's top.
      const table = page.locator("table[data-width-table]");
      await table.evaluate((t) => t.closest("[data-value-list-card]")!.scrollIntoView({ block: "start" }));
      const frameOf = () => table.evaluate((t) => {
        const f = t.parentElement!;
        return { height: f.getBoundingClientRect().height, top: f.getBoundingClientRect().top, head: t.querySelector("thead")!.getBoundingClientRect().top, scrollTop: f.scrollTop };
      });
      expect((await frameOf()).height).toBeGreaterThan(500);
      await table.evaluate((t) => { t.parentElement!.scrollTop = t.parentElement!.scrollHeight; });
      await expect.poll(async () => (await frameOf()).scrollTop).toBeGreaterThan(0);
      const after = await frameOf();
      expect(Math.abs(after.head - after.top)).toBeLessThanOrEqual(2);

      // Step 6 — a list outside „Roluri și legături" has no tile.
      await page.goto("/admin/value-lists?list=citizenships");
      await expect(page.getByRole("region", { name: "Cetățenie", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("[data-relationship-triangle]")).toHaveCount(0);
    });
  }
});
