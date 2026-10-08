/**
 * Case:   TC-VL-02 — „Date de referință” pe o pagină: „folosit de N” pe fiecare rând, valorile nefolosite la urmă, două valori unite
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
 *     dialog, at 1366 and 1920 px, into `playwright-report/value-list-page/`.
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
  test("„folosit de” pe ambele valori, nefolosita la urmă, „Unește” mută și șterge", async ({ page }) => {
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

      // Step 1 — the page: the five categories; „Categorii Folosință" open, marked in the column.
      await page.goto("/admin/value-lists?list=use-categories");
      const nav = page.getByRole("navigation", { name: "Liste de referință" });
      await expect(nav.locator("h2")).toHaveText(["Proprietăți", "Persoane", "Acte", "Roluri", "Legături între obiecte"], { timeout: 30_000 });
      await expect(nav.getByRole("button", { name: "Categorii Folosință", exact: true })).toHaveAttribute("aria-current", "page");
      const panel = page.getByRole("region", { name: "Categorii Folosință", exact: true });
      await expect(panel.getByRole("columnheader", { name: "Folosit de" })).toBeVisible({ timeout: 30_000 });

      // Step 2 — „folosit de" on each; the unused value greyed, after the two in use.
      const row = (name: string) => panel.locator("tbody tr").filter({ hasText: name });
      await expect(row(KEPT)).toContainText("folosit de 2 înregistrări", { timeout: 30_000 });
      await expect(row(MERGED)).toContainText("folosit de 1 înregistrare");
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
      await expect(row(KEPT)).toContainText("folosit de 3 înregistrări", { timeout: 15_000 });

      // Step 5 — another list, then the browser's Back: „Categorii Folosință" again.
      await nav.getByRole("button", { name: "Cetățenie", exact: true }).click();
      await expect(page).toHaveURL(/\?list=citizenships$/, { timeout: 15_000 });
      await expect(page.getByRole("region", { name: "Cetățenie", exact: true })).toBeVisible({ timeout: 15_000 });
      await page.goBack();
      await expect(page).toHaveURL(/\?list=use-categories$/, { timeout: 15_000 });
      await expect(panel).toBeVisible({ timeout: 15_000 });
    } finally {
      await page.waitForLoadState("networkidle").catch(() => {});
      for (const id of properties) await removeRecord(page.request, "property", id);
      await removeValues(page.request);
    }
  });
});
