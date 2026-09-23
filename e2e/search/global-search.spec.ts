/**
 * Case:   TC-SRCH-01 — Cele trei obiecte găsite prin Căutare globală
 * Source: docs/testing/cases/TC-SRCH-01.md, „Last green" 2026-09-22
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case finds the three records TC-PERS-01, TC-PROP-01 and TC-DOC-01
 *     left, by typing `TC-`. A spec cannot rely on another spec's leftovers —
 *     there are none, by design — and `TC-` would also find a hand run's. So
 *     this spec creates its own three through the POST routes the „Adaugă"
 *     forms call, with the form's own `provenance: "MANUAL"`, all marked
 *     `TC-E2E-SRCH-01`, and types that. „3 rezultate" then means exactly what
 *     it means in the case: one of each kind, and nothing else.
 *   - The property has tarla `40` and parcelă `TC01`, as TC-PROP-01's does, so
 *     its „Nume" has the case's shape: `40 / TC01(TC-E2E-SRCH-01 Teren de test)`.
 *   - All three are removed in `finally`. The case writes nothing; its spec's
 *     fixtures are the spec's to remove.
 *   - Step 1 goes through the sidebar group „Admin-Operațiuni" → „Căutare
 *     globală", as the case does, expanding the group first if it is closed.
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createNaturalPerson,
  createProperty,
  createSaleContract,
  removeLeftovers,
  removeRecord,
  tarlaIdFor,
} from "../helpers/records";
import { sidebar } from "../helpers/sidebar";

const MARK = `${E2E_MARKER}SRCH-01`;

test.describe("TC-SRCH-01 — Cele trei obiecte găsite prin Căutare globală", () => {
  test("o singură căutare găsește persoana, proprietatea și actul", async ({ page }) => {
    // Room for the `finally`: twice now (TC-PROP-02 on the first run, TC-ASSOC-01
    // on the third) the browser stopped producing frames mid-test — no new
    // screencast frame for 27 s, Playwright waiting on a locator the snapshot
    // shows on screen — and the default 30 s ran out with the cleanup still to
    // do, leaving a TC-E2E- row for the next run's removeLeftovers.
    test.slow();
    await removeLeftovers(page.request, MARK);
    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const propertyId = await createProperty(page.request, {
      nickname: `${MARK} Teren de test`,
      tarlaId: await tarlaIdFor(page.request, "40"),
      parcela: "TC01",
    });
    const documentId = await createSaleContract(page.request, `${MARK} Contract de test`);

    try {
      // Step 1 — „Admin-Operațiuni" → „Căutare globală".
      await page.goto("/");
      const nav = sidebar(page);
      const searchLink = nav.getByRole("link", { name: "Căutare globală" });
      if (!(await searchLink.isVisible())) {
        await nav.getByRole("button", { name: "Admin-Operațiuni" }).click();
      }
      await searchLink.click();
      await expect(page).toHaveURL(/\/admin\/global-search$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Căutare globală" })).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByText("Căutați printre toate entitățile după nume, cod, adresă sau combinând filtre de metadate, grupuri, ștampile și etichete."),
      ).toBeVisible();

      // Step 2 — „Căutare nume / cod" (placeholder „ex. Popescu sau PPERS00012").
      const nameOrCode = page.getByPlaceholder("ex. Popescu sau PPERS00012");
      await nameOrCode.fill(MARK);
      await expect(nameOrCode).toHaveValue(MARK);

      // Step 3 — „Tip entitate" left at „Orice". The <label> is the <select>'s
      // preceding SIBLING with no `htmlFor` (global-search-view.tsx), so
      // getByLabel cannot reach it; the select is the one right after it.
      const entityType = page
        .locator("label", { hasText: /^Tip entitate$/ })
        .locator("xpath=following-sibling::select[1]");
      await expect(entityType.locator("option:checked")).toHaveText("Orice");

      // Step 4 — „Caută": „3 rezultate", and `?search=` in the address.
      await page.getByRole("button", { name: "Caută", exact: true }).click();
      await expect(page.getByText("3 rezultate")).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(new RegExp(`\\?search=${MARK}$`));

      // Step 5 — three rows: DOCUMENT, PERSON with „Fizic", PROPERTY as
      // „tarla / parcelă(poreclă)". „Tip" shows the raw English values — the
      // case quotes the screen as it is, and so does this.
      for (const col of ["Cod", "Tip", "Nume", "Grupuri", "Ștampile", "Importanță", "Relevanță", "Proveniență", "Actualizat de", "Metadate actualizate"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      const body = page.locator("tbody tr");
      await expect(body).toHaveCount(3);
      const doc = body.filter({ hasText: `${MARK} Contract de test` });
      await expect(doc).toContainText(/DOC\d+/);
      await expect(doc).toContainText("DOCUMENT");
      const person = body.filter({ hasText: `Ion ${MARK}` });
      await expect(person).toContainText(/PPERS\d+/);
      await expect(person).toContainText("PERSON");
      await expect(person).toContainText("Fizic");
      const property = body.filter({ hasText: `40 / TC01(${MARK} Teren de test)` });
      await expect(property).toContainText(/PROP\d+/);
      await expect(property).toContainText("PROPERTY");

      // Step 6 — „Proveniență": all three „Manual (Adaugă nou)".
      for (const row of [doc, person, property]) {
        await expect(row).toContainText("Manual (Adaugă nou)");
      }

      // Step 7 — „Tip entitate" = „Proprietate", „Caută": one row, the property.
      await entityType.selectOption({ label: "Proprietate" });
      await page.getByRole("button", { name: "Caută", exact: true }).click();
      await expect(body).toHaveCount(1, { timeout: 15_000 });
      await expect(body).toContainText(`40 / TC01(${MARK} Teren de test)`);

      // Step 8 — „Resetează": every filter clears, the table goes, the address
      // is back to /admin/global-search.
      await page.getByRole("button", { name: "Resetează" }).click();
      await expect(page).toHaveURL(/\/admin\/global-search$/);
      await expect(nameOrCode).toHaveValue("");
      await expect(entityType.locator("option:checked")).toHaveText("Orice");
      await expect(page.locator("main table")).toHaveCount(0);
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "person", personId);
      await removeRecord(page.request, "property", propertyId);
    }
  });
});
