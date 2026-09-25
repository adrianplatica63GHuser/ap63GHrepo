/**
 * Case:   TC-ASSOC-06 — Firmă proprietară a unui teren
 * Source: docs/testing/cases/TC-ASSOC-06.md, „Last green" 2026-09-25
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case's prerequisites are TC-PERS-02's company and TC-PROP-01's
 *     property. Here they are this spec's own, created through the same POST
 *     routes those forms call and marked `TC-E2E-ASSOC-06` („TC-E2E-ASSOC-06
 *     Firmă de test SRL", „TC-E2E-ASSOC-06 Teren de test"), so step 4 types
 *     `TC-E2E-ASSOC-06` where the case types `TC-PROP-01`.
 *   - Steps 1 and 7 open each record by its address, not from its list.
 *   - Both are removed in `finally` through the DELETE routes „Șterge" calls,
 *     after the case's own cleanup (radio, „Dezasociază") has run.
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createCompany,
  createProperty,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";

const MARK = `${E2E_MARKER}ASSOC-06`;
const COMPANY = `${MARK} Firmă de test SRL`;
const PROPERTY = `${MARK} Teren de test`;
const ROLE = "Proprietar / Titular de drept real";

test.describe("TC-ASSOC-06 — Firmă proprietară a unui teren", () => {
  test("firma devine proprietar din ecranul ei; proprietatea o deschide ca firmă", async ({ page }) => {
    // Room for the `finally` (see the TC-ASSOC-01 spec).
    test.slow();
    await removeLeftovers(page.request, MARK);
    const companyId = await createCompany(page.request, { name: COMPANY });
    const propertyId = await createProperty(page.request, { nickname: PROPERTY });

    try {
      // Step 1 — the company's screen.
      await page.goto(`/judicial-persons/${companyId}`);
      await expect(page.getByRole("heading", { name: COMPANY })).toBeVisible({ timeout: 30_000 });

      // Step 2 — „Proprietăți": empty, „Asociază", „Dezasociază".
      await page.getByRole("tab", { name: "Proprietăți" }).click();
      await expect(page.getByText("Nicio proprietate asociată")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociere proprietate": „Căutare", Cod · Denumire, „Rol" with the four.
      await page.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}/associate-property$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere proprietate" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(COMPANY).first()).toBeVisible();
      const search = page.getByPlaceholder("Cod sau denumire…", { exact: true });
      for (const col of ["Cod", "Denumire"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      const role = page.getByRole("combobox", { name: "Rol", exact: true });
      await expect(role.locator("option")).toHaveText([
        "— fără rol —",
        "Coproprietari / Coindivizari",
        "Cumpărător",
        ROLE,
        "Titular de drept",
      ]);

      // Step 4 — the one row, ticked.
      await search.fill(MARK);
      await expect(page.getByRole("row").filter({ hasText: PROPERTY })).toHaveCount(1, { timeout: 15_000 });
      await page.getByRole("checkbox", { name: PROPERTY }).check();

      // Step 5 — the role.
      await role.selectOption({ label: ROLE });

      // Step 6 — back on the company's „Proprietăți" (`?tab=properties`): Denumire · Rol.
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}\\?tab=properties$`), { timeout: 30_000 });
      const onCompany = page.getByRole("row").filter({ has: page.getByRole("radio", { name: PROPERTY }) });
      await expect(onCompany).toHaveCount(1, { timeout: 15_000 });
      await expect(onCompany).toContainText(ROLE);
      await expect(onCompany.getByRole("button", { name: "Vizualizare" })).toBeVisible();
      const table = page.getByRole("table").filter({ has: onCompany });
      for (const col of ["Denumire", "Rol"]) {
        await expect(table.getByText(col, { exact: true })).toBeVisible();
      }

      // Step 7 — the other end: the property's „Persoane", Nume · Rol, the company.
      await page.goto(`/properties/${propertyId}`);
      await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("tab", { name: "Persoane" }).click();
      const onProperty = page.getByRole("row").filter({ has: page.getByRole("radio", { name: COMPANY }) });
      await expect(onProperty).toHaveCount(1, { timeout: 30_000 });
      await expect(onProperty).toContainText(ROLE);

      // Step 8 — „Vizualizare" opens the COMPANY, read-only, „Înapoi la listă" and „Modifică".
      await onProperty.getByRole("button", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: COMPANY })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Înapoi la listă" }).or(page.getByRole("link", { name: "Înapoi la listă" }))).toBeVisible();
      await expect(page.getByRole("button", { name: "Modifică" }).or(page.getByRole("link", { name: "Modifică" }))).toBeVisible();

      // ── At the end — on the company's „Proprietăți": radio, „Dezasociază" ─
      await page.goto(`/judicial-persons/${companyId}?tab=properties`);
      await page.getByRole("radio", { name: PROPERTY }).check({ timeout: 30_000 });
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nicio proprietate asociată")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "property", propertyId);
      await removeRecord(page.request, "company", companyId);
    }
  });
});
