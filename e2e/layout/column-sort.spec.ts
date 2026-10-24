/**
 * Case:   TC-LAYOUT-10 — Pictograma de ordonare din banda de nume: pe coloanele care ordonează, două săgeți; apăsată, o săgeată bleumarin în cerc, toată lista ordonată după coloană
 * Source: docs/testing/cases/TC-LAYOUT-10.md, „Last green" 2026-10-24 (step 9 is 40.48's)
 *
 * A translation of the case file, step for step (Slice 40.47). The columns are chosen by writing each list's stored
 * choice before the page loads, as TC-LAYOUT-05 does. „The rows' order" is read from the list's own answer by the
 * column's value, empty values last; the first row on screen is matched to it by its link's id. No record's text is
 * read.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The hand run read the answers by fetching the route itself; here the page's own request is awaited.
 *   - This test's browser context is new, so nothing is stored under the four keys before it; it is thrown away after.
 */
import { test, expect, type Page, type Response } from "../helpers/test";
import { openFromSidebar } from "../helpers/sidebar";

type Row = Record<string, unknown> & { id: string };

const CHOICES: Record<string, string[]> = {
  "ga40-col-person-v3": ["dateOfBirth", "age", "dateOfDeath", "changed"], // 40.55: „Modificat la" (was "createdAt")
  "ga40-col-property-v4": ["tarlaSola", "parcela", "surfaceAreaMp", "calculatedAreaMp"],
  "ga40-col-company-v2": ["judicialPersonType", "changed"], // 40.55: „Modificat la" (was "createdAt")
  "ga40-col-document-v3": ["dateDocument", "pageCount", "personCount", "createdAt"],
};

/** Ordered `dir` by `value`, empty values last. */
function expectOrdered(items: Row[], value: (r: Row) => number | string | null, dir: "asc" | "desc"): void {
  const vals = items.map(value);
  expect(vals.length).toBeGreaterThan(1);
  const firstEmpty = vals.findIndex((v) => v === null);
  if (firstEmpty >= 0) expect(vals.slice(firstEmpty).every((v) => v === null)).toBe(true);
  const filled = vals.filter((v): v is number | string => v !== null);
  for (let i = 1; i < filled.length; i++) expect([i, dir === "asc" ? filled[i - 1] <= filled[i] : filled[i - 1] >= filled[i]]).toEqual([i, true]);
}

async function answer(page: Page, api: string, action: () => Promise<unknown>): Promise<Row[]> {
  const isList = (r: Response) => new URL(r.url()).pathname === api && r.request().method() === "GET" && r.ok();
  const [res] = await Promise.all([page.waitForResponse(isList, { timeout: 30_000 }), action()]);
  return ((await res.json()) as { items: Row[] }).items;
}

const sortButton = (page: Page) => page.locator("main [data-sort-control]");
const icon = (page: Page, key: string) => page.locator(`main [data-column-sort="${key}"]`);
const firstRowLink = (page: Page, path: string) => page.locator("main tbody tr").first().locator(`a[href^="${path}/"]`);

/** Each name cell: its name, and its sort icon's state — „-" for none. */
async function heads(page: Page): Promise<string[]> {
  return page.locator("main thead th").evaluateAll((ths) =>
    ths
      .filter((th) => th.querySelector("[data-head-text]"))
      .map((th) => `${th.querySelector("[data-head-text]")!.textContent}:${(th.querySelector("[data-column-sort]") as HTMLElement | null)?.dataset.sortState ?? "-"}`),
  );
}

const dateOf = (k: string) => (r: Row) => (r[k] == null ? null : String(r[k]));
const numberOf = (k: string) => (r: Row) => (r[k] == null ? null : Number(r[k]));

test.describe("TC-LAYOUT-10 — pictograma de ordonare din banda de nume", () => {
  test("două săgeți pe coloanele care ordonează; apăsată, o săgeată în cerc, toată lista ordonată după coloană", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    // Once per tab, before the first page's scripts: step 9 writes a choice of its own, which a later load must keep.
    await page.addInitScript((choices) => {
      if (sessionStorage.getItem("tc-layout-10")) return;
      for (const [k, v] of Object.entries(choices)) localStorage.setItem(k, JSON.stringify(v));
      sessionStorage.setItem("tc-layout-10", "1");
    }, CHOICES);
    await page.goto("/");

    // Step 1 — „Persoane Fizice": the four columns' two arrows; none on Nume and Poreclă.
    await openFromSidebar(page, "Persoane Fizice");
    await expect(sortButton(page)).toHaveText("Recente întâi", { timeout: 30_000 });
    await expect.poll(() => heads(page), { timeout: 30_000 }).toEqual(["Nume:-", "Poreclă:-", "Născut pe:none", "Vârstă:none", "Decedat pe:none", "Modificat la:none"]);
    await expect(icon(page, "dateOfBirth").locator("svg")).toHaveClass(/lucide-arrow-up-down/);
    // Left of the funnel, 2 px from it.
    const gap = await page.locator('main thead th:has([data-column-sort="dateOfBirth"])').evaluate((th) => {
      const s = th.querySelector("[data-head-sort]")!.getBoundingClientRect();
      const f = th.querySelector("[data-head-funnel]")!.getBoundingClientRect();
      return Math.round(f.left - s.right);
    });
    expect(gap).toBe(2);

    // Step 2 — pressed: one arrow up, in use; earliest birth first, empty last.
    const asc = await answer(page, "/api/people", () => icon(page, "dateOfBirth").locator("button").click());
    expectOrdered(asc, dateOf("dateOfBirth"), "asc");
    await expect(icon(page, "dateOfBirth")).toHaveAttribute("data-sort-state", "asc");
    await expect(icon(page, "dateOfBirth").locator("svg")).toHaveClass(/lucide-arrow-up(?!-)/);
    await expect(page.locator('main thead th:has([data-column-sort="dateOfBirth"])')).toHaveAttribute("aria-sort", "ascending");
    await expect(sortButton(page)).toHaveText("Ordonat după „Născut pe”");
    await expect(page).toHaveURL(/[?&]sort=dateOfBirth&order=asc\b/);
    await expect(firstRowLink(page, "/natural-persons")).toHaveAttribute("href", `/natural-persons/${asc[0].id}`);

    // Step 3 — again: latest first.
    const desc = await answer(page, "/api/people", () => icon(page, "dateOfBirth").locator("button").click());
    expectOrdered(desc, dateOf("dateOfBirth"), "desc");
    await expect(icon(page, "dateOfBirth")).toHaveAttribute("data-sort-state", "desc");
    await expect(page.locator('main thead th:has([data-column-sort="dateOfBirth"])')).toHaveAttribute("aria-sort", "descending");
    await expect(firstRowLink(page, "/natural-persons")).toHaveAttribute("href", `/natural-persons/${desc[0].id}`);

    // Step 4 — the first row's record, then Back: still sorted, the same first row.
    await firstRowLink(page, "/natural-persons").click();
    await expect(page).toHaveURL(new RegExp(`/natural-persons/${desc[0].id}$`), { timeout: 30_000 });
    await page.goBack();
    await expect(icon(page, "dateOfBirth")).toHaveAttribute("data-sort-state", "desc", { timeout: 30_000 });
    await expect(firstRowLink(page, "/natural-persons")).toHaveAttribute("href", `/natural-persons/${desc[0].id}`, { timeout: 30_000 });

    // Step 5 — the sort button: back to „Recente întâi", nothing in use.
    await sortButton(page).click();
    await expect(sortButton(page)).toHaveText("Recente întâi");
    await expect(page.locator('main [data-column-sort]:not([data-sort-state="none"])')).toHaveCount(0);
    expect(new URL(page.url()).searchParams.has("sort")).toBe(false);

    // Step 6 — „Proprietăți", „Supr. Calc.": smallest first, as numbers.
    await openFromSidebar(page, "Proprietăți");
    await expect.poll(() => heads(page), { timeout: 30_000 }).toEqual(["Poreclă:-", "Tarla:none", "Parcelă:none", "Supr. Ofic.:none", "Supr. Calc.:none"]);
    const areas = await answer(page, "/api/properties", () => icon(page, "calculatedAreaMp").locator("button").click());
    expectOrdered(areas, numberOf("calculatedAreaMp"), "asc");
    await expect(icon(page, "calculatedAreaMp")).toHaveAttribute("data-sort-state", "asc");
    await expect(sortButton(page)).toHaveText("Ordonat după „Supr. Calc.”");

    // Step 7 — „Persoane Juridice", „Modificat la" (40.55; it was „Adăugat la", newest added first): the two arrows in
    // the default order; pressed, it flips it — the change longest ago first, „Vechi întâi"; „Tip" a funnel only.
    await openFromSidebar(page, "Persoane Juridice");
    await expect.poll(() => heads(page), { timeout: 30_000 }).toEqual(["Denumire:-", "Poreclă:-", "Tip:-", "Modificat la:none"]);
    await expect(page.locator('main thead th:has([data-column-sort="changed"])')).toHaveAttribute("aria-sort", "descending");
    const changed = await answer(page, "/api/judicial-persons", () => icon(page, "changed").locator("button").click());
    expectOrdered(changed, (r) => Math.max(Date.parse(String(r.createdAt)), r.updatedAt ? Date.parse(String(r.updatedAt)) : 0), "asc");
    await expect(icon(page, "changed")).toHaveAttribute("data-sort-state", "asc");
    await expect(icon(page, "changed").locator("svg")).toHaveClass(/lucide-arrow-up(?!-)/);
    await expect(sortButton(page)).toHaveText("Vechi întâi");
    await expect(page).toHaveURL(/[?&]sort=changed&order=asc\b/);

    // Step 8 — „Acte", „Pagini": fewest first; none on Tip or Titlu.
    await openFromSidebar(page, "Acte");
    await expect.poll(() => heads(page), { timeout: 30_000 }).toEqual(["Tip:-", "Titlu:-", "Data:none", "Pagini:none", "Persoane:none", "Adăugat la:none"]);
    const pages = await answer(page, "/api/documents", () => icon(page, "pageCount").locator("button").click());
    expectOrdered(pages, numberOf("pageCount"), "asc");
    await expect(icon(page, "pageCount")).toHaveAttribute("data-sort-state", "asc");
    await expect(sortButton(page)).toHaveText("Ordonat după „Pagini”");

    // Step 9 (40.48) — the two looks: „Gen"'s funnel in use, navy in a circle and filled; the rest the glyph alone.
    await page.evaluate(() => localStorage.setItem("ga40-col-person-v3", JSON.stringify(["gender", "dateOfBirth", "changed"])));
    await page.goto("/natural-persons?gender=MALE");
    const gender = page.locator('main [data-filter-funnel="gender"] button');
    await expect(gender).toHaveAttribute("data-in-use", "true", { timeout: 30_000 });
    const looks = await page.locator("main thead").evaluate((band) =>
      [...band.querySelectorAll<HTMLButtonElement>("[data-filter-funnel] button, [data-column-sort] button")].map((b) => {
        const cs = getComputedStyle(b);
        return {
          key: b.closest<HTMLElement>("[data-filter-funnel]")?.dataset.filterFunnel ?? `sort:${b.closest<HTMLElement>("[data-column-sort]")!.dataset.columnSort}`,
          inUse: b.dataset.inUse,
          border: cs.borderTopStyle === "none" || parseFloat(cs.borderTopWidth) === 0 ? "none" : cs.borderTopColor,
          bg: cs.backgroundColor,
          round: parseFloat(cs.borderTopLeftRadius) >= 6,
          fill: getComputedStyle(b.querySelector("svg")!).fill,
        };
      }),
    );
    const NAVY = "rgb(30, 58, 138)";
    expect(looks.find((l) => l.key === "gender")).toEqual({ key: "gender", inUse: "true", border: NAVY, bg: "rgb(255, 255, 255)", round: true, fill: NAVY });
    const rest = looks.filter((l) => l.key !== "gender");
    expect(rest.map((l) => l.key)).toEqual(expect.arrayContaining(["dateOfBirth", "sort:dateOfBirth", "sort:changed"]));
    for (const l of rest) expect(l).toEqual({ key: l.key, inUse: "false", border: "none", bg: "rgba(0, 0, 0, 0)", round: false, fill: "none" });
  });
});
