/**
 * Case:   TC-ASSOC-04 — Persoană asociată proprietății, cu rol, văzută din ambele capete
 * Source: docs/testing/cases/TC-ASSOC-04.md, „Last green" 2026-09-25
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case's prerequisites are TC-PROP-01's property and TC-PERS-01's
 *     person. Here they are this spec's own, created through the same POST
 *     routes those forms call and marked `TC-E2E-ASSOC-04` („TC-E2E-ASSOC-04
 *     Teren de test", „Ion TC-E2E-ASSOC-04"), so steps 4 and 10 type
 *     `TC-E2E-ASSOC-04` where the case types `TC-PERS-01` / `TC-PROP-01`.
 *   - Steps 1 and 7 open each record by its address, not from its list: the
 *     lists are TC-PROP-01's and TC-PERS-01's to drive.
 *   - Both are removed in `finally` through the DELETE routes „Șterge" calls,
 *     after the case's own cleanup (radio, „Dezasociază") has run.
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createNaturalPerson,
  createProperty,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";

const MARK = `${E2E_MARKER}ASSOC-04`;
const PROPERTY = `${MARK} Teren de test`;
const PERSON = `Ion ${MARK}`;
const ROLE = "Proprietar / Titular de drept real";
const ROLES = ["— fără rol —", "Coproprietari / Coindivizari", "Cumpărător", ROLE, "Titular de drept"];

test.describe("TC-ASSOC-04 — Persoană asociată proprietății, cu rol, văzută din ambele capete", () => {
  test("legătura persoană–proprietate făcută din fiecare capăt, citită din celălalt", async ({ page }) => {
    // Room for the `finally` (see the TC-ASSOC-01 spec).
    test.slow();
    await removeLeftovers(page.request, MARK);
    const propertyId = await createProperty(page.request, { nickname: PROPERTY });
    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });

    try {
      // ── From the property's end ──────────────────────────────────────────
      // Step 1 — the property's screen: five tabs.
      await page.goto(`/properties/${propertyId}`);
      await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });
      for (const tab of ["DETALII", "ASOCIERI", "PERSOANE", "ACTE", "META INFO"]) {
        await expect(page.getByRole("tab", { name: tab })).toBeVisible();
      }

      // Step 2 — „Persoane": empty, „Asociază", „Dezasociază".
      await page.getByRole("tab", { name: "Persoane" }).click();
      await expect(page.getByText("Nicio persoană asociată acestei proprietăți")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociere persoană": „Nume", „Cod", Cod · Nume · Tip, „Rol" with the four.
      await page.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}/associate-person$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere persoană" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(PROPERTY).first()).toBeVisible();
      // `exact`: the sidebar's quick search „Nume, cod…" (the TC-ASSOC-01 spec).
      const nameFilter = page.getByPlaceholder("Nume…", { exact: true });
      await expect(page.getByPlaceholder("Cod…", { exact: true })).toBeVisible();
      for (const col of ["Cod", "Nume", "Tip"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      const role = page.getByRole("combobox", { name: "Rol", exact: true });
      await expect(role.locator("option")).toHaveText(ROLES);

      // Step 4 — one row: `PPERS…`, the person, „Fizică".
      await nameFilter.fill(MARK);
      const candidates = page.getByRole("row").filter({ hasText: PERSON });
      await expect(candidates).toHaveCount(1, { timeout: 15_000 });
      await expect(candidates).toContainText(/PPERS\d+/);
      await expect(candidates).toContainText("Fizică");

      // Step 5 — tick the row, then the role.
      await page.getByRole("checkbox", { name: PERSON }).check();
      await role.selectOption({ label: ROLE });

      // Step 6 — back on „Persoane" (`?tab=persons`): Nume · Rol, one row, no cotă-parte.
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}\\?tab=persons$`), { timeout: 30_000 });
      const onProperty = page.getByRole("row").filter({ has: page.getByRole("radio", { name: PERSON }) });
      await expect(onProperty).toHaveCount(1, { timeout: 15_000 });
      await expect(onProperty).toContainText(ROLE);
      await expect(onProperty.getByRole("button", { name: "Vizualizare" })).toBeVisible();
      const personsTable = page.getByRole("table").filter({ has: onProperty });
      for (const col of ["Nume", "Rol"]) {
        await expect(personsTable.getByText(col, { exact: true })).toBeVisible();
      }
      await expect(personsTable.getByText("Cotă-parte", { exact: true })).toHaveCount(0);

      // Step 7 — the other end: the person's „Proprietăți", Denumire · Rol.
      await page.goto(`/natural-persons/${personId}`);
      await expect(page.getByRole("heading", { name: PERSON })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("tab", { name: "Proprietăți" }).click();
      const onPerson = page.getByRole("row").filter({ has: page.getByRole("radio", { name: PROPERTY }) });
      await expect(onPerson).toHaveCount(1, { timeout: 30_000 });
      await expect(onPerson).toContainText(ROLE);
      const propsTable = page.getByRole("table").filter({ has: onPerson });
      for (const col of ["Denumire", "Rol"]) {
        await expect(propsTable.getByText(col, { exact: true })).toBeVisible();
      }

      // ── Undo, then from the person's end ─────────────────────────────────
      // Step 8 — radio, „Dezasociază": „Nicio proprietate asociată".
      await page.getByRole("radio", { name: PROPERTY }).check();
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nicio proprietate asociată")).toBeVisible({ timeout: 15_000 });

      // Step 9 — „Asociere proprietate": „Căutare", Cod · Denumire, the same four roles.
      await page.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${personId}/associate-property$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere proprietate" })).toBeVisible({ timeout: 30_000 });
      const search = page.getByPlaceholder("Cod sau denumire…", { exact: true });
      await expect(search).toBeVisible();
      for (const col of ["Cod", "Denumire"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      await expect(role.locator("option")).toHaveText(ROLES);

      // Step 10 — the one row, ticked, the role.
      await search.fill(MARK);
      await expect(page.getByRole("row").filter({ hasText: PROPERTY })).toHaveCount(1, { timeout: 15_000 });
      await page.getByRole("checkbox", { name: PROPERTY }).check();
      await role.selectOption({ label: ROLE });

      // Step 11 — back on the person's „Proprietăți" (`?tab=properties`).
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${personId}\\?tab=properties$`), { timeout: 30_000 });
      const again = page.getByRole("row").filter({ has: page.getByRole("radio", { name: PROPERTY }) });
      await expect(again).toHaveCount(1, { timeout: 15_000 });
      await expect(again).toContainText(ROLE);

      // Step 12 — „Vizualizare": the property READ-ONLY, its „Persoane" reads the person.
      await again.getByRole("button", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("tab", { name: "Persoane" }).click();
      const readBack = page.getByRole("row").filter({ has: page.getByRole("radio", { name: PERSON }) });
      await expect(readBack).toHaveCount(1, { timeout: 30_000 });
      await expect(readBack).toContainText(ROLE);

      // ── At the end — on the property's „Persoane": radio, „Dezasociază" ──
      await page.getByRole("radio", { name: PERSON }).check();
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nicio persoană asociată acestei proprietăți")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "person", personId);
      await removeRecord(page.request, "property", propertyId);
    }
  });
});
