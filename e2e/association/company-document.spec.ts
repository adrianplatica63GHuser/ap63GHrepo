/**
 * Case:   TC-ASSOC-10 — Firmă asociată unui act, din ecranul firmei
 * Source: docs/testing/cases/TC-ASSOC-10.md, „Last green" 2026-09-26
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case makes the company and the contract through „Adaugă"; this spec
 *     makes them through the POST routes those forms send (e2e/helpers/
 *     records.ts) — TC-PERS-02's and TC-DOC-01's specs drive the forms — and
 *     names them `TC-E2E-ASSOC-10 …`.
 *   - The case's cleanup runs at the end; a `finally` removes both records
 *     through the DELETE routes „Șterge" calls, which also drop the link.
 *   - Slices #37.18 and #37.20: neither the company nor the document has a
 *     tab row; the company's „Acte" (step 2) and the document's „Persoane"
 *     (step 7) are tiles, ticked with `showTile` (e2e/helpers/tiles.ts).
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createCompany,
  createSaleContract,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ASSOC-10`;
const COMPANY = `${MARK} Firmă de test SRL`;
const DOC_TITLE = `${MARK} Contract de test`;

test.describe("TC-ASSOC-10 — Firmă asociată unui act, din ecranul firmei", () => {
  test("act asociat din ecranul firmei, ca „Cumpărător”, citit din act", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const companyId = await createCompany(page.request, { name: COMPANY });
    const documentId = await createSaleContract(page.request, DOC_TITLE);

    try {
      // Step 2 — the company's „Acte": empty, „Asociază", „Dezasociază".
      await page.goto(`/judicial-persons/${companyId}`);
      await expect(page.getByRole("heading", { name: COMPANY })).toBeVisible({ timeout: 30_000 });
      await showTile(page, "Acte");
      await expect(page.getByText("Niciun act asociat")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociere act": the name, „Căutare", Cod · Tip · Titlu, „Rol" at „fără rol",
      // offering every role in the system.
      await page.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}/associate-document$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere act" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(COMPANY).first()).toBeVisible();
      const search = page.getByPlaceholder("Cod sau titlu…", { exact: true });
      await expect(search).toBeVisible();
      for (const col of ["Tip", "Titlu"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      const role = page.getByRole("combobox", { name: "Rol", exact: true });
      await expect(role.locator("option:checked")).toHaveText("fără rol");
      // „every role in the system": far more than the five a contract offers.
      expect(await role.locator("option").count()).toBeGreaterThan(6);

      // Step 4 — `TC-E2E-ASSOC-10`, tick the one row: „Rol" narrows to a contract's roles.
      await search.fill(MARK);
      const candidate = page.getByRole("row").filter({ hasText: DOC_TITLE });
      await expect(candidate).toHaveCount(1, { timeout: 15_000 });
      await page.getByRole("checkbox", { name: DOC_TITLE }).check();
      await expect(role.locator("option")).toHaveText([
        "fără rol",
        "Cumpărător",
        "Moștenitor / Succesor",
        "Notar",
        "Reprezentant legal / Mandatar",
        "Vânzător",
      ]);

      // Step 5 — „Cumpărător", „Asociază selecția": the company's „Acte" (`?tab=document`).
      await role.selectOption({ label: "Cumpărător" });
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}\\?tab=document$`), { timeout: 30_000 });
      const linked = page.getByRole("row").filter({ hasText: DOC_TITLE });
      await expect(linked).toHaveCount(1, { timeout: 15_000 });
      await expect(linked).toContainText("Contract de Vânzare");
      await expect(linked).toContainText("Cumpărător");
      const table = page.getByRole("table").filter({ has: linked });
      for (const col of ["Tip", "Titlu", "Rol"]) {
        await expect(table.getByText(col, { exact: true })).toBeVisible();
      }

      // Step 6 — „Vizualizare": the document, read-only.
      await linked.getByRole("link", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${documentId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: DOC_TITLE })).toBeVisible({ timeout: 30_000 });

      // Step 7 — its „Persoane": one row — the company, „Cumpărător", the two empty fields
      // reading „fără cotă" and „fără suprafață", „Mod de deținere" „nespecificat".
      await showTile(page, "Persoane");
      const back = page.getByRole("row").filter({ hasText: COMPANY });
      await expect(back).toHaveCount(1, { timeout: 15_000 });
      const persons = page.getByRole("table").filter({ has: back });
      for (const col of ["Nume", "Rol", "Cotă-parte", "Suprafață echivalentă (mp)", "Mod de deținere"]) {
        await expect(persons.getByText(col, { exact: true })).toBeVisible();
      }
      await expect(back.getByRole("cell", { name: "Cumpărător", exact: true })).toHaveCount(1);
      await expect(back.getByLabel(`Cotă-parte — ${COMPANY} — Cumpărător`)).toHaveValue("");
      await expect(back.getByLabel(`Cotă-parte — ${COMPANY} — Cumpărător`)).toHaveAttribute("placeholder", "fără cotă");
      await expect(back.getByLabel(`Suprafață echivalentă (mp) — ${COMPANY} — Cumpărător`)).toHaveAttribute(
        "placeholder",
        "fără suprafață",
      );
      await expect(back.locator("select option:checked")).toHaveText("nespecificat");

      // Step 8 — „Vizualizare" on that row: the COMPANY's screen, read-only.
      await back.getByRole("link", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: COMPANY })).toBeVisible({ timeout: 30_000 });

      // ── At the end — on the company's „Acte": radio, „Dezasociază" ───────
      await page.goto(`/judicial-persons/${companyId}?tab=document`);
      await page.getByRole("row").filter({ hasText: DOC_TITLE }).getByRole("radio").check({ timeout: 30_000 });
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Niciun act asociat")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "company", companyId);
    }
  });
});
