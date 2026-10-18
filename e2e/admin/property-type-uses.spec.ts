/**
 * Case:   TC-VL-11 — „Tipuri de Proprietate și Folosințe”: tipurile, folosințele și ce folosințe permite fiecare tip
 * Source: docs/testing/cases/TC-VL-11.md, „Last green" 2026-10-17
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The property carries `TC-E2E-VL-11` (records.ts), and its type and use are found by name.
 *   - Playwright's mouse presses the ticks and picks the option; the hand run did both by script (FU-290).
 *   - Step 7's tick is waited for by its PUT, not by a second read.
 */

import { test, expect, type APIRequestContext, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}VL-11`;
const NAME = `${MARK} Casă`;
const TYPES = [
  "Teren extravilan", "Teren intravilan", "Teren construit", "Liniară", "Casă", "Apartament", "Garaj", "Spațiu comercial", "Birou",
];
const AGRICULTURAL = ["Arabil", "Pășune", "Fânețe", "Vie", "Livadă", "Pădure", "Ape", "Neproductiv"];
const OPEN = ["Teren intravilan", "Teren construit", "Liniară"];
const BUILDINGS = ["Casă", "Apartament", "Garaj", "Spațiu comercial", "Birou"];
const NOT_ALLOWED = (type: string) => `Tipul „${type}” nu are această categorie de folosință printre cele permise. Rămâne până o schimbați.`;

async function idOf(request: APIRequestContext, list: string, name: string): Promise<string> {
  const res = await request.get(`/api/admin/value-lists/${list}`);
  expect(res.ok()).toBeTruthy();
  const hit = ((await res.json()) as { items: { id: string; name: string }[] }).items.find((i) => i.name === name);
  if (!hit) throw new Error(`No „${name}" in ${list}`);
  return hit.id;
}

const grid = (page: Page) => page.locator("[data-property-type-uses]");
const row = (page: Page, type: string) => grid(page).locator(`tr[data-type-row="${type}"]`);
const tick = (page: Page, use: string, type: string) => grid(page).getByRole("checkbox", { name: `${use} pentru ${type}`, exact: true });

async function tickedOn(page: Page, type: string): Promise<string[]> {
  return row(page, type).locator("input:checked").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")!.split(" pentru ")[0]));
}

async function press(page: Page, use: string, type: string): Promise<void> {
  const put = page.waitForResponse((r) => r.url().endsWith("/api/admin/property-type-uses") && r.request().method() === "PUT");
  await tick(page, use, type).click();
  expect((await put).status()).toBe(204);
}

test.describe("TC-VL-11 — tipurile de proprietate și folosințele", () => {
  test("trei fișe pe o pagină; formularul oferă doar folosințele permise tipului", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const id = await createProperty(page.request, {
      nickname: NAME,
      propertyTypeId: await idOf(page.request, "property-types", "Casă"),
      useCategoryId: await idOf(page.request, "use-categories", "Arabil"),
    });
    let ticked = false;
    try {
      // Step 1 — the page, marked under „Tipuri de obiecte”; „Liste de valori” without the uses; the three tiles.
      await page.goto("/admin/value-lists?list=property-types");
      const nav = page.getByRole("navigation", { name: "Liste de referință" });
      await expect(nav.getByRole("button", { name: "Tipuri de Proprietate și Folosințe", exact: true })).toHaveAttribute("aria-current", "page", { timeout: 30_000 });
      const valueLists = nav.locator("[data-category]").nth(2).locator("button[data-list-key]");
      // #39.70: „Relația cu firma" after „Cetățenie" — was the three without it.
      await expect(valueLists).toHaveText(["Indicative Tarla", "Cetățenie", "Relația cu firma"]);
      const types = page.getByRole("region", { name: "Tipuri de Proprietate", exact: true });
      const uses = page.getByRole("region", { name: "Categorii Folosință", exact: true });
      await expect(types).toBeVisible({ timeout: 30_000 });
      await expect(uses).toBeVisible();
      await expect(grid(page).getByRole("heading", { name: "Folosințe permise pentru fiecare tip" })).toBeVisible();

      // Step 2 — the nine types; the two new uses; no value in both lists.
      await expect(types.locator("tbody tr")).toHaveCount(TYPES.length, { timeout: 30_000 });
      const typeNames = await types.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => (tr as HTMLElement).innerText.split("\t")[0].trim()));
      expect([...typeNames].sort()).toEqual([...TYPES].sort());
      const useNames = await uses.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => (tr as HTMLElement).innerText.split("\t")[0].trim()));
      expect(useNames).toEqual(expect.arrayContaining(["Curți-construcții", "Drumuri"]));
      expect(useNames.filter((u) => typeNames.includes(u))).toEqual([]);

      // Step 3 — the grid in the sort order, its ticks, „(toate)” on the open types.
      await expect(grid(page).locator("tr[data-type-row]")).toHaveCount(TYPES.length, { timeout: 30_000 });
      expect(await grid(page).locator("tr[data-type-row]").evaluateAll((trs) => trs.map((tr) => (tr as HTMLElement).dataset.typeRow))).toEqual(TYPES);
      expect(await tickedOn(page, "Teren extravilan")).toEqual(AGRICULTURAL);
      for (const b of BUILDINGS) expect({ b, on: await tickedOn(page, b) }).toEqual({ b, on: ["Curți-construcții"] });
      for (const o of OPEN) {
        expect({ o, on: await tickedOn(page, o) }).toEqual({ o, on: [] });
        await expect(row(page, o).locator("[data-allows-all]")).toHaveText("(toate)");
      }

      // Step 4 — the uses' address opens the same page.
      await page.goto("/admin/value-lists?list=use-categories");
      await expect(nav.getByRole("button", { name: "Tipuri de Proprietate și Folosințe", exact: true })).toHaveAttribute("aria-current", "page", { timeout: 30_000 });
      await expect(grid(page)).toBeVisible();

      // Step 5 — the property: its use kept, the type's one offered, the sentence.
      const typeSelect = page.locator('select[name="propertyTypeId"]');
      const useSelect = page.locator('select[name="useCategoryId"]');
      const note = page.locator("[data-use-not-allowed]");
      await page.goto(`/properties/${id}`);
      await expect(useSelect.locator("option")).toHaveText(["niciunul", "Arabil", "Curți-construcții"], { timeout: 30_000 });
      await expect(useSelect.locator("option:checked")).toHaveText("Arabil");
      await expect(note).toHaveText(NOT_ALLOWED("Casă"));

      // Step 6 — „Teren intravilan”, not saved: every use, no sentence.
      await typeSelect.selectOption({ label: "Teren intravilan" });
      await expect(note).toHaveCount(0);
      expect(await useSelect.locator("option").count()).toBe(useNames.length + 1);

      // Step 7 — „Drumuri” ticked on „Teren intravilan”: kept after a reload; the form follows.
      await page.goto("/admin/value-lists?list=property-types");
      await expect(tick(page, "Drumuri", "Teren intravilan")).toBeVisible({ timeout: 30_000 });
      await press(page, "Drumuri", "Teren intravilan");
      ticked = true;
      await page.reload();
      await expect(tick(page, "Drumuri", "Teren intravilan")).toBeChecked({ timeout: 30_000 });
      await expect(row(page, "Teren intravilan").locator("[data-allows-all]")).toHaveCount(0);
      await page.goto(`/properties/${id}`);
      await expect(useSelect.locator("option:checked")).toHaveText("Arabil", { timeout: 30_000 });
      await typeSelect.selectOption({ label: "Teren intravilan" });
      await expect(useSelect.locator("option")).toHaveText(["niciunul", "Arabil", "Drumuri"]);
      await expect(note).toHaveText(NOT_ALLOWED("Teren intravilan"));

      // Step 8 — unticked: „(toate)” again.
      await page.goto("/admin/value-lists?list=property-types");
      await expect(tick(page, "Drumuri", "Teren intravilan")).toBeChecked({ timeout: 30_000 });
      await press(page, "Drumuri", "Teren intravilan");
      ticked = false;
      await expect(row(page, "Teren intravilan").locator("[data-allows-all]")).toHaveText("(toate)", { timeout: 15_000 });

      // Step 9 — #39.75: tiles. At 1920 the types (5 units) and the uses (3) side by side, the grid (5) under the
      // types; each list with the same gap either side; „Implicit" above. At 1366 the three one under another.
      const tileOf = (k: string) => page.locator(`[data-tile="${k}"]`);
      const at = async () =>
        page.evaluate(() =>
          Object.fromEntries(
            [...document.querySelectorAll<HTMLElement>("[data-reference-tiles] [data-tile]")].map((t) => {
              const r = t.getBoundingClientRect();
              const list = (t.querySelector("table") as HTMLElement).getBoundingClientRect();
              return [t.dataset.tile, { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), units: Number(t.dataset.tileUnits), left: list.x - r.x, right: r.right - list.right }];
            }),
          ),
        );
      await expect(page.locator('[data-reference-tiles] [data-tile-positions-reset="reference-property-types"]')).toBeVisible();
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect.poll(async () => { const t = await at(); return t["use-categories"]?.y === t["property-types"]?.y && t["use-categories"].x > t["property-types"].x; }, { timeout: 15_000 }).toBe(true);
      const wide = await at();
      expect([wide["property-types"].units, wide["use-categories"].units, wide["type-uses"].units]).toEqual([5, 3, 5]);
      expect(wide["type-uses"].x).toBe(wide["property-types"].x);
      expect(wide["type-uses"].y).toBeGreaterThan(wide["property-types"].y);
      for (const [k, t] of Object.entries(wide)) expect({ k, even: Math.abs(t.left - t.right) <= 2 }).toEqual({ k, even: true });
      await expect(tileOf("property-types")).toHaveCSS("width", "804px");
      await page.setViewportSize({ width: 1366, height: 900 });
      await expect.poll(async () => { const t = await at(); return new Set(Object.values(t).map((v) => v.x)).size; }, { timeout: 15_000 }).toBe(1);
    } finally {
      if (ticked) {
        await page.request.put("/api/admin/property-type-uses", {
          data: {
            propertyTypeId: await idOf(page.request, "property-types", "Teren intravilan"),
            useCategoryId: await idOf(page.request, "use-categories", "Drumuri"),
            allowed: false,
          },
        });
      }
      await removeRecord(page.request, "property", id);
    }
  });
});
