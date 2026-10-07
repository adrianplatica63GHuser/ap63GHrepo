/**
 * Case:   TC-PROP-11 — Titlul proprietății numește tipul ei și explică ce fișe arată acel tip
 * Source: docs/testing/cases/TC-PROP-11.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The properties carry `TC-E2E-PROP-11` (records.ts), and the two types
 *     are found by their stable keys, TEREN_CONSTRUIT and TEREN_ARABIL.
 *   - The bubble is opened by resting Playwright's mouse on the type, not by
 *     pressing the ⓘ: a press after the mouse has rested there closes it again
 *     (the ⓘ is the way in for a finger, as TC-DOC-08's step 5 notes). The
 *     hand run pressed it by script (FU-290). The select's option is picked
 *     with Playwright.
 *   - Slice #38.03's pictures, not steps of the case: the heading of each
 *     property with its bubble open under it, at 1366 and 1920 px, into
 *     `playwright-report/property-heading-type/`.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}PROP-11`;
const URBAN = `${MARK} Teren urban`;
const RURAL = `${MARK} Teren agricol`;
const SHOTS = "playwright-report/property-heading-type";

const URBAN_SAYS =
  "Pentru acest tip se afișează „Adresă” și „Street View”. Tarla/Solă și Parcelă nu apar în „Identificare cadastrală”.";
const RURAL_SAYS =
  "Pentru acest tip nu se afișează „Adresă” și „Street View”. Tarla/Solă și Parcelă apar în „Identificare cadastrală”.";

async function typeIdOf(page: Page, key: string): Promise<string> {
  const res = await page.request.get("/api/admin/value-lists/property-types");
  expect(res.ok()).toBeTruthy();
  const items = ((await res.json()) as { items: { id: string; key: string | null }[] }).items;
  const hit = items.find((i) => i.key === key);
  if (!hit) throw new Error(`No property type with key ${key}`);
  return hit.id;
}

/** The heading's type part, and the ⓘ's bubble. */
function headingType(page: Page) {
  const part = page.locator("header [data-heading-type]");
  return {
    part,
    separator: part.locator("[data-heading-type-separator]"),
    name: part.locator("[data-heading-type-name]"),
    about: part.getByRole("button", { name: "Despre tipul proprietății", exact: true }),
    bubble: part.getByRole("tooltip"),
  };
}

async function photograph(page: Page, name: string): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    // The bubble opened by the mouse resting on the type, then the header and the bubble under it.
    await page.locator("header [data-heading-type-name]").hover();
    await expect(page.locator("header [data-heading-type]").getByRole("tooltip")).not.toHaveClass(/sr-only/);
    const box = (await page.locator("header").first().boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, clip: { x: box.x, y: box.y, width: box.width, height: box.height + 110 } });
  }
  await page.setViewportSize({ width: 1920, height: 1200 });
}

test.describe("TC-PROP-11 — titlul proprietății numește tipul ei", () => {
  test("tipul după nume, explicația în ⓘ, schimbată odată cu tipul de pe formular", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1200 });
    const urban = await createProperty(page.request, { nickname: URBAN, propertyTypeId: await typeIdOf(page, "TEREN_CONSTRUIT") });
    const rural = await createProperty(page.request, { nickname: RURAL, propertyTypeId: await typeIdOf(page, "TEREN_ARABIL") });
    try {
      // Step 1 — the name in the <h1>; after it „  -  " and „(Teren Construit)" in italics; the ⓘ.
      await page.goto(`/properties/${urban}`);
      await expect(page.getByRole("heading", { level: 1, name: URBAN, exact: true })).toBeVisible({ timeout: 30_000 });
      const h = headingType(page);
      await expect(h.name).toHaveText("(Teren Construit)", { timeout: 30_000 });
      expect(await h.separator.textContent()).toBe("  -  ");
      await expect(h.name).toHaveCSS("font-style", "italic");
      await expect(h.part).toHaveCSS("font-size", "24px");
      await expect(h.about).toBeVisible();

      // Step 2 — the ⓘ: the bubble, in italics.
      await h.name.hover();
      // Open: the bubble drawn, not the screen-reader copy (`sr-only` reads as visible to Playwright).
      await expect(h.bubble).not.toHaveClass(/sr-only/);
      await expect(h.bubble).toHaveText(URBAN_SAYS);
      await expect(h.bubble).toHaveCSS("font-style", "italic");
      await photograph(page, "urban");

      // Step 3 — the agricultural property: „(Teren Arabil)" and its sentence.
      await page.goto(`/properties/${rural}`);
      await expect(page.getByRole("heading", { level: 1, name: RURAL, exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(h.name).toHaveText("(Teren Arabil)", { timeout: 30_000 });
      await expect(h.bubble).toHaveText(RURAL_SAYS);
      await h.name.hover();
      // Open: the bubble drawn, not the screen-reader copy (`sr-only` reads as visible to Playwright).
      await expect(h.bubble).not.toHaveClass(/sr-only/);
      await photograph(page, "agricultural");

      // Step 4 — „Teren Construit" chosen on the form, not saved: the heading and the bubble follow.
      const select = page.getByRole("combobox").filter({ has: page.locator("option", { hasText: "Teren Arabil" }) });
      await select.selectOption({ label: "Teren Construit" });
      await expect(h.name).toHaveText("(Teren Construit)");
      await expect(h.bubble).toHaveText(URBAN_SAYS);
      await expect(page.getByRole("heading", { level: 1, name: RURAL, exact: true })).toBeVisible();

      // Step 5 — „niciunul": nothing after the name.
      await select.selectOption({ label: "niciunul" });
      await expect(h.part).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1, name: RURAL, exact: true })).toBeVisible();
    } finally {
      await removeRecord(page.request, "property", urban);
      await removeRecord(page.request, "property", rural);
    }
  });
});
