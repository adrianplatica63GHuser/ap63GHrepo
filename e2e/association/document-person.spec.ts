/**
 * Case:   TC-ASSOC-01 — Persoană asociată actului cu rol și cotă-parte
 * Source: docs/testing/cases/TC-ASSOC-01.md, „Last green" 2026-09-22
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The case's prerequisites are TC-PERS-01's person and TC-DOC-01's
 *     document. Here they are this spec's own, created through the same POST
 *     routes those forms call and marked `TC-E2E-ASSOC-01` (person „Ion
 *     TC-E2E-ASSOC-01", document „TC-E2E-ASSOC-01 Contract de test"), so step 4
 *     types `TC-E2E-ASSOC-01` where the case types `TC-PERS-01`. Driving those
 *     two forms is what the TC-PERS-01 and TC-DOC-01 specs are for.
 *   - Both are removed in `finally` through the DELETE routes „Șterge" calls,
 *     after the case's own cleanup (radio, „Dezasociază") has run.
 *   - Step 11's warning is matched as its two halves around the role name,
 *     because the message file closes „Cumpărător" with a typographic quote
 *     the case file does not reproduce; the words are the case's, verbatim.
 */

import { test, expect } from "@playwright/test";
import {
  E2E_MARKER,
  createNaturalPerson,
  createSaleContract,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";

const MARK = `${E2E_MARKER}ASSOC-01`;
const PERSON = `Ion ${MARK}`; // prenume first, as every list renders it
const DOC_TITLE = `${MARK} Contract de test`;
const ROW = `${PERSON} — Cumpărător`; // the accessible-name suffix of the row's controls

test.describe("TC-ASSOC-01 — Persoană asociată actului cu rol și cotă-parte", () => {
  test("rol Cumpărător, cotă 50% cu avertisment, indiviziune, apoi 100%", async ({ page }) => {
    // Room for the `finally`: an action waiting on a locator that never matches
    // spends the whole default 30 s, and the cleanup after it then dies of the
    // same timeout, leaving a TC-E2E- row for the next run's removeLeftovers.
    test.slow();
    await removeLeftovers(page.request, MARK);
    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const documentId = await createSaleContract(page.request, DOC_TITLE);

    try {
      // Step 1 — the document's detail screen.
      await page.goto(`/documents/${documentId}`);
      await expect(page.getByRole("heading", { name: DOC_TITLE })).toBeVisible({ timeout: 30_000 });

      // Step 2 — „Persoane", beside „Asocieri": empty, „Asociază", „Dezasociază".
      await page.getByRole("tab", { name: "Persoane" }).click();
      await expect(page.getByText("Nicio persoană asociată acestui act")).toBeVisible();
      await expect(page.getByRole("button", { name: "Dezasociază", exact: true })).toBeVisible();

      // Step 3 — „Asociază": „Asociere persoană", the title, the filters, „Rol".
      await page.getByRole("button", { name: "Asociază", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${documentId}/associate-person$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere persoană" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText(DOC_TITLE).first()).toBeVisible();
      // `exact`: the sidebar's quick search „Nume, cod…" contains „cod…" too —
      // the first run failed on exactly that (strict mode, two inputs).
      const nameFilter = page.getByPlaceholder("Nume…", { exact: true });
      await expect(nameFilter).toBeVisible();
      await expect(page.getByPlaceholder("Cod…", { exact: true })).toBeVisible();
      // By role, not getByLabel: the <label> wraps the <select>, so its text runs
      // straight into the options — „Rol— fără rol —Cumpărător…", no space — and
      // /^Rol(\s|$)/ matched nothing (second run). The accessible name is „Rol".
      const role = page.getByRole("combobox", { name: "Rol", exact: true });
      await expect(role.locator("option:checked")).toHaveText("— fără rol —");

      // Step 4 — one row: `PPERS…`, „Ion TC-E2E-ASSOC-01", „Fizică".
      await nameFilter.fill(MARK);
      const candidates = page.getByRole("row").filter({ hasText: PERSON });
      await expect(candidates).toHaveCount(1, { timeout: 15_000 });
      await expect(candidates).toContainText(/PPERS\d+/);
      await expect(candidates).toContainText("Fizică");

      // Step 5 — „Cumpărător", out of the five a Contract de Vânzare offers.
      for (const offered of [
        "Cumpărător",
        "Moștenitor / Succesor",
        "Notar",
        "Reprezentant legal / Mandatar",
        "Vânzător",
      ]) {
        await expect(role.locator("option", { hasText: offered })).toHaveCount(1);
      }
      await role.selectOption({ label: "Cumpărător" });

      // Step 6 — tick the row.
      await page.getByRole("checkbox", { name: PERSON }).check();

      // Step 7 — „Asociază selecția": back on the document, on „Persoane".
      // (Runs 1–6 of this spec never found this button: the screen said
      // „Asociează selecția", a misspelling in messages/ro-RO.json since Slice
      // #5.4, where every other association screen says „Asociază". The case
      // file had the right word; the message file is what was corrected.)
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${documentId}\\?tab=persons$`), { timeout: 30_000 });

      // Step 8 — Nume · Rol · Cotă-parte · Suprafață echivalentă (mp) · Mod de
      // deținere, no „Cod" column, and the one row as „Cumpărător".
      await expect(page.getByRole("radio", { name: ROW })).toBeVisible({ timeout: 15_000 });
      const linked = page.getByRole("table").filter({ has: page.getByRole("radio", { name: ROW }) });
      for (const col of ["Nume", "Rol", "Cotă-parte", "Suprafață echivalentă (mp)", "Mod de deținere"]) {
        await expect(linked.getByText(col, { exact: true }).first()).toBeVisible();
      }
      await expect(linked.getByText("Cod", { exact: true })).toHaveCount(0);

      // Step 9 — `50%`, leave the field: stored, and the cell reads `50`.
      const cota = page.getByRole("textbox", { name: `Cotă-parte — ${ROW}` });
      await cota.click();
      await cota.fill("50%");
      await cota.blur();
      await expect(cota).toHaveValue("50", { timeout: 15_000 });

      // Step 10 — „Mod de deținere" is an inline select on the same row; the
      // qualifier survives a reload.
      const mod = page.getByRole("combobox", { name: `Mod de deținere — ${ROW}` });
      for (const offered of ["— nespecificat —", "în nume propriu", "devălmășie", "indiviziune", "prin mandatar"]) {
        await expect(mod.locator("option", { hasText: offered })).toHaveCount(1);
      }
      await mod.selectOption({ label: "indiviziune" });
      await expect(mod.locator("option:checked")).toHaveText("indiviziune");
      await page.reload();
      await expect(mod.locator("option:checked")).toHaveText("indiviziune", { timeout: 30_000 });
      await expect(cota).toHaveValue("50");

      // Step 11 — the warning, and NO separate „Total Cumpărător: 50%" line:
      // the application warns and saves anyway.
      await expect(page.getByText("Cotele pentru")).toContainText(
        "însumează 50%, nu 100%. Actul se salvează oricum — verificați ce scrie în act.",
      );
      await expect(page.getByText("Total Cumpărător: 50%")).toHaveCount(0);

      // Step 12 — `100%`: click into the cell, Ctrl+A, type, leave. Never a
      // double-click on a person row: it opens the person (the case's ⚠️).
      await cota.click();
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.type("100%");
      await cota.blur();
      await expect(page.getByText("Total Cumpărător: 100%")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Cotele pentru")).toHaveCount(0);

      // ── At the end — select the row's radio, then „Dezasociază" ──────────
      await page.getByRole("radio", { name: ROW }).check();
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nicio persoană asociată acestui act")).toBeVisible({ timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "person", personId);
    }
  });
});
