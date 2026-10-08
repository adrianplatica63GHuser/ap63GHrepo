/**
 * Case:   TC-DOC-20 — Actul adițional: „Actul modificat" legat de contractul pe care îl modifică, câmpurile text doar fără legătură, un singur act modificat
 * Source: docs/testing/cases/TC-DOC-20.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step (Slice #38.34). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The three documents are created through the route, with `TC-E2E-DOC-20`
 *     names (e2e/helpers/records.ts), and removed in `finally`.
 *   - The tiles are read as regions by their names; the boxes by their field
 *     (`data-width-field`).
 *   - Slice #38.34's pictures, not steps of the case: „Actul modificat" linked
 *     and not, and the page, at 1366 and 1920 px, into `playwright-report/addendum-tiles/`.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}DOC-20`;
const ACT = `${MARK} Act`;
const CVC = `${MARK} CVC`;
const OTHER = `${MARK} Alt CVC`;
const SHOTS = "playwright-report/addendum-tiles";

const amended = (page: Page) => page.getByRole("region", { name: "Actul modificat", exact: true });
const fallback = (page: Page) => amended(page).locator('[data-width-field="customFields.actParinteNumar"]');

async function photograph(page: Page, name: string, target: Locator | null): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    if (target) await target.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
    else await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-DOC-20 — actul adițional și actul pe care îl modifică", () => {
  test("legat, refuzat a doua oară, dezlegat — câmpurile text revin cu ce aveau", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const made: string[] = [];
    try {
      made.push(await createDocumentOfType(page.request, "CONTRACT_VANZARE", CVC));
      made.push(await createDocumentOfType(page.request, "CONTRACT_VANZARE", OTHER));
      const act = await createDocumentOfType(page.request, "ACT_ADITIONAL", ACT);
      made.push(act);

      // Step 1 — the four tiles; „Onorariu notarial" on „Identificarea actului"; no deed yet.
      await page.goto(`/documents/${act}`);
      await expect(page.getByRole("heading", { name: ACT })).toBeVisible({ timeout: 30_000 });
      for (const name of ["Actul modificat", "Ce modifică", "Părți"]) await showTile(page, name);
      const general = page.locator('[data-panel="general"]');
      for (const label of ["Notariat", "Nr. act autentic", "Data autentificării", "Calitate exemplar", "Exemplare emise", "Onorariu notarial"]) {
        await expect(general.getByText(label, { exact: true }).first()).toBeVisible();
      }
      await expect(amended(page).getByRole("button", { name: "Leagă actul modificat", exact: true })).toBeVisible();
      await expect(amended(page).getByText("Actul modificat nu e în arhivă — datele lui, așa cum le dă actul adițional:")).toBeVisible();
      await expect(fallback(page)).toBeVisible();
      const changes = page.getByRole("region", { name: "Ce modifică", exact: true });
      for (const label of ["Motiv completare", "Efect urmărit", "Preț neschimbat", "Liber de sarcini"]) {
        await expect(changes.getByText(label, { exact: true }).first()).toBeVisible();
      }

      // Step 2 — `TC-1` into „Nr. act părinte", „Salvează": „v 1".
      await fallback(page).fill("TC-1");
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page.getByText("v 1", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
      await photograph(page, "amended-none", amended(page));

      // Step 3 — „Leagă actul modificat", `TC-E2E-DOC-20`: the two contracts; „Leagă" on the first.
      await amended(page).getByRole("button", { name: "Leagă actul modificat", exact: true }).click();
      await amended(page).getByRole("searchbox", { name: "Caută actul modificat" }).fill(MARK);
      const results = amended(page).locator("[data-parent-candidate]");
      await expect(results).toHaveCount(2, { timeout: 15_000 });
      await expect(results.first()).toHaveAttribute("data-parent-candidate", "CONTRACT_VANZARE");
      await amended(page).getByRole("button", { name: `Leagă „${CVC}”`, exact: true }).click();
      const deed = amended(page).locator("[data-parent-deed]");
      await expect(deed).toContainText(CVC, { timeout: 15_000 });
      await expect(deed).toContainText("Contract de Vânzare");
      await expect(deed.getByRole("link", { name: "Deschide", exact: true })).toHaveAttribute("href", /\/documents\//);
      await expect(fallback(page)).toBeHidden();
      await expect(amended(page).getByText("Actul modificat nu e în arhivă", { exact: false })).toHaveCount(0);
      await photograph(page, "amended-linked", amended(page));
      await photograph(page, "addendum-page", null);

      // Step 4 — a second deed through „Legături" → „Asociază act", „Act adițional la": refused, naming the first.
      const links = await showTile(page, "Legături");
      await links.getByRole("button", { name: "Asociază act", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Asociază Document" })).toBeVisible({ timeout: 30_000 });
      await page.getByPlaceholder("Cod sau titlu…", { exact: true }).fill(OTHER);
      await page.getByRole("checkbox", { name: OTHER }).check({ timeout: 15_000 });
      await page.getByRole("combobox", { name: "Tip relație", exact: true }).selectOption({ label: "Act adițional la" });
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page.getByText(`Acest act adițional modifică deja „${CVC}”. Dezlegați-l întâi.`)).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${act}\\?tab=related$`), { timeout: 30_000 });

      // Step 5 — „Dezleagă": „Leagă actul modificat" again, and `TC-1` still in „Nr. act părinte".
      await amended(page).getByRole("button", { name: "Dezleagă", exact: true }).click();
      await expect(amended(page).getByRole("button", { name: "Leagă actul modificat", exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(fallback(page)).toBeVisible();
      await expect(fallback(page)).toHaveValue("TC-1");
    } finally {
      await page.waitForLoadState("networkidle").catch(() => {});
      for (const id of made.reverse()) await removeRecord(page.request, "document", id);
    }
  });
});
