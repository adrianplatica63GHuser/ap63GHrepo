/**
 * Case:   TC-DOC-01 — Act creat, pagină atașată, pagina se deschide
 * Source: docs/testing/cases/TC-DOC-01.md, „Last green" 2026-09-22
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **NO REAL DEED GOES INTO GIT.** The hand run attaches `530.jpg`, a scan of
 * a real contract with real names on it. This spec attaches
 * `e2e/fixtures/tc-e2e-pagina.png` instead — a blank page reading „PAGINĂ DE
 * TEST", made for the purpose — through `setInputFiles` on the same `sr-only`
 * input the hand run uses. It asserts what does not depend on the scan: the
 * page appears in „Pagini", „Pagini extinse" opens it and „✕ Restrânge"
 * closes it. Step 10's „a Romanian sale contract, first page" stays a
 * hand-run assertion; the case file says so too.
 *
 * Other divergences from the hand run, each for a reason the case cannot have:
 *   - „Etichetă scurtă" is `TC-E2E-DOC-01 Contract de test` — a spec's rows
 *     carry the TC-E2E- marker (e2e/helpers/records.ts).
 *   - The case leaves its document for the association cases. A spec may not:
 *     it is removed in `finally` through DELETE /api/documents/[id], the route
 *     the form's „Șterge" → „Da" calls. Not through the button itself: this
 *     screen has two „Șterge" — the page row's and the form's — and the case's
 *     cleanup paragraph exists to tell a PERSON which is which.
 */

import path from "path";
import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";

const TITLE = `${E2E_MARKER}DOC-01 Contract de test`;
const FIXTURE = path.join(__dirname, "../fixtures/tc-e2e-pagina.png");
const FIXTURE_NAME = "tc-e2e-pagina.png";

async function readTotal(page: Page): Promise<number> {
  const text = await page.getByText(/^Se afișează \d+ din \d+$/).textContent();
  const m = /din (\d+)/.exec(text ?? "");
  if (!m) throw new Error(`Unexpected count text: "${text}"`);
  return Number(m[1]);
}

test.describe("TC-DOC-01 — Act creat, pagină atașată, pagina se deschide", () => {
  test("act nou, o pagină atașată fără dialogul sistemului, pagina se deschide", async ({ page }) => {
    // Room for the `finally`: an action waiting on a locator that never matches
    // spends the whole default 30 s, and the cleanup after it then dies of the
    // same timeout, leaving a TC-E2E- row for the next run's removeLeftovers.
    test.slow();
    await removeLeftovers(page.request, `${E2E_MARKER}DOC-01`);

    let documentId: string | undefined;
    try {
      // Step 1 — „Acte": every document in one list, filters, „Adaugă act".
      await page.goto("/");
      await openFromSidebar(page, "Acte");
      await expect(page.getByRole("heading", { name: "Acte", exact: true })).toBeVisible({ timeout: 30_000 });
      for (const col of ["COD", "TIP", "TITLU"]) {
        await expect(page.getByRole("columnheader", { name: col }).first()).toBeVisible();
      }
      await expect(page.getByRole("button", { name: /^Tip document:\s*Toate tipurile/ })).toBeVisible();
      await expect(page.getByText("Importanță:")).toBeVisible();
      await expect(page.getByText("Relevanță:")).toBeVisible();
      await expect(page.getByText("Câmp specific:")).toBeVisible();
      const totalBefore = await readTotal(page);

      // Step 2 — „Adaugă act": „Act nou", „DATE GENERALE", „TAXE ȘI ONORARII",
      // and „Tip document" starts empty.
      await page.getByRole("link", { name: "Adaugă act" }).click();
      await expect(page).toHaveURL(/\/documents\/new$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Act nou" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("DATE GENERALE").first()).toBeVisible();
      await expect(page.getByText("TAXE ȘI ONORARII").first()).toBeVisible();
      const type = page.getByLabel(/^Tip document/);
      await expect(type).toHaveValue("");

      // Step 3 — „Contract de Vânzare (are formular)": the notebook tabs and „FINANCIAR".
      await type.selectOption({ label: "Contract de Vânzare (are formular)" });
      for (const tab of ["Instrument", "Cadastru", "Stare juridică", "Conformitate"]) {
        await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible();
      }
      await expect(page.getByText("FINANCIAR").first()).toBeVisible();

      // Step 4 — „Etichetă scurtă" is the title; there is no „Titlu" field.
      await page.getByLabel(/^Etichetă scurtă/).fill(TITLE);
      await expect(page.getByLabel(/^Titlu/)).toHaveCount(0);

      // Step 5 — „Salvează"; back to „Acte", the new row on top, count + 1.
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page).toHaveURL(/\/documents$/, { timeout: 30_000 });
      const top = page.getByRole("row").nth(1);
      await expect(top).toContainText(TITLE, { timeout: 15_000 });
      await expect(top).toContainText("Nou!");
      await expect(top).toContainText(/DOC\d+/);
      await expect(top).toContainText("Contract de Vânzare");
      await expect(page.getByText(new RegExp(`^Se afișează \\d+ din ${totalBefore + 1}$`))).toBeVisible();

      // Step 6 — „Deschide": headed with the title, „Neprocesat", five tabs,
      // and „Pagini" reading „Nicio pagină adăugată".
      const href = await top.getByRole("link", { name: "Deschide" }).getAttribute("href");
      documentId = href?.split("/").pop();
      await top.getByRole("link", { name: "Deschide" }).click();
      await expect(page.getByRole("heading", { name: TITLE })).toBeVisible({ timeout: 30_000 });
      // The chip carries its subject in an sr-only span
      // (document-detail-tabs.tsx), so its text is „Stare procesare: Neprocesat"
      // and an exact match on „Neprocesat" alone finds nothing (first run).
      await expect(page.getByText("Stare procesare: Neprocesat")).toBeVisible();
      for (const tab of ["DETALII", "ASOCIERI", "PERSOANE", "PROPRIETĂȚI", "META INFO"]) {
        await expect(page.getByRole("tab", { name: tab })).toBeVisible();
      }
      const pages = page.getByRole("region", { name: "Pagini" });
      await expect(pages.getByText("Nicio pagină adăugată")).toBeVisible();
      await expect(pages.getByRole("button", { name: "Pagini extinse" })).toBeVisible();

      // Step 7 — „+ Adaugă pagină" opens the APPLICATION's dialog.
      await pages.getByRole("button", { name: "+ Adaugă pagină" }).click();
      const dialog = page.getByRole("dialog", { name: "Adaugă pagină" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Număr pagină")).toBeVisible();
      await expect(dialog.getByText("Denumire pagină")).toBeVisible();
      await expect(dialog.getByText("Note pagină")).toBeVisible();
      await expect(dialog.getByRole("spinbutton")).toHaveValue("1");
      const dialogSave = dialog.getByRole("button", { name: "Salvează", exact: true });
      await expect(dialogSave).toBeDisabled();

      // Step 8 — the file goes onto the hidden input; „Încarcă" is NOT pressed.
      await dialog.locator('input[type="file"]').setInputFiles(FIXTURE);
      await expect(dialog.getByText(`✓ ${FIXTURE_NAME}`)).toBeVisible();

      // Step 9 — „Salvează": the page is in „Pagini" under its file name, with
      // „Vizualizare", „Tipărire", „Șterge" — and no „1 / 1" for a single page.
      await dialogSave.click();
      await expect(dialog).toHaveCount(0);
      await expect(pages.getByRole("img", { name: FIXTURE_NAME })).toBeVisible({ timeout: 15_000 });
      await expect(pages.getByText(FIXTURE_NAME, { exact: true }).first()).toBeVisible();
      for (const action of ["Vizualizare", "Tipărire", "Șterge"]) {
        await expect(pages.getByRole("button", { name: action, exact: true })).toBeVisible();
      }
      await expect(pages.getByText("1 / 1")).toHaveCount(0);

      // Step 10 — „Pagini extinse": the full-window view headed „Pagini".
      // (That the page is readable is the hand run's to judge — see the header.)
      await pages.getByRole("button", { name: "Pagini extinse" }).click();
      const collapse = page.getByRole("button", { name: /^✕?\s*Restrânge$/ });
      await expect(collapse).toBeVisible();
      await expect(page.getByRole("heading", { name: "Pagini", exact: true })).toBeVisible();

      // Step 11 — „✕ Restrânge": the large view closes.
      await collapse.click();
      await expect(collapse).toHaveCount(0);
      await expect(pages.getByRole("button", { name: "Pagini extinse" })).toBeVisible();
    } finally {
      if (documentId) await removeRecord(page.request, "document", documentId);
    }
  });
});
