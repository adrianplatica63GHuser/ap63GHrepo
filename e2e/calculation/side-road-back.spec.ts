/**
 * Slice 41.81 — „Înapoi" from „Calcul drum lateral" returns to the screen before it.
 *
 * Adrian, 2026-11-04: „If I click on “Calculation of a side road” under Tools I arrive at the expected screen; but if I
 * change my mind and just click on the Back button I end up, unexpectedly, on the big map; also unexpectedly, the
 * Tools menu on the left navigation panel closes and the Domain menu that contains the properties opens up".
 *
 * No real map and no record: the dashboard, the natural persons' list and the calculation's empty screen.
 */
import { test, expect, type Page } from "../helpers/test";
import { openSection, sidebar } from "../helpers/sidebar";

const section = (page: Page, name: string) => sidebar(page).getByRole("button", { name, exact: true });
const back = (page: Page) => page.locator("[data-breadcrumb-back]").getByRole("button", { name: "Înapoi", exact: true });

async function openCalculation(page: Page): Promise<void> {
  await openSection(page, "Instrumente");
  await sidebar(page).getByRole("link", { name: "Calcul drum lateral", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/calculation$/, { timeout: 30_000 });
  // „Instrumente" stays open while the calculation is shown.
  await expect(section(page, "Instrumente")).toHaveAttribute("aria-expanded", "true");
}

test.describe("41.81 — „Înapoi” din „Calcul drum lateral”", () => {
  test("de pe tabloul de bord înapoi pe tabloul de bord; din lista persoanelor înapoi în listă, cu „Domeniu” deschis", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });

    // The dashboard → „Instrumente" → „Calcul drum lateral" → „Înapoi": the dashboard, never the big map.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Tablou de bord" })).toBeVisible({ timeout: 30_000 });
    await openCalculation(page);
    await back(page).click();
    await expect(page).toHaveURL((u) => u.pathname === "/", { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Tablou de bord" })).toBeVisible();

    // The natural persons' list → „Calcul drum lateral" → „Înapoi": the list, and „Domeniu" open.
    await openSection(page, "Domeniu");
    await sidebar(page).getByRole("link", { name: "Persoane Fizice", exact: true }).click();
    await expect(page).toHaveURL(/\/natural-persons$/, { timeout: 30_000 });
    await openCalculation(page);
    await back(page).click();
    await expect(page).toHaveURL((u) => u.pathname === "/natural-persons", { timeout: 30_000 });
    await expect(section(page, "Domeniu")).toHaveAttribute("aria-expanded", "true");
    expect(page.url()).not.toContain("/properties/map");
  });
});
