/**
 * Case:   TC-DOC-25 — „Pagini": un PDF arată doar pagina, fără coloana de miniaturi a browserului
 * Source: docs/testing/cases/TC-DOC-25.md, „Last green" 2026-10-10
 *
 * A translation of the case file, step for step.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The document carries `TC-E2E-DOC-25` (records.ts); its pages are the test PDF `tc-e2e-pagina-3.pdf` and the
 *     blank test image, uploaded through the API.
 *   - Playwright's Chromium has no PDF viewer of its own, so the spec reads what the app asks of the viewer — the
 *     frame's `#navpanes=0` — not the thumbnails; the hand run (Adrian's Chrome, the desktop app's pane) looks.
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type Locator } from "../helpers/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-25`;
const FIXTURES = path.join(process.cwd(), "e2e", "fixtures");

const frameSrc = (where: Locator) => where.locator("iframe[data-pdf-frame]").first().getAttribute("src");

test.describe("TC-DOC-25 — un PDF arată doar pagina", () => {
  test("pe ecranul actului, în „Pagini extinse” și în Incursiune, la 1920 px; o imagine ca înainte", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1100 });
    const docId = await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} Act`);
    try {
      for (const [n, name, mime] of [["1", "tc-e2e-pagina-3.pdf", "application/pdf"], ["2", "tc-e2e-pagina.png", "image/png"]] as const) {
        const up = await page.request.post(`/api/documents/${docId}/pages`, {
          multipart: { file: { name, mimeType: mime, buffer: fs.readFileSync(path.join(FIXTURES, name)) }, pageNumber: n },
        });
        expect(up.ok(), await up.text()).toBeTruthy();
      }

      // Step 1 — the document's „Pagini": page 1, the PDF, in a frame that asks for no thumbnail column.
      await page.goto(`/documents/${docId}`);
      const pages = page.getByRole("region", { name: "Pagini", exact: true }).first();
      await expect(pages.locator("iframe[data-pdf-frame]")).toHaveCount(1, { timeout: 30_000 });
      expect(await frameSrc(pages)).toMatch(/#navpanes=0$/);

      // Step 2 — „Pagini extinse": the same.
      await page.getByRole("button", { name: "Pagini extinse", exact: true }).click();
      await expect.poll(async () => page.locator("iframe[data-pdf-frame]").count()).toBeGreaterThan(0);
      for (const f of await page.locator("iframe[data-pdf-frame]").all()) expect(await f.getAttribute("src")).toMatch(/#navpanes=0$/);
      await page.getByRole("button", { name: "Restrânge", exact: true }).first().click();

      // Step 3 — page 2, the image: drawn as an image, no frame.
      await pages.locator("tbody tr").nth(1).click();
      await expect(pages.getByRole("img", { name: "tc-e2e-pagina.png" })).toBeVisible({ timeout: 15_000 });
      await expect(pages.locator("iframe[data-pdf-frame]")).toHaveCount(0);

      // Step 4 — „Acte", the document's Incursiune: the PDF framed the same way.
      await page.goto("/documents");
      const search = page.locator("main").locator('input[placeholder^="caută"]').first();
      await expect(search).toBeVisible({ timeout: 30_000 });
      await search.fill(MARK);
      const row = page.locator("main [data-list-edge] tbody tr").filter({ hasText: `${MARK} Act` });
      await expect(row).toHaveCount(1, { timeout: 30_000 });
      await row.getByRole("button", { name: "Incursiune", exact: true }).click();
      const peek = page.locator('[data-incursion="document"]');
      await expect(peek.locator("iframe[data-pdf-frame]")).toHaveCount(1, { timeout: 30_000 });
      expect(await frameSrc(peek)).toMatch(/#navpanes=0$/);
    } finally {
      await removeRecord(page.request, "document", docId);
    }
  });
});
