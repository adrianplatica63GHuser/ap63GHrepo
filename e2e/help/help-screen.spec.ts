/**
 * Case:   TC-HELP-01 — Text de ajutor scris pentru un ecran și citit în spatele „?”
 * Source: docs/testing/cases/TC-HELP-01.md, „Last green" 2026-09-26
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **HELP IS SHARED STATE — EVERY USER READS IT — AND IT IS GIVEN BACK BYTE
 * FOR BYTE.** The spec reads all four stored fields of „Administrare —
 * Etichete" before it touches anything, puts the text back through the screen
 * as the case does, and then — in a `finally`, so also when an assertion
 * failed first — writes all four back through the PUT the screen's „Salvează"
 * sends and asserts that what is stored equals what was read (`readHelp`,
 * `writeHelp`, e2e/helpers/records.ts). The row's `updated_at` moves; the text
 * does not, which is exactly what the case file says.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The four text areas' labels are not tied to them, so „Cum se folosește
 *     (Română)" is found as the fourth text area, in the order the labels are
 *     shown. Not changed here.
 *   - The sentence written is `TC-E2E-HELP-01 — text de ajutor scris de cazul
 *     de test.` — the case's, with the TC-E2E- marker every spec write carries.
 *   - Step 3's „checks it is the text above" compares the stored field with the
 *     case file's text, character for character, before anything is written.
 */

import { test, expect } from "@playwright/test";
import { readHelp, writeHelp } from "../helpers/records";
import { sidebar } from "../helpers/sidebar";

const SCREEN = "admin-tags";
const ORIGINAL_HOW_TO_RO =
  "Etichetele se adaugă din fila META INFO a unei înregistrări, una câte una.\n\n" +
  "Descriere completă: Manualul utilizatorului, capitolul 6.4.";
const TC_TEXT = "TC-E2E-HELP-01 — text de ajutor scris de cazul de test.";

test.describe("TC-HELP-01 — Text de ajutor scris pentru un ecran și citit în spatele „?”", () => {
  test("textul scris pe „Informații de ajutor” e cel din „?”; apoi pus înapoi identic", async ({ page }) => {
    test.slow();
    const before = await readHelp(page.request, SCREEN);
    // Step 3's check, made before anything is written: the stored text is the case's.
    expect(before.howToRo).toBe(ORIGINAL_HOW_TO_RO);

    try {
      // Step 1 — „Administrare" → „Informații de ajutor": the heading, „Ecrane", „Sfaturi rapide",
      // every screen „Complet" once the list has loaded (FU-227).
      await page.goto("/");
      const nav = sidebar(page);
      const helpLink = nav.getByRole("link", { name: "Informații de ajutor", exact: true });
      if (!(await helpLink.isVisible())) {
        await nav.getByRole("button", { name: "Administrare", exact: true }).click();
      }
      await helpLink.click();
      await expect(page).toHaveURL(/\/admin\/help-content$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Informații de ajutor" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Ecrane", { exact: true })).toBeVisible();
      await expect(page.getByText("Sfaturi rapide", { exact: true })).toBeVisible();
      const screenButton = page.getByRole("button", { name: /^Administrare — Etichete/ });
      await expect(screenButton).toContainText("Complet", { timeout: 30_000 });
      await expect(page.getByText("Lipsă", { exact: true })).toHaveCount(0);

      // Step 2 — the four fields, „Salvează", „Previzualizare".
      await screenButton.click();
      for (const label of ["Context (Engleză)", "Context (Română)", "Cum se folosește (Engleză)", "Cum se folosește (Română)"]) {
        await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
      }
      await expect(page.getByText("Previzualizare", { exact: true })).toBeVisible();
      const save = page.getByRole("button", { name: "Salvează", exact: true });
      await expect(save).toBeVisible();
      const howToRo = page.locator("main textarea").nth(3);

      // Step 3 — the field holds the text above.
      await expect(howToRo).toHaveValue(ORIGINAL_HOW_TO_RO);

      // Step 4 — the new sentence; „Previzualizare" follows.
      await howToRo.fill(TC_TEXT);
      // The preview's paragraph — the text area holds the same words.
      await expect(page.locator("main p").filter({ hasText: TC_TEXT })).toBeVisible();

      // Step 5 — „Salvează": „Salvat".
      await save.click();
      await expect(page.getByText("Salvat", { exact: true })).toBeVisible({ timeout: 15_000 });

      // Step 6 — „Etichete", „?": „Ajutor" with „×", „Context" unchanged, „Cum se folosește" the new text.
      const tagsLink = nav.getByRole("link", { name: "Etichete", exact: true });
      if (!(await tagsLink.isVisible())) {
        await nav.getByRole("button", { name: "Administrare", exact: true }).click();
      }
      await tagsLink.click();
      await expect(page).toHaveURL(/\/admin\/tags$/, { timeout: 30_000 });
      // Slice #38.20: the sidebar has a section „Ajutor" too — the screen's „?" is the one outside it.
      await page
        .getByRole("button", { name: "Ajutor", exact: true })
        .and(page.locator(":not(nav[data-sidebar-nav] *)"))
        .first()
        .click({ timeout: 30_000 });
      // The innermost block holding both the „Ajutor" heading and „Cum se folosește" is the panel.
      const panel = page
        .locator("div")
        .filter({ has: page.getByRole("heading", { name: "Ajutor", exact: true }) })
        .filter({ hasText: "Cum se folosește" })
        .last();
      await expect(panel.getByRole("button", { name: "Închide" })).toBeVisible();
      await expect(panel.getByRole("heading", { name: "Context", exact: true })).toBeVisible();
      await expect(panel.getByText(before.backgroundRo ?? "", { exact: true })).toBeVisible();
      await expect(panel.getByRole("heading", { name: "Cum se folosește", exact: true })).toBeVisible();
      await expect(panel.getByText(TC_TEXT, { exact: true })).toBeVisible();

      // ── At the end — the text above back into the field, empty line included, „Salvează" ──
      await page.goto("/admin/help-content");
      await page.getByRole("button", { name: /^Administrare — Etichete/ }).click({ timeout: 30_000 });
      await expect(howToRo).toHaveValue(TC_TEXT, { timeout: 15_000 });
      await howToRo.fill(ORIGINAL_HOW_TO_RO);
      await save.click();
      await expect(page.getByText("Salvat", { exact: true })).toBeVisible({ timeout: 15_000 });
    } finally {
      await writeHelp(page.request, SCREEN, before);
      expect(await readHelp(page.request, SCREEN)).toEqual(before);
    }
  });
});
