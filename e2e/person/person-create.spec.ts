/**
 * Case:   TC-PERS-01 — Persoană fizică creată manual
 * Source: docs/testing/cases/TC-PERS-01.md, „Last green" 2026-09-22
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - „Nume" is `TC-E2E-PERS-01`, not `TC-PERS-01` — a spec's rows carry the
 *     TC-E2E- marker (e2e/helpers/records.ts). So step 6 reads
 *     `Ion TC-E2E-PERS-01` and step 7 types `TC-E2E-PERS`.
 *   - The case leaves its person for TC-ASSOC-01 and TC-SRCH-01. A spec may
 *     not, so the case's own cleanup — „Șterge", „Da" — runs at the end, and a
 *     `finally` removes the row through the same DELETE route if the test
 *     stopped before that.
 *   - No CNP, exactly as the case: a synthetic record carries no real
 *     identifier.
 */

import { test, expect } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";

const LAST_NAME = `${E2E_MARKER}PERS-01`;
const LISTED_AS = `Ion ${LAST_NAME}`; // prenume first, as the list renders it

test.describe("TC-PERS-01 — Persoană fizică creată manual", () => {
  test("creare manuală, rândul nou apare și se găsește, apoi ștergere", async ({ page }) => {
    await removeLeftovers(page.request, LAST_NAME);

    let personId: string | undefined;
    try {
      // Step 1 — „Persoane Fizice" in the left sidebar.
      await page.goto("/");
      await openFromSidebar(page, "Persoane Fizice");
      await expect(page.getByRole("heading", { name: "Persoană fizică", exact: true })).toBeVisible({ timeout: 30_000 });
      for (const col of ["COD", "NUME", "PORECLĂ"]) {
        await expect(page.getByRole("columnheader", { name: col, exact: false }).first()).toBeVisible();
      }

      // Step 2 — „Adaugă persoană" goes STRAIGHT to the form; no chooser.
      await page.getByRole("link", { name: "Adaugă persoană" }).click();
      await expect(page).toHaveURL(/\/natural-persons\/new$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Persoană fizică nouă" })).toBeVisible({ timeout: 30_000 });
      for (const section of ["IDENTITATE", "CARTE DE IDENTITATE", "CONTACT", "ADRESĂ DOMICILIU"]) {
        await expect(page.getByText(section).first()).toBeVisible();
      }

      // Steps 3–4 — „Nume" and „Prenume".
      await page.getByLabel(/^Nume(\s|$)/).fill(LAST_NAME);
      await page.getByLabel(/^Prenume(\s|$)/).fill("Ion");

      // Step 5 — „Salvează"; back to the LIST.
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page).toHaveURL(/\/natural-persons$/, { timeout: 30_000 });

      // Step 6 — at the top: „Nou!", a `PPERS` code, „Ion TC-E2E-PERS-01", „—".
      const top = page.getByRole("row").nth(1);
      await expect(top).toContainText(LISTED_AS, { timeout: 15_000 });
      await expect(top).toContainText("Nou!");
      await expect(top).toContainText(/PPERS\d+/);
      await expect(top).toContainText("—");
      const href = await top.getByRole("link", { name: "Deschide" }).getAttribute("href");
      personId = href?.split("/").pop();

      // Step 7 — the list's search finds it by the prefix.
      await page.getByPlaceholder("caută după cod, nume, email sau telefon").fill(`${E2E_MARKER}PERS`);
      await expect(page.getByRole("row").filter({ hasText: LISTED_AS })).toHaveCount(1, { timeout: 15_000 });

      // ── At the end — the case's cleanup, through the UI ──────────────────
      await page.getByRole("row").filter({ hasText: LISTED_AS }).getByRole("link", { name: "Deschide" }).click();
      await page.getByRole("button", { name: "Șterge", exact: true }).click();
      const confirm = page.getByRole("dialog", { name: "Ștergeți persoana?" });
      await expect(confirm.getByRole("button", { name: "Nu", exact: true })).toBeVisible();
      await confirm.getByRole("button", { name: "Da", exact: true }).click();
      await expect(page).toHaveURL(/\/natural-persons$/, { timeout: 30_000 });
      await expect(page.getByRole("row").filter({ hasText: LISTED_AS })).toHaveCount(0);
    } finally {
      if (personId) await removeRecord(page.request, "person", personId);
    }
  });
});
