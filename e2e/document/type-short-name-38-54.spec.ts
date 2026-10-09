/**
 * Case:   TC-DOC-23 — Lista actelor arată noile denumiri scurte: „Urbanism”, „Aut. Constr.”
 * Source: docs/testing/cases/TC-DOC-23.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step. The documents carry `TC-E2E-DOC-23` (records.ts).
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-23`;

/** „Tip" on the row holding `title`: its text and its tooltip. */
async function tipOf(page: Page, title: string): Promise<[string, string | null]> {
  const main = page.locator("main");
  const cell = main.locator("tbody tr").filter({ hasText: title }).locator("td").nth(1);
  return [(await cell.textContent())?.trim() ?? "", await cell.getAttribute("title")];
}

test.describe("TC-DOC-23 — noile denumiri scurte", () => {
  test("„Urbanism” și „Aut. Constr.” în lista actelor", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 900 });
    await removeLeftovers(page.request, MARK);
    const ids: string[] = [];
    try {
      ids.push(await createDocumentOfType(page.request, "CERTIFICAT_URBANISM", `${MARK} Urbanism`));
      ids.push(await createDocumentOfType(page.request, "AUTORIZATIE_CONSTRUIRE", `${MARK} Construire`));

      // Step 1 — both documents.
      await page.goto("/documents");
      const main = page.locator("main");
      const search = main.getByRole("searchbox", { name: "caută după cod, titlu sau nr. document" });
      await expect(search).toBeVisible({ timeout: 30_000 });
      await search.fill(MARK);
      await expect(main.locator("tbody tr").filter({ hasText: MARK })).toHaveCount(2, { timeout: 30_000 });

      // Steps 2 and 3 — the short names, the full names as tooltips.
      expect(await tipOf(page, `${MARK} Urbanism`)).toEqual(["Urbanism", "Certificat de Urbanism"]);
      expect(await tipOf(page, `${MARK} Construire`)).toEqual(["Aut. Constr.", "Autorizație De Construire"]);
    } finally {
      for (const id of ids) await removeRecord(page.request, "document", id);
    }
  });
});
