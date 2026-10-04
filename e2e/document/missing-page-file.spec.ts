/**
 * Case:   TC-DOC-12 — O pagină al cărei fișier lipsește arată o imagine discretă, nu o eroare
 * Source: docs/testing/cases/TC-DOC-12.md, „Last green" 2026-10-04
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-DOC-12` (records.ts); the image page is
 *     `e2e/fixtures/tc-e2e-pagina.png`, the .docx page a few bytes built here.
 *   - The page's file is removed by this spec, on the machine that runs it,
 *     from the path its view URL names under `uploads\`.
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { E2E_MARKER, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-12`;
const PAGE_FILE = path.join(process.cwd(), "e2e", "fixtures", "tc-e2e-pagina.png");
const MISSING = "Fișierul paginii nu este disponibil";
const ERROR = "Eroare la încărcarea fișierului";
const FAILED = "Această pagină nu a putut fi afișată aici. O puteți descărca.";

test.describe("TC-DOC-12 — fișierul unei pagini lipsește", () => {
  test("imaginea discretă în „Pagini” și în „Pagini extinse”, fără eroare; un .docx își păstrează descărcarea", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const act = await createSaleContract(page.request, `${MARK} Act`);
    const nota = await createSaleContract(page.request, `${MARK} Notă`);
    try {
      const up1 = await page.request.post(`/api/documents/${act}/pages`, {
        multipart: { file: { name: "tc-e2e-pagina.png", mimeType: "image/png", buffer: fs.readFileSync(PAGE_FILE) }, pageNumber: "1" },
      });
      expect(up1.ok(), `the image upload failed (${up1.status()})`).toBeTruthy();
      const up2 = await page.request.post(`/api/documents/${nota}/pages`, {
        multipart: {
          file: { name: "tc-e2e-nota.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from([80, 75, 3, 4, 20, 0, 0, 0]) },
          pageNumber: "1",
        },
      });
      expect(up2.ok(), `the .docx upload failed (${up2.status()})`).toBeTruthy();
      // Before you start — the image page's file removed from uploads\.
      const [first] = (await (await page.request.get(`/api/documents/${act}/pages`)).json()) as { id: string }[];
      const { url } = (await (await page.request.get(`/api/documents/${act}/pages/${first.id}/view`)).json()) as { url: string };
      fs.rmSync(path.join(process.cwd(), "uploads", decodeURIComponent(url.replace(/^\/api\/files\//, ""))));

      // Step 1 — the picture, neither sentence, page 1's row with its buttons.
      await page.goto(`/documents/${act}`);
      const pagini = page.getByRole("region", { name: "Pagini", exact: true });
      await expect(pagini.getByRole("img", { name: MISSING, exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(pagini.getByText(ERROR)).toHaveCount(0);
      await expect(pagini.getByText(FAILED)).toHaveCount(0);
      for (const b of ["Vizualizare", "Tipărire", "Șterge"]) await expect(pagini.locator("tbody tr").getByRole("button", { name: b, exact: true })).toBeVisible();

      // Step 2 — „Pagini extinse": the same picture; „Restrânge".
      await pagini.getByRole("button", { name: "Pagini extinse", exact: true }).click();
      const big = page.getByRole("dialog", { name: "Pagini", exact: true });
      await expect(big.getByRole("img", { name: MISSING, exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(big.getByText(ERROR)).toHaveCount(0);
      await expect(big.getByText(FAILED)).toHaveCount(0);
      await big.getByRole("button", { name: "Restrânge", exact: true }).click();
      await expect(big).toHaveCount(0);

      // Step 3 — the .docx: its download prompt, no picture.
      await page.goto(`/documents/${nota}`);
      const pagini2 = page.getByRole("region", { name: "Pagini", exact: true });
      await expect(pagini2.getByText("Acest tip de fișier nu poate fi previzualizat în browser.")).toBeVisible({ timeout: 30_000 });
      await expect(pagini2.getByRole("img", { name: MISSING })).toHaveCount(0);
    } finally {
      await removeRecord(page.request, "document", act);
      await removeRecord(page.request, "document", nota);
    }
  });
});
