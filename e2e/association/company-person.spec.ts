/**
 * Case:   TC-ASSOC-11 — Persoană fizică legată de o firmă, citită din ambele capete
 * Source: docs/testing/cases/TC-ASSOC-11.md, „Last green" 2026-09-30
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Slice #37.28 (FU-221 closed): the case chooses the representative it was
 * written for. From the company's screen Ion is ticked as „Reprezentant legal /
 * Mandatar": the company's „Persoane corelate" (#37.29, „Asocieri" before) reads „Ion — Reprezentant legal /
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
 *   - Slice #37.67: each one's „Persoane corelate" / „Persoane" is „Corelate", one line a row —
 *     „Nume (Rol)" — with „Asociază persoană" (the case's steps as corrected on 2026-10-03).
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createCompany,
  createNaturalPerson,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { expectOneLine, lineRow, showTile } from "../helpers/tiles";

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
      // Step 2 — the company's „Corelate" (#37.67): „Nimic corelat încă.", „Asociază persoană", „Dezasociază".
      await page.goto(`/judicial-persons/${companyId}`);
      await expect(page.getByRole("heading", { name: COMPANY })).toBeVisible({ timeout: 30_000 });
      const related = await showTile(page, "Legături");
      await expect(related.getByText("Nimic corelat încă.")).toBeVisible({ timeout: 30_000 });
      await expect(related.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociere persoană corelată": „Nume", „Cod", Cod · Nume · Tip, the hint.
      await related.getByRole("button", { name: "Asociază persoană", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}/associate-person$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere persoană corelată" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(COMPANY).first()).toBeVisible();
      // `exact`: the sidebar's quick search is „Nume, cod…".
      const nameFilter = page.getByPlaceholder("Nume…", { exact: true });
      await expect(page.getByPlaceholder("Cod…", { exact: true })).toBeVisible();
      for (const col of ["Nume", "Tip"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      await expect(page.getByText("Selectați cel puțin o persoană")).toBeVisible();
      // „Rol" offers the representative, and says whose role it is (#37.28).
      const roleSelect = page.getByLabel("Rol", { exact: true });
      await expect(roleSelect).toBeVisible();
      await expect(roleSelect.locator("option", { hasText: "Reprezentant legal / Mandatar" })).toHaveCount(1);
      await expect(page.getByText(`Rolul pe care persoana bifată îl are față de ${COMPANY}.`)).toBeVisible();

      // Step 4 — `TC-E2E-ASSOC-11` into „Nume", tick `PPERS…`, the person, „Fizică": the hint goes.
      await nameFilter.fill(MARK);
      const candidate = page.getByRole("row").filter({ hasText: PERSON });
      await expect(candidate).toHaveCount(1, { timeout: 15_000 });
      await expect(candidate).not.toContainText(/PPERS\d+/); // #37.57: no system ID here
      await expect(candidate).toContainText("Fizică");
      await page.getByRole("checkbox", { name: PERSON }).check();
      await expect(page.getByText("Selectați cel puțin o persoană")).toHaveCount(0);
      await roleSelect.selectOption({ label: "Reprezentant legal / Mandatar" });

      // Step 5 — „Asociază selecția": the company's „Corelate" (`?tab=related`), one line —
      // „Nume (Rol)": the person, „Reprezentant legal / Mandatar" — and „Vizualizare" (#37.67).
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}\\?tab=related$`), { timeout: 30_000 });
      const onCompany = lineRow(page.getByRole("region", { name: "Legături", exact: true }), PERSON);
      await expect(onCompany).toHaveCount(1, { timeout: 15_000 });
      await expect(onCompany.locator("[data-row-content]")).toHaveText(`${PERSON} (Reprezentant legal / Mandatar)`);
      await expectOneLine(onCompany);
      await expect(page.getByRole("columnheader")).toHaveCount(0);

      // Step 6 — „Vizualizare": the person, read-only.
      await onCompany.getByRole("link", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${personId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: PERSON })).toBeVisible({ timeout: 30_000 });

      // Step 7 — the person's „Corelate": the company, „Reprezentat / Mandant" (the converse), „Vizualizare".
      const onPerson = lineRow(await showTile(page, "Legături"), COMPANY);
      await expect(onPerson).toHaveCount(1, { timeout: 30_000 });
      await expect(onPerson.locator("[data-row-content]")).toHaveText(`${COMPANY} (Reprezentat / Mandant)`);
      await expect(onPerson).not.toContainText("Reprezentant legal / Mandatar");

      // Step 8 — „Vizualizare" on that row: the COMPANY's screen, read-only.
      await onPerson.getByRole("link", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: COMPANY })).toBeVisible({ timeout: 30_000 });

      // ── At the end — on the company's „Corelate": radio, „Dezasociază" ────
      await page.goto(`/judicial-persons/${companyId}?tab=related`);
      await lineRow(page, PERSON).getByRole("radio").check({ timeout: 30_000 });
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nimic corelat încă.")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "company", companyId);
      await removeRecord(page.request, "person", personId);
    }
  });
});
