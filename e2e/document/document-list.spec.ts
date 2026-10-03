/**
 * Case:   TC-DOC-08 — Lista actelor: căutarea înaintea tipului, fără filtre de importanță și relevanță, „Câmpuri afișate" cu câmpurile oricărui act, „Câmp specific" explicat
 * Source: docs/testing/cases/TC-DOC-08.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The document carries `TC-E2E-DOC-08` (records.ts).
 *   - A Playwright browser has never chosen, so the columns start as the two
 *     defaults, Nr. document and Data: „Câmpuri afișate 2/4", and step 4's two
 *     headers follow theirs.
 *   - Step 5 checks the bubble's opening and closing and the start of its text;
 *     the jest suite `document-list.test.tsx` holds the rest.
 *   - Slice #37.62's pictures, not steps of the case: the toolbar, and the list
 *     with „Câmpuri afișate" open, at 1366 and 1920 px, into
 *     `playwright-report/document-list/`.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-08`;
const TITLE = `${MARK} Act de test`;
const SUBJECT = "Subiect de test TC-DOC-08";
const SHOTS = "playwright-report/document-list";

async function photograph(page: Page, name: string, target: Locator): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await target.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-DOC-08 — lista actelor", () => {
  test("căutarea întâi, fără importanță și relevanță, „Câmpuri afișate” cu câmpurile oricărui act, „Câmp specific” explicat", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const documentId = await createDocumentOfType(page.request, "ADEVERINTA", TITLE, { subject: SUBJECT });
    try {
      // Step 1 — the search box first, then „Tip document"; no „Importanță" or „Relevanță".
      await page.goto("/documents");
      const main = page.locator("main");
      const search = main.getByRole("searchbox", { name: "caută după cod, titlu sau nr. document" });
      await expect(search).toBeVisible({ timeout: 30_000 });
      const typeFilter = main.getByRole("button", { name: /^Tip document:\s*Toate tipurile/ });
      await expect(typeFilter).toBeVisible();
      const [s, t] = [await search.boundingBox(), await typeFilter.boundingBox()];
      expect(s && t && (s.y + s.height <= t.y || s.x + s.width <= t.x)).toBeTruthy();
      await expect(main.getByText("Câmp specific:")).toBeVisible();
      const about = main.getByRole("button", { name: "Despre „Câmp specific”" });
      await expect(about).toBeVisible();
      await expect(main.getByRole("button", { name: "Expiră curând" })).toBeVisible();
      const chooserButton = main.getByRole("button", { name: /^Câmpuri afișate \d\/4$/ });
      await expect(chooserButton).toBeVisible();
      await expect(main.getByText(/Importanță|Relevanță/)).toHaveCount(0);

      // Step 2 — one row: „Adeverință", the title.
      await search.fill(MARK);
      const table = main.locator("table").first();
      const row = table.locator("tbody tr").filter({ hasText: TITLE });
      await expect(row).toHaveCount(1, { timeout: 30_000 });
      await expect(row).toContainText("Adeverință");
      expect((await table.innerText()).match(/\bDOC\d{3,}\b/g) ?? []).toEqual([]);
      await photograph(page, "documents-toolbar", search.locator(".."));

      // Step 3 — the eight fields, and none of the three.
      await chooserButton.click();
      const picker = main.locator("[data-field-chooser]");
      await expect(picker.getByText("Selectați până la 4 coloane opționale")).toBeVisible();
      await expect(picker.locator("label")).toHaveText([
        "Nr. document", "Data", "Instituție / Notariat", "Subiect", "Nr. pagini", "Persoane", "Proprietăți", "Adăugat la",
      ]);
      for (const gone of ["Importanță", "Relevanță", "Proveniență"]) {
        await expect(picker.getByText(gone, { exact: true })).toHaveCount(0);
      }

      // Step 4 — „Subiect" and „Adăugat la": two more headers, and their values.
      await picker.getByLabel("Subiect", { exact: true }).check();
      await picker.getByLabel("Adăugat la", { exact: true }).check();
      await expect(table.getByRole("columnheader", { name: "Subiect" })).toBeVisible();
      await expect(table.getByRole("columnheader", { name: "Adăugat la" })).toBeVisible();
      const today = await page.evaluate(() => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
      });
      await expect(row).toContainText(SUBJECT);
      await expect(row).toContainText(today);
      await photograph(page, "documents-chooser", main);

      // Step 5 — outside the list; resting the mouse on „Câmp specific:" opens the
      // bubble, moving it away closes it. (A press on the ⓘ after a rest would close
      // it again — the ⓘ is the way in for a finger, as on the import bar.)
      await page.getByRole("heading", { level: 1 }).first().click();
      await expect(picker.locator("label")).toHaveCount(0);
      const bubble = page.locator("#custom-field-hint");
      await expect(bubble).toHaveClass(/sr-only/);
      await main.getByText("Câmp specific:").hover();
      await expect(bubble).toContainText("Filtrează după unul dintre câmpurile proprii ale unui tip de act");
      await expect(bubble).not.toHaveClass(/sr-only/);
      await page.mouse.move(5, 5);
      await expect(bubble).toHaveClass(/sr-only/);
    } finally {
      await removeRecord(page.request, "document", documentId);
    }
  });
});
