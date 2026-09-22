/**
 * Case:   TC-ASSOC-02 — Proprietate asociată actului
 * Source: docs/testing/cases/TC-ASSOC-02.md, „Last green" 2026-09-22
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case's prerequisites are TC-PROP-01's property and TC-DOC-01's
 *     document. Here they are this spec's own, created through the same POST
 *     routes those forms call and marked `TC-E2E-ASSOC-02` („TC-E2E-ASSOC-02
 *     Teren de test", „TC-E2E-ASSOC-02 Contract de test"), so step 4 types
 *     `TC-E2E-ASSOC-02` where the case types `TC-PROP-01`.
 *   - Both are removed in `finally` through the DELETE routes „Șterge" calls,
 *     after the case's own cleanup (radio, „Dezasociază") has run.
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createProperty,
  createSaleContract,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";

const MARK = `${E2E_MARKER}ASSOC-02`;
const PROPERTY = `${MARK} Teren de test`;
const DOC_TITLE = `${MARK} Contract de test`;

test.describe("TC-ASSOC-02 — Proprietate asociată actului", () => {
  test("legătura act–proprietate se vede din ambele capete", async ({ page }) => {
    await removeLeftovers(page.request, MARK);
    const propertyId = await createProperty(page.request, { nickname: PROPERTY });
    const documentId = await createSaleContract(page.request, DOC_TITLE);

    try {
      // Step 1 — the document's detail screen.
      await page.goto(`/documents/${documentId}`);
      await expect(page.getByRole("heading", { name: DOC_TITLE })).toBeVisible({ timeout: 30_000 });

      // Step 2 — „Proprietăți", beside „Asocieri": empty, „Asociază", „Dezasociază".
      await page.getByRole("tab", { name: "Proprietăți" }).click();
      await expect(page.getByText("Nicio proprietate asociată")).toBeVisible();
      await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociază": „Asociere proprietate", one filter, no „Rol".
      await page.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${documentId}/associate-property$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere proprietate" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(DOC_TITLE).first()).toBeVisible();
      const search = page.getByPlaceholder("Cod sau denumire…");
      await expect(search).toBeVisible();
      await expect(page.getByLabel(/^Rol(\s|$)/)).toHaveCount(0);

      // Step 4 — the table narrows to one row.
      await search.fill(MARK);
      const candidates = page.getByRole("row").filter({ hasText: PROPERTY });
      await expect(candidates).toHaveCount(1, { timeout: 15_000 });

      // Step 5 — tick it; the hint „Selectați cel puțin o proprietate" goes away.
      await expect(page.getByText("Selectați cel puțin o proprietate")).toBeVisible();
      await page.getByRole("checkbox", { name: PROPERTY }).check();
      await expect(page.getByText("Selectați cel puțin o proprietate")).toHaveCount(0);

      // Step 6 — „Asociază selecția": back on the document, on „Proprietăți".
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${documentId}\\?tab=properties$`), { timeout: 30_000 });

      // Step 7 — one column, „Denumire" (no „Cod"), one row with „Vizualizare".
      const linkedRow = page.getByRole("row").filter({ has: page.getByRole("radio", { name: PROPERTY }) });
      await expect(linkedRow).toHaveCount(1, { timeout: 15_000 });
      const linked = page.getByRole("table").filter({ has: page.getByRole("radio", { name: PROPERTY }) });
      await expect(linked.getByText("Denumire", { exact: true })).toBeVisible();
      await expect(linked.getByText("Cod", { exact: true })).toHaveCount(0);

      // Step 8 — „Vizualizare": the property's own screen, READ-ONLY.
      await linkedRow.getByRole("button", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });

      // Step 9 — the other end: „Acte" lists „Contract de Vânzare", the title.
      await page.getByRole("tab", { name: "Acte" }).click();
      const back = page.getByRole("row").filter({ has: page.getByRole("radio", { name: DOC_TITLE }) });
      await expect(back).toHaveCount(1, { timeout: 15_000 });
      await expect(back).toContainText("Contract de Vânzare");
      const docs = page.getByRole("table").filter({ has: page.getByRole("radio", { name: DOC_TITLE }) });
      await expect(docs.getByText("Tip", { exact: true })).toBeVisible();
      await expect(docs.getByText("Titlu", { exact: true })).toBeVisible();

      // ── At the end — back on the document: radio, then „Dezasociază" ─────
      await page.goto(`/documents/${documentId}?tab=properties`);
      await page.getByRole("radio", { name: PROPERTY }).check({ timeout: 30_000 });
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nicio proprietate asociată")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "property", propertyId);
    }
  });
});
