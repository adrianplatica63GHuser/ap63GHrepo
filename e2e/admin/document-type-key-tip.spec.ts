/**
 * Case:   TC-VL-07 — Tipuri de document: fără coloana „Cheie”; cheia în bula denumirii
 * Source: docs/testing/cases/TC-VL-07.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step. Nothing is created: the list is read as it is.
 */

import { test, expect } from "@playwright/test";

test.describe("TC-VL-07 — cheia în bula denumirii", () => {
  test("fără „Cheie”; „Contract de Vânzare” și CONTRACT_VANZARE într-o singură bulă", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 1000 });
    await page.goto("/admin/value-lists?list=document-types");
    await expect(page.locator("[data-usage]").first()).toBeVisible({ timeout: 30_000 });

    // Step 1 — no „Cheie" column.
    const heads = page.locator("table[data-width-table] thead th");
    await expect(heads.filter({ hasText: /^Denumire$/i })).toHaveCount(1);
    await expect(heads.filter({ hasText: /^Cheie$/i })).toHaveCount(0);
    await expect(page.locator('table[data-width-table] thead th[data-width-column="valueKey"]')).toHaveCount(0);

    // Step 2 — one tooltip: the name, the key under it in mono; no browser tooltip on the cell.
    const name = page.locator("tbody tr [data-name-tip]").filter({ hasText: /^Contract de Vânzare$/ });
    await expect(name).toHaveCount(1);
    await expect(name.locator("xpath=ancestor::td[1]")).not.toHaveAttribute("title", /.+/);
    await name.hover();
    const tip = page.getByRole("tooltip");
    await expect(tip).toHaveCount(1);
    await expect(tip).toHaveText("Contract de VânzareCONTRACT_VANZARE");
    const key = tip.locator("span").filter({ hasText: /^CONTRACT_VANZARE$/ });
    expect(await key.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/mono|Consolas|Courier|Menlo/i);

    // Step 3 — the mouse away: closed.
    await page.mouse.move(5, 5);
    await expect(page.getByRole("tooltip")).toHaveCount(0);
  });
});
