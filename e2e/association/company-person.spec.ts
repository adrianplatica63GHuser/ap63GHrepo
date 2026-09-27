/**
 * Case:   TC-ASSOC-11 — Persoană fizică legată de o firmă, citită din ambele capete
 * Source: docs/testing/cases/TC-ASSOC-11.md, „Last green" 2026-09-26
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **FU-221 IS ASSERTED AS IT IS.** No person role is ticked „Valabil pentru
 * persoană", so step 3 offers no „Tip relație" and both ends read „—". The day
 * FU-221 is fixed, the commit that closes it changes the two assertions marked
 * FU-221 below — and this case gains the role it was written for.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The company and the person are made through the POST routes „Adaugă"
 *     sends (e2e/helpers/records.ts), named `TC-E2E-ASSOC-11 …`.
 *   - The case's cleanup runs at the end; a `finally` removes both records
 *     through the DELETE routes „Șterge" calls, which also drop the link.
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createCompany,
  createNaturalPerson,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";

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
      await page.getByRole("tab", { name: "Asocieri" }).click();
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
      // FU-221: no „Tip relație" — no person role is offered today.
      await expect(page.getByText("Tip relație", { exact: true })).toHaveCount(0);
      await expect(page.locator("main select")).toHaveCount(0);

      // Step 4 — `TC-E2E-ASSOC-11` into „Nume", tick `PPERS…`, the person, „Fizică": the hint goes.
      await nameFilter.fill(MARK);
      const candidate = page.getByRole("row").filter({ hasText: PERSON });
      await expect(candidate).toHaveCount(1, { timeout: 15_000 });
      await expect(candidate).toContainText(/PPERS\d+/);
      await expect(candidate).toContainText("Fizică");
      await page.getByRole("checkbox", { name: PERSON }).check();
      await expect(page.getByText("Selectați cel puțin o persoană")).toHaveCount(0);

      // Step 5 — „Asociază selecția": the company's „Asocieri" (`?tab=related`),
      // Nume · Tip · Tip relație — the person, „Fizică", „—", „Vizualizare".
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}\\?tab=related$`), { timeout: 30_000 });
      const onCompany = page.getByRole("row").filter({ hasText: PERSON });
      await expect(onCompany).toHaveCount(1, { timeout: 15_000 });
      await expect(onCompany).toContainText("Fizică");
      await expect(onCompany.getByRole("cell", { name: "—", exact: true })).toHaveCount(1); // FU-221
      const table = page.getByRole("table").filter({ has: onCompany });
      for (const col of ["Nume", "Tip", "Tip relație"]) {
        await expect(table.getByText(col, { exact: true })).toBeVisible();
      }

      // Step 6 — „Vizualizare": the person, read-only.
      await onCompany.getByRole("button", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${personId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: PERSON })).toBeVisible({ timeout: 30_000 });

      // Step 7 — the person's „Asocieri": the company, „Juridică", „—", „Vizualizare".
      await page.getByRole("tab", { name: "Asocieri" }).click();
      const onPerson = page.getByRole("row").filter({ hasText: COMPANY });
      await expect(onPerson).toHaveCount(1, { timeout: 30_000 });
      await expect(onPerson).toContainText("Juridică");
      await expect(onPerson.getByRole("cell", { name: "—", exact: true })).toHaveCount(1); // FU-221

      // Step 8 — „Vizualizare" on that row: the COMPANY's screen, read-only.
      await onPerson.getByRole("button", { name: "Vizualizare" }).click();
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
