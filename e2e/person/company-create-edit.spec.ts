/**
 * Case:   TC-PERS-02 — Persoană juridică creată și modificată
 * Source: docs/testing/cases/TC-PERS-02.md, „Last green" 2026-09-25
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - „Denumire" is `TC-E2E-PERS-02 Firmă de test SRL` — a spec's rows carry
 *     the TC-E2E- marker (e2e/helpers/records.ts) — so step 9 types
 *     `TC-E2E-PERS` and step 10's „Poreclă" is `TC-E2E-PERS-02 editat`.
 *   - The CUI is the case's synthetic `0000000002`. Step 8's search by CUI
 *     asserts this spec's row is found, not that it is the only row: a hand
 *     run in progress would carry the same CUI.
 *   - The case leaves its company for TC-ASSOC-06. A spec may not, so the
 *     case's own cleanup — „Șterge", „Ștergeți persoana juridică?", „Da" —
 *     runs at the end, and a `finally` removes the row through the same
 *     DELETE route if the test stopped before that.
 */

import { test, expect } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";

const MARK = `${E2E_MARKER}PERS-02`;
const NAME = `${MARK} Firmă de test SRL`;
const CUI = "0000000002";

test.describe("TC-PERS-02 — Persoană juridică creată și modificată", () => {
  test("creare, găsire după nume și CUI, modificare → v 1, apoi ștergere", async ({ page }) => {
    // Room for the `finally` (see the TC-PERS-01 spec).
    test.slow();
    await removeLeftovers(page.request, MARK);

    let companyId: string | undefined;
    try {
      // Step 1 — „Persoane Juridice": no CUI column, no „Câmpuri afișate".
      await page.goto("/");
      await openFromSidebar(page, "Persoane Juridice");
      await expect(page.getByRole("heading", { name: "Persoană juridică", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Toate grupurile").first()).toBeVisible();
      const search = page.getByPlaceholder("caută după cod, nume, poreclă sau ID");
      await expect(search).toBeVisible();
      for (const col of ["COD", "DENUMIRE", "PORECLĂ"]) {
        await expect(page.getByRole("columnheader", { name: col }).first()).toBeVisible();
      }
      await expect(page.getByRole("columnheader", { name: "CUI" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^Câmpuri afișate/ })).toHaveCount(0);

      // Step 2 — „Adaugă persoană juridică" goes STRAIGHT to the form.
      await page.getByRole("link", { name: "Adaugă persoană juridică" }).click();
      await expect(page).toHaveURL(/\/judicial-persons\/new$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Persoană juridică nouă" })).toBeVisible({ timeout: 30_000 });
      for (const section of ["PERSOANĂ JURIDICĂ", "PERSOANE DE CONTACT", "ADRESĂ SEDIU SOCIAL", "ADRESĂ CORESPONDENȚĂ"]) {
        await expect(page.getByText(section).first()).toBeVisible();
      }
      await expect(page.getByRole("checkbox", { name: "Aceeași cu adresa sediului social" })).toBeVisible();

      // Step 3 — „Denumire".
      await page.getByLabel(/^Denumire/).fill(NAME);

      // Step 4 — „Tip": the eleven the case lists; „SRL".
      const type = page.getByRole("combobox", { name: "Tip", exact: true });
      for (const offered of ["—", "Consiliu Local", "Instituție", "SRL", "SA", "SRL-D", "PFA", "II", "IF", "ONG", "Altele"]) {
        await expect(type.locator("option", { hasText: new RegExp(`^${offered}$`) })).toHaveCount(1);
      }
      await type.selectOption({ label: "SRL" });

      // Step 5 — „Nr. înregistrare (CUI)", unchecked.
      await page.getByLabel(/^Nr\. înregistrare \(CUI\)/).fill(CUI);

      // Step 6 — „Salvează"; back to the LIST.
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page).toHaveURL(/\/judicial-persons$/, { timeout: 30_000 });

      // Step 7 — at the top: „Nou!", a `JPERS` code, the name, „—".
      const top = page.getByRole("row").nth(1);
      await expect(top).toContainText(NAME, { timeout: 15_000 });
      await expect(top).toContainText("Nou!");
      await expect(top).toContainText(/JPERS\d+/);
      await expect(top).toContainText("—");
      const href = await top.getByRole("link", { name: "Deschide" }).getAttribute("href");
      companyId = href?.split("/").pop();

      // Step 8 — the search matches the CUI; `0000000003` empties the list.
      await search.fill(CUI);
      await expect(page.getByRole("row").filter({ hasText: NAME })).toHaveCount(1, { timeout: 15_000 });
      await search.fill("0000000003");
      await expect(page.getByText("Nu există persoane juridice")).toBeVisible({ timeout: 15_000 });

      // Step 9 — `TC-E2E-PERS`, „Deschide": „v 0", five tabs, no „Persoane",
      // „ID" read-only, and the CUI hint.
      await search.fill(`${E2E_MARKER}PERS`);
      const row = page.getByRole("row").filter({ hasText: NAME });
      await expect(row).toHaveCount(1, { timeout: 15_000 });
      await row.getByRole("link", { name: "Deschide" }).click();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: NAME })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 0", { exact: true }).first()).toBeAttached({ timeout: 30_000 });
      for (const tab of ["DETALII", "ASOCIERI", "PROPRIETĂȚI", "ACTE", "META INFO"]) {
        await expect(page.getByRole("tab", { name: tab })).toBeVisible();
      }
      await expect(page.getByRole("tab", { name: "Persoane" })).toHaveCount(0);
      await expect(page.getByText(/^JPERS\d+$/).first()).toBeVisible();
      await expect(
        page.getByText("CUI-ul nu poate fi modificat odată setat — ștergeți și creați din nou pentru a-l schimba"),
      ).toBeVisible();

      // Step 10 — „Poreclă", „Salvează": STAYS on the company, „v 1", „2 versiuni".
      const nickname = page.getByLabel(/^Poreclă/);
      await nickname.fill(`${MARK} editat`);
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page.getByText("2 versiuni")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 1", { exact: true }).first()).toBeAttached();
      await expect(page).toHaveURL(new RegExp(`/judicial-persons/${companyId}$`));
      await expect(nickname).toHaveValue(`${MARK} editat`);

      // ── At the end — the case's cleanup, through the UI ──────────────────
      await page.getByRole("button", { name: "Șterge", exact: true }).click();
      const confirm = page.getByRole("dialog", { name: "Ștergeți persoana juridică?" });
      await expect(confirm.getByRole("button", { name: "Nu", exact: true })).toBeVisible();
      await confirm.getByRole("button", { name: "Da", exact: true }).click();
      await expect(page).toHaveURL(/\/judicial-persons$/, { timeout: 30_000 });
      await expect(page.getByRole("row").filter({ hasText: NAME })).toHaveCount(0);
    } finally {
      if (companyId) await removeRecord(page.request, "company", companyId);
    }
  });
});
