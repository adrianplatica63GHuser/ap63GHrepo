/**
 * Case:   TC-ASSOC-11 — Persoană fizică legată de o firmă, citită din ambele capete
 * Source: docs/testing/cases/TC-ASSOC-11.md, „Last green" 2026-09-26
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Slice #37.28 (FU-221 closed): the case chooses the representative it was
 * written for. From the company's screen Ion is ticked as „Reprezentant legal /
 * Mandatar": the company's „Asocieri" reads „Ion — Reprezentant legal /
 * Mandatar", and Ion's „Persoane" reads the company as „Reprezentat / Mandant"
 * — the role's converse, neutral because a company has no gender.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The company and the person are made through the POST routes „Adaugă"
 *     sends (e2e/helpers/records.ts), named `TC-E2E-ASSOC-11 …`.
 *   - The case's cleanup runs at the end; a `finally` removes both records
 *     through the DELETE routes „Șterge" calls, which also drop the link.
 *   - Slices #37.17 and #37.18: neither the person nor the company has a tab
 *     row; each one's „Asocieri" (steps 2 and 7) is a tile, ticked with
 *     `showTile` (e2e/helpers/tiles.ts).
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createCompany,
  createNaturalPerson,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ASSOC-11`;
const COMPANY = `${MARK} Firmă de test SRL`;
const PERSON = `Ion ${MARK}`; // prenume first, as every list renders it

test.describe("TC-ASSOC-11 — Persoană fizică legată de o firmă, citită din ambele capete", () => {
  test("persoana legată din ecranul firmei, citită din ambele capete", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const companyId = await createCompany(page.request, { name: COMPANY });
    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });

    try {
      // Step 2 — the company's „Asocieri": „Nicio persoană corelată", „Asociază", „Dezasociază".
      await page.goto(`/judicial-persons/${companyId}`);
      await expect(page.getByRole("heading", { name: COMPANY })).toBeVisible({ timeout: 30_000 });
      await showTile(page, "Asocieri");
      await expect(page.getByText("Nicio persoană corelată")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociere persoană corelată": „Nume", „Cod", Cod · Nume · Tip, the hint.
      await page.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}/associate-person$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere persoană corelată" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(COMPANY).first()).toBeVisible();
      // `exact`: the sidebar's quick search is „Nume, cod…".
      const nameFilter = page.getByPlaceholder("Nume…", { exact: true });
      await expect(page.getByPlaceholder("Cod…", { exact: true })).toBeVisible();
      for (const col of ["Cod", "Nume", "Tip"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      await expect(page.getByText("Selectați cel puțin o persoană")).toBeVisible();
      // „Tip relație" offers the representative, and says whose role it is (#37.28).
      const roleSelect = page.getByLabel("Tip relație", { exact: true });
      await expect(roleSelect).toBeVisible();
      await expect(roleSelect.locator("option", { hasText: "Reprezentant legal / Mandatar" })).toHaveCount(1);
      await expect(page.getByText(`Rolul pe care persoana bifată îl are față de ${COMPANY}.`)).toBeVisible();

      // Step 4 — `TC-E2E-ASSOC-11` into „Nume", tick `PPERS…`, the person, „Fizică": the hint goes.
      await nameFilter.fill(MARK);
      const candidate = page.getByRole("row").filter({ hasText: PERSON });
      await expect(candidate).toHaveCount(1, { timeout: 15_000 });
      await expect(candidate).toContainText(/PPERS\d+/);
      await expect(candidate).toContainText("Fizică");
      await page.getByRole("checkbox", { name: PERSON }).check();
      await expect(page.getByText("Selectați cel puțin o persoană")).toHaveCount(0);
      await roleSelect.selectOption({ label: "Reprezentant legal / Mandatar" });

      // Step 5 — „Asociază selecția": the company's „Asocieri" (`?tab=related`),
      // Nume · Tip · Tip relație — the person, „Fizică", „Reprezentant legal / Mandatar", „Vizualizare".
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}\\?tab=related$`), { timeout: 30_000 });
      const onCompany = page.getByRole("row").filter({ hasText: PERSON });
      await expect(onCompany).toHaveCount(1, { timeout: 15_000 });
      await expect(onCompany).toContainText("Fizică");
      await expect(onCompany.getByText("Reprezentant legal / Mandatar", { exact: true })).toBeVisible();
      const table = page.getByRole("table").filter({ has: onCompany });
      for (const col of ["Nume", "Tip", "Tip relație"]) {
        await expect(table.getByText(col, { exact: true })).toBeVisible();
      }

      // Step 6 — „Vizualizare": the person, read-only.
      await onCompany.getByRole("link", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${personId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: PERSON })).toBeVisible({ timeout: 30_000 });

      // Step 7 — the person's „Persoane": the company, „Reprezentat / Mandant" (the converse), „Vizualizare".
      // The person's tile has no „Tip" column since #37.27, so „Juridică" is not on it.
      await showTile(page, "Persoane");
      const onPerson = page.getByRole("row").filter({ hasText: COMPANY });
      await expect(onPerson).toHaveCount(1, { timeout: 30_000 });
      await expect(onPerson.getByText("Reprezentat / Mandant", { exact: true })).toBeVisible();
      await expect(onPerson.getByText("Reprezentant legal / Mandatar", { exact: true })).toHaveCount(0);

      // Step 8 — „Vizualizare" on that row: the COMPANY's screen, read-only.
      await onPerson.getByRole("link", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: COMPANY })).toBeVisible({ timeout: 30_000 });

      // ── At the end — on the company's „Asocieri": radio, „Dezasociază" ────
      await page.goto(`/judicial-persons/${companyId}?tab=related`);
      await page.getByRole("row").filter({ hasText: PERSON }).getByRole("radio").check({ timeout: 30_000 });
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nicio persoană corelată")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "company", companyId);
      await removeRecord(page.request, "person", personId);
    }
  });
});
