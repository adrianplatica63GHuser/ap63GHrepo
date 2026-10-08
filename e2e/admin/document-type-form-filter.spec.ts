/**
 * Case:   TC-VL-06 — Tipuri de document: „Cu formular” și „Fără formular”, fiecare singur și amândouă
 * Source: docs/testing/cases/TC-VL-06.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step. Nothing is created: the list is read as it is.
 */

import { test, expect, type Page } from "@playwright/test";

const HAS_FORM = "Are formular";

/** Each row's name and status. */
async function rows(page: Page): Promise<{ name: string; status: string }[]> {
  return page.evaluate(() => {
    const table = document.querySelector<HTMLElement>("table[data-width-table]")!;
    const heads = [...table.querySelectorAll<HTMLElement>("thead th")].map((th) => th.dataset.widthColumn);
    const name = heads.indexOf("valueName");
    const status = heads.indexOf("valueStatus");
    return [...table.querySelectorAll<HTMLTableRowElement>("tbody tr")]
      .filter((r) => r.cells.length === heads.length)
      .map((r) => ({ name: r.cells[name].innerText.trim(), status: r.cells[status].innerText.trim() }));
  });
}

test.describe("TC-VL-06 — „Cu formular” și „Fără formular”", () => {
  test("fiecare singur, amândouă, și legătura importului", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 1000 });
    await page.goto("/admin/value-lists?list=document-types");
    const withForm = page.getByRole("checkbox", { name: "Cu formular", exact: true });
    const withoutForm = page.getByRole("checkbox", { name: "Fără formular", exact: true });

    // Step 1 — both unticked: every type.
    await expect(page.locator("[data-usage]").first()).toBeVisible({ timeout: 30_000 });
    await expect(withForm).not.toBeChecked();
    await expect(withoutForm).not.toBeChecked();
    await expect(page.getByText("Doar cele care așteaptă un formular", { exact: true })).toHaveCount(0);
    await expect.poll(async () => (await rows(page)).length).toBeGreaterThan(2);
    const all = await rows(page);

    // Step 2 — „Cu formular": only „Are formular".
    await withForm.check();
    await expect.poll(async () => (await rows(page)).every((r) => r.status === HAS_FORM)).toBe(true);
    const withRows = await rows(page);
    expect(withRows.map((r) => r.name)).toContain("Contract de Vânzare");

    // Step 3 — „Fără formular" alone: the rest; the halves add up.
    await withForm.uncheck();
    await withoutForm.check();
    await expect.poll(async () => (await rows(page)).every((r) => r.status !== HAS_FORM)).toBe(true);
    const withoutRows = await rows(page);
    expect(withRows.length + withoutRows.length).toBe(all.length);

    // Step 4 — both: every type.
    await withForm.check();
    await expect.poll(async () => (await rows(page)).length).toBe(all.length);

    // Step 5 — the import's link: „Fără formular" ticked.
    await page.goto("/admin/value-lists?list=document-types&form=without");
    await expect(withoutForm).toBeChecked({ timeout: 30_000 });
    await expect(withForm).not.toBeChecked();
    await expect.poll(async () => (await rows(page)).length).toBe(withoutRows.length);
  });
});
