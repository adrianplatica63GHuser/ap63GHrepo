/**
 * Case:   TC-TAG-01 — Etichetă aplicată unei proprietăți și găsită după ea
 * Source: docs/testing/cases/TC-TAG-01.md, „Last green" 2026-09-25
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **A TAG IS SHARED STATE — IT IS IN EVERY USER'S CLOUD AND FILTERS.** The
 * case removes it in steps 6–7. If the test stops before that, the `finally`
 * removes the spec's own property through DELETE /api/properties/[id], and
 * the tag goes with its last use — the case file's own recovery note: „If the
 * property is already gone, the tag went with it."
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case's prerequisite is TC-PROP-01's property. Here it is this spec's
 *     own, „TC-E2E-TAG-01 Teren de test", created through the POST route the
 *     „Adaugă" form calls.
 *   - The tag typed is `TC-E2E-TAG-01`, stored lower-case as `tc-e2e-tag-01`,
 *     where the case types `TC-TAG-01` and reads `tc-tag-01`.
 *   - Step 2 opens the property by its address, not from its list.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { sidebar } from "../helpers/sidebar";

const MARK = `${E2E_MARKER}TAG-01`;
const PROPERTY = `${MARK} Teren de test`;
const TYPED = MARK; // what a person types
const STORED = MARK.toLowerCase(); // what the application keeps: `tc-e2e-tag-01`

async function readDistinct(page: Page): Promise<number> {
  const count = page.getByText(/^\d+ etichete distincte$/).first();
  await expect(count).toBeVisible({ timeout: 30_000 });
  return Number((await count.textContent())?.match(/\d+/)?.[0]);
}

async function openMetaInfo(page: Page, propertyId: string): Promise<void> {
  await page.goto(`/properties/${propertyId}`);
  await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("tab", { name: "Meta info" }).click();
  await expect(page.getByPlaceholder("Introduceți o etichetă…")).toBeVisible({ timeout: 30_000 });
}

test.describe("TC-TAG-01 — Etichetă aplicată unei proprietăți și găsită după ea", () => {
  test("eticheta apare pe „Etichete”, găsește proprietatea, dispare cu ultima utilizare", async ({ page }) => {
    // Room for the `finally`, which must run: a tag is everyone's.
    test.slow();
    await removeLeftovers(page.request, MARK);
    const propertyId = await createProperty(page.request, { nickname: PROPERTY });

    try {
      // Step 1 — „Admin-Configurare" → „Etichete": the count, the cloud, the table.
      await page.goto("/");
      const nav = sidebar(page);
      const tagsLink = nav.getByRole("link", { name: "Etichete", exact: true });
      if (!(await tagsLink.isVisible())) {
        await nav.getByRole("button", { name: "Admin-Configurare" }).click();
      }
      await tagsLink.click();
      await expect(page).toHaveURL(/\/admin\/tags$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Etichete", exact: true })).toBeVisible({ timeout: 30_000 });
      const before = await readDistinct(page);
      await expect(page.getByText("Nor de etichete").first()).toBeVisible();
      await expect(page.getByText("Toate etichetele").first()).toBeVisible();
      for (const col of ["Etichetă", "Utilizări", "Acțiuni"]) {
        await expect(page.getByRole("columnheader", { name: col })).toBeVisible();
      }

      // Step 2 — the property's „META INFO": „Clasificare subiectivă", then
      // „Conexiuni" → „Etichete / Cuvinte cheie", empty.
      await openMetaInfo(page, propertyId);
      await expect(page.getByText("Clasificare subiectivă").first()).toBeVisible();
      for (const field of ["Importanță", "Relevanță", "Proveniență"]) {
        await expect(page.getByText(field, { exact: true }).first()).toBeVisible();
      }
      await expect(page.getByText("Conexiuni").first()).toBeVisible();
      await expect(page.getByText("Etichete / Cuvinte cheie").first()).toBeVisible();
      await expect(page.getByText("Nicio etichetă adăugată încă")).toBeVisible();

      // Step 3 — type the tag, „Adaugă": a chip, lower-case, saved at once.
      await page.getByPlaceholder("Introduceți o etichetă…").fill(TYPED);
      await page.getByRole("button", { name: "Adaugă", exact: true }).click();
      const remove = page.getByRole("button", { name: `Elimină eticheta ${STORED}` });
      await expect(remove).toBeVisible({ timeout: 15_000 });
      await openMetaInfo(page, propertyId); // „still there after a reload"
      await expect(page.getByRole("button", { name: `Elimină eticheta ${STORED}` })).toBeVisible({ timeout: 15_000 });

      // Step 4 — „Etichete": N+1, in the cloud as „×1", in the table with 1 and „Redenumește".
      await page.goto("/admin/tags");
      expect(await readDistinct(page)).toBe(before + 1);
      await expect(page.getByRole("button").filter({ hasText: new RegExp(`^${STORED}\\s*×1$`) })).toBeVisible();
      const tagRow = page.getByRole("row").filter({ hasText: STORED });
      await expect(tagRow).toHaveCount(1);
      await expect(tagRow.getByRole("cell", { name: "1", exact: true })).toBeVisible();
      await expect(tagRow.getByRole("button", { name: "Redenumește" })).toBeVisible();

      // Step 5 — Căutare globală, „Etichetă": „1 rezultat", the property.
      await page.goto("/admin/global-search");
      await page.getByPlaceholder("ex. prioritar").fill(STORED);
      await page.getByRole("button", { name: "Caută", exact: true }).click();
      await expect(page.getByText("1 rezultat", { exact: true })).toBeVisible({ timeout: 30_000 });
      const hit = page.locator("tbody tr");
      await expect(hit).toHaveCount(1);
      await expect(hit).toContainText(/PROP\d+/);
      await expect(hit).toContainText(PROPERTY);

      // Step 6 — „×" on the chip: „Nicio etichetă adăugată încă".
      await openMetaInfo(page, propertyId);
      await page.getByRole("button", { name: `Elimină eticheta ${STORED}` }).click();
      await expect(page.getByText("Nicio etichetă adăugată încă")).toBeVisible({ timeout: 15_000 });

      // Step 7 — „Etichete": N again, and the tag nowhere on the page.
      await page.goto("/admin/tags");
      expect(await readDistinct(page)).toBe(before);
      await expect(page.getByText(STORED)).toHaveCount(0);
    } finally {
      await removeRecord(page.request, "property", propertyId);
    }
  });
});
