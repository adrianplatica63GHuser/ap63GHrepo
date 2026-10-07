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
 *   - Slice #37.16 checks the association tab's fixed column widths here:
 *     every column the same width at 1400 and 2400 px, the table no wider than
 *     its columns, no fixed column's cell wider than the column. Not a step of
 *     the case.
 *   - Slice #37.17: a Natural Person has no tab row; the person's „Acte"
 *     is a tile, ticked with `showTile` (e2e/helpers/tiles.ts) where the hand
 *     run clicks the tile's checkbox.
 *   - Slice #37.20: nor has the document; its „Persoane" is a tile too.
 *   - Slice #37.64: a Document's „Persoane", „Proprietăți" and „Acte corelate"
 *     are one line a row with no heading row, the share boxes behind the row's
 *     orange „Cotă" (step 9 as corrected on 2026-10-03).
 *   - Slice #37.65: a Document's „Persoane", „Proprietăți" and „Acte corelate"
 *     are one tile, „Corelate", with „Asociază persoană", „Asociază
 *     proprietate" and „Asociază act" (the case's steps as corrected on 2026-10-03).
 *   - Slice #37.67: so are the person's „Persoane", „Proprietăți" and „Acte": its „Corelate" has the
 *     contract on one line — „Etichetă scurtă (Tip)" — and the person's role behind „Relația".
 *     #37.16's column check (`expectStableColumns`) has no table to measure there any more; the row
 *     is measured one line tall instead.
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createNaturalPerson,
  createSaleContract,
  documentRoleOptions,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { expectOneLine, lineRow, showTile, tileBox } from "../helpers/tiles";

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
      // Step 1 — the person's screen: the tile checkboxes (Slice #37.17; nine since #37.63, seven since #37.67).
      await page.goto(`/natural-persons/${personId}`);
      await expect(page.getByRole("heading", { name: PERSON })).toBeVisible({ timeout: 30_000 });
      for (const tile of ["Identitate", "Act de identitate", "Contact", "Adrese", "Legături", "Clasificare", "Etichete și grupuri"]) {
        await expect(tileBox(page, tile)).toBeVisible();
      }

      // Step 2 — „Corelate": empty, „Asociază act", „Dezasociază".
      const related = await showTile(page, "Legături");
      await expect(related.getByText("Nimic corelat încă.")).toBeVisible({ timeout: 30_000 });
      await expect(related.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociază act": „Asociere act", the name, „Căutare", Cod · Tip · Titlu, „Rol".
      await related.getByRole("button", { name: "Asociază act", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${personId}/associate-document$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere act" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(PERSON).first()).toBeVisible();
      const search = page.getByPlaceholder("Cod sau titlu…", { exact: true });
      await expect(search).toBeVisible();
      for (const col of ["Tip", "Titlu"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      const role = page.getByRole("combobox", { name: "Rol", exact: true });
      await expect(role.locator("option:checked")).toHaveText("fără rol");

      // Step 4 — one row: `DOC…`, „Contract de Vânzare", the title.
      await search.fill(MARK);
      const candidates = page.getByRole("row").filter({ hasText: DOC_TITLE });
      await expect(candidates).toHaveCount(1, { timeout: 15_000 });
      await expect(candidates).not.toContainText(/DOC\d+/); // #37.57: no system ID here
      await expect(candidates).toContainText("Contract de Vânzare");

      // Step 5 — tick FIRST: the hint goes and „Rol" narrows to the type's roles.
      await expect(page.getByText("Selectați cel puțin un act")).toBeVisible();
      await page.getByRole("checkbox", { name: DOC_TITLE }).check();
      await expect(page.getByText("Selectați cel puțin un act")).toHaveCount(0);
      // Exactly the contract type's roles, as Date de referință holds them today.
      const offered = await documentRoleOptions(page.request, documentId);
      expect(offered).toContain("Cumpărător");
      await expect(role.locator("option")).toHaveText(offered);

      // Step 6 — „Cumpărător".
      await role.selectOption({ label: "Cumpărător" });

      // Step 7 — „Asociază selecția": the person's „Corelate", one line — „Etichetă scurtă (Tip)" —
      // the role behind „Relația" (#37.67).
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${personId}\\?tab=document$`), { timeout: 30_000 });
      const linked = page.locator("li[data-one-line-row]").filter({ has: page.getByRole("radio", { name: `${DOC_TITLE} — Cumpărător` }) });
      await expect(linked).toHaveCount(1, { timeout: 15_000 });
      await expect(linked.locator("[data-row-content]")).toHaveText(`${DOC_TITLE} (Contract de Vânzare)`);
      await expectOneLine(linked);
      await linked.getByRole("button", { name: "Relația", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Rol în act" })).toHaveText("Rol în act: „Cumpărător”");
      await page.keyboard.press("Escape");

      // Step 8 — „Vizualizare": the document, READ-ONLY.
      await linked.getByRole("link", { name: "Vizualizare" }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${documentId}\\?readonly=true$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: DOC_TITLE })).toBeVisible({ timeout: 30_000 });

      // Step 9 — the other end: „Persoane" reads the person as „Cumpărător".
      const personsTile = await showTile(page, "Legături");
      const back = lineRow(personsTile, PERSON);
      await expect(back).toHaveCount(1, { timeout: 15_000 });
      await expect(back.getByRole("radio", { name: `${PERSON} — Cumpărător` })).toHaveCount(1);
      await expect(back.locator("[data-row-content]")).toHaveText(`${PERSON} (Cumpărător)`);
      await expect(back.getByRole("button", { name: "Cotă", exact: true })).toBeVisible();

      // ── At the end — on the person's „Corelate": radio, then „Dezasociază" ───
      await page.goto(`/natural-persons/${personId}?tab=document`);
      await page.getByRole("radio", { name: `${DOC_TITLE} — Cumpărător` }).check({ timeout: 30_000 });
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nimic corelat încă.")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "person", personId);
    }
  });
});
