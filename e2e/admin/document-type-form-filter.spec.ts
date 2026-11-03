/**
 * Case:   TC-VL-06 — Tipuri de document: „Cu formular” și „Fără formular”, fiecare singur și amândouă
 * Source: docs/testing/cases/TC-VL-06.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step. Nothing is created: the list is read as it is.
 */

import { test, expect, type Page } from "../helpers/test";

const HAS_FORM = "Are formular";
// Slice 41.50: the four identity types count as having a form; their „Stare” says „Act de identitate”.
const IDENTITY = "Act de identitate";
const IDENTITY_TYPES = ["Carte de Identitate (tip vechi)", "Carte de Identitate (tip nou)", "Pașaport", "Pașaport CRDS"];

/** Each row's name, its status, and whether the name is bold green (41.50). */
async function rows(page: Page): Promise<{ name: string; status: string; green: boolean }[]> {
  return page.evaluate(() => {
    const table = document.querySelector<HTMLElement>("table[data-width-table]")!;
    const heads = [...table.querySelectorAll<HTMLElement>("thead th")].map((th) => th.dataset.widthColumn);
    // Slice #38.66: the document types' name has a column of its own (was the shared "valueName").
    const name = heads.indexOf("valueDocTypeName");
    const status = heads.indexOf("valueStatus");
    return [...table.querySelectorAll<HTMLTableRowElement>("tbody tr")]
      .filter((r) => r.cells.length === heads.length)
      .map((r) => {
        // The name's cell carries the colour itself (value-list-modal.tsx, `review.nameClass`).
        const painted = r.cells[name].matches("[class*='text-green-700']") ? r.cells[name] : r.cells[name].querySelector<HTMLElement>("[class*='text-green-700']");
        return {
          name: r.cells[name].innerText.trim(),
          status: r.cells[status].innerText.trim(),
          green: !!painted && Number(getComputedStyle(painted).fontWeight) >= 700,
        };
      });
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

    // Step 2 — „Cu formular": only „Are formular" and, since 41.50, the four identity types, all bold green (it read
    // `every((r) => r.status === HAS_FORM)`).
    await withForm.check();
    await expect.poll(async () => (await rows(page)).every((r) => r.status === HAS_FORM || r.status === IDENTITY)).toBe(true);
    const withRows = await rows(page);
    expect(withRows.map((r) => r.name)).toContain("Contract de Vânzare");
    for (const type of IDENTITY_TYPES) expect(withRows.find((r) => r.name === type)).toEqual({ name: type, status: IDENTITY, green: true });
    expect(withRows.every((r) => r.green)).toBe(true);

    // Step 3 — „Fără formular" alone: the rest; the halves add up.
    await withForm.uncheck();
    await withoutForm.check();
    await expect.poll(async () => (await rows(page)).every((r) => r.status !== HAS_FORM && r.status !== IDENTITY)).toBe(true);
    const withoutRows = await rows(page);
    for (const type of IDENTITY_TYPES) expect(withoutRows.map((r) => r.name)).not.toContain(type);
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
