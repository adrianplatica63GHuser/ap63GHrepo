/**
 * Case:   TC-PROP-12 — Căsuțele fișelor pe care tipul proprietății nu le arată: inactive, în cursiv, neatinse de „Toate” și „Implicit”
 * Source: docs/testing/cases/TC-PROP-12.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The property carries `TC-E2E-PROP-12` (records.ts), and its type is found
 *     by its stable key, TEREN_ARABIL.
 *   - This test's browser context is new, so nothing is stored under
 *     `ga40-tiles-property-v1`; the spec removes it anyway, and the context is
 *     thrown away after.
 *   - Playwright's mouse presses „Toate" and „Implicit" and picks the option;
 *     the hand run did both by script (FU-290).
 *   - Slice #38.04's pictures, not steps of the case: the bar of the property
 *     as agricultural and, after step 4, as urban, at 1366 and 1920 px, into
 *     `playwright-report/property-tiles-by-type/`.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { tileBox, TILE_GROUP } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PROP-12`;
const NAME = `${MARK} Teren agricol`;
const SHOTS = "playwright-report/property-tiles-by-type";
const REASON = "Tipul „Teren Arabil” nu afișează această fișă.";
const OFF = ["Adresă", "Street View"];

async function typeIdOf(page: Page, key: string): Promise<string> {
  const res = await page.request.get("/api/admin/value-lists/property-types");
  expect(res.ok()).toBeTruthy();
  const items = ((await res.json()) as { items: { id: string; key: string | null }[] }).items;
  const hit = items.find((i) => i.key === key);
  if (!hit) throw new Error(`No property type with key ${key}`);
  return hit.id;
}

/** A disabled box: unticked, disabled, its label in italics, the type its tooltip. */
async function expectOff(page: Page): Promise<void> {
  for (const name of OFF) {
    const box = tileBox(page, name);
    await expect(box).not.toBeChecked();
    await expect(box).toBeDisabled();
    await expect(box).toHaveAttribute("title", REASON);
    await expect(page.locator(`label[data-tile-disabled]`).filter({ hasText: name })).toHaveCSS("font-style", "italic");
  }
}

async function photograph(page: Page, name: string): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await page.getByRole("group", { name: TILE_GROUP }).screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1920, height: 1200 });
}

test.describe("TC-PROP-12 — căsuțele fișelor pe care tipul nu le arată", () => {
  test("inactive și în cursiv; „Toate” și „Implicit” nu le ating; un tip urban le aduce înapoi", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1200 });
    const id = await createProperty(page.request, { nickname: NAME, propertyTypeId: await typeIdOf(page, "TEREN_ARABIL") });
    try {
      await page.goto("/");
      await page.evaluate(() => localStorage.removeItem("ga40-tiles-property-v1"));

      // Step 1 — the two boxes off, disabled, italic, the type named; the defaults ticked; no „Adresă" tile.
      await page.goto(`/properties/${id}`);
      await expect(page.getByRole("heading", { level: 1, name: NAME, exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("header [data-heading-type-name]")).toHaveText("(Teren Arabil)", { timeout: 30_000 });
      await expectOff(page);
      for (const name of ["Date cadastrale", "Hartă", "Puncte de contur"]) await expect(tileBox(page, name)).toBeChecked();
      await expect(page.getByRole("region", { name: "Adresă", exact: true })).toHaveCount(0);
      await photograph(page, "agricultural");

      // Step 2 — „Toate": every other box ticked; the two still off.
      await page.getByRole("button", { name: "Toate", exact: true }).click();
      for (const name of ["Date cadastrale", "Corelate", "Clasificări", "Conexiuni", "Hartă", "Puncte de contur"]) {
        await expect(tileBox(page, name)).toBeChecked();
      }
      await expectOff(page);

      // Step 3 — „Implicit": the defaults; the two still off.
      await page.getByRole("button", { name: "Implicit", exact: true }).click();
      for (const name of ["Date cadastrale", "Hartă", "Puncte de contur"]) await expect(tileBox(page, name)).toBeChecked();
      for (const name of ["Corelate", "Clasificări", "Conexiuni"]) await expect(tileBox(page, name)).not.toBeChecked();
      await expectOff(page);

      // Step 4 — „Teren Construit" on the form, not saved: both enabled; „Adresă" ticked, its tile on screen.
      const select = page.getByRole("combobox").filter({ has: page.locator("option", { hasText: "Teren Arabil" }) });
      await select.selectOption({ label: "Teren Construit" });
      for (const name of OFF) {
        await expect(tileBox(page, name)).toBeEnabled();
        await expect(tileBox(page, name)).not.toHaveAttribute("title", /.+/);
      }
      await expect(page.locator("label[data-tile-disabled]")).toHaveCount(0);
      await expect(tileBox(page, "Adresă")).toBeChecked();
      await expect(tileBox(page, "Street View")).not.toBeChecked();
      await expect(page.getByRole("region", { name: "Adresă", exact: true })).toBeVisible();
      await photograph(page, "urban");
    } finally {
      await page.evaluate(() => localStorage.removeItem("ga40-tiles-property-v1")).catch(() => {});
      await removeRecord(page.request, "property", id);
    }
  });
});
