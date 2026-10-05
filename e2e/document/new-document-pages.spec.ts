/**
 * Case:   TC-DOC-14 — Un act nou primește paginile înainte de prima salvare
 * Source: docs/testing/cases/TC-DOC-14.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The files are the case's own, `e2e/fixtures/tc-e2e-pagina-{1,2}.jpg` and
 *     `tc-e2e-pagina-3.pdf`, handed to the panel's file input with
 *     `setInputFiles`; `poza.heic` is made in memory. The hand run made
 *     same-named files in the page (the pane cannot reach the computer's).
 *   - „Etichetă scurtă" is `TC-E2E-DOC-14 Act` (records.ts), and the document
 *     is found by it at the end and deleted, whatever happened before.
 *   - Playwright's mouse throughout; the hand run pressed by script (FU-290).
 */

import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";

const MARK = `${E2E_MARKER}DOC-14`;
const TITLE = `${MARK} Act`;
const NAMES = ["tc-e2e-pagina-1.jpg", "tc-e2e-pagina-2.jpg", "tc-e2e-pagina-3.pdf"];
const FILES = NAMES.map((n) => path.join(__dirname, "..", "fixtures", n));

const panel = (page: Page) => page.locator("[data-new-pages]");
const rows = (page: Page) => page.locator("[data-staged-page]");

async function order(page: Page): Promise<string[]> {
  return rows(page).evaluateAll((els) => els.map((el) => el.getAttribute("data-staged-page") ?? ""));
}

test.describe("TC-DOC-14 — un act nou primește paginile înainte de prima salvare", () => {
  test("alese, refuzate, mutate, salvate în ordine; plecarea întreabă", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    let id: string | undefined;
    try {
      // Step 1 — „Acte", „Adaugă act": „Pagini", purple, empty.
      await page.goto("/");
      await openFromSidebar(page, "Acte");
      await page.getByRole("link", { name: "Adaugă act", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Act nou" })).toBeVisible({ timeout: 30_000 });
      await expect(panel(page)).toHaveAttribute("aria-label", "Pagini");
      await expect(panel(page)).toHaveClass(/bg-card-pinned/);
      await expect(panel(page).getByRole("button", { name: "+ Adaugă pagină", exact: true })).toBeVisible();
      await expect(panel(page).getByText("Nicio pagină adăugată")).toBeVisible();

      // Step 2 — the three files: rows 1–3 in that order, the JPGs with their picture, the PDF an icon.
      await panel(page).locator('input[type="file"]').setInputFiles(FILES);
      await expect(rows(page)).toHaveCount(3);
      expect(await order(page)).toEqual(NAMES);
      for (const [i, thumb] of [[0, "image"], [1, "image"], [2, "file"]] as const) {
        await expect(rows(page).nth(i).locator(`[data-staged-thumb="${thumb}"]`)).toBeVisible();
        await expect(rows(page).nth(i)).toContainText(String(i + 1));
      }

      // Step 3 — „poza.heic" refused there; still three rows.
      await panel(page).locator('input[type="file"]').setInputFiles({ name: "poza.heic", mimeType: "image/heic", buffer: Buffer.from("x") });
      await expect(panel(page).getByRole("alert")).toContainText("poza.heic: Acest tip de fișier nu poate fi adăugat ca pagină.");
      await expect(rows(page)).toHaveCount(3);

      // Step 4 — „Mută mai sus" on row 3, then „Mută mai jos" on row 2.
      await rows(page).nth(2).getByRole("button", { name: "Mută mai sus", exact: true }).click();
      expect(await order(page)).toEqual([NAMES[0], NAMES[2], NAMES[1]]);
      await rows(page).nth(1).getByRole("button", { name: "Mută mai jos", exact: true }).click();
      expect(await order(page)).toEqual(NAMES);
      await expect(rows(page).nth(0).getByRole("button", { name: "Mută mai sus", exact: true })).toBeDisabled();

      // Step 5 — the type, the label, „Salvează": the document's own screen, its pages 1–3.
      await page.getByLabel(/^Tip document/).selectOption({ label: "Contract de Vânzare (are formular)" });
      await page.getByLabel(/^Etichetă scurtă/).fill(TITLE);
      await page.locator("#document-form").evaluate((f: HTMLFormElement) => f.requestSubmit());
      await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/, { timeout: 60_000 });
      id = page.url().split("/").pop();
      await expect(page.getByRole("heading", { name: TITLE })).toBeVisible({ timeout: 30_000 });
      const pages = page.getByRole("region", { name: "Pagini" });
      const table = pages.locator("tbody tr");
      await expect(table).toHaveCount(3, { timeout: 30_000 });
      for (let i = 0; i < 3; i++) {
        await expect(table.nth(i).locator("td").first()).toHaveText(String(i + 1));
        await expect(table.nth(i)).toContainText(NAMES[i]);
      }
      await expect(page.getByText("Unele pagini nu au fost salvate")).toHaveCount(0);

      // Step 6 — a new form with a chosen page: leaving asks; „Anulează" keeps it.
      await openFromSidebar(page, "Acte");
      await page.getByRole("link", { name: "Adaugă act", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Act nou" })).toBeVisible({ timeout: 30_000 });
      await panel(page).locator('input[type="file"]').setInputFiles(FILES[2]);
      await expect(rows(page)).toHaveCount(1);
      await openFromSidebar(page, "Acte");
      const dialog = page.getByRole("dialog").filter({ hasText: "Modificări nesalvate" });
      await expect(dialog).toBeVisible();
      for (const b of ["Anulează", "Renunță", "Salvează"]) await expect(dialog.getByRole("button", { name: b, exact: true })).toBeVisible();
      await dialog.getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(page).toHaveURL(/\/documents\/new$/);
      await expect(rows(page)).toHaveCount(1);

      // At the end — the second form left with „Renunță".
      await openFromSidebar(page, "Acte");
      await page.getByRole("dialog").filter({ hasText: "Modificări nesalvate" }).getByRole("button", { name: "Renunță", exact: true }).click();
      await expect(page).toHaveURL(/\/documents$/);
    } finally {
      if (id) await removeRecord(page.request, "document", id);
      await removeLeftovers(page.request, MARK);
    }
  });
});
