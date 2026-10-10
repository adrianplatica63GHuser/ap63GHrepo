/**
 * Case:   TC-DOC-24 — „Pagini": creionul „Notițe pagină" scrie, schimbă și șterge notițele unei pagini
 * Source: docs/testing/cases/TC-DOC-24.md, „Last green" 2026-10-10
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The document carries `TC-E2E-DOC-24` (records.ts); its page is the blank
 *     test page `e2e/fixtures/tc-e2e-pagina.png`, uploaded through the API.
 *   - Each save waits for the PATCH's answer before the reload.
 *   - The picture for Slice #38.80's handover goes to playwright-report/page-notes.
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-24`;
const PAGE_FILE = path.join(process.cwd(), "e2e", "fixtures", "tc-e2e-pagina.png");
const NOTE = "Semnătura de pe verso, ștampila notarului.";

test.describe("TC-DOC-24 — notițele unei pagini", () => {
  test("creionul scrie notițele, le arată după reîncărcare, le șterge; clicul pe rând deschide pagina; nu e în Incursiune", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 1000 });
    const docId = await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} Act`);
    try {
      for (const n of ["1", "2"]) {
        const up = await page.request.post(`/api/documents/${docId}/pages`, {
          multipart: { file: { name: `tc-e2e-pagina-${n}.png`, mimeType: "image/png", buffer: fs.readFileSync(PAGE_FILE) }, pageNumber: n },
        });
        expect(up.ok(), await up.text()).toBeTruthy();
      }

      // Step 1 — the document's „Pagini": each row reads „Notițe pagină" (the pen) and „Tipărire", no „Vizualizare".
      await page.goto(`/documents/${docId}`);
      const pages = page.getByRole("region", { name: "Pagini", exact: true }).first();
      const rows = pages.locator("tbody tr");
      await expect(rows).toHaveCount(2, { timeout: 30_000 });
      const first = rows.first();
      await expect(first.getByRole("button", { name: "Notițe pagină", exact: true })).toBeVisible();
      await expect(first.getByRole("button", { name: "Tipărire", exact: true })).toBeVisible();
      await expect(pages.getByRole("button", { name: "Vizualizare", exact: true })).toHaveCount(0);
      await expect(first.locator("td").nth(2)).toHaveText("—");

      // Step 2 — the pen: „Notițe pagină", the page named under it, an empty box; a note written and saved.
      await first.getByRole("button", { name: "Notițe pagină", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Notițe pagină", exact: true });
      await expect(dialog).toBeVisible();
      const box = dialog.getByRole("textbox", { name: "Note pagină", exact: true });
      await expect(box).toHaveValue("");
      await box.fill(NOTE);
      fs.mkdirSync("playwright-report/page-notes", { recursive: true });
      await page.screenshot({
        path: "playwright-report/page-notes/dialog-1366.png",
        // Synthetic data only in pictures: the signed-in name and „Recente" are painted over.
        mask: [
          page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) }),
          page.locator("aside").getByText(/^Autentificat ca/),
        ],
      });
      let saved = page.waitForResponse((r) => r.request().method() === "PATCH" && /\/pages\//.test(r.url()));
      await dialog.getByRole("button", { name: "Salvează", exact: true }).click();
      expect((await saved).ok()).toBeTruthy();
      await expect(dialog).toHaveCount(0);
      await expect(first.locator("td").nth(2)).toHaveText(NOTE);

      // Step 3 — after a reload the Notes column still shows it.
      await page.reload();
      await expect(rows.first().locator("td").nth(2)).toHaveText(NOTE, { timeout: 30_000 });

      // Step 4 — the pen again: the note in the box; cleared and saved, the column reads „—".
      await rows.first().getByRole("button", { name: "Notițe pagină", exact: true }).click();
      await expect(box).toHaveValue(NOTE);
      await box.fill("");
      saved = page.waitForResponse((r) => r.request().method() === "PATCH" && /\/pages\//.test(r.url()));
      await dialog.getByRole("button", { name: "Salvează", exact: true }).click();
      expect((await saved).ok()).toBeTruthy();
      await page.reload();
      await expect(rows.first().locator("td").nth(2)).toHaveText("—", { timeout: 30_000 });

      // Step 5 — a click on the second row still opens that page in the viewer.
      await rows.nth(1).click();
      await expect(rows.nth(1)).toHaveAttribute("aria-pressed", "true");
      await expect(rows.first()).toHaveAttribute("aria-pressed", "false");

      // Step 6 — „Acte", the document's „Incursiune": its „Pagini" has no pen — a look, not an edit.
      await page.goto("/documents");
      const search = page.locator("main").locator('input[placeholder^="caută"]').first();
      await expect(search).toBeVisible({ timeout: 30_000 });
      await search.fill(MARK);
      const row = page.locator("main [data-list-edge] tbody tr").filter({ hasText: `${MARK} Act` });
      await expect(row).toHaveCount(1, { timeout: 30_000 });
      await row.getByRole("button", { name: "Incursiune", exact: true }).click();
      const peek = page.locator('[data-incursion="document"] section[aria-label="Pagini"]');
      await expect(peek.locator("tbody tr")).toHaveCount(2, { timeout: 30_000 });
      await expect(peek.getByRole("button", { name: "Notițe pagină", exact: true })).toHaveCount(0);
    } finally {
      await removeRecord(page.request, "document", docId);
    }
  });
});
