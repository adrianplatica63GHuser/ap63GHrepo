/**
 * Case:   TC-ASSOC-03 — Act asociat persoanei, din ecranul persoanei
 * Source: docs/testing/cases/TC-ASSOC-03.md, „Last green" 2026-09-25
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case's prerequisites are TC-PERS-01's person and TC-DOC-01's
 *     document. Here they are this spec's own, created through the same POST
 *     routes those forms call and marked `TC-E2E-ASSOC-03` (person „Ion
 *     TC-E2E-ASSOC-03", document „TC-E2E-ASSOC-03 Contract de test"), so step 4
 *     types `TC-E2E-ASSOC-03` where the case types `TC-DOC-01`.
 *   - Step 1 opens the person by its address rather than from „Persoane
 *     Fizice": the list is TC-PERS-01's to drive, and its spec does.
 *   - Both are removed in `finally` through the DELETE routes „Șterge" calls,
 *     after the case's own cleanup (radio, „Dezasociază") has run.
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createNaturalPerson,
  createSaleContract,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";

const MARK = `${E2E_MARKER}ASSOC-03`;
const PERSON = `Ion ${MARK}`; // prenume first, as every list renders it
const DOC_TITLE = `${MARK} Contract de test`;

test.describe("TC-ASSOC-03 — Act asociat persoanei, din ecranul persoanei", () => {
  test("act asociat din ecranul persoanei, cu rol, văzut din ambele capete", async ({ page }) => {
    // Room for the `finally` (see the TC-ASSOC-01 spec).
    test.slow();
    await removeLeftovers(page.request, MARK);
    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const documentId = await createSaleContract(page.request, DOC_TITLE);

    try {
      // Step 1 — the person's screen: five tabs.
      await page.goto(`/natural-persons/${personId}`);
      await expect(page.getByRole("heading", { name: PERSON })).toBeVisible({ timeout: 30_000 });
      for (const tab of ["DETALII", "ASOCIERI", "PROPRIETĂȚI", "ACTE", "META INFO"]) {
        await expect(page.getByRole("tab", { name: tab })).toBeVisible();
      }

      // Step 2 — „Acte": empty, „Asociază", „Dezasociază".
      await page.getByRole("tab", { name: "Acte" }).click();
      await expect(page.getByText("Niciun act asociat")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociază": „Asociere act", the name, „Căutare", Cod · Tip · Titlu, „Rol".
      await page.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${personId}/associate-document$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere act" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(PERSON).first()).toBeVisible();
      const search = page.getByPlaceholder("Cod sau titlu…", { exact: true });
      await expect(search).toBeVisible();
      for (const col of ["Cod", "Tip", "Titlu"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      const role = page.getByRole("combobox", { name: "Rol", exact: true });
      await expect(role.locator("option:checked")).toHaveText("— fără rol —");

      // Step 4 — one row: `DOC…`, „Contract de Vânzare", the title.
      await search.fill(MARK);
      const candidates = page.getByRole("row").filter({ hasText: DOC_TITLE });
      await expect(candidates).toHaveCount(1, { timeout: 15_000 });
      await expect(candidates).toContainText(/DOC\d+/);
      await expect(candidates).toContainText("Contract de Vânzare");

      // Step 5 — tick FIRST: the hint goes and „Rol" narrows to the type's roles.
      await expect(page.getByText("Selectați cel puțin un act")).toBeVisible();
      await page.getByRole("checkbox", { name: DOC_TITLE }).check();
      await expect(page.getByText("Selectați cel puțin un act")).toHaveCount(0);
      const offered = ["— fără rol —", "Cumpărător", "Moștenitor / Succesor", "Notar", "Reprezentant legal / Mandatar", "Vânzător"];
      await expect(role.locator("option")).toHaveText(offered);

      // Step 6 — „Cumpărător".
      await role.selectOption({ label: "Cumpărător" });

      // Step 7 — „Asociază selecția": the person's „Acte", Tip · Titlu · Rol, one row.
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${personId}\\?tab=document$`), { timeout: 30_000 });
      const linked = page.getByRole("row").filter({ has: page.getByRole("radio", { name: `${DOC_TITLE} — Cumpărător` }) });
      await expect(linked).toHaveCount(1, { timeout: 15_000 });
      await expect(linked).toContainText("Contract de Vânzare");
      await expect(linked).toContainText("Cumpărător");
      const table = page.getByRole("table").filter({ has: linked });
      for (const col of ["Tip", "Titlu", "Rol"]) {
        await expect(table.getByText(col, { exact: true })).toBeVisible();
      }

      // Step 8 — „Vizualizare": the document, READ-ONLY.
      await linked.getByRole("button", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${documentId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: DOC_TITLE })).toBeVisible({ timeout: 30_000 });

      // Step 9 — the other end: „Persoane" reads the person as „Cumpărător".
      await page.getByRole("tab", { name: "Persoane" }).click();
      const back = page.getByRole("row").filter({ has: page.getByRole("radio", { name: `${PERSON} — Cumpărător` }) });
      await expect(back).toHaveCount(1, { timeout: 15_000 });
      const persons = page.getByRole("table").filter({ has: back });
      for (const col of ["Nume", "Rol", "Cotă-parte", "Suprafață echivalentă (mp)", "Mod de deținere"]) {
        await expect(persons.getByText(col, { exact: true })).toBeVisible();
      }

      // ── At the end — on the person's „Acte": radio, then „Dezasociază" ───
      await page.goto(`/natural-persons/${personId}?tab=document`);
      await page.getByRole("radio", { name: `${DOC_TITLE} — Cumpărător` }).check({ timeout: 30_000 });
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Niciun act asociat")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "person", personId);
    }
  });
});
