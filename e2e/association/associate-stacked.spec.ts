/**
 * Case:   TC-ASSOC-13 — Ecranele de asociere: „Căutare", „Rezultate" și „Asociere" una sub alta; numele proprietății pe un rând
 * Source: docs/testing/cases/TC-ASSOC-13.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-ASSOC-13` (records.ts).
 *   - The window is 1366 × 768, the header's laptop: the hand runs were at
 *     2016 × 920, where „Asociere persoană" fits without the sticky tile.
 *   - Slice #37.58's pictures, not steps of the case: „Asociere persoană",
 *     „Asociere proprietate" (filtered to this case's property, so no real
 *     record is pictured) and the PAD's „Proprietăți" tile, at 1366 and 1920
 *     px, into `playwright-report/associate-stacked/`. „Asociere persoană"'s
 *     results list real people, so that picture is of the tiles' frames only,
 *     the results table masked.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  E2E_MARKER,
  createDocumentOfType,
  createProperty,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ASSOC-13`;
const PAD = `${MARK} PAD`;
const PROPERTY = `${MARK} Parcelă de test cu un nume lung`;
const SHOTS = "playwright-report/associate-stacked";

/** The three tiles: one under another, the same left edge; „Asociere" below „Rezultate" or held at the window's bottom. */
async function expectStacked(page: Page): Promise<void> {
  const m = await page.evaluate(() => {
    const box = (n: string) => document.querySelector<HTMLElement>(`[data-tile="${n}"]`)!.getBoundingClientRect();
    const [s, r, a] = ["search", "results", "association"].map(box);
    const buttons = [...document.querySelectorAll<HTMLElement>('[data-tile="association"] button')].map((b) => b.getBoundingClientRect());
    return {
      lefts: [s.left, r.left, a.left].map(Math.round),
      resultsBelowSearch: r.top >= s.bottom,
      associationBelowOrHeld: a.top >= r.bottom || Math.abs(a.bottom - window.innerHeight) <= 1,
      buttonsInView: buttons.length >= 2 && buttons.every((b) => b.top >= 0 && b.bottom <= window.innerHeight),
    };
  });
  expect(new Set(m.lefts).size, `left edges ${m.lefts.join(", ")}`).toBe(1);
  expect(m.resultsBelowSearch).toBe(true);
  expect(m.associationBelowOrHeld).toBe(true);
  expect(m.buttonsInView).toBe(true);
}

/** „On one line": the cell's text is one line, and not cut. */
async function expectOneLine(cell: Locator): Promise<void> {
  const m = await cell.evaluate((td) => {
    const range = document.createRange();
    range.selectNodeContents(td);
    return {
      lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size,
      cut: td.scrollWidth > td.clientWidth,
    };
  });
  expect(m).toEqual({ lines: 1, cut: false });
}

async function photograph(page: Page, name: string, target?: Locator, mask: Locator[] = []): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 768 });
    await page.waitForTimeout(300);
    if (target) await target.screenshot({ path: `${SHOTS}/${name}-${width}.png`, mask });
    else await page.locator("main").screenshot({ path: `${SHOTS}/${name}-${width}.png`, mask });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}

test.describe("TC-ASSOC-13 — ecranele de asociere: tile una sub alta; numele proprietății pe un rând", () => {
  test("„Căutare”, „Rezultate”, „Asociere” una sub alta; numele proprietății pe un rând în „Rezultate” și în „Proprietăți”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 768 });
    const padId = await createDocumentOfType(page.request, "PLAN_AMPLASAMENT_DELIMITARE", PAD);
    const propertyId = await createProperty(page.request, { nickname: PROPERTY });
    try {
      // Step 1 — „Persoane" → „Asociază": „Asociere persoană", the three tiles one under another.
      await page.goto(`/documents/${padId}`);
      await expect(page.getByRole("heading", { name: PAD })).toBeVisible({ timeout: 30_000 });
      const persons = await showTile(page, "Persoane");
      await persons.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${padId}/associate-person$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere persoană" })).toBeVisible({ timeout: 30_000 });
      for (const name of ["Căutare", "Rezultate", "Asociere"]) {
        await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
      }
      await expect(page.locator("[data-tile-row] [data-tile]").first()).toHaveAttribute("data-tile", "search");

      // Step 2 — „Asociază selecția" and „Anulează" inside the window, without scrolling.
      await expect(page.getByRole("region", { name: "Rezultate", exact: true }).locator("tbody tr").first()).toBeVisible({ timeout: 30_000 });
      await expectStacked(page);
      await photograph(page, "associate-person", undefined, [page.getByRole("region", { name: "Rezultate", exact: true }).locator("table")]);

      // Step 3 — „Anulează"; „Proprietăți" → „Asociază": „Asociere proprietate", the same three.
      await page.getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${padId}`), { timeout: 30_000 });
      const properties = await showTile(page, "Proprietăți");
      await properties.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${padId}/associate-property$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere proprietate" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("region", { name: "Rezultate", exact: true }).locator("tbody tr").first()).toBeVisible({ timeout: 30_000 });
      await expectStacked(page);

      // Step 4 — `TC-ASSOC-13`: one row, the name on one line.
      await page.getByPlaceholder("Cod sau denumire…", { exact: true }).fill(MARK);
      const row = page.getByRole("region", { name: "Rezultate", exact: true }).locator("tbody tr");
      await expect(row).toHaveCount(1, { timeout: 15_000 });
      const cell = row.locator("td").nth(1);
      await expect(cell).toHaveText(PROPERTY);
      await expectOneLine(cell);
      await expectStacked(page);
      await photograph(page, "associate-property");

      // Step 5 — „Asociază selecția": back on the PAD; „Proprietăți" 4 units, the name on one line.
      await page.getByRole("checkbox", { name: PROPERTY }).check();
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${padId}\\?tab=properties$`), { timeout: 30_000 });
      const tile = page.getByRole("region", { name: "Proprietăți", exact: true });
      const linked = tile.locator("td").filter({ hasText: PROPERTY });
      await expect(linked).toHaveCount(1, { timeout: 30_000 });
      await expectOneLine(linked);
      const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      const width = await tile.evaluate((el) => el.getBoundingClientRect().width);
      expect(Math.round(width)).toBe(Math.round((4 * 9.25 + 3) * rem));
      await photograph(page, "pad-properties", tile);

      // At the end — „Dezasociază" in „Proprietăți" (the PAD's „Persoane" has one too).
      await tile.getByRole("radio", { name: PROPERTY }).check();
      await tile.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(tile.getByText("Nicio proprietate asociată")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "document", padId);
      await removeRecord(page.request, "property", propertyId);
    }
  });
});
