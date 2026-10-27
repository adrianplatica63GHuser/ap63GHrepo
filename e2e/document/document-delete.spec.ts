/**
 * Case:   TC-DOC-26 — „Șterge" pe un act abia creat: actul dispare din listă; o ștergere eșuată spune de ce și lasă butoanele
 * Source: docs/testing/cases/TC-DOC-26.md, „Last green" 2026-10-14
 *
 * A translation of the case file, step for step (Slice #39.32). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The created act carries `TC-E2E-DOC-26` as its „Nr. act autentic", so the
 *     list's search finds it, and a leftover is removed by `finally`.
 *   - Step 5's failure is made by answering the DELETE with a 404 in the
 *     browser (`page.route`); the hand run deleted the act from a second tab.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-26`;
const GONE = "Actul nu mai există în arhivă — poate a fost șters între timp.";

const tile = (page: Page) => page.locator('[data-panel="general"]');

async function countByMark(page: Page): Promise<number> {
  const res = await page.request.get(`/api/documents?q=${encodeURIComponent(MARK)}&limit=10`);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { total: number }).total;
}

test.describe("TC-DOC-26 — „Șterge” pe un act abia creat", () => {
  test("creat, salvat, șters: actul nu mai e în listă", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    let id: string | undefined;
    try {
      // Step 1 — „Adaugă act": a Contract de Vânzare, a notary office, the number.
      await page.goto("/documents/new");
      await page.getByLabel(/^Tip document/).selectOption({ label: "Contract de Vânzare (F)" }); // 40.88: „(are formular)" became „(F)"
      await tile(page).getByRole("combobox", { name: "Notariat", exact: true }).selectOption({ label: "Notariat" }) // #39.72: the issuer, a juridical person by its name;
      await tile(page).locator('[data-width-field="nrDocument"]').fill(MARK);

      // Step 2 — „Salvează": the act's own address.
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/, { timeout: 30_000 });
      id = page.url().split("/").pop();
      expect(await countByMark(page)).toBe(1);

      // Step 3 — „Șterge": the question, on the screen, its „Da" in reach.
      await page.getByRole("button", { name: "Șterge", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Ștergeți actul?" });
      await expect(dialog).toBeVisible();
      const yes = dialog.getByRole("button", { name: "Da", exact: true });
      await expect(yes).toBeInViewport();
      // Nothing grew under it: the page is not millions of pixels tall.
      const height = await page.evaluate(() => document.querySelector("main")?.scrollHeight ?? 0);
      expect(height).toBeLessThan(20_000);

      // Step 4 — „Da": the list, without the act.
      await yes.click();
      await expect(page).toHaveURL(/\/documents$/, { timeout: 30_000 });
      const search = page.getByRole("searchbox", { name: "caută după Cod, Titlu sau Nr. document" });
      await search.fill(MARK);
      await expect(page.locator("main table tbody tr").filter({ hasText: MARK })).toHaveCount(0);
      expect(await countByMark(page)).toBe(0);
      expect((await page.request.get(`/api/documents/${id}`)).status()).toBe(404);
    } finally {
      if (id) await removeRecord(page.request, "document", id);
    }
  });

  test("o ștergere eșuată spune de ce, în română, și lasă actul deschis cu butoanele lui", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 900 });
    const id = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} eșuat`);
    try {
      // Step 5 — the act gone meanwhile: the DELETE answers 404.
      await page.route(`**/api/documents/${id}`, (route) =>
        route.request().method() === "DELETE"
          ? route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) })
          : route.continue(),
      );
      await page.goto(`/documents/${id}`);
      await page.getByRole("button", { name: "Șterge", exact: true }).click();
      await page.getByRole("dialog", { name: "Ștergeți actul?" }).getByRole("button", { name: "Da", exact: true }).click();

      await expect(page.getByRole("alert").filter({ hasText: GONE })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Not found", { exact: true })).toHaveCount(0);
      await expect(page.getByRole("dialog", { name: "Ștergeți actul?" })).toHaveCount(0);
      await expect(page).toHaveURL(new RegExp(`/documents/${id}$`));
      for (const name of ["Șterge", "Anulează"]) {
        await expect(page.getByRole("button", { name, exact: true })).toBeEnabled();
      }
    } finally {
      await page.unroute(`**/api/documents/${id}`);
      await removeRecord(page.request, "document", id);
    }
  });
});
