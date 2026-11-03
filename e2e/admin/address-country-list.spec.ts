/**
 * Case:   TC-VL-12 — „Țara adresei” după „Cetățenie”, cu cele opt țări; o schimbare în una cere verificarea celeilalte
 * Source: docs/testing/cases/TC-VL-12.md, „Last green" 2026-11-02
 *
 * Slice 41.51. An invented country (`TC-E2E-VL-12 Țară`) is added through the screen and deleted through it; nothing
 * else in either list changes. Maps are not on these screens.
 */
import { test, expect, type APIRequestContext } from "../helpers/test";
import { E2E_MARKER } from "../helpers/records";

const MARK = `${E2E_MARKER}VL-12`;
const NEW = `${MARK} Țară`;
const LIST = "/api/admin/value-lists/address-countries";
const EIGHT = ["România", "Moldova", "Statele Unite ale Americii", "Germania", "Franța", "Italia", "Spania", "Regatul Unit"];
const NOTICE = "Ați salvat o schimbare în „Țara adresei”. Verificați dacă „Cetățenie” are nevoie de aceeași schimbare, ca listele să rămână în acord.";

async function removeMine(request: APIRequestContext): Promise<void> {
  const res = await request.get(LIST);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { items?: { id: string; name: string }[] };
  for (const v of body.items ?? []) if (v.name.startsWith(MARK)) await request.delete(`${LIST}/${v.id}`);
}

test.describe("TC-VL-12 — „Țara adresei”", () => {
  test("după „Cetățenie”, cele opt țări; adăugată și ștearsă, de fiecare dată nota despre „Cetățenie”", async ({ page }) => {
    test.slow();
    await removeMine(page.request);
    await page.setViewportSize({ width: 1366, height: 900 });
    try {
      // Step 1 — the list, right after „Cetățenie" in „Liste de valori"; its eight countries in their order.
      await page.goto("/admin/value-lists?list=address-countries");
      const nav = page.getByRole("navigation", { name: "Liste de referință" });
      const group = nav.locator("[data-category]").filter({ has: page.getByRole("button", { name: "Cetățenie", exact: true }) });
      await expect(group.locator("button[data-list-key]")).toHaveText(["Indicative Tarla", "Cetățenie", "Țara adresei", "Relația cu firma"], { timeout: 30_000 });
      const panel = page.getByRole("region", { name: "Țara adresei", exact: true });
      await expect(panel.locator("tbody tr").first()).toBeVisible({ timeout: 30_000 });
      const names = await panel.locator("tbody tr td:first-child").allInnerTexts();
      expect(names.map((n) => n.trim()).slice(0, 8)).toEqual(EIGHT);

      // Step 2 — „Adaugă" a country: saved, and the notice names „Cetățenie"; it stays until „Închide".
      await panel.locator("[data-value-list-head]").getByRole("button", { name: "+ Adaugă", exact: true }).click();
      await panel.getByRole("textbox").first().fill(NEW);
      await panel.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(panel.getByText(NEW, { exact: true })).toBeVisible({ timeout: 30_000 });
      const notice = page.locator("[data-notice-text]");
      await expect(notice).toHaveText(NOTICE);
      await page.waitForTimeout(4500); // longer than a toast's 4 s: a notice stays
      await expect(notice).toBeVisible();
      await page.locator("[data-notice-close]").click();
      await expect(notice).toHaveCount(0);

      // Step 3 — „Șterge" it: the same notice.
      const row = panel.locator("tbody tr").filter({ hasText: NEW });
      await row.getByRole("button", { name: "Șterge", exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Șterge", exact: true }).click();
      await expect(panel.getByText(NEW, { exact: true })).toHaveCount(0, { timeout: 30_000 });
      await expect(notice).toHaveText(NOTICE);
    } finally {
      await removeMine(page.request);
    }
  });
});
