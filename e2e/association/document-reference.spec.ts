/**
 * Case:   TC-ASSOC-07 — Act legat manual de înscrisul pe care îl citează, citit în sensul corect
 * Source: docs/testing/cases/TC-ASSOC-07.md, „Last green" 2026-09-25
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **ONE RUN OF THIS SPEC TESTS ONE SORT ORDER, AND WHICH ONE IS CHANCE.**
 * Both documents get fresh uuids, so a run lands on either order — the
 * certificate sorting before the contract or after it — and over a handful of
 * runs meets both. The defect it guards (FU-001) was invisible on exactly half
 * the pairs; the ORDER itself is pinned deterministically, both ways, by
 * `src/__tests__/document-manual-link-direction.test.ts`. This spec is the
 * end-to-end half: the screen, the route and the reading tab together.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case's contract is TC-DOC-01's. Here it is this spec's own,
 *     „TC-E2E-ASSOC-07 Contract de test", created through the POST route the
 *     „Adaugă act" form calls; so step 5 types `TC-E2E-ASSOC-07` where the case
 *     types `TC-DOC-01`, and the one row it ticks is that contract.
 *   - The certificate the case creates by hand is „TC-E2E-ASSOC-07 Titlu
 *     anterior", created through the form exactly as steps 1–2 say.
 *   - Step 8 opens the contract by its address rather than from „Acte".
 *   - Both documents are removed in `finally` through DELETE
 *     /api/documents/[id], after the case's own cleanup (radio, „Dezasociază",
 *     then „Șterge" / „Da" on the certificate) has run.
 *   - Slice #37.20: a document has no tab row; its „Asocieri" (steps 3 and 8)
 *     is a tile, ticked with `showTile` (e2e/helpers/tiles.ts). Step 1's
 *     „no notebook" check is on „Adaugă act", which keeps its notebook.
 *   - Slice #37.64: „Acte corelate" is one line a row — „Etichetă scurtă (Tip)" —
 *     and the relationship is a button before „Vizualizează" whose sentence
 *     shows on a press; „Înscrisuri citate" is one button that unfolds the panel
 *     (the case's steps 3, 7 and 8 as corrected on 2026-10-03).
 *   - Slice #37.65: a Document's „Persoane", „Proprietăți" and „Acte corelate"
 *     are one tile, „Corelate", with „Asociază persoană", „Asociază
 *     proprietate" and „Asociază act" (the case's steps as corrected on 2026-10-03).
 */

import { test, expect } from "@playwright/test";
import { E2E_MARKER, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";
import { expectOneLine, lineRow, showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ASSOC-07`;
const CERTIFICATE = `${MARK} Titlu anterior`;
const CONTRACT = `${MARK} Contract de test`;
const ROLES = [
  "fără relație",
  "Înlocuiește",
  "Modifică",
  "Prelungește",
  "Anulează",
  "Consolidat cu",
  "Versiune anterioară a",
  "Anexă la",
  "Corecție a",
  "Titlu anterior al",
  "Înscris doveditor pentru",
  "Act adițional la",
  "Antecontract al",
];

test.describe("TC-ASSOC-07 — Act legat manual de înscrisul pe care îl citează, citit în sensul corect", () => {
  test("„Titlu anterior al” ales din certificat se citește așa din certificat și invers din contract", async ({ page }) => {
    // Room for the `finally` (see the TC-ASSOC-01 spec).
    test.slow();
    await removeLeftovers(page.request, MARK);
    const contractId = await createSaleContract(page.request, CONTRACT);
    let certificateId: string | undefined;

    try {
      // Step 1 — „Acte" → „Adaugă act", „Certificat de Moștenitor": the short form and its note.
      await page.goto("/");
      await openFromSidebar(page, "Acte");
      await expect(page.getByRole("heading", { name: "Acte", exact: true })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("link", { name: "Adaugă act" }).click();
      await expect(page).toHaveURL(/\/documents\/new$/, { timeout: 30_000 });
      await page.getByLabel(/^Tip document/).selectOption({ label: "Certificat de Moștenitor" });
      await expect(page.getByText("DATE GENERALE").first()).toBeVisible();
      // #37.52: a type with no fees group titles that panel „Date de emitere".
      await expect(page.getByText("DATE DE EMITERE").first()).toBeVisible();
      // #37.85: the superuser's line, the engine's name a link.
      await expect(page.getByText("Acest tip nu are încă formular; formularul se construiește în", { exact: false })).toBeVisible();
      await expect(page.getByRole("link", { name: "Distilare Tipizate", exact: true })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Instrument", exact: true })).toHaveCount(0);

      // Step 2 — „Etichetă scurtă", „Salvează": the new document opens (#37.93); „Acte": the new row.
      await page.getByLabel(/^Etichetă scurtă/).fill(CERTIFICATE);
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: CERTIFICATE })).toBeVisible({ timeout: 30_000 });
      await openFromSidebar(page, "Acte");
      await expect(page).toHaveURL(/\/documents$/, { timeout: 30_000 });
      const top = page.getByRole("row").nth(1);
      await expect(top).toContainText(CERTIFICATE, { timeout: 15_000 });
      await expect(top).toContainText("Nou!");
      await expect(top).toContainText("Moștenitor"); // #37.95: the type by its short name
      const href = await top.getByRole("link", { name: "Deschide" }).getAttribute("href");
      certificateId = href?.split("/").pop();

      // Step 3 — open it, „Asocieri": empty, the two buttons, „Înscrisuri citate…".
      await top.getByRole("link", { name: "Deschide" }).click();
      await expect(page.getByRole("heading", { name: CERTIFICATE })).toBeVisible({ timeout: 30_000 });
      await showTile(page, "Legături");
      await expect(page.getByText("Nimic corelat încă.")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();
      const cited = page.getByRole("button", { name: "Înscrisuri citate", exact: true });
      await expect(cited).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByText("Înscrisuri citate în acest document")).toHaveCount(0);
      await cited.click();
      await expect(page.getByText("Înscrisuri citate în acest document")).toBeVisible();
      await cited.click();
      await expect(page.getByText("Înscrisuri citate în acest document")).toHaveCount(0);

      // Step 4 — „Asociază": „Asociază Document", „Căutare", Cod · Tip · Titlu, „Tip relație".
      await page.getByRole("button", { name: "Asociază act", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${certificateId}/associate-reference$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociază Document" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(CERTIFICATE).first()).toBeVisible();
      const search = page.getByPlaceholder("Cod sau titlu…", { exact: true });
      for (const col of ["Tip", "Titlu"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: true })).toBeVisible();
      }
      const relation = page.getByRole("combobox", { name: "Tip relație", exact: true });
      await expect(relation.locator("option")).toHaveText(ROLES);

      // Step 5 — the contract's one row, ticked; „Titlu anterior al".
      await search.fill(MARK);
      const candidates = page.getByRole("row").filter({ hasText: CONTRACT });
      await expect(candidates).toHaveCount(1, { timeout: 15_000 });
      await page.getByRole("checkbox", { name: CONTRACT }).check();
      await relation.selectOption({ label: "Titlu anterior al" });

      // Step 6 — „Asociază selecția": back on the certificate's „Asocieri".
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${certificateId}\\?tab=related$`), { timeout: 30_000 });

      // Step 7 — one line, „Etichetă scurtă (Tip)"; the relationship behind its button
      // reads FROM the certificate, and a click outside hides it.
      const fromCertificate = lineRow(page.getByRole("region", { name: "Legături", exact: true }), CONTRACT);
      await expect(fromCertificate).toHaveCount(1, { timeout: 15_000 });
      await expect(fromCertificate.locator("[data-row-content]")).toHaveText(`${CONTRACT} (Contract de Vânzare)`);
      await expectOneLine(fromCertificate);
      await expect(page.getByText(`acest document „Titlu anterior al” ${CONTRACT}`)).toHaveCount(0);
      await fromCertificate.getByRole("button", { name: "Relația", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Titlu anterior al" }))
        .toHaveText(`acest document „Titlu anterior al” ${CONTRACT}`); // #37.57: by its title, not its code
      await page.getByRole("heading", { name: CERTIFICATE }).click();
      await expect(page.getByText(`acest document „Titlu anterior al” ${CONTRACT}`)).toHaveCount(0);

      // Step 8 — the contract's „Acte corelate": the converse.
      await page.goto(`/documents/${contractId}`);
      await expect(page.getByRole("heading", { name: CONTRACT })).toBeVisible({ timeout: 30_000 });
      const related = await showTile(page, "Legături");
      const fromContract = lineRow(related, CERTIFICATE);
      await expect(fromContract).toHaveCount(1, { timeout: 30_000 });
      await expect(fromContract.locator("[data-row-content]")).toHaveText(`${CERTIFICATE} (Certificat de Moștenitor)`);
      await fromContract.getByRole("button", { name: "Relația", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Titlu anterior al" }))
        .toHaveText(`${CERTIFICATE} „Titlu anterior al” acest document`); // #37.57
      await page.keyboard.press("Escape");
      await expect(page.getByText(`${CERTIFICATE} „Titlu anterior al” acest document`)).toHaveCount(0);

      // ── At the end — radio, „Dezasociază"; then the certificate „Șterge" / „Da" ─
      await page.getByRole("radio", { name: CERTIFICATE }).check();
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nimic corelat încă.")).toBeVisible({ timeout: 15_000 });
      await page.goto(`/documents/${certificateId}`);
      await expect(page.getByRole("heading", { name: CERTIFICATE })).toBeVisible({ timeout: 30_000 });
      // `.last()`: the form's „Șterge" is at the bottom; „Pagini" rows carry their own, and since
      // #37.56 stand in the right-hand column, after the form in the page: the left area's last one.
      await page.locator('[data-tile-area="left"]').getByRole("button", { name: "Șterge", exact: true }).last().click();
      await page.getByRole("dialog", { name: "Ștergeți actul?" }).getByRole("button", { name: "Da", exact: true }).click();
      await expect(page).toHaveURL(/\/documents$/, { timeout: 30_000 });
    } finally {
      if (certificateId) await removeRecord(page.request, "document", certificateId);
      await removeRecord(page.request, "document", contractId);
    }
  });
});
