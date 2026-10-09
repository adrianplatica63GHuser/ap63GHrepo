/**
 * Case:   TC-VL-02 — „Date de referință” pe o pagină: „N obiecte” pe fiecare rând, valorile nefolosite la urmă, două valori unite
 * Source: docs/testing/cases/TC-VL-02.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step (Slice #38.35). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The three values on „Categorii Folosință" and the three properties are
 *     created through the routes the screens call, with `TC-E2E-VL-02` names,
 *     and removed in `finally` (a value by DELETE, after its properties).
 *   - Slice #38.35's pictures, not steps of the case: the page and the merge
 *     dialog, at 1366 and 1920 px, into `playwright-report/value-list-page/`;
 *     Slice #38.65's, „Roluri Persoane" under the narrower column, beside them.
 */

import { test, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}VL-02`;
const KEPT = `${MARK} Păstrată`;
const MERGED = `${MARK} Unită`;
const UNUSED = `${MARK} Nefolosită`;
const LIST = "/api/admin/value-lists/use-categories";
const SHOTS = "playwright-report/value-list-page";

type Row = { id: string; name: string };

async function values(request: APIRequestContext): Promise<Row[]> {
  const res = await request.get(LIST);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { items?: Row[] } | Row[];
  return Array.isArray(body) ? body : body.items ?? [];
}

async function addValue(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post(LIST, { data: { name } });
  expect(res.ok(), `POST ${LIST} failed (${res.status()})`).toBeTruthy();
  return ((await res.json()) as Row).id;
}

async function removeValues(request: APIRequestContext): Promise<void> {
  for (const v of await values(request)) {
    if (v.name?.startsWith(MARK)) await request.delete(`${LIST}/${v.id}`);
  }
}

async function photograph(page: Page, name: string, target: Locator | null): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    if (target) await target.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
    else await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-VL-02 — „Date de referință” pe o pagină, două valori unite", () => {
  test("„N obiecte” pe ambele valori, nefolosita la urmă, „Unește” mută și șterge", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await removeValues(page.request);
    await page.setViewportSize({ width: 1366, height: 900 });
    const properties: string[] = [];
    try {
      const kept = await addValue(page.request, KEPT);
      const merged = await addValue(page.request, MERGED);
      await addValue(page.request, UNUSED);
      properties.push(await createProperty(page.request, { nickname: `${MARK} P1`, useCategoryId: kept }));
      properties.push(await createProperty(page.request, { nickname: `${MARK} P2`, useCategoryId: kept }));
      properties.push(await createProperty(page.request, { nickname: `${MARK} P3`, useCategoryId: merged }));

      // Step 1 — the page: Adrian's three groups, each with its lists in his order (#38.61 — #38.35 had five,
      // „Proprietăți", „Persoane", „Acte", „Roluri", „Legături între obiecte"); no list name wraps; „Categorii
      // Folosință" open, marked in the column.
      await page.goto("/admin/value-lists?list=use-categories");
      const nav = page.getByRole("navigation", { name: "Liste de referință" });
      await expect(nav.locator("h2")).toHaveText(["Tipuri de obiecte", "Roluri și legături", "Liste de valori"], { timeout: 30_000 });
      const groups = await nav.locator("[data-category]").evaluateAll((els) =>
        els.map((el) => [...el.querySelectorAll<HTMLButtonElement>("button[data-list-key]")].map((b) => ({
          name: b.innerText.trim(),
          oneLine: b.getBoundingClientRect().height < parseFloat(getComputedStyle(b).lineHeight) * 1.5 + 8,
          whole: b.scrollWidth <= b.clientWidth + 1,
        }))),
      );
      expect(groups.map((g) => g.map((b) => b.name))).toEqual([
        ["Tipuri de Persoană Fizică", "Tipuri de Persoană Juridică", "Tipuri de Proprietate", "Tipuri de Document"],
        ["Roluri Persoane", "Legături Proprietate → Proprietate", "Legături Document → Document"],
        ["Indicative Tarla", "Categorii Folosință", "Cetățenie", "Instituții"],
      ]);
      expect(groups.flat().filter((b) => !b.oneLine || !b.whole).map((b) => b.name)).toEqual([]);
      await expect(nav.getByRole("button", { name: "Categorii Folosință", exact: true })).toHaveAttribute("aria-current", "page");
      const panel = page.getByRole("region", { name: "Categorii Folosință", exact: true });
      // Slice #38.59: the header is two lines, „Folosit de" over „(n obiecte)".
      await expect(panel.getByRole("columnheader", { name: /^folosit de\s*\(n obiecte\)$/i })).toBeVisible({ timeout: 30_000 });

      // Step 2 — the count on each, „N obiecte" (#38.59; #38.35 read „folosit de N înregistrări"); the unused value
      // greyed, after the two in use.
      const row = (name: string) => panel.locator("tbody tr").filter({ hasText: name });
      await expect(row(KEPT).locator("[data-usage]")).toHaveText("2 obiecte", { timeout: 30_000 });
      await expect(row(MERGED).locator("[data-usage]")).toHaveText("1 obiect");
      await expect(row(UNUSED)).toContainText("nefolosit");
      await expect(row(UNUSED)).toHaveAttribute("data-unused", "");
      const names = await panel.locator("tbody tr").allTextContents();
      const at = (n: string) => names.findIndex((t) => t.includes(n));
      expect(at(UNUSED)).toBeGreaterThan(at(KEPT));
      expect(at(UNUSED)).toBeGreaterThan(at(MERGED));
      await photograph(page, "use-categories", null);

      // Step 3 — „Unește" on the merged one: the dialog, one record to move, the value to keep.
      await row(MERGED).getByRole("button", { name: "Unește", exact: true }).click();
      const dialog = page.getByRole("alertdialog", { name: `Unește „${MERGED}” cu altă valoare` });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("O înregistrare se mută pe valoarea păstrată:", { timeout: 15_000 });
      await dialog.locator("select").selectOption({ label: KEPT });
      await photograph(page, "merge-dialog", dialog);

      // Step 4 — „Unește": the merged value is gone, the kept one is used by three.
      await dialog.getByRole("button", { name: "Unește", exact: true }).click();
      await expect(dialog).toHaveCount(0, { timeout: 15_000 });
      await expect(row(MERGED)).toHaveCount(0, { timeout: 15_000 });
      await expect(row(KEPT).locator("[data-usage]")).toHaveText("3 obiecte", { timeout: 15_000 });

      // Step 5 — another list, then the browser's Back: „Categorii Folosință" again.
      await nav.getByRole("button", { name: "Cetățenie", exact: true }).click();
      await expect(page).toHaveURL(/\?list=citizenships$/, { timeout: 15_000 });
      await expect(page.getByRole("region", { name: "Cetățenie", exact: true })).toBeVisible({ timeout: 15_000 });
      await page.goBack();
      await expect(page).toHaveURL(/\?list=use-categories$/, { timeout: 15_000 });
      await expect(panel).toBeVisible({ timeout: 15_000 });

      // Step 6 — (#38.61) the list keys did not change: `?list=person-roles` still opens the roles, under their new title.
      await page.goto("/admin/value-lists?list=person-roles");
      await expect(page.getByRole("region", { name: "Roluri Persoane", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(nav.getByRole("button", { name: "Roluri Persoane", exact: true })).toHaveAttribute("aria-current", "page");

      // Step 7 — (#38.65) the column is as wide as its longest name: the gap after „Legături Proprietate →
      // Proprietate" within 4 px of the gap before it. At 1920 px the list's side starts just under the breadcrumbs
      // bar, level with the page title; at 1366 px it is still under the column (Ask first #2).
      const gaps = (await nav.getByRole("button", { name: "Legături Proprietate → Proprietate", exact: true }).evaluate((b) => {
        const navBox = b.closest("nav")!.getBoundingClientRect();
        const text = (el: Element) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
        const widest = Math.max(...[...b.closest("nav")!.querySelectorAll("button[data-list-key]")].map((x) => text(x).width));
        const own = text(b);
        return { before: own.left - navBox.left, after: navBox.right - own.right, widest: own.width >= widest - 0.5 };
      }));
      expect(gaps.widest, "„Legături Proprietate → Proprietate” is the longest name").toBe(true);
      expect(Math.abs(gaps.after - gaps.before), `gap before ${gaps.before} px, after ${gaps.after} px`).toBeLessThanOrEqual(4);
      const bar = page.getByRole("navigation", { name: "Fir de navigare" });
      const title = page.getByRole("heading", { level: 1, name: "Date de referință" });
      const side = page.locator("[data-value-list-side]");
      await page.setViewportSize({ width: 1920, height: 900 });
      await page.waitForTimeout(300);
      const [barBox, titleBox, sideBox] = [await bar.boundingBox(), await title.boundingBox(), await side.boundingBox()];
      expect(barBox && titleBox && sideBox, "the bar, the title and the list's side are drawn").toBeTruthy();
      const under = sideBox!.y - (barBox!.y + barBox!.height);
      expect(under, `the list's side starts ${under} px under the breadcrumbs bar`).toBeGreaterThanOrEqual(0);
      expect(under).toBeLessThanOrEqual(8);
      expect(Math.abs(sideBox!.y - titleBox!.y), "the list's side is level with the title").toBeLessThanOrEqual(2);
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.waitForTimeout(300);
      const navBox = await nav.boundingBox();
      expect((await side.boundingBox())!.y, "at 1366 px the list stays under the column").toBeGreaterThan(navBox!.y + navBox!.height);
      await photograph(page, "narrow-column", null);
    } finally {
      await page.waitForLoadState("networkidle").catch(() => {});
      for (const id of properties) await removeRecord(page.request, "property", id);
      await removeValues(page.request);
    }
  });
});
