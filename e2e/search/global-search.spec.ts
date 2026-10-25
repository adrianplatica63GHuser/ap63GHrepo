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
 *   - Step 1 goes through the sidebar group „Rapoarte" (#39.02; „Instrumente" before, „Funcții" before
 *     #38.42) → „Căutare globală", as the case does, expanding the group first if it is closed.
 *   - Slice #37.16 checks the results' fixed column widths here: every column the
 *     same width at 1400 and 2400 px, the table no wider than its columns, and
 *     no fixed column's cell wider than the column. Not a step of the case.
 */

import { test, expect } from "../helpers/test";
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
import { expectStableColumns } from "../helpers/field-widths";

const MARK = `${E2E_MARKER}SRCH-01`;

test.describe("TC-SRCH-01 — Cele trei obiecte găsite prin Căutare globală", () => {
  test("o singură căutare găsește persoana, proprietatea și actul", async ({ page }) => {
    // Room for the `finally`: an action waiting on a locator that never matches
    // spends the whole default 30 s, and the cleanup after it then dies of the
    // same timeout, leaving a TC-E2E- row for the next run's removeLeftovers.
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
      // Step 1 — „Rapoarte" → „Căutare globală" (#39.02: was „Instrumente"). Slice 40.09: at 1920 × 1080, where the
      // filters' widths were measured.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto("/");
      const nav = sidebar(page);
      const searchLink = nav.getByRole("link", { name: "Căutare globală" });
      if (!(await searchLink.isVisible())) {
        await nav.getByRole("button", { name: "Rapoarte", exact: true }).click();
      }
      await searchLink.click();
      await expect(page).toHaveURL(/\/admin\/global-search$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Căutare globală" })).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByText("Căutați printre toate entitățile după nume, cod, adresă sau combinând filtre de metadate, grupuri, ștampile și etichete."),
      ).toBeVisible();
      // Slice 40.09: the explanation's example of AND.
      await expect(page.locator("main p").first()).toContainText(
        "De exemplu, „Tip entitate: Proprietate” împreună cu „Etichetă: prioritar” găsesc doar proprietățile cu eticheta „prioritar” — nu și persoanele cu această etichetă, nici proprietățile fără ea.",
      );
      // Slice 40.09: every filter's box one width — a third of the 525 px it was at this window (± 1 rem) — and all
      // of them in at most two rows, „Caută" and „Resetează" after the last.
      const boxes = page.locator("[data-search-filter] select, [data-search-filter] input");
      await expect(boxes).toHaveCount(12);
      const rects = await boxes.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.bottom]; }));
      for (const [w] of rects) expect(Math.abs(w - 525 / 3), `a box ${w} px wide`).toBeLessThanOrEqual(16);
      expect(new Set(rects.map(([w]) => Math.round(w))).size).toBe(1);
      expect(new Set(rects.map(([, b]) => Math.round(b))).size).toBeLessThanOrEqual(2);

      // Step 2 — „Căutare nume / cod" (placeholder „Popescu", its tooltip „ex. Popescu sau PPERS00012" — Slice 40.09).
      const nameOrCode = page.getByPlaceholder("Popescu", { exact: true });
      await expect(nameOrCode).toHaveAttribute("title", "ex. Popescu sau PPERS00012");
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

      // Step 5 — three rows: „Document", „Persoană fizică", „Proprietate" — since 40.61 as the kind's mark —
      // as „tarla / parcelă(poreclă)". „Tip" says the filter's Romanian words
      // since Slice #37.07 (FU-061); the raw enum must not come back.
      for (const col of ["Tip", "Nume", "Grupuri", "Ștampile", "Importanță", "Relevanță", "Proveniență", "Actualizat de", "Metadate actualizate"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      const body = page.locator("tbody tr");
      await expect(body).toHaveCount(3);
      const doc = body.filter({ hasText: `${MARK} Contract de test` });
      await expect(doc).not.toContainText(/DOC\d+/); // #37.57: no system ID here
      // 40.61: „Tip" is the kind's mark, named by the filter's words (it was the word in a coloured chip).
      await expect(doc.getByRole("img", { name: "Document", exact: true })).toHaveAttribute("data-entity-mark", "document");
      await expect(doc).not.toContainText("DOCUMENT");
      const person = body.filter({ hasText: `Ion ${MARK}` });
      await expect(person).not.toContainText(/PPERS\d+/); // #37.57: no system ID here
      // 40.61: one mark, the natural person's (it was „Persoană" and a second chip „Fizic").
      await expect(person.getByRole("img", { name: "Persoană fizică", exact: true })).toHaveAttribute("data-entity-mark", "natural");
      await expect(person).not.toContainText("PERSON");
      await expect(person).not.toContainText("Fizic");
      const property = body.filter({ hasText: `40 / TC01(${MARK} Teren de test)` });
      await expect(property).not.toContainText(/PROP\d+/); // #37.57: no system ID here
      await expect(property.getByRole("img", { name: "Proprietate", exact: true })).toHaveAttribute("data-entity-mark", "property");
      await expect(property).not.toContainText("PROPERTY");
      await expectStableColumns(page);

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
