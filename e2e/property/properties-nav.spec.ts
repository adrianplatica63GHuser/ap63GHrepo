/**
 * Case:   TC-PROP-10 — Un singur „Proprietăți" în bara laterală; „Hartă completă" din lista proprietăților
 * Source: docs/testing/cases/TC-PROP-10.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim; an icon is read as the case reads it, the Lucide
 * class on the <svg>.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The hand run pressed by script (FU-290); here it is Playwright's mouse.
 *   - „The map draws" is read from the map's box: `[data-property-map]`
 *     carries `data-map-zoom` once the camera has settled (TC-MAP-01's way).
 *   - The breadcrumb is the visible „Fir de navigare": the router keeps the
 *     page before, hidden, with its own.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { openFromSidebar, sidebar } from "../helpers/sidebar";

async function iconOf(el: Locator): Promise<string> {
  const cls = (await el.locator("svg").first().getAttribute("class")) ?? "";
  return cls.split(" ").find((c) => c.startsWith("lucide-") && c !== "lucide") ?? "";
}

async function onePropertyItem(page: Page): Promise<void> {
  const nav = sidebar(page);
  const item = nav.getByRole("link", { name: "Proprietăți", exact: true });
  await expect(item).toHaveCount(1);
  expect(await iconOf(item)).toBe("lucide-map");
  await expect(item).toHaveAttribute("aria-current", "page");
  for (const old of ["Proprietăți — Listă", "Proprietăți — Hartă"]) await expect(nav.getByText(old, { exact: true })).toHaveCount(0);
}

async function mapLeftOfAdd(page: Page): Promise<Locator> {
  const full = page.getByRole("button", { name: "Hartă completă", exact: true });
  const add = page.getByRole("button", { name: "Adaugă proprietate", exact: true });
  await expect(full).toBeVisible({ timeout: 30_000 });
  expect(await iconOf(full)).toBe("lucide-map");
  const f = (await full.boundingBox())!;
  const a = (await add.boundingBox())!;
  expect(Math.abs(f.y + f.height / 2 - (a.y + a.height / 2))).toBeLessThanOrEqual(2);
  expect(f.x + f.width).toBeLessThanOrEqual(a.x);
  return full;
}

const breadcrumb = (page: Page) => page.getByRole("navigation", { name: "Fir de navigare" }).filter({ visible: true });

test.describe("TC-PROP-10 — un singur „Proprietăți”; „Hartă completă” din listă", () => {
  test("bara laterală, butonul listei, harta și drumul înapoi", async ({ page }) => {
    // Step 1 — 1920: „Proprietăți" in the sidebar; the list; one property item, active.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/documents");
    await openFromSidebar(page, "Proprietăți");
    await expect(page).toHaveURL(/\/properties$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Proprietăți", level: 1 })).toBeVisible();
    await onePropertyItem(page);

    // Step 2 — „Hartă completă" left of „Adaugă proprietate", on one line.
    await mapLeftOfAdd(page);

    // Step 3 — 1366: the same.
    await page.setViewportSize({ width: 1366, height: 900 });
    await onePropertyItem(page);
    const full = await mapLeftOfAdd(page);

    // Step 4 — „Hartă completă": /properties/map, the map draws, „Proprietăți" active, the breadcrumb.
    await full.click();
    await expect(page).toHaveURL(/\/properties\/map$/, { timeout: 30_000 });
    await expect(page.locator("[data-property-map]")).toHaveAttribute("data-map-zoom", /\d/, { timeout: 30_000 });
    await onePropertyItem(page);
    const crumbs = breadcrumb(page);
    for (const name of ["Acasă", "Proprietăți", "Hartă completă"]) await expect(crumbs.getByText(name, { exact: true })).toBeVisible();

    // Step 5 — the breadcrumb's „Proprietăți": the list again.
    await crumbs.getByRole("link", { name: "Proprietăți", exact: true }).click();
    await expect(page).toHaveURL(/\/properties$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Proprietăți", level: 1 })).toBeVisible();
  });
});
