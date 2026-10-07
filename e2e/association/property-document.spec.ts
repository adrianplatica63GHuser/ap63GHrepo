/**
 * Case:   TC-ASSOC-05 — Act asociat proprietății, din ecranul proprietății
 * Source: docs/testing/cases/TC-ASSOC-05.md, „Last green" 2026-09-25
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case's prerequisites are TC-PROP-01's property and TC-DOC-01's
 *     document. Here they are this spec's own, created through the same POST
 *     routes those forms call and marked `TC-E2E-ASSOC-05` („TC-E2E-ASSOC-05
 *     Teren de test", „TC-E2E-ASSOC-05 Contract de test"), so step 4 types
 *     `TC-E2E-ASSOC-05` where the case types `TC-DOC-01`.
 *   - Step 1 opens the property by its address, not from its list.
 *   - Both are removed in `finally` through the DELETE routes „Șterge" calls,
 *     after the case's own cleanup (radio, „Dezasociază") has run.
 *   - Slices #37.19 and #37.20: neither the property nor the document has a
 *     tab row; the property's „Acte" (step 2) and the document's
 *     „Proprietăți" are tiles, ticked with `showTile` (e2e/helpers/tiles.ts).
 *   - Slice #37.64: a Document's „Persoane", „Proprietăți" and „Acte corelate"
 *     are one line a row with no heading row (step 8 as corrected on 2026-10-03).
 *   - Slice #37.65: a Document's „Persoane", „Proprietăți" and „Acte corelate"
 *     are one tile, „Corelate", with „Asociază persoană", „Asociază
 *     proprietate" and „Asociază act" (the case's steps as corrected on 2026-10-03).
 *   - Slice #37.66: the Property's „Proprietăți corelate", Persoane and Acte are one tile,
 *     „Corelate", one line a row (the case's steps as corrected on 2026-10-03).
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createProperty,
  createSaleContract,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { lineRow, showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ASSOC-05`;
const PROPERTY = `${MARK} Teren de test`;
const DOC_TITLE = `${MARK} Contract de test`;

test.describe("TC-ASSOC-05 — Act asociat proprietății, din ecranul proprietății", () => {
  test("act asociat din ecranul proprietății, văzut din ambele capete", async ({ page }) => {
    // Room for the `finally` (see the TC-ASSOC-01 spec).
    test.slow();
    await removeLeftovers(page.request, MARK);
    const propertyId = await createProperty(page.request, { nickname: PROPERTY });
    const documentId = await createSaleContract(page.request, DOC_TITLE);

    try {
      // Step 1 — the property's screen.
      await page.goto(`/properties/${propertyId}`);
      await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });

      // Step 2 — „Corelate" (#37.66): empty, „Asociază act", „Dezasociază".
      await showTile(page, "Legături");
      await expect(page.getByText("Nimic corelat încă.")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociere act": „Căutare", Cod · Tip · Titlu, and no „Rol".
      await page.getByRole("button", { name: "Asociază act", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}/associate-document$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere act" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(PROPERTY).first()).toBeVisible();
      const search = page.getByPlaceholder("Cod sau titlu…", { exact: true });
      await expect(search).toBeVisible();
      for (const col of ["Tip", "Titlu"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      await expect(page.getByRole("combobox", { name: "Rol", exact: true })).toHaveCount(0);

      // Step 4 — one row: `DOC…`, „Contract de Vânzare", the title.
      await search.fill(MARK);
      const candidates = page.getByRole("row").filter({ hasText: DOC_TITLE });
      await expect(candidates).toHaveCount(1, { timeout: 15_000 });
      await expect(candidates).not.toContainText(/DOC\d+/); // #37.57: no system ID here
      await expect(candidates).toContainText("Contract de Vânzare");

      // Step 5 — tick it; the hint „Selectați cel puțin un act" goes away.
      await expect(page.getByText("Selectați cel puțin un act")).toBeVisible();
      await page.getByRole("checkbox", { name: DOC_TITLE }).check();
      await expect(page.getByText("Selectați cel puțin un act")).toHaveCount(0);

      // Step 6 — back on „Corelate" (`?tab=document`): one line, „Etichetă scurtă (Tip)", „Vizualizare".
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}\\?tab=document$`), { timeout: 30_000 });
      const related = page.getByRole("region", { name: "Legături", exact: true });
      const linked = lineRow(related, DOC_TITLE);
      await expect(linked).toHaveCount(1, { timeout: 15_000 });
      await expect(linked.locator("[data-row-content]")).toHaveText(`${DOC_TITLE} (Contract de Vânzare)`);
      await expect(related.getByRole("columnheader")).toHaveCount(0);
      await expect(related.getByText("Cod", { exact: true })).toHaveCount(0);

      // Step 7 — „Vizualizare": the document, READ-ONLY.
      await linked.getByRole("link", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${documentId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: DOC_TITLE })).toBeVisible({ timeout: 30_000 });

      // Step 8 — the other end: „Proprietăți", one column „Denumire", one row.
      const props = await showTile(page, "Legături");
      const back = lineRow(props, PROPERTY);
      await expect(back).toHaveCount(1, { timeout: 30_000 });
      await expect(back.getByRole("radio", { name: PROPERTY })).toHaveCount(1);
      await expect(back.getByRole("link", { name: "Vizualizare" })).toBeVisible();
      await expect(back.locator("[data-row-content]")).toHaveText(PROPERTY);

      // ── At the end — on the document's „Proprietăți": radio, „Dezasociază" ─
      await page.getByRole("radio", { name: PROPERTY }).check();
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nimic corelat încă.")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "property", propertyId);
    }
  });
});
